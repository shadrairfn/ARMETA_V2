import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

// Load environment variables from .env file
dotenv.config();

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		include: ["src/**/*.test.js", "src/**/*.spec.js"],
		env: {
			GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
			JWT_SECRET: process.env.JWT_SECRET,
			SUPABASE_URL: process.env.SUPABASE_URL,
			SUPABASE_KEY: process.env.SUPABASE_KEY,
			SESSION_SECRET: process.env.SESSION_SECRET,
			FRONTEND_URL: process.env.FRONTEND_URL,
		},
	},
});
