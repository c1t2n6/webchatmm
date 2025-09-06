from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi import Request
from contextlib import asynccontextmanager
import structlog

from .config import settings
from .database import create_tables
from .api import auth, user, chat, admin, simple_countdown
from .routes import router as main_router
from .websocket_routes import router as websocket_router
from .websocket_manager import manager

# Setup logging - Railway.app compatible
def setup_logging():
    """Setup logging configuration for Railway.app"""
    try:
        structlog.configure(
            processors=[
                structlog.stdlib.filter_by_level,
                structlog.stdlib.add_logger_name,
                structlog.stdlib.add_log_level,
                structlog.stdlib.PositionalArgumentsFormatter(),
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.UnicodeDecoder(),
                structlog.processors.JSONRenderer()
            ],
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )
        print("✅ Logging configured successfully")
    except Exception as e:
        print(f"⚠️ Warning: Could not configure structured logging: {e}")
        # Railway.app fallback: use basic logging
        import logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger = structlog.get_logger()
    logger.info("Starting Mapmo.vn application...")
    
    # Create database tables
    create_tables()
    logger.info("Database tables created")
    
    # Note: WebSocket managers will be started when needed, not at startup
    
    logger.info("Mapmo.vn application started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Mapmo.vn application...")
    
    # Note: WebSocket managers are not running at startup
    
    logger.info("Mapmo.vn application shutdown complete")

def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    # Setup logging first
    setup_logging()
    
    # Create FastAPI app
    app = FastAPI(
        title="Mapmo.vn",
        description="Anonymous Web Chat Application",
        version="1.0.0",
        lifespan=lifespan
    )
    
    # Setup CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure properly for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Mount static files - Railway.app compatible
    try:
        app.mount("/static", StaticFiles(directory="static"), name="static")
    except Exception as e:
        logger.warning(f"Could not mount static files: {e}")
        # Railway.app fallback: serve static files from app directory
        try:
            import os
            static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
            if os.path.exists(static_dir):
                app.mount("/static", StaticFiles(directory=static_dir), name="static")
        except Exception as e2:
            logger.warning(f"Could not mount static files from app directory: {e2}")
    
    # Health check
    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "service": "mapmo.vn"}
    
    # Include routers
    app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
    app.include_router(user.router, prefix="/user", tags=["User Management"])
    app.include_router(chat.router, prefix="/chat", tags=["Chat"])
    app.include_router(simple_countdown.router, prefix="/simple-countdown", tags=["Simple Countdown"])
    app.include_router(admin.router, prefix="/admin", tags=["Admin"])
    app.include_router(main_router, tags=["Main"])
    app.include_router(websocket_router, tags=["WebSocket"])
    
    return app
