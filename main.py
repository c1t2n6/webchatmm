#!/usr/bin/env python3
"""
Main entry point for WebChat App
Railway.app compatible
"""

import sys
import os

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.app_factory import create_app

# Create the FastAPI application
app = create_app()

if __name__ == "__main__":
    import uvicorn
    # Railway.app compatible configuration
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Starting WebChat App on port {port}")
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=port,
        log_level="info",
        access_log=True
    )
