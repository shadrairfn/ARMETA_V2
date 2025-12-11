import express from "express";
import {
  createForum,
  getForumBySubject,
  searchForum,
  filterForum,
  getAllForum,
  getForumById
} from "../controllers/forumController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.post("/createForum", requireAuth, upload.array("files"), createForum);
router.get("/searchForum", requireAuth, searchForum);
router.get("/filterForum", requireAuth, filterForum);
router.get("/getAllForum", requireAuth, getAllForum);
router.get("/getForumId", requireAuth, getForumById);
router.get("/getForumSubject", requireAuth, getForumBySubject);

export default router;
