// routes/googleAuth.js

import { eq } from "drizzle-orm";
import express from "express";
import passport from "passport";
import { db } from "../db/db.js";
import { users } from "../db/schema/schema.js";
import { generateAccessToken, generateRefreshToken } from "../service/tokenService.js";

console.log("🔧 googleAuth.js module loaded!");

const router = express.Router();

// Step 1: Redirect ke Google
router.get(
	"/google/login",
	(_req, _res, next) => {
		console.log("\n==========================================");
		console.log("➡️  /auth/google HIT");
		console.log("==========================================\n");
		next();
	},
	passport.authenticate("google", { scope: ["profile", "email"] })
);

// Step 2: Callback dari Google
router.get("/google/callback", (req, res, next) => {
	console.log("\n🔥 CALLBACK HIT:", req.query);

	// Menggunakan Custom Callback agar bisa handle error/cancel dengan fleksibel
	passport.authenticate("google", { session: true }, async (err, user, _info) => {
		// 1. HANDLE JIKA ERROR ATAU USER CANCEL
		if (err || !user) {
			console.log("❌ Auth Error atau User Cancel:", err);
			// Redirect paksa ke URL Frontend Login
			// Pastikan FRONTEND_URL sudah diset di .env (misal: http://localhost:5173)
			return res.redirect(`${process.env.FRONTEND_URL}`);
		}

		// 2. HANDLE JIKA SUKSES (Logika asli kamu dipindah ke sini)
		console.log("\n🎯 AFTER PASSPORT AUTH:", user);

		try {
			const accessToken = generateAccessToken({
				id_user: user.id_user,
				email: user.email,
				name: user.name,
				role: user.role,
				is_banned: user.is_banned,
			});

			const refreshToken = generateRefreshToken({
				id_user: user.id_user,
			});

			console.log("\n📝 UPDATE REFRESH TOKEN", {
				userId: user.id_user,
				refreshToken,
			});

			const updated = await db
				.update(users)
				.set({ refreshToken })
				.where(eq(users.id_user, user.id_user))
				.returning();

			console.log("📌 UPDATED USER:", updated);

			const callbackUrl = `?accessToken=${encodeURIComponent(
				accessToken
			)}&refreshToken=${encodeURIComponent(refreshToken)}`;

			console.log("\n🔁 REDIRECTING TO FRONTEND:", process.env.FRONTEND_URL);

			// Redirect ke Frontend dengan Token
			return res.redirect(`${process.env.FRONTEND_URL}/auth/google/callback${callbackUrl}`);
		} catch (err) {
			console.log("\n❌ CALLBACK SYSTEM ERROR:", err);
			// Jika terjadi error sistem, kembalikan ke login frontend
			return res.redirect(`${process.env.FRONTEND_URL}/login`);
		}
	})(req, res, next); // <--- Jangan lupa eksekusi fungsi passport di sini
});

export default router;
