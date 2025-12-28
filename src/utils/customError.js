/**
 * Custom Error Classes
 * Untuk membuat error yang lebih spesifik dan mudah di-handle
 */

/**
 * Base Custom Error Class
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Untuk membedakan operational error vs programming error

    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad Request') {
    super(message, 400);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized - Please login') {
    super(message, 401);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class TokenError extends AppError {
  constructor(message = 'Invalid or expired token') {
    super(message, 401);
  }
}

export {
  AppError,
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  TokenError
};
