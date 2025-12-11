import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import { reviews, users, reviewsForum } from "../db/schema/schema.js";
import { eq, sql, and, gte, lte } from "drizzle-orm";

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

const createForum = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { title, description, id_subject } = req.body;

  if (!title || !id_subject) {
    throw new BadRequestError("title dan id_subject wajib diisi");
  }

  const fileUploaded = req.files || [];
  const fileLocalLinks = [];
  for (const file of fileUploaded) {
    const fileUrl = await uploadToFirebase(file, "ulasan");
    fileLocalLinks.push(fileUrl);
  }

  const filesJson = JSON.stringify(fileLocalLinks);

  const result = await db.execute(
    sql`INSERT INTO reviews_forum (id_user, id_subject, title, description, files)
          VALUES (${userId}, ${id_subject}, ${title}, ${description}, ${filesJson})
          RETURNING *`
  );

  return res.status(201).json({
    success: true,
    message: "Forum created successfully",
    data: result.rows[0],
  });
});

const getForums = asyncHandler(async (req, res) => {
  const { id_subject } = req.body;

  if (!id_subject) {
    throw new BadRequestError("id_subject wajib diisi");
  }

  const forums = await db
    .select()
    .from(reviewsForum)
    .where(eq(reviewsForum.id_subject, id_subject));

  return res.status(200).json({
    success: true,
    data: forums,
    message: "Success get all forums",
  });
});

const searchForum = asyncHandler(async (req, res) => {
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
      FROM reviews_forum
      WHERE title ILIKE ${searchPattern}
      LIMIT 20
    `
  );

  const results = [];
  for (const row of searchResults.rows) {
    results.push({
      id_forum: row.id_forum,
      title: row.title,
      created_at: row.created_at,
    });
  }

  // 3. Response
  res.status(200).json({
    status: "success",
    data: results,
    message: "Pencarian berhasil",
  });
});

const filterForum = asyncHandler(async (req, res) => {
  const { from, to } = req.body;
  const forum = await db
    .select({
      id_forum: reviewsForum.id_forum,
      id_user: reviewsForum.id_user,
      id_subject: reviewsForum.id_subject,
      title: reviewsForum.title,
      description: reviewsForum.description,
      created_at: reviewsForum.created_at,
    })
    .from(reviewsForum)
    .where(
      and(
        gte(reviewsForum.created_at, new Date(from)),
        lte(reviewsForum.created_at, new Date(to))
      )
    );
  return res.status(200).json({
    success: true,
    data: forum,
    message: "Success get all forum",
  });
});

export { createForum, getForums, searchForum, filterForum };
