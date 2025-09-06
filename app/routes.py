from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from .websocket_manager import manager
from .api import auth, user, chat, admin, simple_countdown

router = APIRouter()

# Include API routers
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(user.router, prefix="/user", tags=["user"])
router.include_router(chat.router, prefix="/chat", tags=["chat"])
router.include_router(admin.router, prefix="/admin", tags=["admin"])
# router.include_router(notification.router, prefix="/notification", tags=["notification"]) # Removed - replaced by simple_countdown
router.include_router(simple_countdown.router, prefix="/simple-countdown", tags=["simple-countdown"])

# Debug endpoint for room connections
@router.get("/debug/room/{room_id}")
async def debug_room(room_id: int):
    """Debug endpoint to check room connections"""
    return manager.get_room_info(room_id)

# Debug endpoint for all rooms
@router.get("/debug/rooms")
async def debug_all_rooms():
    """Debug endpoint to check all room connections"""
    from .websocket_manager import manager
    return {
        "all_rooms": manager.room_connections,
        "active_connections": manager.active_connections
    }

# Check if user is in active room
@router.get("/user/active-room")
async def get_user_active_room():
    """Check if current user is in an active room"""
    from .database import get_db
    from .models import User, Room
    from .utils.auth_utils import get_current_user
    
    try:
        current_user = get_current_user()
        if not current_user:
            return {"error": "Unauthorized"}
        
        db = next(get_db())
        try:
            # Kiểm tra xem user có đang trong room nào không
            user = db.query(User).filter(User.id == current_user.id).first()
            if not user:
                return {"error": "User not found"}
            
            # Nếu user có current_room_id, trả về room đó
            if user.current_room_id:
                room = db.query(Room).filter(Room.id == user.current_room_id).first()
                if room and not room.end_time:
                    return {"room_id": room.id, "status": "active"}
            
            # Nếu không có current_room_id, kiểm tra xem user có trong room nào không
            room = db.query(Room).filter(
                ((Room.user1_id == user.id) | (Room.user2_id == user.id)) &
                (Room.end_time.is_(None))
            ).first()
            
            if room:
                # Cập nhật user status
                user.current_room_id = room.id
                user.status = "connected"
                db.commit()
                
                return {"room_id": room.id, "status": "restored"}
            
            return {"room_id": None, "status": "no_active_room"}
            
        finally:
            db.close()
            
    except Exception as e:
        return {"error": str(e)}

# Test endpoint to check if server reloaded
@router.get("/test-reload")
async def test_reload():
    """Test endpoint to check if server reloaded"""
    return {"message": "Server reloaded!", "timestamp": "2025-08-21T15:52:00Z"}

# Health check endpoint
@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Mapmo.vn"}

# Root endpoint
@router.get("/", response_class=HTMLResponse)
async def root():
    with open("templates/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

# Favicon endpoint
@router.get("/favicon.ico")
async def favicon():
    from .websocket_handlers import get_favicon_response
    return get_favicon_response()
