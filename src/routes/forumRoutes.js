import express from "express";
import {
  createReport,
  getReports,
} from "../controllers/reportController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/createReport", requireAuth, createReport);
router.get("/getReports", requireAuth, getReports);

export default router;