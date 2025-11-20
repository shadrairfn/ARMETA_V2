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

  if (!user || user.refreshToken !== refreshToken) {
    throw new TokenError("Refresh token tidak valid");
  }

  const newAccessToken = generateAccessToken({
    id_user: user.id_user,
    email: user.email,
    nama: user.nama,
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

  const { password: _, refreshToken: __, ...userWithoutSensitiveData } = user;

  return successResponse(res, 200, "User profile berhasil diambil", {
    user: userWithoutSensitiveData,
  });
});


const updateProfile = asyncHandler(async (req, res, next) => {
  const userId = req.user.id_user;
  const { nama, image } = req.body;

  if (!nama && !image) {
    throw new BadRequestError("Tidak ada data yang diupdate");
  }

  const updateData = {};
  if (nama) updateData.nama = nama;
  if (image) updateData.image = image;

  const [updatedUser] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id_user, userId))
    .returning();

  if (!updatedUser) {
    throw new NotFoundError("User tidak ditemukan");
  }

  const { password: _, refreshToken: __, ...userWithoutSensitiveData } =
    updatedUser;

  return successResponse(res, 200, "Profile berhasil diupdate", {
    user: userWithoutSensitiveData,
  });
});

const updateProfilePhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new BadRequestError("Tidak ada file yang diupload");
  }

  const userId = req.user.id_user;

  // Upload ke Firebase Storage
  const profileUrl = await uploadToFirebase(req.file, "profile_photos");

  // Update ke database
  const [updated] = await db
    .update(users)
    .set({ image: profileUrl })
    .where(eq(users.id_user, userId))
    .returning();

  if (!updated) {
    throw new NotFoundError("User tidak ditemukan");
  }

  const { password: _, refreshToken: __, ...safeUser } = updated;

  return successResponse(res, 200, "Foto profil berhasil diperbarui", {
    user: safeUser,
    imageUrl: profileUrl,
  });
});

export {
  logout,
  refreshAccessToken,
  getCurrentUser,
  updateProfile,
  updateProfilePhoto
};
