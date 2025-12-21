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
import { createClient } from '@supabase/supabase-js';

import dotenv from 'dotenv';
import { point } from "drizzle-orm/pg-core";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const logout = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id_user;

  if (!userId) {
    throw new UnauthorizedError();
  }

  await db
    .update(users)
    .set({ refreshToken: null })
    .where(eq(users.id_user, userId));

  return res.status(200).json({
    status: true,
    message: "Logout berhasil",
  });
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

  console.log(user.refreshToken);


  if (!user) {
    throw new TokenError("user tidak valid");
  }

  if (!user || user.refreshToken !== refreshToken) {
    throw new TokenError("Refresh token tidak valid");
  }

  const newAccessToken = generateAccessToken({
    id_user: user.id_user,
    email: user.email,
    name: user.name,
    role: user.role,
    is_banned: user.is_banned,
  });

  return res.status(200).json({
    status: true,
    message: "Access token berhasil diperbarui",
    accessToken: newAccessToken,
  })
});


const getCurrentUser = asyncHandler(async (req, res, next) => {

  const userId = req.user?.id_user;

  if (!userId) {
    throw new UnauthorizedError();
  }


  const user = await db
    .select({
      id_user: users.id_user,
      email: users.email,
      name: users.name,
      image: users.image,
      poin: users.poin,
      role: users.role,
      is_banned: users.is_banned,
      created_at: users.created_at,
      updated_at: users.updated_at
    })
    .from(users)
    .where(eq(users.id_user, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError("User tidak ditemukan");
  }

  return res.status(200).json({
    data: user[0],
    status: true,
    message: "Success get current user",
  })
});

const getUserById = asyncHandler(async (req, res, next) => {
  const { id_user } = req.params;

  console.log(" ================= id_user ================");
  console.log(id_user);
  console.log(req.query)
  console.log(req.params)
  console.log(" ================= id_user ================");

  if (!id_user) {
    throw new UnauthorizedError();
  }

  const result = await db
    .select({
      id_user: users.id_user,
      email: users.email,
      name: users.name,
      image: users.image,
      poin: users.poin,
      created_at: users.created_at,
      updated_at: users.updated_at
    })
    .from(users)
    .where(eq(users.id_user, id_user))
    .limit(1);

  if (!result) {
    throw new NotFoundError("User tidak ditemukan");
  }

  const user = result[0];

  return res.status(200).json({
    data: user,
    status: true,
    message: "Success get current user",
  })
});


const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;
  const { name } = req.body;

  // 1. Cek apakah ada data yang dikirim (Text atau File)
  // Perbaikan: Cek req.file (single) dan req.files (array) untuk jaga-jaga
  const hasFile = req.file || (req.files && req.files.length > 0);

  if (!name && !hasFile) {
    throw new BadRequestError("Tidak ada data yang diupdate (nama atau gambar kosong)");
  }

  // Cek user lama
  const [oldUser] = await db
    .select()
    .from(users)
    .where(eq(users.id_user, userId));

  if (!oldUser) throw new NotFoundError("User tidak ditemukan");

  // 2. Upload ke Supabase (Hanya jika ada file)
  let profileUrl = null;

  if (hasFile) {
    // Normalisasi: Ambil file pertama saja karena ini profile picture
    const fileToUpload = req.file || req.files[0];
    const BUCKET_NAME = "armeta-profile";

    // Nama file unik
    const fileName = `profiles/${userId}-${Date.now()}-${fileToUpload.originalname.replace(/\s/g, "_")}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, fileToUpload.buffer, {
        contentType: fileToUpload.mimetype,
        upsert: false,
      });

    if (error) {
      console.error("Supabase Upload Error:", error);
      throw new Error(`Gagal upload file: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    profileUrl = publicUrlData.publicUrl;
  }

  // 3. Susun Data Update Secara Dinamis
  // Kita hanya memasukkan field ke dalam objek updateData JIKA datanya ada.
  // Ini mencegah menimpa data lama dengan null.
  const updateData = {
    updated_at: new Date(), // Selalu update timestamp
  };

  if (name) {
    updateData.name = name;
  }

  if (profileUrl) {
    updateData.image = profileUrl;
  }

  console.log("FINAL UPDATE DATA:", updateData);

  // 4. Eksekusi Update
  const [updatedUser] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id_user, userId))
    .returning();

  return res.status(200).json({
    data: updatedUser,
    status: true,
    message: "Success update profile",
  });
});

export {
  logout,
  refreshAccessToken,
  getCurrentUser,
  getUserById,
  updateProfile
};
