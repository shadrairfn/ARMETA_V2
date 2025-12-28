import {
    createUlasan,
    editUlasan,
    getAllUlasan,
    likeUlasan,
    bookmarkUlasan,
    unLikeUlasan,
    unBookmarkUlasan,
    getBookmarkUlasan,
    getLikeUlasan,
    deleteUlasan,
    getUlasanById
} from "../controllers/ulasanController.js";
import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.post(
    "/createUlasan",
    requireAuth,
    upload.array("files"),
    createUlasan
);

router.patch(
    "/editUlasan",
    requireAuth,
    upload.array("files"),
    editUlasan
);

router.get(
    "/getUlasan",
    requireAuth,
    getAllUlasan
);

router.get(
    "/getUlasanById",
    requireAuth,
    getUlasanById
)

router.post(
    "/likeUlasan",
    requireAuth,
    likeUlasan
);

router.post(
    "/bookmarkUlasan",
    requireAuth,
    bookmarkUlasan
);

router.delete(
    "/likeUlasan",
    requireAuth,
    unLikeUlasan
);

router.delete(
    "/bookmarkUlasan",
    requireAuth,
    unBookmarkUlasan
);

router.get(
    "/likeUlasan",
    requireAuth,
    getLikeUlasan
);

router.get(
    "/bookmarkUlasan",
    requireAuth,
    getBookmarkUlasan
);

router.delete(
    "/deleteUlasan",
    requireAuth,
    deleteUlasan
);

export default router;
