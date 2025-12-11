import express from "express";
import {
    getLecturers,
    getSubjects
} from "../controllers/lecturerSubjectController.js";
// import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/getLecturers", getLecturers);
router.get("/getSubjects", getSubjects);

export default router;
