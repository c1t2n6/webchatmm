"""
Simple Countdown API endpoints
API đơn giản hóa cho hệ thống countdown và notification
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Room, User
from app.schemas import ChatLike
from app.utils.auth_utils import get_current_user
from app.services.simple_countdown_service import simple_countdown_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/start/{room_id}")
async def start_countdown(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bắt đầu countdown cho room"""
    try:
        # Validate room access
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Phòng chat không tồn tại"
            )
        
        if room.end_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phòng chat đã kết thúc"
            )
        
        # Check user access
        if current_user.id not in [room.user1_id, room.user2_id]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập phòng này"
            )
        
        # Start countdown
        success = await simple_countdown_service.start_countdown(room_id)
        
        if success:
            return {"message": "Countdown đã được bắt đầu", "room_id": room_id}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể bắt đầu countdown"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting countdown for room {room_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi bắt đầu countdown: {str(e)}"
        )

@router.post("/response/{room_id}")
async def handle_response(
    room_id: int,
    response_data: ChatLike,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Xử lý phản hồi từ user"""
    try:
        # Validate room access
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Phòng chat không tồn tại"
            )
        
        if room.end_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phòng chat đã kết thúc"
            )
        
        # Check user access
        if current_user.id not in [room.user1_id, room.user2_id]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập phòng này"
            )
        
        # Validate response
        if response_data.response not in ["yes", "no"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phản hồi không hợp lệ. Chỉ chấp nhận 'yes' hoặc 'no'"
            )
        
        # Handle response
        result = await simple_countdown_service.handle_user_response(
            room_id, current_user.id, response_data.response
        )
        
        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling response for room {room_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi xử lý phản hồi: {str(e)}"
        )

@router.get("/status/{room_id}")
async def get_status(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lấy trạng thái countdown cho room"""
    try:
        # Validate room access
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Phòng chat không tồn tại"
            )
        
        # Check user access
        if current_user.id not in [room.user1_id, room.user2_id]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập phòng này"
            )
        
        # Get status
        status = simple_countdown_service.get_room_status(room_id)
        
        return {
            "room_id": room_id,
            "room_ended": room.end_time is not None,
            **status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting status for room {room_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lấy trạng thái: {str(e)}"
        )

@router.post("/cancel/{room_id}")
async def cancel_countdown(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Hủy countdown cho room"""
    try:
        # Validate room access
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Phòng chat không tồn tại"
            )
        
        # Check user access
        if current_user.id not in [room.user1_id, room.user2_id]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập phòng này"
            )
        
        # Cancel countdown
        await simple_countdown_service._cancel_room_process(room_id)
        
        return {"message": "Countdown đã được hủy", "room_id": room_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling countdown for room {room_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi hủy countdown: {str(e)}"
        )
