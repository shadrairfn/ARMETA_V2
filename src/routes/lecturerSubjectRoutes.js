import express from "express";
import {
    getLecturers,
    getSubjects,
    createLecturer,
    updateLecturer,
    deleteLecturer,
    createSubject,
    updateSubject,
    deleteSubject
} from "../controllers/lecturerSubjectController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public/User routes
router.get("/getLecturers", getLecturers);
router.get("/getSubjects", getSubjects);

// Admin routes
router.post("/lecturer", requireAdmin, createLecturer);
router.patch("/lecturer/:id", requireAdmin, updateLecturer);
router.delete("/lecturer/:id", requireAdmin, deleteLecturer);

router.post("/subject", requireAdmin, createSubject);
router.patch("/subject/:id", requireAdmin, updateSubject);
router.delete("/subject/:id", requireAdmin, deleteSubject);

export default router;
