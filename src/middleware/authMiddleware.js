import jwt from "jsonwebtoken";

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({ message: "Token tidak diberikan" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .json({ message: "Token tidak valid atau sudah kedaluwarsa" });
    }

    console.log(" ================= decoded ================");
    console.log(decoded);
    console.log(" ================= decoded ================");

    req.user = decoded; // { id_user, email, nama, role, is_banned }

    if (decoded.is_banned) {
      return res.status(403).json({ message: "Akun Anda telah ditangguhkan (banned)" });
    }

    next();
  });
};

export const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak. Memerlukan hak akses Admin." });
    }
    next();
  });
};
