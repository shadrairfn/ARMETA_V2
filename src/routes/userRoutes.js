import express from "express";
import {
  logout,
  refreshAccessToken,
  getCurrentUser,
  getUserById,
  updateProfile
} from "../controllers/userController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Public routes (tidak perlu authentication)
router.post("/refresh-token", refreshAccessToken);

// Protected routes (perlu authentication)
router.post("/logout", requireAuth, logout);
router.get("/:id_user", getUserById);
router.get("/profile", requireAuth, getCurrentUser);
router.patch("/changeProfile", requireAuth, upload.single("image"), updateProfile);

export default router;