import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import { reviews, users, reviewsForum } from "../db/schema/schema.js";
import { eq, sql, and, gte, lte, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

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
import { generateEmbedding } from "../service/vectorizationService.js";
import { createClient } from '@supabase/supabase-js';

import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const createForum = asyncHandler(async (req, res) => {
  const userId = req.user.id_user;

  if (!userId) {
    throw new UnauthorizedError("Unauthorized - Please login");
  }
  
  const { title, description, id_subject } = req.body;

  if (!title || !id_subject) {
    throw new BadRequestError("title dan id_subject wajib diisi");
  }

// 2. Upload ke Supabase (Hanya jika ada file)
const fileUploaded = req.files || []; // Pastikan ini array (dari multer)
  const fileLocalLinks = [];

  // Nama bucket Anda di Supabase (sesuaikan dengan yang dibuat di dashboard)
  const BUCKET_NAME = "armeta-files";

  for (const file of fileUploaded) {
    // 1. Buat nama file unik (misal: ulasan/timestamp-namafile)
    // .replace spasi dengan underscore agar URL aman
    const fileName = `ulasan/${Date.now()}-${file.originalname.replace(
      /\s/g,
      "_"
    )}`;

    // 2. Upload file buffer ke Supabase
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error("Supabase Upload Error:", error);
      throw new Error(`Gagal upload file: ${error.message}`);
    }

    // 3. Dapatkan Public URL setelah berhasil upload
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    fileLocalLinks.push(publicUrlData.publicUrl);
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

  if (results.length === 0) {
    throw new NotFoundError("Forum not found");
  }

  res.status(200).json({
    status: "success",
    data: results,
    message: "Pencarian berhasil",
  });
});
 
const filterForum = asyncHandler(async (req, res) => {
  const { from, to } = req.body;

  if (!from || !to) {
    throw new BadRequestError("from dan to wajib diisi");
  }

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

  if (forum.length === 0) {
    throw new NotFoundError("Forum not found");
  }

  return res.status(200).json({
    success: true,
    data: forum,
    message: "Success get all forum",
  });
});

const getAllForum = asyncHandler(async (req, res) => {
  const forum = await db
  .select({
    id_forum: reviewsForum.id_forum,
    id_user: reviewsForum.id_user,
    id_subject: reviewsForum.id_subject,
    title: reviewsForum.title,
    files: reviewsForum.files,
    description: reviewsForum.description,
    created_at: reviewsForum.created_at,
  })
  .from(reviewsForum);

  if (!forum) {
    throw new NotFoundError("Forum not found");
  }

  return res.status(200).json({
    success: true,
    data: forum,
    message: "Success get all forum",
  });
});

const getForumById = asyncHandler(async (req, res) => {
  const { id_forum } = req.body;

  if (!id_forum) {
    throw new BadRequestError("id_forum wajib diisi");
  }

  // Kita gunakan alias untuk pembuat forum (opsional, agar membedakan dengan penulis review)
  const forumCreator = alias(users, "forumCreator");

  const [forumResult, reviewsResult] = await Promise.all([
    // 1. Query Data Forum (dan pembuat forumnya)
    db
      .select({
        id_forum: reviewsForum.id_forum,
        title: reviewsForum.title,
        description: reviewsForum.description,
        files: reviewsForum.files,
        created_at: reviewsForum.created_at,
        // Info User Pembuat Forum
        creator: {
          id_user: forumCreator.id_user,
          name: forumCreator.name,
          image: forumCreator.image, // Sesuaikan dengan schema users (image/avatar)
        },
      })
      .from(reviewsForum)
      .leftJoin(forumCreator, eq(reviewsForum.id_user, forumCreator.id_user))
      .where(eq(reviewsForum.id_forum, id_forum)),

    // 2. Query User yang melakukan Ulasan di Forum tersebut
    db
      .select({
        id_review: reviews.id_review,
        title: reviews.title,
        body: reviews.body,
        files: reviews.files,
        created_at: reviews.created_at,
        // Info User Penulis Ulasan
        reviewer: {
          id_user: users.id_user,
          name: users.name,
          image: users.image, // Sesuaikan dengan schema users
        },
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.id_user, users.id_user)) // Join review ke user
      .where(eq(reviews.id_forum, id_forum)) // Filter berdasarkan id_forum
      .orderBy(desc(reviews.created_at)), // Urutkan ulasan terbaru
  ]);

  const forum = forumResult[0];

  if (!forum) {
    throw new NotFoundError("Forum not found");
  }

  // Gabungkan hasil
  const responseData = {
    ...forum,
    reviews: reviewsResult, // List ulasan beserta user-nya
  };

  return res.status(200).json({
    success: true,
    data: responseData,
    message: "Success get forum by id",
  });
});

const getForumBySubject = asyncHandler(async (req, res) => {
  const { id_subject } = req.body;

  if (!id_subject) {
    throw new BadRequestError("id_subject wajib diisi");
  }

  const forums = await db
    .select({
      id_forum: reviewsForum.id_forum,
      id_user: reviewsForum.id_user,
      id_subject: reviewsForum.id_subject,
      title: reviewsForum.title,
      files: reviewsForum.files,
      description: reviewsForum.description,
      created_at: reviewsForum.created_at,
    })
    .from(reviewsForum)
    .where(eq(reviewsForum.id_subject, id_subject));
  
  if (forums.length === 0) {
    throw new NotFoundError("Forum not found");
  }

  return res.status(200).json({
    success: true,
    data: forums,
    message: "Success get all forums",
  });
});

export { createForum, getForumBySubject, searchForum, filterForum, getAllForum, getForumById };
