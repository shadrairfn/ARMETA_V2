import express from "express";
import {
  logout,
  refreshAccessToken,
  getCurrentUser,
  updateProfile,
  updateProfilePhoto
} from "../controllers/userController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Public routes (tidak perlu authentication)
router.post("/refresh-token", refreshAccessToken);

// Protected routes (perlu authentication)
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, getCurrentUser);
router.patch("/profile", requireAuth, updateProfile);
router.patch(
  "/profile/photo",
  requireAuth,
  upload.single("image"),
  updateProfilePhoto
);

export default router;