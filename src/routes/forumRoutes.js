import express from "express";
import {
  createForum,
  getForums,
} from "../controllers/forumController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/createForum", requireAuth, createForum);
router.get("/getForums", requireAuth, getForums);

export default router;