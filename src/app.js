// app.js
import express from "express";
import session from "express-session";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// ✅ Load konfigurasi Passport (strategy Google, serialize, deserialize)
import "./config/passport.js";
import passport from "passport";

import authRoutes from "./routes/googleAuth.js";
import userRoutes from "./routes/userRoutes.js";
import ulasanRoutes from "./routes/ulasanRoutes.js";
import chatbotRoutes from "./routes/chatbotRoutes.js";
import forumRoutes from "./routes/forumRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import lecturerSubjectRoutes from "./routes/lecturerSubjectRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration
app.use(
  cors({
    origin: "http://localhost:3001",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url}`);
  next();
});

const publicPath = path.join(__dirname, "..", "test-frontend");
console.log("📁 Serving static files from:", publicPath);
app.use(express.static(publicPath));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "armeta-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/ulasan", ulasanRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/lecturer-subjects", lecturerSubjectRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "ARMETA API Server is running",
    version: "1.0.0",
  });
});

// 404 & Error handler
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
