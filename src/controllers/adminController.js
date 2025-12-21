import { db } from "../db/db.js";
import { users, reviews, reviewsForum, reports, lecturers, subjects } from "../db/schema/schema.js";
import { eq, sql, count, desc, gte, and, lte } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler.js";
import { NotFoundError } from "../utils/customError.js";

// --- Stats ---
const getAdminStats = asyncHandler(async (req, res) => {
    // Basic Counts
    const [userCount] = await db.select({ value: count() }).from(users);
    const [reviewCount] = await db.select({ value: count() }).from(reviews);
    const [forumCount] = await db.select({ value: count() }).from(reviewsForum);
    const [reportCount] = await db.select({ value: count() }).from(reports).where(eq(reports.status, "Pending"));

    // User status breakdown
    const [bannedCount] = await db.select({ value: count() }).from(users).where(eq(users.is_banned, true));

    // Content trends (last 7 days grouped by date)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const reviewTrends = await db.select({
        date: sql`DATE(created_at)`,
        count: count()
    })
        .from(reviews)
        .where(gte(reviews.created_at, sevenDaysAgo))
        .groupBy(sql`DATE(created_at)`)
        .orderBy(sql`DATE(created_at) ASC`);

    const forumTrends = await db.select({
        date: sql`DATE(created_at)`,
        count: count()
    })
        .from(reviewsForum)
        .where(gte(reviewsForum.created_at, sevenDaysAgo))
        .groupBy(sql`DATE(created_at)`)
        .orderBy(sql`DATE(created_at) ASC`);

    // Top lecturers (most reviewed)
    const topLecturers = await db.select({
        id: lecturers.id_lecturer,
        name: lecturers.name,
        review_count: count(reviews.id_review)
    })
        .from(lecturers)
        .leftJoin(reviews, eq(lecturers.id_lecturer, reviews.id_lecturer))
        .groupBy(lecturers.id_lecturer, lecturers.name)
        .orderBy(desc(count(reviews.id_review)))
        .limit(5);

    return res.status(200).json({
        status: true,
        data: {
            totalUsers: userCount.value,
            totalReviews: reviewCount.value,
            totalForums: forumCount.value,
            pendingReports: reportCount.value,
            bannedUsers: bannedCount.value,
            activeUsers: Number(userCount.value) - Number(bannedCount.value),
            trends: {
                reviews: reviewTrends,
                forums: forumTrends
            },
            topLecturers
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

// --- Reports ---
const getAllReports = asyncHandler(async (req, res) => {
    const allReports = await db.select({
        id_report: reports.id_report,
        reason: reports.type,
        description: reports.body,
        status: reports.status,
        id_review: reports.id_review,
        id_forum: reports.id_forum,
        id_lecturer: reports.id_lecturer,
        created_at: reports.created_at,
        reporter: {
            name: users.name,
            email: users.email
        }
    })
        .from(reports)
        .leftJoin(users, eq(reports.id_user, users.id_user))
        .orderBy(sql`${reports.created_at} DESC`);

    return res.status(200).json({
        status: true,
        data: allReports,
    });
});

const resolveReport = asyncHandler(async (req, res) => {
    const { id_report } = req.params;
    const { status } = req.body; // "Resolved", "Ignored"

    const [updatedReport] = await db
        .update(reports)
        .set({ status })
        .where(eq(reports.id_report, id_report))
        .returning();

    if (!updatedReport) throw new NotFoundError("Report not found");

    return res.status(200).json({
        status: true,
        message: `Report marked as ${status}`,
        data: updatedReport
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
    deleteContent,
    getAllReports,
    resolveReport
};
