from .app_factory import create_app
from .config import settings

# Create the FastAPI application
app = create_app()

if __name__ == "__main__":
    import uvicorn
    # Railway.app compatible configuration
    uvicorn.run(
        app, 
        host=settings.host, 
        port=settings.port,
        log_level=settings.log_level.lower(),
        access_log=True
    )
