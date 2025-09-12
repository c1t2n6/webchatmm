// Rate limiting middleware
class RateLimiter {
    constructor() {
        this.requests = new Map();
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000); // Cleanup every minute
    }

    // Clean up expired entries
    cleanup() {
        const now = Date.now();
        for (const [key, data] of this.requests.entries()) {
            if (now - data.firstRequest > data.windowMs) {
                this.requests.delete(key);
            }
        }
    }

    // Check if request is allowed
    isAllowed(identifier, maxRequests, windowMs) {
        const now = Date.now();
        const key = identifier;

        if (!this.requests.has(key)) {
            this.requests.set(key, {
                count: 1,
                firstRequest: now,
                windowMs: windowMs
            });
            return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
        }

        const data = this.requests.get(key);
        
        // Reset window if expired
        if (now - data.firstRequest > windowMs) {
            data.count = 1;
            data.firstRequest = now;
            return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
        }

        // Check if limit exceeded
        if (data.count >= maxRequests) {
            return { 
                allowed: false, 
                remaining: 0, 
                resetTime: data.firstRequest + windowMs,
                retryAfter: Math.ceil((data.firstRequest + windowMs - now) / 1000)
            };
        }

        // Increment counter
        data.count++;
        return { 
            allowed: true, 
            remaining: maxRequests - data.count, 
            resetTime: data.firstRequest + windowMs 
        };
    }

    // Create rate limiting middleware
    createMiddleware(options = {}) {
        const {
            windowMs = 15 * 60 * 1000, // 15 minutes
            maxRequests = 100,
            keyGenerator = (req) => req.ip,
            skipSuccessfulRequests = false,
            skipFailedRequests = false,
            message = 'Quá nhiều yêu cầu, vui lòng thử lại sau'
        } = options;

        return (req, res, next) => {
            const identifier = keyGenerator(req);
            const result = this.isAllowed(identifier, maxRequests, windowMs);

            // Set rate limit headers
            res.set({
                'X-RateLimit-Limit': maxRequests,
                'X-RateLimit-Remaining': result.remaining,
                'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
            });

            if (!result.allowed) {
                res.set('Retry-After', result.retryAfter);
                return res.status(429).json({
                    error: 'Too Many Requests',
                    detail: message,
                    retry_after: result.retryAfter
                });
            }

            next();
        };
    }

    // Cleanup on shutdown
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.requests.clear();
    }
}

// Create global rate limiter instance
const rateLimiter = new RateLimiter();

// Predefined rate limiting middlewares
const generalLimiter = rateLimiter.createMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // 1000 requests per 15 minutes
    message: 'Quá nhiều yêu cầu, vui lòng thử lại sau'
});

const authLimiter = rateLimiter.createMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 auth attempts per 15 minutes
    keyGenerator: (req) => `auth:${req.ip}`,
    message: 'Quá nhiều lần đăng nhập, vui lòng thử lại sau'
});

const searchLimiter = rateLimiter.createMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 searches per minute
    keyGenerator: (req) => `search:${req.user?.id || req.ip}`,
    message: 'Quá nhiều lần tìm kiếm, vui lòng chờ một chút'
});

const messageLimiter = rateLimiter.createMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 messages per minute
    keyGenerator: (req) => `message:${req.user?.id || req.ip}`,
    message: 'Gửi tin nhắn quá nhanh, vui lòng chậm lại'
});

const uploadLimiter = rateLimiter.createMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute
    keyGenerator: (req) => `upload:${req.user?.id || req.ip}`,
    message: 'Upload quá nhiều file, vui lòng chờ một chút'
});

module.exports = {
    RateLimiter,
    rateLimiter,
    generalLimiter,
    authLimiter,
    searchLimiter,
    messageLimiter,
    uploadLimiter
};
