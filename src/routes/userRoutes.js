import express from "express";
import {
	getCurrentUser,
	getUserById,
	logout,
	refreshAccessToken,
	updateProfile,
} from "../controllers/userController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Public routes (tidak perlu authentication)
router.post("/refresh-token", refreshAccessToken);

// Protected routes (perlu authentication)
router.post("/logout", requireAuth, logout);
router.get("/profile", requireAuth, getCurrentUser);
router.get("/:id_user", getUserById);
router.patch("/changeProfile", requireAuth, upload.single("image"), updateProfile);

export default router;
