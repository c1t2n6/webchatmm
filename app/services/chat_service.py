"""
Simple Chat Service
==================

Basic chat service for message handling and room management.
"""

import json
from typing import Dict, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
import structlog

from ..models import User, Room, Message
from ..websocket_manager import manager

logger = structlog.get_logger()

class ChatService:
    """Simple chat service for basic operations"""
    
    def __init__(self):
        self.active_rooms: Dict[int, Dict] = {}
    
    async def create_room(self, db: Session, user1_id: int, user2_id: int) -> Optional[Room]:
        """Create a new chat room"""
        try:
            # Check if users exist
            user1 = db.query(User).filter(User.id == user1_id).first()
            user2 = db.query(User).filter(User.id == user2_id).first()
            
            if not user1 or not user2:
                logger.error(f"Users not found: {user1_id}, {user2_id}")
                return None
            
            # Create room
            room = Room(
                user1_id=user1_id,
                user2_id=user2_id,
                start_time=datetime.now(timezone.utc)
            )
            
            db.add(room)
            db.commit()
            db.refresh(room)
            
            # Update user statuses
            user1.current_room_id = room.id
            user1.status = 'connected'
            user2.current_room_id = room.id
            user2.status = 'connected'
            
            db.commit()
            
            logger.info(f"Created room {room.id} for users {user1_id} and {user2_id}")
            return room
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating room: {e}")
            return None
    
    async def end_room(self, db: Session, room_id: int, user_id: int) -> bool:
        """End a chat room"""
        try:
            room = db.query(Room).filter(Room.id == room_id).first()
            if not room:
                return False
            
            # Update room
            room.end_time = datetime.now(timezone.utc)
            
            # Update user statuses
            user1 = db.query(User).filter(User.id == room.user1_id).first()
            user2 = db.query(User).filter(User.id == room.user2_id).first()
            
            if user1:
                user1.current_room_id = None
                user1.status = 'idle'
            if user2:
                user2.current_room_id = None
                user2.status = 'idle'
            
            db.commit()
            
            # Notify WebSocket connections
            await manager.force_close_room(room_id)
            
            logger.info(f"Room {room_id} ended by user {user_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error ending room {room_id}: {e}")
            return False
    
    async def send_message(self, db: Session, room_id: int, user_id: int, content: str) -> Optional[Message]:
        """Send a message in a room"""
        try:
            # Validate room access
            room = db.query(Room).filter(Room.id == room_id).first()
            if not room or room.end_time:
                return None
            
            if room.user1_id != user_id and room.user2_id != user_id:
                return None
            
            # Create message
            message = Message(
                room_id=room_id,
                user_id=user_id,
                content=content,
                timestamp=datetime.now(timezone.utc)
            )
            
            db.add(message)
            room.last_message_time = datetime.now(timezone.utc)
            db.commit()
            db.refresh(message)
            
            # Broadcast to WebSocket
            message_data = {
                "type": "message",
                "message_id": message.id,
                "user_id": user_id,
                "content": content,
                "timestamp": message.timestamp.isoformat()
            }
            
            await manager.broadcast_to_room(json.dumps(message_data), room_id, exclude_user=user_id)
            
            logger.info(f"Message sent in room {room_id} by user {user_id}")
            return message
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error sending message: {e}")
            return None
    
    async def get_room_messages(self, db: Session, room_id: int, user_id: int, limit: int = 50) -> List[Message]:
        """Get messages from a room"""
        try:
            # Validate room access
            room = db.query(Room).filter(Room.id == room_id).first()
            if not room:
                return []
            
            if room.user1_id != user_id and room.user2_id != user_id:
                return []
            
            # Get messages
            messages = db.query(Message).filter(
                Message.room_id == room_id
            ).order_by(Message.timestamp.desc()).limit(limit).all()
            
            return messages
            
        except Exception as e:
            logger.error(f"Error getting messages: {e}")
            return []
    
    def get_room_info(self, room_id: int) -> Optional[Dict]:
        """Get room information"""
        return self.active_rooms.get(room_id)

# Global instance
chat_service = ChatService()