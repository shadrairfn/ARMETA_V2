import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import { ulasan, users, likeUlasanMatkul} from "../db/schema/schema.js";
import { eq, sql } from "drizzle-orm";

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
    sql`INSERT INTO ulasan (id_user, id_matkul, id_dosen, id_ulasan_reply, judul_ulasan, teks_ulasan, files, vectorize_ulasan)
        VALUES (${userId}, ${idMatkul}, ${idDosen}, ${idReply}, ${judulUlasan}, ${textUlasan}, ${filesJson}, ${vectorString}::vector)
        RETURNING *`
  );

  const newUlasan = result.rows[0];

  return createdResponse(res, "Ulasan berhasil dibuat", {
    ulasan: newUlasan,
  });
});

const getAllUlasan = asyncHandler(async (req, res) => {
  const dataUlasan = await await db.select().from(ulasan);
  return res.status(200).json({
        data : dataUlasan,
        status : true,
        message : "Success get all ulasan"
    });
});

const likeUlasan = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { id_ulasan } = req.body;

  if (!id_ulasan) {
    throw new BadRequestError("id_ulasan wajib diisi");
  }

  const existingLike = await db.execute(
    sql`SELECT * FROM like_ulasan_matkul
        WHERE id_user = ${userId} AND id_ulasan = ${id_ulasan}`
  );
  
  if (existingLike.rows.length >= 1) {
    throw new BadRequestError("User sudah like ulasan ini");
  }

  const result = await db.execute(
    sql`INSERT INTO like_ulasan_matkul (id_user, id_ulasan)
        VALUES (${userId}, ${id_ulasan})
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
  const { id_ulasan } = req.body;

  if (!id_ulasan) {
    throw new BadRequestError("id_ulasan wajib diisi");
  }

  const existingBokmark = await db.execute(
    sql`SELECT * FROM bookmark_ulasan
        WHERE id_user = ${userId} AND id_ulasan = ${id_ulasan}`
  );
  
  if (existingBokmark.rows.length >= 1) {
    throw new BadRequestError("User sudah bookmark ulasan ini");
  }

  const result = await db.execute(
    sql`INSERT INTO bookmark_ulasan (id_user, id_ulasan)
        VALUES (${userId}, ${id_ulasan})
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
  const { id_ulasan } = req.body;

  if (!id_ulasan) {
    throw new BadRequestError("id_ulasan wajib diisi");
  }

  const existingLike = await db.execute(
    sql`SELECT * FROM like_ulasan_matkul
        WHERE id_user = ${userId} AND id_ulasan = ${id_ulasan}`
  );
  
  if (existingLike.rows.length == 0) {
    throw new BadRequestError("User belum bookmark ulasan ini");
  }

  const result = await db.execute(
    sql`DELETE FROM like_ulasan_matkul
        WHERE id_user = ${userId} AND id_ulasan = ${id_ulasan}
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
  const { id_ulasan } = req.body;

  if (!id_ulasan) {
    throw new BadRequestError("id_ulasan wajib diisi");
  }

  const existingBokmark = await db.execute(
    sql`SELECT * FROM bookmark_ulasan
        WHERE id_user = ${userId} AND id_ulasan = ${id_ulasan}`
  );
  
  if (existingBokmark.rows.length == 0) {
    throw new BadRequestError("User belum bookmark ulasan ini");
  }

  const result = await db.execute(
    sql`DELETE FROM bookmark_ulasan
        WHERE id_user = ${userId} AND id_ulasan = ${id_ulasan}
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
      FROM like_ulasan_matkul l
      JOIN ulasan u ON l.id_ulasan = u.id_ulasan
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
      FROM bookmark_ulasan l
      JOIN ulasan u ON l.id_ulasan = u.id_ulasan
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
      u.id_ulasan,
      u.id_user,
      u.id_matkul,
      u.id_dosen,
      u.teks_ulasan,
      u.files,
      u.tanggal_upload,
      (u.vectorize_ulasan <=> $1::vector) as distance,
      (1 - (u.vectorize_ulasan <=> $1::vector)) as similarity
    FROM ulasan u
    ORDER BY u.vectorize_ulasan <=> $1::vector
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
  getAllUlasan, 
  likeUlasan, 
  bookmarkUlasan, 
  unLikeUlasan, 
  unBookmarkUlasan,
  getBookmarkUlasan,
  getLikeUlasan, 
  searchSimilarUlasan };