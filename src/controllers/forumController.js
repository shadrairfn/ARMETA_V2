import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import {
  reviews,
  users,
  reviewsForum,
  likeForums,
  bookmarkForums,
  subjects,
} from "../db/schema/schema.js";
import { eq, sql, and, gte, lte, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  generateAccessToken,
  generateRefreshToken,
} from "../service/tokenService.js";

import { successResponse, createdResponse } from "../utils/responseHandler.js";

import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  TokenError,
} from "../utils/customError.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import {
  generateEmbedding,
  generateQueryEmbedding,
} from "../service/vectorizationService.js";
import { createClient } from "@supabase/supabase-js";

import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const createForum = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;

  if (!userId) {
    throw new UnauthorizedError("Unauthorized - Please login");
  }

  const { title, description, id_subject, isAnonymous } = req.body;

  if (!title || !id_subject) {
    throw new BadRequestError("title dan id_subject wajib diisi");
  }

  if (title.length > 100) {
    throw new BadRequestError("Judul forum maksimal 100 karakter");
  }

  if (description && description.length > 1000) {
    throw new BadRequestError("Isi forum maksimal 1000 karakter");
  }

  // 2. Upload ke Supabase (Hanya jika ada file)
  const fileUploaded = req.files || []; // Pastikan ini array (dari multer)
  const fileLocalLinks = [];

  // Nama bucket Anda di Supabase (sesuaikan dengan yang dibuat di dashboard)
  const BUCKET_NAME = "armeta-files";

  for (const file of fileUploaded) {
    // 1. Buat nama file unik (misal: ulasan/timestamp-namafile)
    // .replace spasi dengan underscore agar URL aman
    const fileName = `ulasan/${Date.now()}-${file.originalname.replace(
      /\s/g,
      "_"
    )}`;

    // 2. Upload file buffer ke Supabase
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error("Supabase Upload Error:", error);
      throw new Error(`Gagal upload file: ${error.message}`);
    }

    // 3. Dapatkan Public URL setelah berhasil upload
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    fileLocalLinks.push(publicUrlData.publicUrl);
  }

  const filesJson = JSON.stringify(fileLocalLinks);

  const result = await db.execute(
    sql`INSERT INTO reviews_forum (id_user, id_subject, title, description, files, is_anonymous)
          VALUES (${userId}, ${id_subject}, ${title}, ${description}, ${filesJson}, ${isAnonymous ? true : false
      })
          RETURNING *`
  );

  return res.status(201).json({
    success: true,
    message: "Forum created successfully",
    data: result.rows[0],
  });
});

const searchForum = asyncHandler(async (req, res) => {
  const userId = req.user?.id_user;
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({
      message: "Silakan masukkan kata kunci pencarian.",
    });
  }

  const searchPattern = `%${q}%`;

  const searchResults = await db.execute(sql`
    SELECT 
      f.id_forum, 
      f.id_user, 
      f.id_subject, 
      f.title, 
      f.files, 
      f.description, 
      f.created_at, 
      f.updated_at,
      s.name as subject_name,
      u.name as user_name,
      u.image as user_image,
      (SELECT count(*)::int FROM like_forums l WHERE l.id_forum = f.id_forum) as total_like,
      (SELECT count(*)::int FROM bookmark_forums b WHERE b.id_forum = f.id_forum) as total_bookmark,
      (SELECT count(*)::int FROM reviews r WHERE r.id_forum = f.id_forum) as total_reply,
      EXISTS (SELECT 1 FROM like_forums l WHERE l.id_forum = f.id_forum AND l.id_user = ${userId}::uuid) as is_liked,
      EXISTS (SELECT 1 FROM bookmark_forums b WHERE b.id_forum = f.id_forum AND b.id_user = ${userId}::uuid) as is_bookmarked,
      f.is_anonymous
    FROM reviews_forum f
    LEFT JOIN users u ON f.id_user = u.id_user
    LEFT JOIN subjects s ON f.id_subject = s.id_subject
    WHERE f.title ILIKE ${searchPattern} OR f.description ILIKE ${searchPattern} OR s.name ILIKE ${searchPattern}
    ORDER BY f.created_at DESC
    LIMIT 20
  `);

  const mappedData = searchResults.rows.map((row) => ({
    id_forum: row.id_forum,
    id_user: row.id_user,
    id_subject: row.id_subject,
    subject_name: row.subject_name,
    title: row.title,
    files: row.files,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: row.is_anonymous
      ? {
        id_user: null,
        name: "Anonymous",
        image: null,
      }
      : {
        id_user: row.id_user,
        name: row.user_name,
        image: row.user_image,
      },
    total_like: row.total_like,
    total_bookmark: row.total_bookmark,
    total_reply: row.total_reply,
    is_liked: row.is_liked,
    is_bookmarked: row.is_bookmarked,
    is_anonymous: row.is_anonymous,
  }));

  res.status(200).json({
    success: true,
    data: mappedData,
    message: "Pencarian berhasil",
  });
});

const getAllForum = asyncHandler(async (req, res) => {
  // Fix: Gunakan null jika undefined agar SQL tidak error
  const userId = req.user?.id_user || null;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  // 1. Ambil Parameter
  const {
    search = "",
    from,
    to,
    filter,
    sortBy = "date",
    order = "desc",
    id_user,
    id_subject,
  } = req.query;

  // ---------------------------------------------------------
  // 2. BUILD WHERE CLAUSE
  // ---------------------------------------------------------
  let whereClause = sql`1=1`;

  // A. Logic Search (ILIKE) - UPDATE: Tambahkan Subject & User
  if (search && search.trim().length > 0) {
    const searchPattern = `%${search}%`;
    whereClause = sql`${whereClause} AND (
      f.title ILIKE ${searchPattern} OR 
      f.description ILIKE ${searchPattern} OR
      s.name ILIKE ${searchPattern} OR   -- Cari juga di nama Matkul
      u.name ILIKE ${searchPattern}      -- Cari juga di nama User
    )`;
  }

  // B. Filter Tanggal
  if (from && to) {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    whereClause = sql`${whereClause} AND f.created_at >= ${fromDate} AND f.created_at <= ${toDate}`;
  } else if (filter) {
    const now = new Date();
    let startDate = new Date();

    switch (filter) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    whereClause = sql`${whereClause} AND f.created_at >= ${startDate}`;
  }

  // C. Filter User
  if (id_user) {
    if (id_user === userId) {
      whereClause = sql`${whereClause} AND f.id_user = ${id_user}::uuid`;
    } else {
      whereClause = sql`${whereClause} AND f.id_user = ${id_user}::uuid AND f.is_anonymous = false`;
    }
  }

  // D. Filter Subject
  if (id_subject) {
    whereClause = sql`${whereClause} AND f.id_subject = ${id_subject}::uuid`;
  }

  // ---------------------------------------------------------
  // 3. BUILD ORDER BY CLAUSE
  // ---------------------------------------------------------
  const isAsc = order === "asc";
  const countLikes = sql`(SELECT count(*) FROM like_forums l WHERE l.id_forum = f.id_forum)`;
  const countBookmarks = sql`(SELECT count(*) FROM bookmark_forums b WHERE b.id_forum = f.id_forum)`;
  const countReplies = sql`(SELECT count(*) FROM reviews r WHERE r.id_forum = f.id_forum)`;

  let orderByClause;

  switch (sortBy) {
    case "most_like":
      orderByClause = isAsc ? sql`${countLikes} ASC` : sql`${countLikes} DESC`;
      break;
    case "most_bookmark":
      orderByClause = isAsc ? sql`${countBookmarks} ASC` : sql`${countBookmarks} DESC`;
      break;
    case "most_popular":
      orderByClause = isAsc
        ? sql`(${countLikes} + ${countBookmarks}) ASC`
        : sql`(${countLikes} + ${countBookmarks}) DESC`;
      break;
    case "most_reply":
      orderByClause = isAsc ? sql`${countReplies} ASC` : sql`${countReplies} DESC`;
      break;
    case "date":
    default:
      orderByClause = isAsc ? sql`f.created_at ASC` : sql`f.created_at DESC`;
      break;
  }

  // ---------------------------------------------------------
  // 4. EKSEKUSI QUERY
  // ---------------------------------------------------------

  const forumData = await db.execute(sql`
    SELECT 
      f.id_forum, 
      f.id_user, 
      f.id_subject, 
      f.title, 
      f.files, 
      f.description, 
      f.created_at, 
      f.updated_at,
      f.is_anonymous,
      
      s.name as subject_name,
      u.name as user_name,
      u.image as user_image,

      (SELECT count(*)::int FROM like_forums l WHERE l.id_forum = f.id_forum) as total_like,
      (SELECT count(*)::int FROM bookmark_forums b WHERE b.id_forum = f.id_forum) as total_bookmark,
      (SELECT count(*)::int FROM reviews r WHERE r.id_forum = f.id_forum) as total_reply,
      
      EXISTS (SELECT 1 FROM like_forums l WHERE l.id_forum = f.id_forum AND l.id_user = ${userId}::uuid) as is_liked,
      EXISTS (SELECT 1 FROM bookmark_forums b WHERE b.id_forum = f.id_forum AND b.id_user = ${userId}::uuid) as is_bookmarked
      
    FROM reviews_forum f
    LEFT JOIN users u ON f.id_user = u.id_user
    LEFT JOIN subjects s ON f.id_subject = s.id_subject
    WHERE ${whereClause}
    ORDER BY ${orderByClause}
    LIMIT ${limit} OFFSET ${offset}
  `);

  const rows = forumData.rows;

  const totalResult = await db.execute(sql`
    SELECT count(*)::int as count
    FROM reviews_forum f
    LEFT JOIN subjects s ON f.id_subject = s.id_subject -- Join subject juga di count agar filter konsisten
    LEFT JOIN users u ON f.id_user = u.id_user          -- Join user juga di count agar filter konsisten
    WHERE ${whereClause}
  `);

  const totalData = Number(totalResult.rows[0].count);
  const totalPage = Math.ceil(totalData / limit);

  // ---------------------------------------------------------
  // 5. MAPPING RESPONSE
  // ---------------------------------------------------------
  const mappedData = rows.map((row) => ({
    id_forum: row.id_forum,
    id_user: row.id_user,
    id_subject: row.id_subject,
    subject_name: row.subject_name,
    title: row.title,
    files: row.files,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: row.is_anonymous
      ? {
        id_user: null,
        name: "Anonymous",
        image: null,
      }
      : {
        id_user: row.id_user,
        name: row.user_name,
        image: row.user_image,
      },
    total_like: row.total_like,
    total_bookmark: row.total_bookmark,
    total_reply: row.total_reply,
    is_liked: row.is_liked,
    is_bookmarked: row.is_bookmarked,
    is_anonymous: row.is_anonymous,
  }));

  return res.status(200).json({
    success: true,
    message: search ? "Success search forum" : "Success get all forum",
    pagination: {
      currentPage: page,
      limit: limit,
      totalData: totalData,
      totalPage: totalPage,
      hasNextPage: page < totalPage,
    },
    data: mappedData,
  });
});

const getForumById = asyncHandler(async (req, res) => {
  const userId = req.user?.id_user;
  const { id_forum } = req.query;

  if (!id_forum) {
    throw new BadRequestError("id_forum wajib diisi");
  }

  const [forumResult, reviewsResult] = await Promise.all([
    // 1. Query Data Forum (dan pembuat forumnya)
    db.execute(sql`
      SELECT 
        f.id_forum, 
        f.id_user, 
        f.title, 
        f.description, 
        f.files, 
        f.created_at, 
        f.updated_at,
        u.id_user as "user.id_user",
        u.name as "user.name",
        u.image as "user.image",
        (SELECT count(*)::int FROM like_forums l WHERE l.id_forum = f.id_forum) as total_like,
        (SELECT count(*)::int FROM bookmark_forums b WHERE b.id_forum = f.id_forum) as total_bookmark,
        (SELECT count(*)::int FROM reviews r WHERE r.id_forum = f.id_forum) as total_reply,
        EXISTS (SELECT 1 FROM like_forums l WHERE l.id_forum = f.id_forum AND l.id_user = ${userId}::uuid) as is_liked,
        EXISTS (SELECT 1 FROM bookmark_forums b WHERE b.id_forum = f.id_forum AND b.id_user = ${userId}::uuid) as is_bookmarked,
        f.is_anonymous
      FROM reviews_forum f
      LEFT JOIN users u ON f.id_user = u.id_user
      WHERE f.id_forum = ${id_forum}::uuid
    `),

    // 2. Query User yang melakukan Ulasan di Forum tersebut
    db
      .select({
        id_review: reviews.id_review,
        title: reviews.title,
        body: reviews.body,
        files: reviews.files,
        created_at: reviews.created_at,
        // Info User Penulis Ulasan
        user: {
          id_user: users.id_user,
          name: users.name,
          image: users.image,
        },
        total_like:
          sql`(SELECT count(*)::int FROM like_reviews l WHERE l.id_review = ${reviews.id_review})`.as(
            "total_like"
          ),
        total_bookmark:
          sql`(SELECT count(*)::int FROM bookmark_reviews b WHERE b.id_review = ${reviews.id_review})`.as(
            "total_bookmark"
          ),
        total_reply:
          sql`(SELECT count(*)::int FROM reviews r2 WHERE r2.id_reply = ${reviews.id_review})`.as(
            "total_reply"
          ),
        is_liked:
          sql`EXISTS (SELECT 1 FROM like_reviews l WHERE l.id_review = ${reviews.id_review} AND l.id_user = ${userId}::uuid)`.as(
            "is_liked"
          ),
        is_bookmarked:
          sql`EXISTS (SELECT 1 FROM bookmark_reviews b WHERE b.id_review = ${reviews.id_review} AND b.id_user = ${userId}::uuid)`.as(
            "is_bookmarked"
          ),
        is_anonymous: reviews.is_anonymous,
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.id_user, users.id_user))
      .where(eq(reviews.id_forum, id_forum))
      .orderBy(desc(reviews.created_at)),
  ]);

  const forumRow = forumResult.rows[0];

  if (!forumRow) {
    throw new NotFoundError("Forum not found");
  }

  // Map result for forumRow to nested user object
  const forum = {
    id_forum: forumRow.id_forum,
    title: forumRow.title,
    description: forumRow.description,
    files: forumRow.files,
    created_at: forumRow.created_at,
    updated_at: forumRow.updated_at,
    user: {
      id_user: forumRow["user.id_user"],
      name: forumRow["user.name"],
      image: forumRow["user.image"],
    },
    total_like: forumRow.total_like,
    total_bookmark: forumRow.total_bookmark,
    total_reply: forumRow.total_reply,
    is_liked: forumRow.is_liked,
    is_bookmarked: forumRow.is_bookmarked,
    is_anonymous: forumRow.is_anonymous,
  };

  if (!forum) {
    throw new NotFoundError("Forum not found");
  }

  // Gabungkan hasil
  const responseData = {
    ...forum,
    user: forum.is_anonymous
      ? {
        id_user: null,
        name: "Anonymous",
        image: null,
      }
      : forum.user,
    reviews: reviewsResult.map((review) => ({
      ...review,
      user: review.is_anonymous
        ? {
          id_user: null,
          name: "Anonymous",
          image: null,
        }
        : review.user,
    })),
  };

  return res.status(200).json({
    success: true,
    data: responseData,
    message: "Success get forum by id",
  });
});

const getForumBySubject = asyncHandler(async (req, res) => {
  const userId = req.user?.id_user;
  const { id_subject } = req.body;

  if (!id_subject) {
    throw new BadRequestError("id_subject wajib diisi");
  }

  const forumsResult = await db.execute(sql`
    SELECT 
      f.id_forum, 
      f.id_user, 
      f.id_subject, 
      f.title, 
      f.files, 
      f.description, 
      f.created_at, 
      f.updated_at,
      s.name as subject_name,
      u.name as user_name,
      u.image as user_image,
      (SELECT count(*)::int FROM like_forums l WHERE l.id_forum = f.id_forum) as total_like,
      (SELECT count(*)::int FROM bookmark_forums b WHERE b.id_forum = f.id_forum) as total_bookmark,
      (SELECT count(*)::int FROM reviews r WHERE r.id_forum = f.id_forum) as total_reply,
      EXISTS (SELECT 1 FROM like_forums l WHERE l.id_forum = f.id_forum AND l.id_user = ${userId}::uuid) as is_liked,
      EXISTS (SELECT 1 FROM bookmark_forums b WHERE b.id_forum = f.id_forum AND b.id_user = ${userId}::uuid) as is_bookmarked,
      f.is_anonymous
    FROM reviews_forum f
    LEFT JOIN users u ON f.id_user = u.id_user
    LEFT JOIN subjects s ON f.id_subject = s.id_subject
    WHERE f.id_subject = ${id_subject}::uuid
  `);

  const forumRows = forumsResult.rows;

  if (forumRows.length === 0) {
    throw new NotFoundError("Forum not found");
  }

  const mappedData = forumRows.map((row) => ({
    id_forum: row.id_forum,
    id_user: row.id_user,
    id_subject: row.id_subject,
    subject_name: row.subject_name,
    title: row.title,
    files: row.files,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: row.is_anonymous
      ? {
        id_user: null,
        name: "Anonymous",
        image: null,
      }
      : {
        id_user: row.id_user,
        name: row.user_name,
        image: row.user_image,
      },
    total_like: row.total_like,
    total_bookmark: row.total_bookmark,
    total_reply: row.total_reply,
    is_liked: row.is_liked,
    is_bookmarked: row.is_bookmarked,
    is_anonymous: row.is_anonymous,
  }));

  return res.status(200).json({
    success: true,
    data: mappedData,
    message: "Success get all forums",
  });
});

const likeForum = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { id_forum } = req.body;

  if (!id_forum) {
    throw new BadRequestError("id_forum wajib diisi");
  }

  const existingLike = await db.execute(
    sql`SELECT * FROM like_forums
        WHERE id_user = ${userId} AND id_forum = ${id_forum}`
  );

  if (existingLike.rows.length >= 1) {
    throw new BadRequestError("User sudah like forum ini");
  }

  const result = await db.execute(
    sql`INSERT INTO like_forums (id_user, id_forum)
        VALUES (${userId}, ${id_forum})
        RETURNING *`
  );

  return res.status(200).json({
    data: result.rows[0],
    success: true,
    message: "Success like forum",
  });
});

const unlikeForum = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { id_forum } = req.body;

  if (!id_forum) {
    throw new BadRequestError("id_forum wajib diisi");
  }

  const existingLike = await db.execute(
    sql`SELECT * FROM like_forums
        WHERE id_user = ${userId} AND id_forum = ${id_forum}`
  );

  if (existingLike.rows.length == 0) {
    throw new BadRequestError("User belum like forum ini");
  }

  const result = await db.execute(
    sql`DELETE FROM like_forums
        WHERE id_user = ${userId} AND id_forum = ${id_forum}
        RETURNING *`
  );

  return res.status(200).json({
    data: result.rows[0],
    success: true,
    message: "Success unlike forum",
  });
});

const bookmarkForum = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { id_forum } = req.body;

  if (!id_forum) {
    throw new BadRequestError("id_forum wajib diisi");
  }

  const existingBookmark = await db.execute(
    sql`SELECT * FROM bookmark_forums
        WHERE id_user = ${userId} AND id_forum = ${id_forum}`
  );

  if (existingBookmark.rows.length >= 1) {
    throw new BadRequestError("User sudah bookmark forum ini");
  }

  const result = await db.execute(
    sql`INSERT INTO bookmark_forums (id_user, id_forum)
        VALUES (${userId}, ${id_forum})
        RETURNING *`
  );

  return res.status(200).json({
    data: result.rows[0],
    success: true,
    message: "Success bookmark forum",
  });
});

const unbookmarkForum = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { id_forum } = req.body;

  if (!id_forum) {
    throw new BadRequestError("id_forum wajib diisi");
  }

  const existingBookmark = await db.execute(
    sql`SELECT * FROM bookmark_forums
        WHERE id_user = ${userId} AND id_forum = ${id_forum}`
  );

  if (existingBookmark.rows.length == 0) {
    throw new BadRequestError("User belum bookmark forum ini");
  }

  const result = await db.execute(
    sql`DELETE FROM bookmark_forums
        WHERE id_user = ${userId} AND id_forum = ${id_forum}
        RETURNING *`
  );

  return res.status(200).json({
    data: result.rows[0],
    success: true,
    message: "Success unbookmark forum",
  });
});

const getLikeForum = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id_user;
  const targetUserId = req.query.id_user || currentUserId;

  if (!targetUserId) {
    throw new BadRequestError("id_user wajib diisi");
  }

  const likedForums = await db.execute(
    sql`
      SELECT 
        f.id_forum, 
        f.id_user, 
        f.id_subject, 
        f.title, 
        f.files, 
        f.description, 
        f.created_at, 
        f.updated_at,
        s.name as subject_name,
        u.name as user_name,
        u.image as user_image,
        (SELECT count(*)::int FROM like_forums l WHERE l.id_forum = f.id_forum) as total_like,
        (SELECT count(*)::int FROM bookmark_forums b WHERE b.id_forum = f.id_forum) as total_bookmark,
        (SELECT count(*)::int FROM reviews r WHERE r.id_forum = f.id_forum) as total_reply,
        EXISTS (SELECT 1 FROM like_forums l WHERE l.id_forum = f.id_forum AND l.id_user = ${currentUserId}::uuid) as is_liked,
        EXISTS (SELECT 1 FROM bookmark_forums b WHERE b.id_forum = f.id_forum AND b.id_user = ${currentUserId}::uuid) as is_bookmarked,
        f.is_anonymous
      FROM like_forums lf
      JOIN reviews_forum f ON lf.id_forum = f.id_forum
      LEFT JOIN users u ON f.id_user = u.id_user
      LEFT JOIN subjects s ON f.id_subject = s.id_subject
      WHERE lf.id_user = ${targetUserId} 
      ORDER BY f.created_at DESC
    `
  );

  const mappedData = likedForums.rows.map((row) => ({
    id_forum: row.id_forum,
    id_user: row.id_user,
    id_subject: row.id_subject,
    subject_name: row.subject_name,
    title: row.title,
    files: row.files,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: row.is_anonymous
      ? {
        id_user: null,
        name: "Anonymous",
        image: null,
      }
      : {
        id_user: row.id_user,
        name: row.user_name,
        image: row.user_image,
      },
    total_like: row.total_like,
    total_bookmark: row.total_bookmark,
    total_reply: row.total_reply,
    is_liked: row.is_liked,
    is_bookmarked: row.is_bookmarked,
    is_anonymous: row.is_anonymous,
  }));

  return res.status(200).json({
    data: mappedData,
    success: true,
    message: "Success get liked forums",
  });
});

const getBookmarkForum = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;

  if (!userId) {
    throw new BadRequestError("id_user wajib diisi");
  }

  const bookmarkedForums = await db.execute(
    sql`
      SELECT 
        f.id_forum, 
        f.id_user, 
        f.id_subject, 
        f.title, 
        f.files, 
        f.description, 
        f.created_at, 
        f.updated_at,
        s.name as subject_name,
        u.name as user_name,
        u.image as user_image,
        (SELECT count(*)::int FROM like_forums l WHERE l.id_forum = f.id_forum) as total_like,
        (SELECT count(*)::int FROM bookmark_forums b WHERE b.id_forum = f.id_forum) as total_bookmark,
        (SELECT count(*)::int FROM reviews r WHERE r.id_forum = f.id_forum) as total_reply,
        EXISTS (SELECT 1 FROM like_forums l WHERE l.id_forum = f.id_forum AND l.id_user = ${userId}::uuid) as is_liked,
        EXISTS (SELECT 1 FROM bookmark_forums b WHERE b.id_forum = f.id_forum AND b.id_user = ${userId}::uuid) as is_bookmarked,
        f.is_anonymous
      FROM bookmark_forums bf
      JOIN reviews_forum f ON bf.id_forum = f.id_forum
      LEFT JOIN users u ON f.id_user = u.id_user
      LEFT JOIN subjects s ON f.id_subject = s.id_subject
      WHERE bf.id_user = ${userId}
      ORDER BY f.created_at DESC
    `
  );

  const mappedData = bookmarkedForums.rows.map((row) => ({
    id_forum: row.id_forum,
    id_user: row.id_user,
    id_subject: row.id_subject,
    subject_name: row.subject_name,
    title: row.title,
    files: row.files,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: row.is_anonymous
      ? {
        id_user: null,
        name: "Anonymous",
        image: null,
      }
      : {
        id_user: row.id_user,
        name: row.user_name,
        image: row.user_image,
      },
    total_like: row.total_like,
    total_bookmark: row.total_bookmark,
    total_reply: row.total_reply,
    is_liked: row.is_liked,
    is_bookmarked: row.is_bookmarked,
    is_anonymous: row.is_anonymous,
  }));

  return res.status(200).json({
    data: mappedData,
    success: true,
    message: "Success get bookmarked forums",
  });
});

const searchSimilarForum = asyncHandler(async (req, res) => {
  const { query, limit = 5 } = req.body;

  if (!query || query.trim().length === 0) {
    throw new BadRequestError("Query text wajib diisi");
  }

  // Generate query embedding
  console.log("🔍 Generating query embedding for forum search...");
  const queryEmbedding = await generateQueryEmbedding(query);
  console.log("✅ Query embedding generated");

  // Search for similar forums using cosine similarity
  try {
    const vectorString = `[${queryEmbedding.join(",")}]`;
    // Use a CTE to pass the vector parameter once, avoiding issues with large parameters and some poolers
    const similarForums = await db.execute(
      sql`WITH query_vector AS (
        SELECT ${vectorString}::vector as q_vec
      )
      SELECT
        f.id_forum,
        f.id_user,
        f.id_subject,
        f.title,
        f.description,
        f.files,
        f.created_at,
        f.is_anonymous,
        (f.vectorize <=> qv.q_vec) as distance,
        (1 - (f.vectorize <=> qv.q_vec)) as similarity,
        s.name as subject_name,
        u.name as user_name,
        u.image as user_image,
        (SELECT count(*)::int FROM like_forums l WHERE l.id_forum = f.id_forum) as total_like,
        (SELECT count(*)::int FROM bookmark_forums b WHERE b.id_forum = f.id_forum) as total_bookmark,
        (SELECT count(*)::int FROM reviews r WHERE r.id_forum = f.id_forum) as total_reply
      FROM reviews_forum f
      CROSS JOIN query_vector qv
      LEFT JOIN users u ON f.id_user = u.id_user
      LEFT JOIN subjects s ON f.id_subject = s.id_subject
      WHERE f.vectorize IS NOT NULL
      ORDER BY f.vectorize <=> qv.q_vec
      LIMIT ${limit}`
    );

    const results = similarForums.rows.map((row) => ({
      ...row,
      user: row.is_anonymous
        ? {
          id_user: null,
          name: "Anonymous",
          image: null,
        }
        : {
          id_user: row.id_user,
          name: row.user_name,
          image: row.user_image,
        },
    }));

    return successResponse(res, 200, "Pencarian berhasil", {
      query,
      results,
      count: similarForums.rows.length,
    });
  } catch (error) {
    // Fallback to text search if vector search fails
    console.log(
      "Vector search failed, falling back to text search:",
      error.message
    );
    const searchPattern = `%${query}%`;

    const textSearchResults = await db.execute(
      sql`
        SELECT 
          f.id_forum,
          f.id_user,
          f.id_subject,
          f.title,
          f.description,
          f.files,
          f.created_at,
          f.is_anonymous,
          s.name as subject_name,
          u.name as user_name,
          u.image as user_image,
          (SELECT count(*)::int FROM like_forums l WHERE l.id_forum = f.id_forum) as total_like,
          (SELECT count(*)::int FROM bookmark_forums b WHERE b.id_forum = f.id_forum) as total_bookmark,
          (SELECT count(*)::int FROM reviews r WHERE r.id_forum = f.id_forum) as total_reply
        FROM reviews_forum f
        LEFT JOIN users u ON f.id_user = u.id_user
        LEFT JOIN subjects s ON f.id_subject = s.id_subject
        WHERE f.title ILIKE ${searchPattern} OR f.description ILIKE ${searchPattern} OR s.name ILIKE ${searchPattern}
        LIMIT ${limit}
      `
    );

    const results = textSearchResults.rows.map((row) => ({
      ...row,
      user: row.is_anonymous
        ? {
          id_user: null,
          name: "Anonymous",
          image: null,
        }
        : {
          id_user: row.id_user,
          name: row.user_name,
          image: row.user_image,
        },
    }));

    return successResponse(res, 200, "Pencarian berhasil (text search)", {
      query,
      results,
      count: textSearchResults.rows.length,
    });
  }
});

const editForum = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { id_forum, title, description, isAnonymous } = req.body;

  if (!id_forum) {
    throw new BadRequestError("id_forum wajib diisi");
  }

  const [oldForum] = await db
    .select()
    .from(reviewsForum)
    .where(eq(reviewsForum.id_forum, id_forum));

  if (!oldForum) {
    throw new NotFoundError("Forum tidak ditemukan");
  }

  // Ownership check
  if (oldForum.id_user !== userId) {
    throw new UnauthorizedError(
      "Anda tidak memiliki izin untuk mengubah forum ini"
    );
  }

  // Upload file bila ada
  const fileUploaded = req.files || [];
  const fileLocalLinks = [];
  const BUCKET_NAME = "armeta-files";

  if (fileUploaded.length > 0) {
    for (const file of fileUploaded) {
      const fileName = `ulasan/${Date.now()}-${file.originalname.replace(
        /\s/g,
        "_"
      )}`;
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        console.error("Supabase Upload Error:", error);
        throw new Error(`Gagal upload file: ${error.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

      fileLocalLinks.push(publicUrlData.publicUrl);
    }
  }

  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (fileLocalLinks.length > 0)
    updateData.files = JSON.stringify(fileLocalLinks);
  if (isAnonymous !== undefined)
    updateData.is_anonymous = isAnonymous === "true" || isAnonymous === true;

  updateData.updated_at = sql`NOW()`;

  const [updatedForum] = await db
    .update(reviewsForum)
    .set(updateData)
    .where(eq(reviewsForum.id_forum, id_forum))
    .returning();

  return res.status(200).json({
    data: updatedForum,
    success: true,
    message: "Success update forum",
  });
});

const deleteForum = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { id_forum } = req.body;

  if (!id_forum) {
    throw new BadRequestError("id_forum wajib diisi");
  }

  const [forum] = await db
    .select()
    .from(reviewsForum)
    .where(eq(reviewsForum.id_forum, id_forum));

  if (!forum) {
    throw new NotFoundError("Forum tidak ditemukan");
  }

  // Ownership check
  if (forum.id_user !== userId) {
    throw new UnauthorizedError(
      "Anda tidak memiliki izin untuk menghapus forum ini"
    );
  }

  await db.delete(reviewsForum).where(eq(reviewsForum.id_forum, id_forum));

  return res.status(200).json({
    success: true,
    message: "Success delete forum",
  });
});

export {
  createForum,
  editForum,
  deleteForum,
  getForumBySubject,
  searchForum,
  getAllForum,
  getForumById,
  likeForum,
  unlikeForum,
  bookmarkForum,
  unbookmarkForum,
  getLikeForum,
  getBookmarkForum,
  searchSimilarForum,
};
