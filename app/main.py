from .app_factory import create_app
from .config import settings

# Create the FastAPI application
app = create_app()

if __name__ == "__main__":
    import uvicorn
    import os
    # Railway.app compatible configuration
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=port,
        log_level="info",
        access_log=True
    )
