import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import {
  reviews,
  users,
  likeReviews,
  bookmarkReviews,
  subjects,
  lecturers,
} from "../db/schema/schema.js";
import { eq, sql, and, count, desc, gte, lte, asc } from "drizzle-orm";
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
import { generateEmbedding } from "../service/vectorizationService.js";
import { createClient } from '@supabase/supabase-js';

import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const createUlasan = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;

  let { idMatkul, idDosen, idReply, idForum, judulUlasan, textUlasan } =
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
  if (idMatkul == "") idMatkul = null;
  if (idDosen == "") idDosen = null;
  if (idReply == "") idReply = null;
  if (idForum == "") idForum = null;

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
  });

  // Eksekusi Query Database
  const result = await db.execute(
    sql`INSERT INTO reviews (id_user, id_subject, id_lecturer, id_reply, id_forum, title, body, files, vectorize)
        VALUES (${userId}, ${idMatkul}, ${idDosen}, ${idReply}, ${idForum}, ${judulUlasan}, ${textUlasan}, ${filesJson}, ${vectorString}::vector)
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
    console.log("🔄 Generating embedding for ulasan text...");
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
  const page = parseInt(req.body.page) || 1; // Saran: Gunakan req.query untuk GET
  const limit = parseInt(req.body.limit) || 10;
  const offset = (page - 1) * limit;

  const dataUlasan = await db.execute(
    sql`
      SELECT 
    r.id_review, 
    r.id_user, 
    r.title, 
    r.body, 
    r.files, 
    r.created_at,
    
    COALESCE(d.name, '') AS lecturer_name, 
    COALESCE(s.name, '') AS subject_name,
    s.semester,
    
    COUNT(DISTINCT l.id_like) AS total_likes,
    COUNT(DISTINCT b.id_bookmark) AS total_bookmarks

    FROM reviews r

    LEFT JOIN lecturers d ON r.id_lecturer = d.id_lecturer
    LEFT JOIN subjects s ON r.id_subject = s.id_subject
    LEFT JOIN like_reviews l ON r.id_review = l.id_review
    LEFT JOIN bookmark_reviews b ON r.id_review = b.id_review

    GROUP BY 
        r.id_review, 
        d.name, 
        s.name, 
        s.semester

    ORDER BY r.created_at DESC

    LIMIT ${limit}
    OFFSET ${offset};
    `
  );

  if (dataUlasan.length === 0) {
    throw new NotFoundError("Ulasan tidak ditemukan");
  }

  const totalResult = await db.select({ value: count() }).from(reviews);
  const totalData = totalResult[0].value;
  const totalPage = Math.ceil(totalData / limit);

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
    data: dataUlasan,
  });
});

const getUlasanById = asyncHandler(async (req, res) => {
  const { id_review } = req.body;

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

  // Gabungkan hasil
  const responseData = {
    ...ulasan,
    replies: repliesResult,
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
  const userId = req.user.id_user;

  if (!userId) {
    throw new BadRequestError("id_user wajib diisi");
  }

  const existingLike = await db.execute(
    sql`
      SELECT 
        u.id_review,
        u.id_user,
        u.id_subject,
        u.id_lecturer,
        u.id_reply,
        u.title,
        u.body,
        u.files,
        u.created_at,
        u.updated_at
      FROM like_reviews l
      JOIN reviews u ON l.id_review = u.id_review
      WHERE l.id_user = ${userId}
    `
  );

  return res.status(200).json({
    data: existingLike.rows,
    status: true,
    message: "Success get all ulasan",
  });
});

const getBookmarkUlasan = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;

  if (!userId) {
    throw new BadRequestError("id_user wajib diisi");
  }

  const existingBookmark = await db.execute(
    sql`
      SELECT 
        u.id_review,
        u.id_user,
        u.id_subject,
        u.id_lecturer,
        u.id_reply,
        u.title,
        u.body,
        u.files,
        u.created_at,
        u.updated_at
      FROM bookmark_reviews l
      JOIN reviews u ON l.id_review = u.id_review
      WHERE l.id_user = ${userId}
    `
  );

  return res.status(200).json({
    data: existingBookmark.rows,
    status: true,
    message: "Success get all ulasan",
  });
});

const searchSimilarUlasan = asyncHandler(async (req, res) => {
  const { query, limit = 5 } = req.body;

  if (!query || query.trim().length === 0) {
    throw new BadRequestError("Query text wajib diisi");
  }

  // Generate query embedding
  console.log("🔍 Generating query embedding...");
  const queryEmbedding = await generateEmbedding(query);
  console.log("✅ Query embedding generated");

  // Search for similar ulasan using cosine similarity
  // Using raw SQL for pgvector similarity search
  const similarUlasan = await db.execute(
    `SELECT
      u.id_review,
      u.id_user,
      u.id_subject,
      u.id_lecturer,
      u.title,
      u.files,
      u.created_at,
      (u.vectorize <=> $1::vector) as distance,
      (1 - (u.vectorize <=> $1::vector)) as similarity
    FROM reviews u
    ORDER BY u.vectorize <=> $1::vector
    LIMIT $2`,
    [JSON.stringify(queryEmbedding), limit]
  );

  return successResponse(res, 200, "Pencarian berhasil", {
    query,
    results: similarUlasan.rows,
    count: similarUlasan.rows.length,
  });
});

const searchUlasan = asyncHandler(async (req, res) => {
  const { q } = req.body;
  if (!q) {
    return res.status(400).json({
      message: "Silakan masukkan kata kunci pencarian.",
    });
  }

  const searchPattern = `%${q}%`;

  const searchResults = await db.execute(
    sql`
      SELECT *
      FROM reviews
      WHERE title ILIKE ${searchPattern}
      LIMIT 20
    `
  );

  const results = [];
  for (const row of searchResults.rows) {
    results.push({
      id_review: row.id_review,
      title: row.title,
      files: row.files,
      created_at: row.created_at,
    });
  }

  if (results.length === 0) {
    throw new NotFoundError("Ulasan not found");
  }

  res.status(200).json({
    status: "success",
    data: results,
    message: "Pencarian berhasil",
  });
});

const filterUlasan = asyncHandler(async (req, res) => {
  const { from, to } = req.body;

  if (!from || !to) {
    throw new BadRequestError("from dan to wajib diisi");
  }

  const ulasan = await db
    .select({
      id_review: reviews.id_review,
      id_user: reviews.id_user,
      id_subject: reviews.id_subject,
      id_lecturer: reviews.id_lecturer,
      title: reviews.title,
      body: reviews.body,
      files: reviews.files,
      created_at: reviews.created_at,
    })
    .from(reviews)
    .where(
      and(
        gte(reviews.created_at, new Date(from)),
        lte(reviews.created_at, new Date(to))
      )
    );

  if (ulasan.length === 0) {
    throw new NotFoundError("Ulasan tidak ditemukan");
  }

  return res.status(200).json({
    success: true,
    data: ulasan,
    message: "Success get all ulasan",
  });
});

const sortUlasan = asyncHandler(async (req, res) => {
  const { sortBy = "date", order = "desc" } = req.query;

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
    case "date":
    default:
      orderByClause = isAsc
        ? asc(reviews.created_at)
        : desc(reviews.created_at);
      break;
  }

  const ulasan = await db
    .select({
      id_review: reviews.id_review,
      id_user: reviews.id_user,
      title: reviews.title,
      body: reviews.body,
      files: reviews.files,
      created_at: reviews.created_at,
      total_likes: sql`${countLikes}`.mapWith(Number),
      total_bookmarks: sql`${countBookmarks}`.mapWith(Number),
      popularity_score: sql`${countPopularity}`.mapWith(Number),
    })
    .from(reviews)
    .leftJoin(likeReviews, eq(reviews.id_review, likeReviews.id_review))
    .leftJoin(bookmarkReviews, eq(reviews.id_review, bookmarkReviews.id_review))
    .groupBy(reviews.id_review)
    .orderBy(orderByClause);

  if (ulasan.length === 0) {
    throw new NotFoundError("Ulasan tidak ditemukan");
  }

  return res.status(200).json({
    success: true,
    count: ulasan.length,
    data: ulasan,
    message: `Success get ulasan sorted by ${sortBy}`,
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
  filterUlasan,
  sortUlasan,
};
