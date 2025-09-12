// Centralized error handling middleware
class ErrorHandler {
    constructor() {
        this.errorTypes = {
            VALIDATION_ERROR: 'ValidationError',
            AUTHENTICATION_ERROR: 'AuthenticationError',
            AUTHORIZATION_ERROR: 'AuthorizationError',
            NOT_FOUND_ERROR: 'NotFoundError',
            RATE_LIMIT_ERROR: 'RateLimitError',
            DATABASE_ERROR: 'DatabaseError',
            WEBSOCKET_ERROR: 'WebSocketError',
            INTERNAL_ERROR: 'InternalError'
        };
    }

    // Create custom error
    createError(type, message, statusCode = 500, details = {}) {
        const error = new Error(message);
        error.type = type;
        error.statusCode = statusCode;
        error.details = details;
        error.timestamp = new Date().toISOString();
        return error;
    }

    // Validation error
    validationError(message, details = {}) {
        return this.createError(
            this.errorTypes.VALIDATION_ERROR,
            message,
            400,
            details
        );
    }

    // Authentication error
    authenticationError(message = 'Authentication failed') {
        return this.createError(
            this.errorTypes.AUTHENTICATION_ERROR,
            message,
            401
        );
    }

    // Authorization error
    authorizationError(message = 'Access denied') {
        return this.createError(
            this.errorTypes.AUTHORIZATION_ERROR,
            message,
            403
        );
    }

    // Not found error
    notFoundError(message = 'Resource not found') {
        return this.createError(
            this.errorTypes.NOT_FOUND_ERROR,
            message,
            404
        );
    }

    // Rate limit error
    rateLimitError(message = 'Too many requests') {
        return this.createError(
            this.errorTypes.RATE_LIMIT_ERROR,
            message,
            429
        );
    }

    // Database error
    databaseError(message = 'Database operation failed', details = {}) {
        return this.createError(
            this.errorTypes.DATABASE_ERROR,
            message,
            500,
            details
        );
    }

    // WebSocket error
    websocketError(message = 'WebSocket operation failed') {
        return this.createError(
            this.errorTypes.WEBSOCKET_ERROR,
            message,
            500
        );
    }

    // Internal error
    internalError(message = 'Internal server error', details = {}) {
        return this.createError(
            this.errorTypes.INTERNAL_ERROR,
            message,
            500,
            details
        );
    }

    // Error handler middleware
    handleError(err, req, res, next) {
        console.error('Error occurred:', {
            type: err.type || 'Unknown',
            message: err.message,
            stack: err.stack,
            url: req.url,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: err.timestamp || new Date().toISOString()
        });

        // Default error response
        let statusCode = err.statusCode || 500;
        let errorResponse = {
            error: 'Internal Server Error',
            detail: 'Đã xảy ra lỗi không mong muốn',
            timestamp: err.timestamp || new Date().toISOString()
        };

        // Handle specific error types
        switch (err.type) {
            case this.errorTypes.VALIDATION_ERROR:
                statusCode = 400;
                errorResponse = {
                    error: 'Validation Error',
                    detail: err.message,
                    validation_errors: err.details,
                    timestamp: err.timestamp
                };
                break;

            case this.errorTypes.AUTHENTICATION_ERROR:
                statusCode = 401;
                errorResponse = {
                    error: 'Authentication Error',
                    detail: err.message,
                    timestamp: err.timestamp
                };
                break;

            case this.errorTypes.AUTHORIZATION_ERROR:
                statusCode = 403;
                errorResponse = {
                    error: 'Authorization Error',
                    detail: err.message,
                    timestamp: err.timestamp
                };
                break;

            case this.errorTypes.NOT_FOUND_ERROR:
                statusCode = 404;
                errorResponse = {
                    error: 'Not Found',
                    detail: err.message,
                    timestamp: err.timestamp
                };
                break;

            case this.errorTypes.RATE_LIMIT_ERROR:
                statusCode = 429;
                errorResponse = {
                    error: 'Too Many Requests',
                    detail: err.message,
                    retry_after: err.details.retryAfter || 60,
                    timestamp: err.timestamp
                };
                break;

            case this.errorTypes.DATABASE_ERROR:
                statusCode = 500;
                errorResponse = {
                    error: 'Database Error',
                    detail: 'Lỗi cơ sở dữ liệu',
                    timestamp: err.timestamp
                };
                break;

            case this.errorTypes.WEBSOCKET_ERROR:
                statusCode = 500;
                errorResponse = {
                    error: 'WebSocket Error',
                    detail: 'Lỗi kết nối real-time',
                    timestamp: err.timestamp
                };
                break;

            default:
                // For unknown errors, don't expose internal details in production
                if (process.env.NODE_ENV === 'production') {
                    errorResponse = {
                        error: 'Internal Server Error',
                        detail: 'Đã xảy ra lỗi không mong muốn',
                        timestamp: err.timestamp
                    };
                } else {
                    errorResponse = {
                        error: 'Internal Server Error',
                        detail: err.message,
                        stack: err.stack,
                        timestamp: err.timestamp
                    };
                }
        }

        res.status(statusCode).json(errorResponse);
    }

    // Async error wrapper
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    // 404 handler
    notFoundHandler(req, res, next) {
        const error = this.notFoundError(`Endpoint ${req.method} ${req.url} not found`);
        next(error);
    }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Bind methods to preserve 'this' context
errorHandler.notFoundHandler = errorHandler.notFoundHandler.bind(errorHandler);
errorHandler.handleError = errorHandler.handleError.bind(errorHandler);

module.exports = errorHandler;
