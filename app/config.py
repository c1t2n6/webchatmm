import os
from typing import Optional

class Settings:
    def __init__(self):
        # Database
        self.database_url = os.getenv("DATABASE_URL", "sqlite:///./app.db")
        
        # JWT
        self.jwt_secret_key = os.getenv("JWT_SECRET_KEY", "your-super-secret-jwt-key-here")
        self.jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        self.jwt_access_token_expire_minutes = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
        
        # Security
        self.secret_key = os.getenv("SECRET_KEY", "your-super-secret-key-here")
        self.bcrypt_rounds = int(os.getenv("BCRYPT_ROUNDS", "12"))
        
        # Feature Flags
        self.enable_voice = os.getenv("ENABLE_VOICE", "false").lower() == "true"
        self.enable_captcha = os.getenv("ENABLE_CAPTCHA", "false").lower() == "true"
        self.enable_dark_mode = os.getenv("ENABLE_DARK_MODE", "true").lower() == "true"
        
        # Rate Limiting
        self.rate_limit_search = int(os.getenv("RATE_LIMIT_SEARCH", "5"))
        self.rate_limit_upload = int(os.getenv("RATE_LIMIT_UPLOAD", "10"))
        self.rate_limit_login = int(os.getenv("RATE_LIMIT_LOGIN", "3"))
        
        # File Upload
        self.max_file_size = int(os.getenv("MAX_FILE_SIZE", "5242880"))  # 5MB
        self.upload_dir = os.getenv("UPLOAD_DIR", "./static/uploads")
        
        # Logging
        self.log_level = os.getenv("LOG_LEVEL", "DEBUG")
        self.log_file = os.getenv("LOG_FILE", "./logs/app.log")
        
        # Admin
        self.admin_username = os.getenv("ADMIN_USERNAME", "Admin")
        self.admin_password = os.getenv("ADMIN_PASSWORD", "Passwordnaoday123")
        
        # Future Extensions
        self.sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
        self.google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

# Global settings instance
settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(os.path.dirname(settings.log_file), exist_ok=True)
