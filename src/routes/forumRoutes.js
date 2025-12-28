import express from "express";
import {
  createForum,
  deleteForum,
  editForum,
  getForumBySubject,
  searchForum,
  getAllForum,
  getForumById,
  likeForum,
  unlikeForum,
  bookmarkForum,
  unbookmarkForum,
  getLikeForum,
  getBookmarkForum
} from "../controllers/forumController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.post("/createForum", requireAuth, upload.array("files"), createForum);
router.patch("/editForum", requireAuth, upload.array("files"), editForum);
router.delete("/deleteForum", requireAuth, deleteForum);
router.get("/searchForum", requireAuth, searchForum);
router.get("/getAllForum", requireAuth, getAllForum);
router.get("/getForumId", requireAuth, getForumById);
router.get("/getForumSubject", requireAuth, getForumBySubject);

// Like Forum routes
router.post("/likeForum", requireAuth, likeForum);
router.delete("/likeForum", requireAuth, unlikeForum);
router.get("/likeForum", requireAuth, getLikeForum);

// Bookmark Forum routes
router.post("/bookmarkForum", requireAuth, bookmarkForum);
router.delete("/bookmarkForum", requireAuth, unbookmarkForum);
router.get("/bookmarkForum", requireAuth, getBookmarkForum);

export default router;

