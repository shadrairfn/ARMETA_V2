// server.js
import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./db/db.js"; // ✅ perbaiki .js.js kalau tadi typo

const PORT = process.env.PORT || 3000;

// Global error handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
});

// Start server setelah DB connect
(async () => {
  try {
    await connectDB();
    console.log("✅ PostgreSQL connected successfully");

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://127.0.0.1:${PORT}/`);
    });

    server.on("close", () => {
      console.log("⚠️  Server closed!");
    });
  } catch (err) {
    console.error("❌ PostgreSQL Connection Error:", err);
    process.exit(1);
  }
})();
