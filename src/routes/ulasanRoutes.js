import {
    createUlasan,
    getAllUlasan,
    searchSimilarUlasan
} from "../controllers/ulasanController.js";
import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Create new ulasan with file uploads
router.post(
    "/createUlasan",
    requireAuth,
    upload.array("files"),
    createUlasan
);

// Search similar ulasan using vector similarity
router.post(
    "/search",
    requireAuth,
    searchSimilarUlasan
);

// Get all ulasan
router.get(
    "/getUlasan",
    requireAuth,
    getAllUlasan
);

export default router;
