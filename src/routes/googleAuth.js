// routes/googleAuth.js
import express from "express";
import passport from "passport";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../service/tokenService.js";
import { db } from "../db/db.js";
import { users } from "../db/schema/schema.js";
import { eq } from "drizzle-orm";

console.log("🔧 googleAuth.js module loaded!");

const router = express.Router();

// Step 1: Redirect ke Google
router.get(
  "/google/login",
  (req, res, next) => {
    console.log("\n==========================================");
    console.log("➡️  /auth/google HIT");
    console.log("==========================================\n");
    next();
  },
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Step 2: Callback dari Google
router.get(
  "/google/callback",
  (req, res, next) => {
    console.log("\n🔥 CALLBACK HIT:", req.query);
    next();
  },
  passport.authenticate("google", { failureRedirect: "/login.html", session: true }),

  async (req, res) => {
    console.log("\n🎯 AFTER PASSPORT AUTH:", req.user);

    if (!req.user) {
      console.log("❌ ERROR: req.user is NULL");
      return res.redirect("/login.html");
    }

    try {
      const accessToken = generateAccessToken({
        id_user: req.user.id_user,
        email: req.user.email,
        name: req.user.name,
      });

      const refreshToken = generateRefreshToken({
        id_user: req.user.id_user,
      });

      console.log("\n📝 UPDATE REFRESH TOKEN", {
        userId: req.user.id_user,
        refreshToken,
      });

      const updated = await db
        .update(users)
        .set({ refreshToken })
        .where(eq(users.id_user, req.user.id_user))
        .returning();

      console.log("📌 UPDATED USER:", updated);

      const callbackUrl =
        `http://localhost:3001/auth/callback` +
        `?accessToken=${encodeURIComponent(accessToken)}` +
        `&refreshToken=${encodeURIComponent(refreshToken)}`;

      console.log("\n🔁 REDIRECTING TO:", callbackUrl);
      return res.redirect(callbackUrl);
    } catch (err) {
      console.log("\n❌ CALLBACK ERROR:", err);
      return res.redirect("/login.html");
    }
  }
);


export default router;
