from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import json
from datetime import datetime, date, timedelta
from typing import Optional

from app.database import get_db
from app.models import User, Room, Message, MatchingQueue
from app.schemas import ChatSearch, ChatLike, ChatKeep, ChatReport, MatchingResponse, RoomResponse, UserResponse
from app.utils.auth_utils import get_current_user
from app.utils.matching import matching_engine
from app.utils.image_utils import image_processor
from app.websocket_manager import manager

router = APIRouter()
security = HTTPBearer()

class RoomManager:
    """Centralized room management with proper validation and error handling"""
    
    @staticmethod
    def validate_user_room_access(user: User, room_id: int, db: Session) -> tuple[bool, Optional[Room], Optional[str]]:
        """Validate if user has access to the specified room"""
        try:
            # Check if user is in this room
            if user.current_room_id != room_id:
                return False, None, "Bạn không có quyền truy cập phòng này"
            
            # Get room
            room = db.query(Room).filter(Room.id == room_id).first()
            if not room:
                return False, None, "Không tìm thấy phòng chat"
            
            # Check if room is still active
            if room.end_time:
                return False, None, "Phòng chat đã kết thúc"
            
            # Verify user belongs to this room
            if room.user1_id != user.id and room.user2_id != user.id:
                return False, None, "Bạn không có quyền truy cập phòng này"
            
            return True, room, None
            
        except Exception as e:
            return False, None, f"Lỗi xác thực phòng: {str(e)}"
    
    @staticmethod
    def get_other_user_in_room(room: Room, current_user_id: int, db: Session) -> Optional[User]:
        """Get the other user in the room"""
        other_user_id = room.user2_id if room.user1_id == current_user_id else room.user1_id
        return db.query(User).filter(User.id == other_user_id).first()
    
    @staticmethod
    def create_user_response(user: User) -> UserResponse:
        """Create UserResponse from User model"""
        return UserResponse(
            id=user.id,
            username=user.username,
            nickname=user.nickname,
            dob=user.dob,
            gender=user.gender,
            preferred_gender=json.loads(user.preferred_gender) if user.preferred_gender else [],
            needs=json.loads(user.needs) if user.needs else [],
            interests=json.loads(user.interests) if user.interests else [],
            profile_completed=user.profile_completed,
            status=user.status,
            online_status=user.online_status,
            avatar_url=image_processor.get_avatar_url(user.avatar_url, 0),
            role=user.role,
            created_at=user.created_at
        )

@router.post("/search", response_model=MatchingResponse)
async def search_chat(
    search_data: ChatSearch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search for chat partner"""
    
    try:
        # Check if user is already in a room
        if current_user.current_room_id:
            # User is already in a room, return room info
            room = db.query(Room).filter(Room.id == current_user.current_room_id).first()
            if room and not room.end_time:
                # Find the other user in the room
                other_user = RoomManager.get_other_user_in_room(room, current_user.id, db)
                
                if other_user:
                    # Convert matched user to response schema
                    matched_user_response = RoomManager.create_user_response(other_user)
                    
                    return MatchingResponse(
                        room_id=current_user.current_room_id,
                        matched_user=matched_user_response,
                        icebreaker="Bạn đã có sẵn phòng chat!"
                    )
        
        # Check if user is already searching
        if current_user.status == 'searching':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bạn đang tìm kiếm người chat"
            )
        
        # Check if user is banned
        if current_user.banned_until and current_user.banned_until > date.today():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Tài khoản bị tạm khóa đến {current_user.banned_until.strftime('%d/%m/%Y')}"
            )
        
        # Update user status first
        current_user.status = 'searching'
        db.commit()
        
        # Add user to matching queue and try immediate match
        success, match_info = matching_engine.add_to_queue(db, current_user.id, search_data.type)
        if not success:
            # Reset user status on failure
            current_user.status = 'idle'
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể thêm vào hàng đợi"
            )
        
        # Check if user was matched during add_to_queue
        current_user = db.query(User).filter(User.id == current_user.id).first()
        
        if current_user.status == 'connected' and current_user.current_room_id:
            # User was matched! Get room and matched user info
            room = db.query(Room).filter(Room.id == current_user.current_room_id).first()
            if room:
                # Find the other user in the room
                other_user = RoomManager.get_other_user_in_room(room, current_user.id, db)
                
                if other_user:
                    # Get icebreaker message
                    icebreaker = matching_engine.get_icebreaker(db, current_user, other_user)
                    
                    # Convert matched user to response schema
                    matched_user_response = RoomManager.create_user_response(other_user)
                    
                    # Send WebSocket notification to both users
                    match_notification = {
                        "type": "match_found",
                        "room_id": current_user.current_room_id,
                        "matched_user": matched_user_response.dict(),
                        "icebreaker": icebreaker,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Send to current user
                    manager.send_to_user(current_user.id, json.dumps(match_notification))
                    # Send to matched user
                    manager.send_to_user(other_user.id, json.dumps(match_notification))
                    
                    return MatchingResponse(
                        room_id=current_user.current_room_id,
                        matched_user=matched_user_response,
                        icebreaker=icebreaker
                    )
        
        # No immediate match found, return searching status
        return MatchingResponse(
            room_id=None,
            matched_user=None,
            icebreaker=None
        )
            
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        # Reset user status on error
        current_user.status = 'idle'
        matching_engine.remove_from_queue(db, current_user.id)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi tìm kiếm: {str(e)}"
        )

@router.post("/cancel-search")
async def cancel_search(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel chat search"""
    
    if current_user.status != 'searching':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn không đang tìm kiếm"
        )
    
    try:
        # Remove from queue
        matching_engine.remove_from_queue(db, current_user.id)
        
        # Update user status
        current_user.status = 'idle'
        db.commit()
        
        return {"message": "Đã hủy tìm kiếm"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi hủy tìm kiếm: {str(e)}"
        )

@router.post("/like/{room_id}")
async def like_response(
    room_id: int,
    like_data: ChatLike,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send like response for chat partner"""
    
    try:
        # Validate room access
        has_access, room, error_msg = RoomManager.validate_user_room_access(current_user, room_id, db)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )
        
        # Validate like response
        if like_data.response not in ["yes", "no"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phản hồi không hợp lệ"
            )
        
        # Parse existing like responses
        like_responses = json.loads(room.like_responses) if room.like_responses else {}
        
        # Add current user's response
        user_key = "user1" if current_user.id == room.user1_id else "user2"
        like_responses[user_key] = like_data.response
        
        room.like_responses = json.dumps(like_responses)
        
        # Check if both users have responded
        if len(like_responses) == 2:
            user1_response = like_responses.get("user1")
            user2_response = like_responses.get("user2")
            
            if user1_response == "yes" and user2_response == "yes":
                # Both like each other - increase reveal level
                room.reveal_level = min(room.reveal_level + 1, 2)
            elif user1_response == "no" or user2_response == "no":
                # One or both don't like - schedule room end
                # This will be handled by a background task
                pass
        
        db.commit()
        
        return {"message": "Đã gửi phản hồi", "reveal_level": room.reveal_level}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi gửi phản hồi: {str(e)}"
        )

@router.post("/keep/{room_id}")
async def keep_session(
    room_id: int,
    keep_data: ChatKeep,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Keep chat session active"""
    
    try:
        # Validate room access
        has_access, room, error_msg = RoomManager.validate_user_room_access(current_user, room_id, db)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )
        
        room.keep_active = keep_data.keep_active
        db.commit()
        
        return {"message": "Đã cập nhật trạng thái giữ phiên"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi cập nhật trạng thái: {str(e)}"
        )

@router.post("/report/{room_id}")
async def report_user(
    room_id: int,
    report_data: ChatReport,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Report user in chat room"""
    
    try:
        # Validate room access
        has_access, room, error_msg = RoomManager.validate_user_room_access(current_user, room_id, db)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )
        
        # Determine reported user
        reported_user_id = room.user2_id if current_user.id == room.user1_id else room.user1_id
        
        # Create report
        from ..models import Report
        report = Report(
            reporter_id=current_user.id,
            reported_user_id=reported_user_id,
            room_id=room_id,
            reason=report_data.reason
        )
        
        db.add(report)
        
        # Increment reported user's report count
        reported_user = db.query(User).filter(User.id == reported_user_id).first()
        if reported_user:
            reported_user.reports_count += 1
            
            # Auto-ban if 5 or more reports
            if reported_user.reports_count >= 5:
                reported_user.banned_until = date.today() + timedelta(days=1)
        
        db.commit()
        
        return {"message": "Đã báo cáo người dùng"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi báo cáo: {str(e)}"
        )

@router.post("/end/{room_id}")
async def end_session(
    room_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """End chat session"""
    
    try:
        # Validate room access
        has_access, room, error_msg = RoomManager.validate_user_room_access(current_user, room_id, db)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )
        
        # Mark room as ended
        room.end_time = datetime.now(timezone.utc)
        
        # Update both users' status
        user1 = db.query(User).filter(User.id == room.user1_id).first()
        user2 = db.query(User).filter(User.id == room.user2_id).first()
        
        if user1:
            user1.status = 'idle'
            user1.current_room_id = None
        if user2:
            user2.status = 'idle'
            user2.current_room_id = None
        
        db.commit()
        
        # Force close WebSocket connections for this room in background
        background_tasks.add_task(manager.force_close_room, room_id)
        
        return {"message": "Cuộc trò chuyện đã kết thúc"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi kết thúc phiên: {str(e)}"
        )

@router.get("/room/{room_id}", response_model=RoomResponse)
async def get_room_info(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get chat room information"""
    
    try:
        # Validate room access
        has_access, room, error_msg = RoomManager.validate_user_room_access(current_user, room_id, db)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )
        
        return RoomResponse(
            id=room.id,
            type=room.type,
            user1_id=room.user1_id,
            user2_id=room.user2_id,
            start_time=room.start_time,
            end_time=room.end_time,
            reveal_level=room.reveal_level,
            keep_active=room.keep_active,
            last_message_time=room.last_message_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lấy thông tin phòng: {str(e)}"
        )

@router.get("/current-room", response_model=MatchingResponse)
async def get_current_room(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's active room if any"""
    
    if not current_user.current_room_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bạn không có phòng chat nào"
        )
    
    try:
        # Get room
        room = db.query(Room).filter(Room.id == current_user.current_room_id).first()
        if not room or room.end_time:
            # Reset user status if room doesn't exist or has ended
            current_user.status = 'idle'
            current_user.current_room_id = None
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Phòng chat không tồn tại hoặc đã kết thúc"
            )
        
        # Find the other user in the room
        other_user = RoomManager.get_other_user_in_room(room, current_user.id, db)
        
        if not other_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy người chat"
            )
        
        # Convert matched user to response schema
        matched_user_response = RoomManager.create_user_response(other_user)
        
        return MatchingResponse(
            room_id=current_user.current_room_id,
            matched_user=matched_user_response,
            icebreaker="Chào mừng bạn trở lại phòng chat!"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lấy thông tin phòng hiện tại: {str(e)}"
        )

@router.get("/room/{room_id}/messages")
async def get_room_messages(
    room_id: int,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get messages from a specific room"""
    
    try:
        # Validate room access
        has_access, room, error_msg = RoomManager.validate_user_room_access(current_user, room_id, db)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )
        
        # Get messages with pagination
        messages = db.query(Message).filter(
            Message.room_id == room_id
        ).order_by(
            Message.timestamp.desc()
        ).offset(offset).limit(limit).all()
        
        # Convert to response format
        message_list = []
        for msg in messages:
            message_list.append({
                "id": msg.id,
                "user_id": msg.user_id,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat()
            })
        
        return {
            "messages": message_list,
            "total": len(message_list),
            "room_id": room_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lấy tin nhắn: {str(e)}"
        )
