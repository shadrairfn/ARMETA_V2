import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import { reviews, users, reports } from "../db/schema/schema.js";
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

const createReport = asyncHandler(async (req, res) => {
    const userId = req.user.id_user;
    let { id_review, id_lecturer, type, body } = req.body;

    id_review = id_review || null;
    id_lecturer = id_lecturer || null;

    if (!type) {
        throw new BadRequestError("Type laporan wajib diisi.");
    }
    
    if (!id_review && !id_lecturer) {
        throw new BadRequestError("Laporan harus merujuk ke Review atau Dosen (id_review atau id_lecturer wajib diisi salah satunya).");
    }

    const status = "Pending";

    const result = await db.execute(
        sql`INSERT INTO reports (id_user, id_review, id_lecturer, type, body, status)
            VALUES (${userId}, ${id_review}, ${id_lecturer}, ${type}, ${body}, ${status})
            RETURNING *`
    );
    return res.status(200).json({
      success: true,
      message: "Report created successfully",
      data: result.rows[0],
    });
});

const getReports = asyncHandler(async (req, res) => {
    const userId = req.user.id_user;

    const reportsList = await db.execute(
        sql`SELECT * FROM reports WHERE id_user = ${userId} ORDER BY created_at DESC`
    );

    return res.status(200).json({
      success: true,
      message: "Report created successfully",
      data: reportsList,
    });
});

export { createReport, getReports };