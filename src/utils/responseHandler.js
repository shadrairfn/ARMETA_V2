/**
 * Response Handler Utility
 * Standardisasi format response API
 */

/**
 * Success Response
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {String} message - Success message
 * @param {*} data - Response data
 */
export const successResponse = (res, statusCode = 200, message = "Success", data = null) => {
	const response = {
		success: true,
		message,
		...(data && { data }),
	};

	return res.status(statusCode).json(response);
};

/**
 * Error Response
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {String} message - Error message
 * @param {*} errors - Error details (optional)
 */
export const errorResponse = (
	res,
	statusCode = 500,
	message = "Internal Server Error",
	errors = null
) => {
	const response = {
		success: false,
		message,
		...(errors && { errors }),
	};

	return res.status(statusCode).json(response);
};

/**
 * Pagination Response
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {String} message - Success message
 * @param {Array} data - Response data array
 * @param {Object} pagination - Pagination info
 */
export const paginationResponse = (
	res,
	statusCode = 200,
	message = "Success",
	data = [],
	pagination = {}
) => {
	const response = {
		success: true,
		message,
		data,
		pagination: {
			page: pagination.page || 1,
			limit: pagination.limit || 10,
			totalItems: pagination.totalItems || 0,
			totalPages: pagination.totalPages || 0,
			hasNextPage: pagination.hasNextPage || false,
			hasPrevPage: pagination.hasPrevPage || false,
		},
	};

	return res.status(statusCode).json(response);
};

/**
 * Created Response (201)
 */
export const createdResponse = (res, message = "Resource created successfully", data = null) => {
	return successResponse(res, 201, message, data);
};

/**
 * No Content Response (204)
 */
export const noContentResponse = (res) => {
	return res.status(204).send();
};

/**
 * Bad Request Response (400)
 */
export const badRequestResponse = (res, message = "Bad Request", errors = null) => {
	return errorResponse(res, 400, message, errors);
};

/**
 * Unauthorized Response (401)
 */
export const unauthorizedResponse = (res, message = "Unauthorized") => {
	return errorResponse(res, 401, message);
};

/**
 * Forbidden Response (403)
 */
export const forbiddenResponse = (res, message = "Forbidden") => {
	return errorResponse(res, 403, message);
};

/**
 * Not Found Response (404)
 */
export const notFoundResponse = (res, message = "Resource not found") => {
	return errorResponse(res, 404, message);
};

/**
 * Conflict Response (409)
 */
export const conflictResponse = (res, message = "Resource already exists") => {
	return errorResponse(res, 409, message);
};

/**
 * Validation Error Response (422)
 */
export const validationErrorResponse = (res, message = "Validation Error", errors = null) => {
	return errorResponse(res, 422, message, errors);
};

/**
 * Internal Server Error Response (500)
 */
export const serverErrorResponse = (res, message = "Internal Server Error") => {
	return errorResponse(res, 500, message);
};
