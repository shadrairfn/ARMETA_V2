import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import {
  reviews,
  users,
  likeReviews,
  bookmarkReviews,
  subjects,
  lecturers,
  reviewsForum,
} from "../db/schema/schema.js";
import { eq, sql, and, count, desc, gte, lte, asc, isNull } from "drizzle-orm";
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
import { generateEmbedding, generateQueryEmbedding } from "../service/vectorizationService.js";
import { createClient } from '@supabase/supabase-js';

import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const createUlasan = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;

  let { idMatkul, idDosen, idReply, idForum, judulUlasan, textUlasan, isAnonymous } =
    req.body;

  // Validasi Input
  if (
    (!idMatkul || !idDosen || !idForum ||
      idReply) &&
    !textUlasan &&
    !judulUlasan
  ) {
    throw new BadRequestError(
      "id_matkul atau id_dosen, dan textUlasan wajib diisi"
    );
  }

  if (judulUlasan && judulUlasan.length > 100) {
    throw new BadRequestError("Judul ulasan maksimal 100 karakter");
  }

  if (textUlasan && textUlasan.length > 1000) {
    throw new BadRequestError("Isi ulasan maksimal 1000 karakter");
  }

  // --- BAGIAN UPLOAD SUPABASE (MENGGANTIKAN FIREBASE) ---
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
  // --- AKHIR BAGIAN UPLOAD SUPABASE ---

  console.log("🔄 Generating embedding for ulasan text...");
  // Asumsi fungsi generateEmbedding tetap sama
  const embeddingVector = await generateEmbedding(textUlasan);

  console.log(
    "✅ Embedding generated successfully, dimension:",
    embeddingVector.length
  );

  const vectorString = `[${embeddingVector.join(",")}]`;
  console.log(`VECTORIZE DATA TYPE: ${typeof vectorString}`);
  // console.log(`VECTORIZE DATA: ${vectorString}`); // Commented out to reduce noise

  const filesJson = JSON.stringify(fileLocalLinks);

  // Normalisasi data kosong menjadi null
  if (!idMatkul || idMatkul == "") idMatkul = null;
  if (!idDosen || idDosen == "") idDosen = null;
  if (!idReply || idReply == "") idReply = null;
  if (!idForum || idForum == "") idForum = null;

  console.log("Debug insert values:", {
    userId,
    id_matkul: idMatkul,
    id_dosen: idDosen,
    id_ulasan_reply: idReply,
    id_forum: idForum,
    textUlasan: textUlasan ? textUlasan.substring(0, 50) : "",
    judulUlasan: judulUlasan ? judulUlasan.substring(0, 50) : "",
    files_count: fileLocalLinks.length,
    vectorLength: vectorString.length,
    isAnonymous: !!isAnonymous
  });

  // Eksekusi Query Database
  // Using explicit NULL handling for UUID columns to avoid empty string issues
  const result = await db.execute(
    sql`INSERT INTO reviews (id_user, id_subject, id_lecturer, id_reply, id_forum, title, body, files, vectorize, is_anonymous)
        VALUES (
          ${userId}, 
          ${idMatkul ? idMatkul : sql`NULL`}::uuid, 
          ${idDosen ? idDosen : sql`NULL`}::uuid, 
          ${idReply ? idReply : sql`NULL`}::uuid, 
          ${idForum ? idForum : sql`NULL`}::uuid, 
          ${judulUlasan}, 
          ${textUlasan}, 
          ${filesJson}::jsonb, 
          ${vectorString}::vector,
          ${isAnonymous ? true : false}
        )
        RETURNING *`
  );

  const newUlasan = result.rows[0];

  return res.status(200).json({
    data: newUlasan,
    success: true,
    message: "Success create ulasan", // Typo fix: "get all" -> "create"
  });
});

const editUlasan = asyncHandler(async (req, res) => {
  // To be implemented
  const userId = req.user.id_user;
  let { id_review, title, body } = req.body;

  const [oldReview] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id_user, userId), eq(reviews.id_review, id_review)));

  if (id_review != oldReview.id_review) {
    throw new BadRequestError("id_review tidak sama");
  }

  console.log(`BODY BEFORE: ${body}`);

  if (!oldReview) throw new NotFoundError("Review tidak ditemukan");

  // Upload file bila ada
  let profileUrl = oldReview.files;
  console.log("Profil URL: ", profileUrl);
  console.log("Profil URL tipe: ", typeof profileUrl);
  console.log("File lama: ", oldReview.files);
  console.log("File lama tipe: ", typeof oldReview.files);
  console.log("File sekarang: ", req.files);

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

  let vectorString = oldReview.vectorize;
  console.log("VECTORIZE DATA TYPE ONE:", typeof vectorString);

  if (body) {
    if (body.length > 1000) {
      throw new BadRequestError("Isi ulasan maksimal 1000 karakter");
    }
    const embeddingVector = await generateEmbedding(body);

    if (!Array.isArray(embeddingVector)) {
      throw new Error("generateEmbedding did not return an array.");
    }

    console.log(
      "✅ Embedding generated successfully, dimension:",
      embeddingVector.length
    );

    vectorString = embeddingVector;
    console.log("VECTORIZE DATA TYPE TWO:", typeof vectorString);
  }
  if (!title || title === "") {
    title = oldReview.title;
  } else if (title.length > 100) {
    throw new BadRequestError("Judul ulasan maksimal 100 karakter");
  }

  if (!body || body === "") {
    body = oldReview.body;
  }

  console.log(`BODY AFTER: ${body}`);

  const updateData = {};

  if (title) updateData.title = title;
  if (body) updateData.body = body;
  if (profileUrl) updateData.files = fileLocalLinks;
  if (vectorString) updateData.vectorize = vectorString;

  updateData.updated_at = sql`NOW()`;

  console.log("UPDATE DATA TYPE:", typeof updateData.vectorize);
  console.log("UPDATE DATA:", updateData);

  const [updatedUlasan] = await db
    .update(reviews)
    .set(updateData)
    .where(eq(reviews.id_review, id_review))
    .returning();

  return res.status(200).json({
    data: updatedUlasan,
    status: true,
    message: "Success update ulasan",
  });
});

const getAllUlasan = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  // Filter & Sort Params
  const { from, to, sortBy = "date", order = "desc", id_user } = req.query;

  // 1. Base WHERE conditions (Filter out replies and forum content by default)
  const whereConditions = [];
  if (!id_user) {
    whereConditions.push(isNull(reviews.id_reply));
    whereConditions.push(isNull(reviews.id_forum));
  }

  // 2. Add Date Filtering if provided
  if (from && to) {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    whereConditions.push(gte(reviews.created_at, fromDate));
    whereConditions.push(lte(reviews.created_at, toDate));
  }

  // 3. Add User Filtering if provided
  if (id_user) {
    if (id_user === userId) {
      whereConditions.push(eq(reviews.id_user, id_user));
    } else {
      whereConditions.push(and(eq(reviews.id_user, id_user), eq(reviews.is_anonymous, false)));
    }
  }

  // 3. Prepare Sort Logic
  const countLikes = sql`count(distinct ${likeReviews.id_like})`;
  const countBookmarks = sql`count(distinct ${bookmarkReviews.id_bookmark})`;
  const countPopularity = sql`(${countLikes} + ${countBookmarks})`;

  let orderByClause;
  const isAsc = order === "asc";

  switch (sortBy) {
    case "most_like":
      orderByClause = isAsc ? asc(countLikes) : desc(countLikes);
      break;
    case "most_bookmark":
      orderByClause = isAsc ? asc(countBookmarks) : desc(countBookmarks);
      break;
    case "most_popular":
      orderByClause = isAsc ? asc(countPopularity) : desc(countPopularity);
      break;
    case "most_reply":
      const countReplies = sql`(SELECT count(*)::int FROM reviews r WHERE r.id_reply = ${reviews.id_review})`;
      orderByClause = isAsc ? asc(countReplies) : desc(countReplies);
      break;
    case "date":
    default:
      orderByClause = isAsc
        ? asc(reviews.created_at)
        : desc(reviews.created_at);
      break;
  }

  // 4. Data Query
  // Note: Using Drizzle query builder for cleaner dynamic filtering/sorting
  // tailored to the structure used in sortUlasan but adapted for pagination & joins
  const dataUlasan = await db
    .select({
      id_review: reviews.id_review,
      id_user: reviews.id_user,
      id_forum: reviews.id_forum,
      id_reply: reviews.id_reply,
      title: reviews.title,
      body: reviews.body,
      files: reviews.files,
      created_at: reviews.created_at,
      updated_at: reviews.updated_at,

      lecturer_name: sql`COALESCE(${lecturers.name}, '')`,
      subject_name: sql`COALESCE(${subjects.name}, '')`,
      semester: subjects.semester,

      user_name: users.name,
      user_image: users.image,
      user_email: users.email,

      total_likes: sql`${countLikes}`.mapWith(Number),
      total_bookmarks: sql`${countBookmarks}`.mapWith(Number),
      total_reply: sql`(SELECT count(*)::int FROM reviews r WHERE r.id_reply = ${reviews.id_review})`.as('total_reply'),
      is_liked: sql`count(case when ${likeReviews.id_user} = ${userId} then 1 end) > 0`.mapWith(Boolean),
      is_bookmarked: sql`count(case when ${bookmarkReviews.id_user} = ${userId} then 1 end) > 0`.mapWith(Boolean),
      is_anonymous: reviews.is_anonymous,
      parent_user_name: sql`(
        CASE 
          WHEN ${reviews.id_reply} IS NOT NULL THEN (
            SELECT u.name FROM reviews r JOIN users u ON r.id_user = u.id_user WHERE r.id_review = ${reviews.id_reply}
          )
          WHEN ${reviews.id_forum} IS NOT NULL THEN (
            SELECT u.name FROM reviews_forum f JOIN users u ON f.id_user = u.id_user WHERE f.id_forum = ${reviews.id_forum}
          )
          ELSE NULL
        END
      )`.as('parent_user_name'),
    })
    .from(reviews)
    .leftJoin(lecturers, eq(reviews.id_lecturer, lecturers.id_lecturer))
    .leftJoin(subjects, eq(reviews.id_subject, subjects.id_subject))
    .leftJoin(users, eq(reviews.id_user, users.id_user))
    .leftJoin(likeReviews, eq(reviews.id_review, likeReviews.id_review))
    .leftJoin(bookmarkReviews, eq(reviews.id_review, bookmarkReviews.id_review))
    .where(and(...whereConditions))
    .groupBy(
      reviews.id_review,
      lecturers.name,
      subjects.name,
      subjects.semester,
      users.id_user,
      users.name,
      users.image,
      users.email
    )
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  if (dataUlasan.length === 0 && page === 1) {
    // It's acceptable to return empty list if filtering yields no results, 
    // but if strictly following previous behavior:
    // throw new NotFoundError("Ulasan tidak ditemukan");
  }

  // 5. Total Data Query (for pagination)
  // We must apply the same filters to the count
  const totalResult = await db
    .select({ value: count() })
    .from(reviews)
    .where(and(...whereConditions));

  const totalData = totalResult[0].value;
  const totalPage = Math.ceil(totalData / limit);

  const mappedData = dataUlasan.map((row) => ({
    id_review: row.id_review,
    id_user: row.id_user,
    id_forum: row.id_forum,
    id_reply: row.id_reply,
    parent_user_name: row.parent_user_name,
    title: row.title,
    body: row.body,
    files: row.files,
    created_at: row.created_at,
    updated_at: row.updated_at,
    lecturer_name: row.lecturer_name,
    subject_name: row.subject_name,
    semester: row.semester,
    user: row.is_anonymous ? {
      id_user: null,
      name: "Anonymous",
      image: null,
      email: null,
    } : {
      id_user: row.id_user,
      name: row.user_name,
      image: row.user_image,
      email: row.user_email,
    },
    total_likes: row.total_likes,
    total_bookmarks: row.total_bookmarks,
    total_reply: row.total_reply,
    is_liked: row.is_liked,
    is_bookmarked: row.is_bookmarked,
    is_anonymous: row.is_anonymous,
  }));

  return res.status(200).json({
    status: true,
    message: "Success get ulasan",
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

const getUlasanById = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { id_review } = req.query;

  if (!id_review) {
    throw new BadRequestError("id_review wajib diisi");
  }

  // Alias untuk user yang membalas (replier)
  const replier = alias(users, "replier");

  const [reviewResult, repliesResult] = await Promise.all([
    // --- 1. QUERY UTAMA (Review Induk) ---
    db
      .select({
        id_review: reviews.id_review,
        title: reviews.title,
        body: reviews.body,
        files: reviews.files,
        created_at: reviews.created_at,
        updated_at: reviews.updated_at,
        user: {
          id_user: users.id_user,
          name: users.name,
          email: users.email,
          image: users.image, // Sesuaikan dengan field di schema (berdasarkan JSON output Anda: 'image')
        },
        total_likes: sql`count(distinct ${likeReviews.id_like})`.mapWith(Number),
        total_bookmarks: sql`count(distinct ${bookmarkReviews.id_bookmark})`.mapWith(Number),
        total_reply: sql`(SELECT count(*)::int FROM reviews r WHERE r.id_reply = ${reviews.id_review})`.as('total_reply'),
        is_liked: sql`count(case when ${likeReviews.id_user} = ${userId} then 1 end) > 0`.mapWith(Boolean),
        is_bookmarked: sql`count(case when ${bookmarkReviews.id_user} = ${userId} then 1 end) > 0`.mapWith(Boolean),
        id_reply: reviews.id_reply,
        id_forum: reviews.id_forum,
        is_anonymous: reviews.is_anonymous,
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.id_user, users.id_user))
      .leftJoin(likeReviews, eq(reviews.id_review, likeReviews.id_review))
      .leftJoin(bookmarkReviews, eq(reviews.id_review, bookmarkReviews.id_review))
      .where(eq(reviews.id_review, id_review))
      .groupBy(reviews.id_review, users.id_user),

    // --- 2. QUERY BALASAN (Replies) dengan Stats ---
    db
      .select({
        id_review: reviews.id_review,
        body: reviews.body,
        files: reviews.files,
        created_at: reviews.created_at,
        user: {
          id_user: replier.id_user,
          name: replier.name,
          image: replier.image,
        },
        // Tambahkan hitungan like & bookmark di sini
        total_likes: sql`count(distinct ${likeReviews.id_like})`.mapWith(Number),
        total_bookmarks: sql`count(distinct ${bookmarkReviews.id_bookmark})`.mapWith(Number),
        total_reply: sql`(SELECT count(*)::int FROM reviews r WHERE r.id_reply = ${reviews.id_review})`.as('total_reply'),
        is_liked: sql`count(case when ${likeReviews.id_user} = ${userId} then 1 end) > 0`.mapWith(Boolean),
        is_bookmarked: sql`count(case when ${bookmarkReviews.id_user} = ${userId} then 1 end) > 0`.mapWith(Boolean),
      })
      .from(reviews)
      .leftJoin(replier, eq(reviews.id_user, replier.id_user))
      // Join tabel like & bookmark khusus untuk query replies ini
      .leftJoin(likeReviews, eq(reviews.id_review, likeReviews.id_review))
      .leftJoin(bookmarkReviews, eq(reviews.id_review, bookmarkReviews.id_review))
      .where(eq(reviews.id_reply, id_review))
      // Grouping wajib dilakukan agar count berfungsi per balasan
      .groupBy(reviews.id_review, replier.id_user, replier.name, replier.image)
      .orderBy(desc(reviews.created_at))
  ]);

  const ulasan = reviewResult[0];

  if (!ulasan) {
    throw new NotFoundError("Ulasan tidak ditemukan");
  }

  // --- 3. QUERY PARENT CONTEXT (Review asal / Forum asal) ---
  let parentSource = null;
  if (ulasan.id_reply) {
    const [parentReview] = await db
      .select({
        id: reviews.id_review,
        title: reviews.title,
        body: reviews.body,
        created_at: reviews.created_at,
        user: {
          id_user: users.id_user,
          name: users.name,
          image: users.image,
        },
        is_anonymous: reviews.is_anonymous,
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.id_user, users.id_user))
      .where(eq(reviews.id_review, ulasan.id_reply));

    if (parentReview) {
      parentSource = {
        type: 'review',
        ...parentReview,
        user: parentReview.is_anonymous ? {
          id_user: null,
          name: "Anonymous",
          image: null,
        } : parentReview.user
      };
    }
  } else if (ulasan.id_forum) {
    const [parentForum] = await db
      .select({
        id: reviewsForum.id_forum,
        title: reviewsForum.title,
        body: reviewsForum.description,
        created_at: reviewsForum.created_at,
        user: {
          id_user: users.id_user,
          name: users.name,
          image: users.image,
        },
        is_anonymous: reviewsForum.is_anonymous,
      })
      .from(reviewsForum)
      .leftJoin(users, eq(reviewsForum.id_user, users.id_user))
      .where(eq(reviewsForum.id_forum, ulasan.id_forum));

    if (parentForum) {
      parentSource = {
        type: 'forum',
        ...parentForum,
        user: parentForum.is_anonymous ? {
          id_user: null,
          name: "Anonymous",
          image: null,
        } : parentForum.user
      };
    }
  }

  // Gabungkan hasil
  const responseData = {
    ...ulasan,
    user: ulasan.is_anonymous ? {
      id_user: null,
      name: "Anonymous",
      image: null,
      email: null,
    } : ulasan.user,
    replies: repliesResult.map(reply => ({
      ...reply,
      user: reply.is_anonymous ? {
        id_user: null,
        name: "Anonymous",
        image: null,
      } : reply.user
    })),
    parent_source: parentSource,
  };

  return res.status(200).json({
    success: true,
    message: "Success get ulasan by id",
    data: responseData,
  });
});

const likeUlasan = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { id_review } = req.body;

  if (!id_review) {
    throw new BadRequestError("id_review wajib diisi");
  }

  const existingLike = await db.execute(
    sql`SELECT * FROM like_reviews
        WHERE id_user = ${userId} AND id_review = ${id_review}`
  );

  if (existingLike.rows.length >= 1) {
    throw new BadRequestError("User sudah like ulasan ini");
  }

  const result = await db.execute(
    sql`INSERT INTO like_reviews (id_user, id_review)
        VALUES (${userId}, ${id_review})
        RETURNING *`
  );

  return res.status(200).json({
    data: result.rows[0],
    status: true,
    message: "Success like ulasan",
  });
});

const bookmarkUlasan = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { id_review } = req.body;

  if (!id_review) {
    throw new BadRequestError("id_review wajib diisi");
  }

  const existingBokmark = await db.execute(
    sql`SELECT * FROM bookmark_reviews
        WHERE id_user = ${userId} AND id_review = ${id_review}`
  );

  if (existingBokmark.rows.length >= 1) {
    throw new BadRequestError("User sudah bookmark ulasan ini");
  }

  const result = await db.execute(
    sql`INSERT INTO bookmark_reviews (id_user, id_review)
        VALUES (${userId}, ${id_review})
        RETURNING *`
  );

  return res.status(200).json({
    data: result.rows[0],
    status: true,
    message: "Success repost ulasan",
  });
});

const unLikeUlasan = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { id_review } = req.body;

  if (!id_review) {
    throw new BadRequestError("id_review wajib diisi");
  }

  const existingLike = await db.execute(
    sql`SELECT * FROM like_reviews
        WHERE id_user = ${userId} AND id_review = ${id_review}`
  );

  if (existingLike.rows.length == 0) {
    throw new BadRequestError("User belum like ulasan ini");
  }

  const result = await db.execute(
    sql`DELETE FROM like_reviews
        WHERE id_user = ${userId} AND id_review = ${id_review}
        RETURNING *`
  );

  return res.status(200).json({
    data: result.rows[0],
    status: true,
    message: "Success unlike ulasan",
  });
});

const unBookmarkUlasan = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { id_review } = req.body;

  if (!id_review) {
    throw new BadRequestError("id_review wajib diisi");
  }

  const existingBokmark = await db.execute(
    sql`SELECT * FROM bookmark_reviews
        WHERE id_user = ${userId} AND id_review = ${id_review}`
  );

  if (existingBokmark.rows.length == 0) {
    throw new BadRequestError("User belum bookmark ulasan ini");
  }

  const result = await db.execute(
    sql`DELETE FROM bookmark_reviews
        WHERE id_user = ${userId} AND id_review = ${id_review}
        RETURNING *`
  );

  return res.status(200).json({
    data: result.rows[0],
    status: true,
    message: "Success unlike ulasan",
  });
});

const getLikeUlasan = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id_user;
  const targetUserId = req.query.id_user || currentUserId;

  if (!targetUserId) {
    throw new BadRequestError("id_user wajib diisi");
  }

  const allLikes = alias(likeReviews, "all_likes");
  const allBookmarks = alias(bookmarkReviews, "all_bookmarks");

  const dataUlasan = await db
    .select({
      id_review: reviews.id_review,
      id_user: reviews.id_user,
      id_forum: reviews.id_forum,
      title: reviews.title,
      body: reviews.body,
      files: reviews.files,
      created_at: reviews.created_at,
      updated_at: reviews.updated_at,

      lecturer_name: sql`COALESCE(${lecturers.name}, '')`,
      subject_name: sql`COALESCE(${subjects.name}, '')`,
      semester: subjects.semester,

      user_name: users.name,
      user_image: users.image,
      user_email: users.email,

      total_likes: sql`count(distinct ${allLikes.id_like})`.mapWith(Number),
      total_bookmarks: sql`count(distinct ${allBookmarks.id_bookmark})`.mapWith(Number),
      total_reply: sql`(SELECT count(*)::int FROM reviews r WHERE r.id_reply = ${reviews.id_review})`.as('total_reply'),
      is_liked: sql`count(case when ${allLikes.id_user} = ${currentUserId} then 1 end) > 0`.mapWith(Boolean),
      is_bookmarked: sql`count(case when ${allBookmarks.id_user} = ${currentUserId} then 1 end) > 0`.mapWith(Boolean),
      is_anonymous: reviews.is_anonymous,
    })
    .from(likeReviews)
    .innerJoin(reviews, eq(likeReviews.id_review, reviews.id_review))
    .leftJoin(lecturers, eq(reviews.id_lecturer, lecturers.id_lecturer))
    .leftJoin(subjects, eq(reviews.id_subject, subjects.id_subject))
    .leftJoin(users, eq(reviews.id_user, users.id_user))
    .leftJoin(allLikes, eq(reviews.id_review, allLikes.id_review))
    .leftJoin(allBookmarks, eq(reviews.id_review, allBookmarks.id_review))
    .where(eq(likeReviews.id_user, targetUserId))
    .groupBy(
      reviews.id_review,
      lecturers.name,
      subjects.name,
      subjects.semester,
      users.id_user,
      users.name,
      users.image,
      users.email
    )
    .orderBy(desc(reviews.created_at));

  const mappedData = dataUlasan.map((row) => ({
    ...row,
    user: row.is_anonymous ? {
      id_user: null,
      name: "Anonymous",
      image: null,
      email: null,
    } : {
      id_user: row.id_user,
      name: row.user_name,
      image: row.user_image,
      email: row.user_email,
    },
  }));

  return res.status(200).json({
    data: mappedData,
    status: true,
    message: "Success get liked ulasan",
  });
});

const getBookmarkUlasan = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;

  if (!userId) {
    throw new BadRequestError("id_user wajib diisi");
  }

  const allLikes = alias(likeReviews, "all_likes");
  const allBookmarks = alias(bookmarkReviews, "all_bookmarks");

  const dataUlasan = await db
    .select({
      id_review: reviews.id_review,
      id_user: reviews.id_user,
      id_forum: reviews.id_forum,
      title: reviews.title,
      body: reviews.body,
      files: reviews.files,
      created_at: reviews.created_at,
      updated_at: reviews.updated_at,

      lecturer_name: sql`COALESCE(${lecturers.name}, '')`,
      subject_name: sql`COALESCE(${subjects.name}, '')`,
      semester: subjects.semester,

      user_name: users.name,
      user_image: users.image,
      user_email: users.email,

      total_likes: sql`count(distinct ${allLikes.id_like})`.mapWith(Number),
      total_bookmarks: sql`count(distinct ${allBookmarks.id_bookmark})`.mapWith(Number),
      total_reply: sql`(SELECT count(*)::int FROM reviews r WHERE r.id_reply = ${reviews.id_review})`.as('total_reply'),
      is_liked: sql`count(case when ${allLikes.id_user} = ${userId} then 1 end) > 0`.mapWith(Boolean),
      is_bookmarked: sql`count(case when ${allBookmarks.id_user} = ${userId} then 1 end) > 0`.mapWith(Boolean),
      is_anonymous: reviews.is_anonymous,
    })
    .from(bookmarkReviews)
    .innerJoin(reviews, eq(bookmarkReviews.id_review, reviews.id_review))
    .leftJoin(lecturers, eq(reviews.id_lecturer, lecturers.id_lecturer))
    .leftJoin(subjects, eq(reviews.id_subject, subjects.id_subject))
    .leftJoin(users, eq(reviews.id_user, users.id_user))
    .leftJoin(allLikes, eq(reviews.id_review, allLikes.id_review))
    .leftJoin(allBookmarks, eq(reviews.id_review, allBookmarks.id_review))
    .where(eq(bookmarkReviews.id_user, userId))
    .groupBy(
      reviews.id_review,
      lecturers.name,
      subjects.name,
      subjects.semester,
      users.id_user,
      users.name,
      users.image,
      users.email
    )
    .orderBy(desc(reviews.created_at));

  const mappedData = dataUlasan.map((row) => ({
    ...row,
    user: row.is_anonymous ? {
      id_user: null,
      name: "Anonymous",
      image: null,
      email: null,
    } : {
      id_user: row.id_user,
      name: row.user_name,
      image: row.user_image,
      email: row.user_email,
    },
  }));

  return res.status(200).json({
    data: mappedData,
    status: true,
    message: "Success get bookmarked ulasan",
  });
});

const searchSimilarUlasan = asyncHandler(async (req, res) => {
  const { query, limit = 5 } = req.body;

  if (!query || query.trim().length === 0) {
    throw new BadRequestError("Query text wajib diisi");
  }

  // Generate query embedding
  console.log("🔍 Generating query embedding...");
  const queryEmbedding = await generateQueryEmbedding(query);
  console.log("✅ Query embedding generated");

  // Search for similar ulasan using cosine similarity
  // Using raw SQL for pgvector similarity search
  try {
    const vectorString = `[${queryEmbedding.join(",")}]`;
    const similarUlasan = await db.execute(
      sql`WITH query_vector AS (
        SELECT ${vectorString}::vector as q_vec
      )
      SELECT
        u.id_review,
        u.id_user,
        u.id_subject,
        u.id_lecturer,
        u.title,
        u.body,
        u.files,
        u.created_at,
        u.is_anonymous,
        (u.vectorize <=> qv.q_vec) as distance,
        (1 - (u.vectorize <=> qv.q_vec)) as similarity,
        s.name as subject_name,
        l.name as lecturer_name,
        usr.name as user_name,
        usr.image as user_image,
        (SELECT count(*)::int FROM like_reviews lr WHERE lr.id_review = u.id_review) as total_likes,
        (SELECT count(*)::int FROM bookmark_reviews br WHERE br.id_review = u.id_review) as total_bookmarks,
        (SELECT count(*)::int FROM reviews r2 WHERE r2.id_reply = u.id_review) as total_reply
      FROM reviews u
      CROSS JOIN query_vector qv
      LEFT JOIN subjects s ON u.id_subject = s.id_subject
      LEFT JOIN lecturers l ON u.id_lecturer = l.id_lecturer
      LEFT JOIN users usr ON u.id_user = usr.id_user
      ORDER BY u.vectorize <=> qv.q_vec
      LIMIT ${limit}`
    );

    return successResponse(res, 200, "Pencarian berhasil", {
      query,
      results: similarUlasan.rows.map(row => ({
        ...row,
        user: row.is_anonymous ? {
          id_user: null,
          name: "Anonymous",
          image: null,
        } : {
          id_user: row.id_user,
          name: row.user_name,
          image: row.user_image,
        }
      })),
      count: similarUlasan.rows.length,
    });
  } catch (error) {
    console.error("Vector search failed:", error);
    // Fallback to text search
    const searchPattern = `%${query}%`;
    const dataUlasan = await db
      .select({
        id_review: reviews.id_review,
        id_user: reviews.id_user,
        title: reviews.title,
        body: reviews.body,
        files: reviews.files,
        created_at: reviews.created_at,
        user_name: users.name,
        user_image: users.image,
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.id_user, users.id_user))
      .where(
        and(
          isNull(reviews.id_reply),
          sql`(${reviews.title} ILIKE ${searchPattern} OR ${reviews.body} ILIKE ${searchPattern})`
        )
      )
      .limit(limit);

    return successResponse(res, 200, "Pencarian berhasil (fallback)", {
      query,
      results: dataUlasan.map(row => ({
        ...row,
        user: {
          id_user: row.id_user,
          name: row.user_name,
          image: row.user_image,
        }
      })),
      count: dataUlasan.length,
    });
  }
});

const searchUlasan = asyncHandler(async (req, res) => {
  const userId = req.user?.id_user;
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({
      message: "Silakan masukkan kata kunci pencarian.",
    });
  }

  const searchPattern = `%${q}%`;

  // Note: Standardizing with getAllUlasan data structure
  const countLikes = sql`count(distinct ${likeReviews.id_like})`;
  const countBookmarks = sql`count(distinct ${bookmarkReviews.id_bookmark})`;

  const dataUlasan = await db
    .select({
      id_review: reviews.id_review,
      id_user: reviews.id_user,
      id_forum: reviews.id_forum,
      title: reviews.title,
      body: reviews.body,
      files: reviews.files,
      created_at: reviews.created_at,
      updated_at: reviews.updated_at,

      lecturer_name: sql`COALESCE(${lecturers.name}, '')`,
      subject_name: sql`COALESCE(${subjects.name}, '')`,
      semester: subjects.semester,

      user_name: users.name,
      user_image: users.image,
      user_email: users.email,

      total_likes: sql`${countLikes}`.mapWith(Number),
      total_bookmarks: sql`${countBookmarks}`.mapWith(Number),
      total_reply: sql`(SELECT count(*)::int FROM reviews r WHERE r.id_reply = ${reviews.id_review})`.as('total_reply'),
      is_liked: sql`count(case when ${likeReviews.id_user} = ${userId} then 1 end) > 0`.mapWith(Boolean),
      is_bookmarked: sql`count(case when ${bookmarkReviews.id_user} = ${userId} then 1 end) > 0`.mapWith(Boolean),
    })
    .from(reviews)
    .leftJoin(lecturers, eq(reviews.id_lecturer, lecturers.id_lecturer))
    .leftJoin(subjects, eq(reviews.id_subject, subjects.id_subject))
    .leftJoin(users, eq(reviews.id_user, users.id_user))
    .leftJoin(likeReviews, eq(reviews.id_review, likeReviews.id_review))
    .leftJoin(bookmarkReviews, eq(reviews.id_review, bookmarkReviews.id_review))
    .where(
      and(
        isNull(reviews.id_reply), // Only top-level reviews
        sql`(${reviews.title} ILIKE ${searchPattern} OR ${reviews.body} ILIKE ${searchPattern})`
      )
    )
    .groupBy(
      reviews.id_review,
      lecturers.id_lecturer,
      lecturers.name,
      subjects.name,
      subjects.semester,
      users.id_user,
      users.name,
      users.image,
      users.email
    )
    .orderBy(desc(reviews.created_at))
    .limit(20);

  const mappedData = dataUlasan.map((row) => ({
    id_review: row.id_review,
    id_user: row.id_user,
    title: row.title,
    body: row.body,
    files: row.files,
    created_at: row.created_at,
    updated_at: row.updated_at,
    lecturer_name: row.lecturer_name,
    subject_name: row.subject_name,
    semester: row.semester,
    user: row.is_anonymous ? {
      id_user: null,
      name: "Anonymous",
      image: null,
      email: null,
    } : {
      id_user: row.id_user,
      name: row.user_name,
      image: row.user_image,
      email: row.user_email,
    },
    total_likes: row.total_likes,
    total_bookmarks: row.total_bookmarks,
    total_reply: row.total_reply,
    is_liked: row.is_liked,
    is_bookmarked: row.is_bookmarked,
    is_anonymous: row.is_anonymous,
  }));

  res.status(200).json({
    status: true,
    data: mappedData,
    message: "Pencarian berhasil",
  });
});

export {
  createUlasan,
  editUlasan,
  getAllUlasan,
  getUlasanById,
  likeUlasan,
  bookmarkUlasan,
  unLikeUlasan,
  unBookmarkUlasan,
  getBookmarkUlasan,
  getLikeUlasan,
  searchSimilarUlasan,
  searchUlasan,
};
