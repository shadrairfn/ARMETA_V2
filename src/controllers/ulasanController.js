import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import { reviews, users, likeReviews, bookmarkReviews } from "../db/schema/schema.js";
import { eq, sql, and } from "drizzle-orm";

import {
  generateAccessToken,
  generateRefreshToken,
} from "../service/tokenService.js";

import {
  successResponse,
  createdResponse,
} from "../utils/responseHandler.js";

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

  let { idMatkul, idDosen, idReply, judulUlasan, textUlasan } = req.body;

  if ((!idMatkul || !idDosen) && idReply &&!textUlasan && !judulUlasan) {
    throw new BadRequestError("id_matkul atau id_dosen, dan textUlasan wajib diisi");
  }
  
  const fileUploaded = req.files || [];
  const fileLocalLinks = [];
  for (const file of fileUploaded) {
    const fileUrl = await uploadToFirebase(file, "ulasan");
    fileLocalLinks.push(fileUrl);
  }

  console.log("🔄 Generating embedding for ulasan text...");
  const embeddingVector = await generateEmbedding(textUlasan);
  
  console.log("✅ Embedding generated successfully, dimension:", embeddingVector.length);

  const vectorString = `[${embeddingVector.join(',')}]`;
  console.log(`VECTORIZE DATA TYPE: ${typeof vectorString}`);
  console.log(`VECTORIZE DATA: ${vectorString}`);
  
  const filesJson = JSON.stringify(fileLocalLinks);

  if (idMatkul == '') {
    idMatkul = null;
  }
  if (idDosen == '') {
    idDosen = null;
  }
  if (idReply == '') {
    idReply = null;
  }

  console.log("Debug insert values:", {
    userId,
    id_matkul: idMatkul,
    id_dosen: idDosen,
    id_ulasan_reply: idReply,
    textUlasan: textUlasan.substring(0, 50),
    judulUlasan: judulUlasan.substring(0, 50),
    files: fileLocalLinks.length,
    vectorLength: vectorString.length
  });
  
  const result = await db.execute(
    sql`INSERT INTO reviews (id_user, id_subject, id_lecturer, id_reply, title, body, files, vectorize)
        VALUES (${userId}, ${idMatkul}, ${idDosen}, ${idReply}, ${judulUlasan}, ${textUlasan}, ${filesJson}, ${vectorString}::vector)
        RETURNING *`
  );

  const newUlasan = result.rows[0];

  return createdResponse(res, "Ulasan berhasil dibuat", {
    ulasan: newUlasan,
  });
});

const editUlasan = asyncHandler(async (req, res) => {
  // To be implemented
  const userId = req.user.id_user;
  let { id_review, title, body } = req.body;

  const [oldReview] = await db
  .select()
  .from(reviews)
  .where(
    and(
      eq(reviews.id_user, userId),
      eq(reviews.id_review, id_review)
    )
  );

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

      console.log("✅ Embedding generated successfully, dimension:", embeddingVector.length);
      
      vectorString = embeddingVector
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
    data : updatedUlasan,
    status : true,
    message : "Success update ulasan"
  });
});

const getAllUlasan = asyncHandler(async (req, res) => {
  const dataUlasan = await db.select().from(reviews);
  return res.status(200).json({
        data : dataUlasan,
        status : true,
        message : "Success get all ulasan"
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
    data : result.rows[0],
    status : true,
    message : "Success like ulasan"
  })
})

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
    data : result.rows[0],
    status : true,
    message : "Success repost ulasan"
  })
})

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
    data : result.rows[0],
    status : true,
    message : "Success unlike ulasan"
  })
})

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
    data : result.rows[0],
    status : true,
    message : "Success unlike ulasan"
  })
})

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
    data : existingLike.rows,
    status : true,
    message : "Success get all ulasan"
  })
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
    data : existingBookmark.rows,
    status : true,
    message : "Success get all ulasan"
  })
})

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
  searchSimilarUlasan };