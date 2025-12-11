import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import {
  reviews,
  users,
  likeReviews,
  bookmarkReviews,
} from "../db/schema/schema.js";
import { eq, sql, and, count, desc, gte, lte, asc } from "drizzle-orm";

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
import { uploadToFirebase } from "../service/uploadService.js";
import { generateEmbedding } from "../service/vectorizationService.js";

const createUlasan = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;

  let { idMatkul, idDosen, idReply, idForum, judulUlasan, textUlasan } =
    req.body;

  if (
    (!idMatkul || !idDosen || !idForum) &&
    idReply &&
    !textUlasan &&
    !judulUlasan
  ) {
    throw new BadRequestError(
      "id_matkul atau id_dosen, dan textUlasan wajib diisi"
    );
  }

  const fileUploaded = req.files || [];
  const fileLocalLinks = [];
  for (const file of fileUploaded) {
    const fileUrl = await uploadToFirebase(file, "ulasan");
    fileLocalLinks.push(fileUrl);
  }

  console.log("🔄 Generating embedding for ulasan text...");
  const embeddingVector = await generateEmbedding(textUlasan);

  console.log(
    "✅ Embedding generated successfully, dimension:",
    embeddingVector.length
  );

  const vectorString = `[${embeddingVector.join(",")}]`;
  console.log(`VECTORIZE DATA TYPE: ${typeof vectorString}`);
  console.log(`VECTORIZE DATA: ${vectorString}`);

  const filesJson = JSON.stringify(fileLocalLinks);

  if (idMatkul == "") {
    idMatkul = null;
  }
  if (idDosen == "") {
    idDosen = null;
  }
  if (idReply == "") {
    idReply = null;
  }
  if (idForum == "") {
    idForum = null;
  }

  console.log("Debug insert values:", {
    userId,
    id_matkul: idMatkul,
    id_dosen: idDosen,
    id_ulasan_reply: idReply,
    id_forum: idForum,
    textUlasan: textUlasan.substring(0, 50),
    judulUlasan: judulUlasan.substring(0, 50),
    files: fileLocalLinks.length,
    vectorLength: vectorString.length,
  });

  const result = await db.execute(
    sql`INSERT INTO reviews (id_user, id_subject, id_lecturer, id_reply, id_forum, title, body, files, vectorize)
        VALUES (${userId}, ${idMatkul}, ${idDosen}, ${idReply}, ${idForum}, ${judulUlasan}, ${textUlasan}, ${filesJson}, ${vectorString}::vector)
        RETURNING *`
  );

  const newUlasan = result.rows[0];

  return res.status(200).json({
    data: newUlasan,
    status: true,
    message: "Success get all ulasan",
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

  if (req.files.length > 0) {
    const fileUploaded = req.files || [];
    const fileLocalLinks = [];
    for (const file of fileUploaded) {
      const fileUrl = await uploadToFirebase(file, "ulasan");
      fileLocalLinks.push(fileUrl);
    }
    const filesJson = JSON.stringify(fileLocalLinks);
    profileUrl = filesJson;
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
  if (profileUrl) updateData.files = profileUrl;
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
  // 1. Ambil parameter page & limit (Default: page 1, 10 data per load)
  const page = parseInt(req.body.page) || 1;
  const limit = parseInt(req.body.limit) || 10;

  // 2. Hitung Offset (Berapa data yang harus dilewati)
  // Rumus: (Halaman saat ini - 1) * Jumlah per halaman
  // Contoh: Halaman 2, limit 10. Offset = (2-1)*10 = 10. (Lewati 10 data awal)
  const offset = (page - 1) * limit;

  // 3. Query Data dengan Pagination
  // Penting: Selalu gunakan .orderBy() agar urutan data konsisten saat di-scroll
  const dataUlasan = await db
    .select({
      id_review: reviews.id_review,
      id_user: reviews.id_user,
      title: reviews.title,
      body: reviews.body,
      files: reviews.files,
    })
    .from(reviews)
    .limit(limit) // Ambil hanya 10
    .offset(offset) // Loncat sekian data
    .orderBy(desc(reviews.created_at)); // Urutkan dari yang terbaru

  // (Opsional) 4. Hitung Total Data (Untuk tahu kapan harus stop scroll)
  // Ini query tambahan untuk menghitung total baris di tabel
  const totalResult = await db.select({ value: count() }).from(reviews);
  const totalData = totalResult[0].value;
  const totalPage = Math.ceil(totalData / limit);

  // 5. Response
  return res.status(200).json({
    status: true,
    message: "Success get ulasan",
    pagination: {
      currentPage: page,
      limit: limit,
      totalData: totalData,
      totalPage: totalPage,
      hasNextPage: page < totalPage, // Memberitahu frontend apakah masih ada data lagi
    },
    data: dataUlasan,
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
    throw new BadRequestError("User belum bookmark ulasan ini");
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
  const existingLike = await db.execute(
    sql`
      SELECT u.*
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
  const existingBookmark = await db.execute(
    sql`
      SELECT u.*
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

/**
 * Search similar ulasan using vector similarity
 * Uses cosine similarity via pgvector extension
 */
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

  res.status(200).json({
    status: "success",
    data: results,
    message: "Pencarian berhasil",
  });
});

const filterUlasan = asyncHandler(async (req, res) => {
  const { from, to } = req.body;
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
      orderByClause = isAsc ? asc(reviews.created_at) : desc(reviews.created_at);
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
