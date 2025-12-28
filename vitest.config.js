import { defineConfig } from 'vitest/config'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['src/**/*.test.js', 'src/**/*.spec.js'],
        env: {
            // Use real env vars if available, fallback to dummy values
            GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'dummy-client-id',
            GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'dummy-client-secret',
            JWT_SECRET: process.env.JWT_SECRET || 'dummy-jwt-secret',
            SUPABASE_URL: process.env.SUPABASE_URL || 'https://dummy.supabase.co',
            SUPABASE_KEY: process.env.SUPABASE_KEY || 'dummy-key',
            SESSION_SECRET: process.env.SESSION_SECRET || 'dummy-session-secret',
            FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
        }
    },
})
