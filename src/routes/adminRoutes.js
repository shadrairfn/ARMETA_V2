import express from "express";
import {
    getAdminStats,
    getAllUsers,
    toggleUserBan,
    updateUserRole,
    deleteContent
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

export default router;
