import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import { ulasan } from "../db/schema/schema.js";
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

  const { id_matkul, id_dosen, textUlasan } = req.body;

  if (!id_matkul || !id_dosen && !textUlasan) {
    throw new BadRequestError("id_matkul atau id_dosen, dan textUlasan wajib diisi");
  }

  // Upload files (if any)
  const fileUploaded = req.files || [];
  const fileLocalLinks = [];
  for (const file of fileUploaded) {
    const fileUrl = await uploadToFirebase(file, "ulasan");
    fileLocalLinks.push(fileUrl);
  }

  // Generate embedding vector from text using Voyage AI
  console.log("🔄 Generating embedding for ulasan text...");
  const embeddingVector = await generateEmbedding(textUlasan);
  console.log("✅ Embedding generated successfully, dimension:", embeddingVector.length);

  // Convert vector to PostgreSQL-compatible string format
  const vectorString = `[${embeddingVector.join(',')}]`;
  const filesJson = JSON.stringify(fileLocalLinks);

  // Handle null values properly
  const matkulValue = id_matkul ? parseInt(id_matkul) : null;
  const dosenValue = id_dosen ? parseInt(id_dosen) : null;

  console.log("📊 Debug insert values:", {
    userId,
    id_matkul: matkulValue,
    id_dosen: dosenValue,
    textUlasan: textUlasan.substring(0, 50),
    filesCount: fileLocalLinks.length,
    vectorLength: vectorString.length
  });

  // Use sql tagged template from Drizzle (safe from SQL injection)
  const result = await db.execute(
    sql`INSERT INTO ulasan (id_user, id_matkul, id_dosen, teks_ulasan, files, vectorize_ulasan)
        VALUES (${userId}, ${matkulValue}, ${dosenValue}, ${textUlasan}, ${filesJson}::jsonb, ${vectorString}::vector)
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

export { createUlasan, getAllUlasan, searchSimilarUlasan };