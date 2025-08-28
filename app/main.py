from .app_factory import create_app
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .websocket_manager import manager
from datetime import datetime

# Create the FastAPI application
app = create_app()

# Add CORS middleware for WebSocket connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return JSONResponse(
        status_code=200,
        content={
            "status": "healthy",
            "service": "webchat-backend",
            "version": "1.0.0",
            "websocket_status": "active"
        }
    )

@app.get("/ws-health")
async def websocket_health_check():
    """Check WebSocket connection health"""
    return JSONResponse(
        status_code=200,
        content={
            "websocket_status": "active",
            "endpoints": {
                "chat": "/ws/chat/{room_id}",
                "status": "/ws/status"
            }
        }
    )

@app.get("/ws-status")
async def websocket_status():
    """Get detailed WebSocket connection status"""
    try:
        connection_info = manager.get_connection_info()
        return JSONResponse(
            status_code=200,
            content={
                "websocket_status": "active",
                "connection_info": connection_info
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "websocket_status": "error",
                "error": str(e)
            }
        )

@app.get("/test-connection")
async def test_connection():
    """Test endpoint to verify basic connectivity"""
    return JSONResponse(
        status_code=200,
        content={
            "message": "Connection test successful",
            "timestamp": datetime.now().isoformat(),
            "status": "connected"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
