import express from "express";
import { askChatbot, getChatHistory } from "../controllers/chatbotController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/ask", requireAuth, askChatbot);
router.get("/history", requireAuth, getChatHistory);

export default router;
