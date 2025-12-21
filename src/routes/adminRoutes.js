import express from "express";
import {
    getAdminStats,
    getAllUsers,
    toggleUserBan,
    updateUserRole,
    deleteContent,
    getAllReports,
    resolveReport
} from "../controllers/adminController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes here require Admin role
router.use(requireAdmin);

router.get("/stats", getAdminStats);
router.get("/users", getAllUsers);
router.patch("/users/:id_user/ban", toggleUserBan);
router.patch("/users/:id_user/role", updateUserRole);
router.delete("/content/:type/:id", deleteContent);
router.get("/reports", getAllReports);
router.patch("/reports/:id_report/resolve", resolveReport);

export default router;
