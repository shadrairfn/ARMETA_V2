import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import { lecturers, subjects } from "../db/schema/schema.js";
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

const getLecturers = asyncHandler(async (req, res) => {
  const dataLecturers = await db.execute(sql`SELECT id_lecturer, name, faculty FROM lecturers`);
 
  if (dataLecturers.rows.length == 0) {
    throw new NotFoundError("Lecturers not found");
  }

  return res.status(200).json({
    data: dataLecturers.rows,
    status: true,
    message: "Success get all lecturers",
  });
})

const getSubjects = asyncHandler(async (req, res) => {
  const dataSubjects = await db.execute(sql`SELECT id_subject, code, name, semester FROM subjects`);

  if (dataSubjects.rows.length == 0) {
    throw new NotFoundError("Subjects not found");
  }

  return res.status(200).json({
    data: dataSubjects.rows,
    status: true,
    message: "Success get all subjects",
  });
})

export {
  getLecturers,
  getSubjects
}