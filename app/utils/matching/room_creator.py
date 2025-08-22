"""
Room Creator
===========

Handles creation of chat rooms and updating user statuses
when matches are found.
"""

from datetime import datetime, timedelta, date, timezone
from typing import Tuple, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import User, Room, MatchingQueue
import structlog

logger = structlog.get_logger()

class RoomCreator:
    """Create chat rooms and manage user status updates"""
    
    def __init__(self):
        self.logger = structlog.get_logger()
    
    def create_room_for_pair(self, db: Session, user1: User, user2: User, room_type: str = 'chat') -> Tuple[bool, Optional[Room], Optional[str]]:
        """
        Create a chat room for two matched users
        
        Args:
            db: Database session
            user1: First user
            user2: Second user
            room_type: Type of room (chat, voice)
            
        Returns:
            Tuple[bool, Optional[Room], Optional[str]]: (success, room_object, error_message)
        """
        try:
            # Validate users
            validation_result = self._validate_users_for_room(db, user1, user2)
            if not validation_result[0]:
                return False, None, validation_result[1]
            
            # 1. Create new room
            room = self._create_room(db, user1, user2, room_type)
            if not room:
                return False, None, "Không thể tạo phòng chat"
            
            # 2. Update both users to CONNECTED status
            success = self._update_users_status(db, user1, user2, room.id)
            if not success:
                # Rollback room creation
                db.delete(room)
                db.flush()
                return False, None, "Không thể cập nhật trạng thái người dùng"
            
            # 3. Remove both users from search queue
            self._remove_users_from_queue(db, user1.id, user2.id)
            
            # 4. Commit all changes
            db.commit()
            
            # 5. Update the original user objects
            self._update_user_objects(user1, user2, room.id)
            
            self.logger.info(f"Successfully created room {room.id} for users {user1.id} and {user2.id}")
            return True, room, None
            
        except Exception as e:
            db.rollback()
            self.logger.error(f"Error creating room for users {user1.id} and {user2.id}: {e}")
            return False, None, f"Lỗi tạo phòng: {str(e)}"
    
    def _validate_users_for_room(self, db: Session, user1: User, user2: User) -> Tuple[bool, Optional[str]]:
        """Validate that both users can be in a room together"""
        try:
            # Check if users are the same
            if user1.id == user2.id:
                return False, "Không thể tạo phòng với chính mình"
            
            # Check if users are already in rooms
            if user1.current_room_id:
                return False, f"User {user1.id} đã trong phòng {user1.current_room_id}"
            
            if user2.current_room_id:
                return False, f"User {user2.id} đã trong phòng {user2.current_room_id}"
            
            # Check if users are banned
            if user1.banned_until and user1.banned_until > date.today():
                return False, f"User {user1.id} đang bị cấm"
            
            if user2.banned_until and user2.banned_until > date.today():
                return False, f"User {user2.id} đang bị cấm"
            
            # Check if users are searching
            if user1.status != 'searching':
                return False, f"User {user1.id} không trong trạng thái tìm kiếm"
            
            if user2.status != 'searching':
                return False, f"User {user2.id} không trong trạng thái tìm kiếm"
            
            return True, None
            
        except Exception as e:
            self.logger.error(f"Error validating users for room: {e}")
            return False, f"Lỗi xác thực: {str(e)}"
    
    def _create_room(self, db: Session, user1: User, user2: User, room_type: str) -> Optional[Room]:
        """Create a new room object"""
        try:
            # Determine user order (smaller ID first for consistency)
            if user1.id < user2.id:
                first_user_id = user1.id
                second_user_id = user2.id
            else:
                first_user_id = user2.id
                second_user_id = user1.id
            
            room = Room(
                type=room_type,
                user1_id=first_user_id,
                user2_id=second_user_id,
                start_time=datetime.now(timezone.utc),
                created_at=datetime.now(timezone.utc)
            )
            
            db.add(room)
            db.flush()  # Get room ID
            
            self.logger.info(f"Created room {room.id} with users {first_user_id} and {second_user_id}")
            return room
            
        except Exception as e:
            self.logger.error(f"Error creating room object: {e}")
            return None
    
    def _update_users_status(self, db: Session, user1: User, user2: User, room_id: int) -> bool:
        """Update both users to CONNECTED status using direct SQL"""
        try:
            # Update user1
            db.execute(
                text("UPDATE users SET status = :status, current_room_id = :room_id, online_status = :online_status WHERE id = :user_id"),
                {"status": "connected", "room_id": room_id, "online_status": True, "user_id": user1.id}
            )
            
            # Update user2
            db.execute(
                text("UPDATE users SET status = :status, current_room_id = :room_id, online_status = :online_status WHERE id = :user_id"),
                {"status": "connected", "room_id": room_id, "online_status": True, "user_id": user2.id}
            )
            
            self.logger.info(f"Updated users {user1.id} and {user2.id} to connected status in room {room_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error updating user statuses: {e}")
            return False
    
    def _remove_users_from_queue(self, db: Session, user1_id: int, user2_id: int) -> None:
        """Remove both users from matching queue"""
        try:
            # Remove user1 from queue
            db.query(MatchingQueue).filter(MatchingQueue.user_id == user1_id).delete()
            
            # Remove user2 from queue
            db.query(MatchingQueue).filter(MatchingQueue.user_id == user2_id).delete()
            
            self.logger.info(f"Removed users {user1_id} and {user2_id} from matching queue")
            
        except Exception as e:
            self.logger.error(f"Error removing users from queue: {e}")
    
    def _update_user_objects(self, user1: User, user2: User, room_id: int) -> None:
        """Update the original user objects to reflect changes"""
        try:
            user1.status = 'connected'
            user1.current_room_id = room_id
            user1.online_status = True
            
            user2.status = 'connected'
            user2.current_room_id = room_id
            user2.online_status = True
            
            self.logger.info(f"Updated user objects for users {user1.id} and {user2.id}")
            
        except Exception as e:
            self.logger.error(f"Error updating user objects: {e}")
    
    def get_room_info(self, db: Session, room_id: int) -> Optional[Dict[str, Any]]:
        """Get room information including users"""
        try:
            room = db.query(Room).filter(Room.id == room_id).first()
            if not room:
                return None
            
            user1 = db.query(User).filter(User.id == room.user1_id).first()
            user2 = db.query(User).filter(User.id == room.user2_id).first()
            
            result = {
                "room_id": room.id,
                "type": room.type,
                "start_time": room.start_time.isoformat() if room.start_time else None,
                "end_time": room.end_time.isoformat() if room.end_time else None,
                "reveal_level": room.reveal_level,
                "keep_active": room.keep_active,
                "last_message_time": room.last_message_time.isoformat() if room.last_message_time else None,
                "created_at": room.created_at.isoformat() if room.created_at else None,
                "user1": {
                    "id": user1.id, 
                    "username": user1.username,
                    "status": user1.status
                } if user1 else None,
                "user2": {
                    "id": user2.id, 
                    "username": user2.username,
                    "status": user2.status
                } if user2 else None
            }
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error getting room info for room {room_id}: {e}")
            return None
    
    def end_room(self, db: Session, room_id: int, reason: str = "manual_end") -> Tuple[bool, Optional[str]]:
        """End a room and reset user statuses"""
        try:
            room = db.query(Room).filter(Room.id == room_id).first()
            if not room:
                return False, "Không tìm thấy phòng"
            
            # Check if room is already ended
            if room.end_time:
                return False, "Phòng đã kết thúc"
            
            # Mark room as ended
            room.end_time = datetime.now(timezone.utc)
            
            # Reset user statuses
            user1 = db.query(User).filter(User.id == room.user1_id).first()
            user2 = db.query(User).filter(User.id == room.user2_id).first()
            
            if user1:
                user1.status = 'idle'
                user1.current_room_id = None
                user1.online_status = False
            
            if user2:
                user2.status = 'idle'
                user2.current_room_id = None
                user2.online_status = False
            
            db.commit()
            
            self.logger.info(f"Ended room {room_id} with reason: {reason}")
            return True, None
            
        except Exception as e:
            db.rollback()
            self.logger.error(f"Error ending room {room_id}: {e}")
            return False, f"Lỗi kết thúc phòng: {str(e)}"
    
    def cleanup_expired_rooms(self, db: Session, max_age_hours: int = 24) -> int:
        """Clean up rooms that have been inactive for too long"""
        try:
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
            
            # Find expired rooms
            expired_rooms = db.query(Room).filter(
                Room.end_time.is_(None),
                Room.start_time < cutoff_time
            ).all()
            
            cleaned_count = 0
            
            for room in expired_rooms:
                success, error = self.end_room(db, room.id, "expired")
                if success:
                    cleaned_count += 1
                else:
                    self.logger.warning(f"Failed to clean up expired room {room.id}: {error}")
            
            self.logger.info(f"Cleaned up {cleaned_count} expired rooms")
            return cleaned_count
            
        except Exception as e:
            self.logger.error(f"Error during room cleanup: {e}")
            return 0

# Global instance
room_creator = RoomCreator()
