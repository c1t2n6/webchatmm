// Configuration for WebChat Node.js Application
require('dotenv').config();

const config = {
  // Server Configuration
  port: process.env.PORT || 8000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'sqlite:///./app.db',
  
  // JWT Configuration
  jwt: {
    secretKey: process.env.JWT_SECRET_KEY || 'webchat-super-secret-jwt-key-2024',
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
    accessTokenExpireMinutes: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES) || 60
  },
  
  // Security
  secretKey: process.env.SECRET_KEY || 'webchat-super-secret-key-2024',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  
  // Feature Flags
  features: {
    enableVoice: process.env.ENABLE_VOICE === 'true',
    enableCaptcha: process.env.ENABLE_CAPTCHA === 'true',
    enableDarkMode: process.env.ENABLE_DARK_MODE !== 'false'
  },
  
  // Rate Limiting
  rateLimit: {
    search: parseInt(process.env.RATE_LIMIT_SEARCH) || 5,
    upload: parseInt(process.env.RATE_LIMIT_UPLOAD) || 10,
    login: parseInt(process.env.RATE_LIMIT_LOGIN) || 3
  },
  
  // File Upload
  fileUpload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB
    uploadDir: process.env.UPLOAD_DIR || './uploads'
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'INFO',
    logFile: process.env.LOG_FILE || './logs/app.log'
  },
  
  // Admin
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123'
  }
};

module.exports = config;
