from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./mapmo.db"
    
    # JWT
    jwt_secret_key: str = "your-super-secret-jwt-key-here"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    
    # Security
    secret_key: str = "your-super-secret-key-here"
    bcrypt_rounds: int = 12
    
    # Feature Flags
    enable_voice: bool = False
    enable_captcha: bool = False
    enable_dark_mode: bool = True
    
    # Rate Limiting
    rate_limit_search: int = 5
    rate_limit_upload: int = 10
    rate_limit_login: int = 3
    
    # File Upload
    max_file_size: int = 5242880  # 5MB
    upload_dir: str = "./static/uploads"
    
    # Logging
    log_level: str = "DEBUG"
    log_file: str = "./logs/app.log"
    
    # Admin
    admin_username: str = "Admin"
    admin_password: str = "Passwordnaoday123"
    
    # Future Extensions
    sendgrid_api_key: Optional[str] = None
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Global settings instance
settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(os.path.dirname(settings.log_file), exist_ok=True)
