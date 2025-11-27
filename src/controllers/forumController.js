import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import { reviews, users, reviewsForum } from "../db/schema/schema.js";
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

const createForum = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { title, description, id_subject } = req.body;

    if (!title || !id_subject) {
        throw new BadRequestError("title dan id_subject wajib diisi");
    }

    const result =  await db.execute(
      sql`INSERT INTO reviews_forum (id_user, id_subject, title, description)
          VALUES (${userId}, ${id_subject}, ${title}, ${description})
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

    const forums = await db.select().from(reviewsForum).where(eq(reviewsForum.id_subject, id_subject));

    return res.status(200).json({
      success: true,
      data: forums,
      message: "Success get all forums",
    });
});

export { createForum, getForums };