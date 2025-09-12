// Input validation middleware
const validation = {
    // Username validation
    validateUsername: (username) => {
        if (!username || typeof username !== 'string') {
            return { valid: false, error: 'Tên đăng nhập không hợp lệ' };
        }
        
        const trimmed = username.trim();
        if (trimmed.length < 3 || trimmed.length > 20) {
            return { valid: false, error: 'Tên đăng nhập phải từ 3-20 ký tự' };
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
            return { valid: false, error: 'Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới' };
        }
        
        return { valid: true, value: trimmed };
    },

    // Password validation
    validatePassword: (password) => {
        if (!password || typeof password !== 'string') {
            return { valid: false, error: 'Mật khẩu không hợp lệ' };
        }
        
        if (password.length < 6) {
            return { valid: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' };
        }
        
        if (password.length > 128) {
            return { valid: false, error: 'Mật khẩu không được quá 128 ký tự' };
        }
        
        return { valid: true, value: password };
    },

    // Email validation
    validateEmail: (email) => {
        if (!email || typeof email !== 'string') {
            return { valid: false, error: 'Email không hợp lệ' };
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, error: 'Email không đúng định dạng' };
        }
        
        if (email.length > 120) {
            return { valid: false, error: 'Email không được quá 120 ký tự' };
        }
        
        return { valid: true, value: email.toLowerCase().trim() };
    },

    // Message content validation
    validateMessage: (content) => {
        if (!content || typeof content !== 'string') {
            return { valid: false, error: 'Nội dung tin nhắn không hợp lệ' };
        }
        
        const trimmed = content.trim();
        if (trimmed.length === 0) {
            return { valid: false, error: 'Tin nhắn không được để trống' };
        }
        
        if (trimmed.length > 1000) {
            return { valid: false, error: 'Tin nhắn không được quá 1000 ký tự' };
        }
        
        // Check for potentially malicious content
        const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /<iframe/i,
            /<object/i,
            /<embed/i
        ];
        
        for (const pattern of dangerousPatterns) {
            if (pattern.test(trimmed)) {
                return { valid: false, error: 'Tin nhắn chứa nội dung không được phép' };
            }
        }
        
        return { valid: true, value: trimmed };
    },

    // Room ID validation
    validateRoomId: (roomId) => {
        if (!roomId) {
            return { valid: false, error: 'Room ID không được để trống' };
        }
        
        const id = parseInt(roomId);
        if (isNaN(id) || id <= 0) {
            return { valid: false, error: 'Room ID không hợp lệ' };
        }
        
        return { valid: true, value: id };
    },

    // User ID validation
    validateUserId: (userId) => {
        if (!userId) {
            return { valid: false, error: 'User ID không được để trống' };
        }
        
        const id = parseInt(userId);
        if (isNaN(id) || id <= 0) {
            return { valid: false, error: 'User ID không hợp lệ' };
        }
        
        return { valid: true, value: id };
    },

    // Sanitize HTML content
    sanitizeHtml: (content) => {
        if (!content || typeof content !== 'string') {
            return '';
        }
        
        return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
};

// Middleware factory for validation
const createValidationMiddleware = (validationRules) => {
    return (req, res, next) => {
        const errors = [];
        const sanitizedData = {};

        for (const [field, validator] of Object.entries(validationRules)) {
            const value = req.body[field];
            const result = validator(value);
            
            if (!result.valid) {
                errors.push({
                    field,
                    message: result.error
                });
            } else {
                sanitizedData[field] = result.value;
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation error',
                detail: 'Dữ liệu đầu vào không hợp lệ',
                validation_errors: errors
            });
        }

        // Add sanitized data to request
        req.sanitizedData = sanitizedData;
        next();
    };
};

// Predefined validation middlewares
const validateSignup = createValidationMiddleware({
    username: validation.validateUsername,
    password: validation.validatePassword,
    email: validation.validateEmail
});

const validateLogin = createValidationMiddleware({
    username: validation.validateUsername,
    password: validation.validatePassword
});

const validateMessage = createValidationMiddleware({
    content: validation.validateMessage
});

const validateRoomId = createValidationMiddleware({
    roomId: validation.validateRoomId
});

module.exports = {
    validation,
    createValidationMiddleware,
    validateSignup,
    validateLogin,
    validateMessage,
    validateRoomId
};
