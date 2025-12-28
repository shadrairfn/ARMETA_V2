/**
 * Error Handler Middleware
 * Centralized error handling untuk seluruh aplikasi
 */

import { AppError } from "../utils/customError.js";

/**
 * Error Handler Middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
export const errorHandler = (err, _req, res, _next) => {
	// Set default values
	let statusCode = err.statusCode || 500;
	let message = err.message || "Internal Server Error";
	let errors = err.errors || null;

	// Handle specific error types

	// JWT Errors
	if (err.name === "JsonWebTokenError") {
		statusCode = 401;
		message = "Invalid token";
	}

	if (err.name === "TokenExpiredError") {
		statusCode = 401;
		message = "Token expired";
	}

	// Database Errors (PostgreSQL)
	if (err.code === "23505") {
		// Unique constraint violation
		statusCode = 409;
		message = "Duplicate entry - Resource already exists";
	}

	if (err.code === "23503") {
		// Foreign key constraint violation
		statusCode = 400;
		message = "Invalid reference - Related resource not found";
	}

	if (err.code === "23502") {
		// Not null violation
		statusCode = 400;
		message = "Missing required field";
	}

	if (err.code === "22P02") {
		// Invalid UUID format or similar data type conversion errors
		statusCode = 404;
		message = "Resource not found or invalid ID format";
	}

	// Validation Errors
	if (err.name === "ValidationError") {
		statusCode = 422;
		message = "Validation Error";
		errors = err.errors;
	}

	// Cast Errors
	if (err.name === "CastError") {
		statusCode = 400;
		message = "Invalid data format";
	}

	// Log error (hanya di development)
	if (process.env.NODE_ENV === "development") {
		console.error("Error:", {
			message: err.message,
			statusCode,
			stack: err.stack,
			...(errors && { errors }),
		});
	}

	// Send error response
	const response = {
		success: false,
		message,
		...(errors && { errors }),
		...(process.env.NODE_ENV === "development" && {
			stack: err.stack,
		}),
	};

	return res.status(statusCode).json(response);
};

/**
 * 404 Not Found Handler
 * Untuk route yang tidak ditemukan
 */
export const notFoundHandler = (req, _res, next) => {
	const error = new AppError(`Route ${req.originalUrl} not found`, 404);
	next(error);
};

/**
 * Async Error Wrapper (alternative)
 * Bisa digunakan jika tidak mau menggunakan asyncHandler di setiap route
 */
export const catchAsync = (fn) => {
	return (req, res, next) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
};

export default errorHandler;
