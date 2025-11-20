import multer from "multer";

// Storage di memory (karena kita upload langsung buffer)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // max 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Hanya file JPG/PNG yang diperbolehkan"), false);
    }

    cb(null, true);
  },
});

export default upload;