import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import { users } from "../db/schema/schema.js";
import { eq } from "drizzle-orm";

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

const logout = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id_user;

  if (!userId) {
    throw new UnauthorizedError();
  }

  await db
    .update(users)
    .set({ refreshToken: null })
    .where(eq(users.id_user, userId));

  return successResponse(res, 200, "Logout berhasilll");
});


const refreshAccessToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new BadRequestError("Refresh token wajib diisi");
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw new TokenError("Refresh token tidak valid atau sudah kedaluwarsa");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id_user, decoded.id_user))
    .limit(1);

  if (!user || user.refresh_token !== refreshToken) {
    throw new TokenError("Refresh token tidak valid");
  }

  const newAccessToken = generateAccessToken({
    id_user: user.id_user,
    email: user.email,
    name: user.name,
  });

  return successResponse(res, 200, "Access token berhasil diperbarui", {
    accessToken: newAccessToken,
  });
});


const getCurrentUser = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id_user;

  if (!userId) {
    throw new UnauthorizedError();
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id_user, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError("User tidak ditemukan");
  }

  const { password: _, refresh_token: __, ...userWithoutSensitiveData } = user;

  return successResponse(res, 200, "User profile berhasil diambil", {
    user: userWithoutSensitiveData,
  });
});


const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;

  let name = req.body?.name ?? null;

  if (!name && !req.file) {
    throw new BadRequestError("Tidak ada data yang diupdate");
  }

  console.log("REQ BODY BEFORE:", req.body);
  console.log("REQ FILE BEFORE:", req.file);

  const [oldUser] = await db
    .select()
    .from(users)
    .where(eq(users.id_user, userId));

  if (!oldUser) throw new NotFoundError("User tidak ditemukan");

  // Upload file bila ada
  let profileUrl = oldUser.image;
  if (req.file) {
    profileUrl = await uploadToFirebase(req.file, "profile_photos");
  }

  // fallback name
  if (!name || name === "") {
    name = oldUser.name;
  }

  console.log("REQ BODY AFTER:", req.body);
  console.log("REQ FILE AFTER:", req.file);

  const updateData = { name, image: profileUrl };

  const [updatedUser] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id_user, userId))
    .returning();

  return successResponse(res, 200, "Profile berhasil diupdate", {
    user: updatedUser,
  });
});

export {
  logout,
  refreshAccessToken,
  getCurrentUser,
  updateProfile
};
