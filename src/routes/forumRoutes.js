import express from "express";
import {
  createForum,
  getForums,
  searchForum,
  filterForum
} from "../controllers/forumController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.post("/createForum", requireAuth, upload.array("files"), createForum);
router.get("/getForums", requireAuth, getForums);
router.get("/searchForum", requireAuth, searchForum);
router.get("/filterForum", requireAuth, filterForum);

export default router;
