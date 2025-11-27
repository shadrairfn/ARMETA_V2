// config/passport.js
import "dotenv/config";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { db } from "../db/db.js";
import { users } from "../db/schema/schema.js";
import { eq } from "drizzle-orm";

console.log("🔧 passport.js config loaded!");

// ====== Google Strategy ======
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "http://127.0.0.1:3000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        const image = profile.photos?.[0]?.value || null;

        if (!email) {
          console.error("❌ Google profile has no email");
          return done(new Error("Email not found in Google profile"), null);
        }

        // Cek user
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.email, email));

        if (existingUser.length > 0) {
          console.log("🔍 Existing user:", {
            id_user: existingUser[0].id_user,
            email: existingUser[0].email,
          });
          return done(null, existingUser[0]);
        }

        // Insert user baru
        console.log("✨ Creating new user:", { email, name });
        const newUserArr = await db
          .insert(users)
          .values({
            name,
            email,
            image,
            poin: 0,
          })
          .returning();

        const newUser = newUserArr[0];
        console.log("✅ New user created:", {
          id_user: newUser.id_user,
          email: newUser.email,
        });

        return done(null, newUser);
      } catch (error) {
        console.error("❌ Error in GoogleStrategy:", error);
        return done(error, null);
      }
    }
  )
);

// ====== Serialize & Deserialize ======
passport.serializeUser((user, done) => {
  console.log("💾 serializeUser:", user.id_user);
  done(null, user.id_user);
});

passport.deserializeUser(async (id, done) => {
  try {
    const userArr = await db.select().from(users).where(eq(users.id_user, id));

    if (userArr.length === 0) {
      return done(null, false);
    }

    console.log("📥 deserializeUser:", userArr[0].id_user);
    done(null, userArr[0]);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
