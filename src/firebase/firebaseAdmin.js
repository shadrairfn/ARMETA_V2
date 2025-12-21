import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname agar bisa dipakai di ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serviceAccount;

// 1. Coba baca dari environment variable (untuk Production)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log("✅ Firebase Service Account loaded from environment variable");
  } catch (err) {
    console.error("❌ Error parsing FIREBASE_SERVICE_ACCOUNT env:", err.message);
  }
}

// 2. Jika tidak ada di env, coba baca dari file lokal (untuk Development)
if (!serviceAccount) {
  const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    console.log("✅ Firebase Service Account loaded from local file");
  } else {
    console.error("❌ Firebase Service Account not found in ENV or local file!");
  }
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_BUCKET,
  });
}

export const bucket = admin.storage().bucket();
