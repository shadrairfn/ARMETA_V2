import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

dotenv.config();

const pool = new Pool({
	connectionString: process.env.DATABASE_SUPABASE,
});

export const db = drizzle(pool);

export const connectDB = async () => {
	try {
		await pool.query("SELECT NOW()");
		console.log("Database connected successfully");
	} catch (error) {
		console.error("Database connection failed:", error);
		process.exit(1);
	}
};
