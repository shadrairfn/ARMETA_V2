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
        "http://localhost:3000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const nama = profile.displayName;
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
          const { password, ...userWithoutPassword } = existingUser[0];
          console.log("🔍 Existing user:", {
            id_user: userWithoutPassword.id_user,
            email: userWithoutPassword.email,
          });
          return done(null, userWithoutPassword);
        }

        // Insert user baru
        console.log("✨ Creating new user:", { email, nama });
        const newUserArr = await db
          .insert(users)
          .values({
            nama,
            email,
            password: "GOOGLE_OAUTH", // placeholder since Google login
            image,
            poin_reputasi: 0,
          })
          .returning();

        const newUser = newUserArr[0];
        const { password, ...userWithoutPassword } = newUser;
        console.log("✅ New user created:", {
          id_user: userWithoutPassword.id_user,
          email: userWithoutPassword.email,
        });

        return done(null, userWithoutPassword);
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

    const { password, ...userWithoutPassword } = userArr[0];
    console.log("📥 deserializeUser:", userWithoutPassword.id_user);
    done(null, userWithoutPassword);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
