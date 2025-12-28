import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import { requireAuth } from "../authMiddleware.js";

vi.mock("jsonwebtoken");

describe("authMiddleware - requireAuth", () => {
	it("should return 401 if no token is provided", () => {
		const req = { headers: {} };
		const res = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn(),
		};
		const next = vi.fn();

		requireAuth(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.json).toHaveBeenCalledWith({ message: "Token tidak diberikan" });
		expect(next).not.toHaveBeenCalled();
	});

	it("should call next() if valid token is provided", () => {
		const req = { headers: { authorization: "Bearer valid-token" } };
		const res = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn(),
		};
		const next = vi.fn();
		const decoded = { id_user: "1", email: "test@test.com", is_banned: false };

		jwt.verify.mockImplementation((_token, _secret, callback) => {
			callback(null, decoded);
		});

		requireAuth(req, res, next);

		expect(req.user).toEqual(decoded);
		expect(next).toHaveBeenCalled();
	});

	it("should return 403 if user is banned", () => {
		const req = { headers: { authorization: "Bearer banned-token" } };
		const res = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn(),
		};
		const next = vi.fn();
		const decoded = { id_user: "1", email: "test@test.com", is_banned: true };

		jwt.verify.mockImplementation((_token, _secret, callback) => {
			callback(null, decoded);
		});

		requireAuth(req, res, next);

		expect(res.status).toHaveBeenCalledWith(403);
		expect(res.json).toHaveBeenCalledWith({ message: "Akun Anda telah ditangguhkan (banned)" });
		expect(next).not.toHaveBeenCalled();
	});
});
