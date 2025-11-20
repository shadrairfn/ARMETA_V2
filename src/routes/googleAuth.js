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
  "/google",
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
    next();
  },
  passport.authenticate("google", {
    failureRedirect: "/login.html",
    session: true, 
  }),
  async (req, res) => {
    try {
      console.log("req.user:", req.user);

      if (!req.user || !req.user.id_user) {
        console.error("req.user tidak ada atau id_user tidak ditemukan");
        return res.redirect("/login.html");
      }

      // Generate JWT tokens
      const accessToken = generateAccessToken({
        id_user: req.user.id_user,
        email: req.user.email,
        nama: req.user.nama,
      });

      const refreshToken = generateRefreshToken({
        id_user: req.user.id_user,
      });

      const updated = await db
        .update(users)
        .set({ refreshToken })
        .where(eq(users.id_user, req.user.id_user))
        .returning();

      // Redirect ke frontend callback.html dengan query token
      const callbackUrl = `/callback.html?accessToken=${encodeURIComponent(
        accessToken
      )}&refreshToken=${encodeURIComponent(refreshToken)}`;

      console.log("🔁 Redirecting to:", callbackUrl);
      res.redirect(callbackUrl);
    } catch (error) {
      console.error("Error in Google callback handler:", error);
      res.redirect("/login.html");
    }
  }
);

export default router;
