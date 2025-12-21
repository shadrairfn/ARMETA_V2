import { db } from "../db/db.js";
import { users, reviews, reviewsForum, reports, lecturers, subjects } from "../db/schema/schema.js";
import { eq, sql, count } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler.js";
import { NotFoundError } from "../utils/customError.js";

// --- Stats ---
const getAdminStats = asyncHandler(async (req, res) => {
    const [userCount] = await db.select({ value: count() }).from(users);
    const [reviewCount] = await db.select({ value: count() }).from(reviews);
    const [forumCount] = await db.select({ value: count() }).from(reviewsForum);
    const [reportCount] = await db.select({ value: count() }).from(reports).where(eq(reports.status, "Pending"));

    return res.status(200).json({
        status: true,
        data: {
            totalUsers: userCount.value,
            totalReviews: reviewCount.value,
            totalForums: forumCount.value,
            pendingReports: reportCount.value,
        }
    });
});

// --- User Management ---
const getAllUsers = asyncHandler(async (req, res) => {
    const allUsers = await db.select({
        id_user: users.id_user,
        name: users.name,
        email: users.email,
        role: users.role,
        is_banned: users.is_banned,
        poin: users.poin,
        created_at: users.created_at
    }).from(users);

    return res.status(200).json({
        status: true,
        data: allUsers,
    });
});

const toggleUserBan = asyncHandler(async (req, res) => {
    const { id_user } = req.params;

    const [user] = await db.select().from(users).where(eq(users.id_user, id_user)).limit(1);
    if (!user) throw new NotFoundError("User not found");

    const [updatedUser] = await db
        .update(users)
        .set({ is_banned: !user.is_banned })
        .where(eq(users.id_user, id_user))
        .returning();

    return res.status(200).json({
        status: true,
        message: `User ${updatedUser.is_banned ? 'banned' : 'unbanned'} successfully`,
        data: updatedUser
    });
});

const updateUserRole = asyncHandler(async (req, res) => {
    const { id_user } = req.params;
    const { role } = req.body;

    if (!["user", "admin", "moderator"].includes(role)) {
        throw new Error("Invalid role type");
    }

    const [updatedUser] = await db
        .update(users)
        .set({ role })
        .where(eq(users.id_user, id_user))
        .returning();

    if (!updatedUser) throw new NotFoundError("User not found");

    return res.status(200).json({
        status: true,
        message: "User role updated successfully",
        data: updatedUser
    });
});

// --- Content Moderation ---
const deleteContent = asyncHandler(async (req, res) => {
    const { type, id } = req.params;

    let result;
    if (type === "review") {
        result = await db.delete(reviews).where(eq(reviews.id_review, id)).returning();
    } else if (type === "forum") {
        result = await db.delete(reviewsForum).where(eq(reviewsForum.id_forum, id)).returning();
    } else {
        throw new Error("Invalid content type");
    }

    if (result.length === 0) throw new NotFoundError("Content not found");

    return res.status(200).json({
        status: true,
        message: "Content deleted successfully by admin",
    });
});

export {
    getAdminStats,
    getAllUsers,
    toggleUserBan,
    updateUserRole,
    deleteContent
};
