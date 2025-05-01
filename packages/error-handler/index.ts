export class AppError extends Error {
    public readonly status_code: number;
    public readonly is_operational: boolean;
    public readonly details: any;

    constructor(message: string, status_code: number, is_operational = true, details?: any) {
        super(message);
        this.status_code = status_code;
        this.is_operational = is_operational;
        this.details = details;
        Error.captureStackTrace(this);
    };
};

// Not found error
export class NotFoundError extends AppError {
    constructor(message = "Resources not found") {
        super(message, 404);
    };
};

// Validation error
export class ValidationError extends AppError {
    constructor(message = "Invalid request data", details?: any) {
        super(message, 400, true, details);
    };
};

// Forbidden error
export class ForbiddenError extends AppError {
    constructor(message = "Forbidden access") {
        super(message, 403);
    };
};

// Database error
export class DatabaseError extends AppError {
    constructor(message = "Database error", details?: any) {
        super(message, 500, true, details);
    };
};

// Authentication error
export class AuthError extends AppError {
    constructor(message = "Unauthorized", details?: any) {
        super(message, 401, true, details);
    };
};

// RateLimiter error
export class RateLimiterError extends AppError {
    constructor(message = "Too many requests, please try again later") {
        super(message, 429);
    };
};