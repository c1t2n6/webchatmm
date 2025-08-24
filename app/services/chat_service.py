"""
Optimized Chat Service
=====================

Advanced chat service with caching, pagination, performance optimizations,
and better error handling.
"""

import asyncio
import json
import uuid
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, desc, asc, func
from sqlalchemy.exc import SQLAlchemyError
import structlog
from fastapi import HTTPException, status

from ..database import get_db
from ..models.chat_models import (
    ChatRoom, ChatMessage, RoomParticipant, ChatSession, ChatEvent,
    MessageStatus, ParticipantStatus, RoomStatus, ContentType
)
from ..models import User
from ..schemas.chat_schemas import (
    ChatRoomCreate, ChatMessageCreate, MessageReactionCreate,
    MessagePaginationParams, MessagePaginationResponse
)
from ..websocket.connection_manager import connection_manager

logger = structlog.get_logger()

class ChatService:
    """Advanced chat service with performance optimizations"""
    
    def __init__(self):
        self.message_cache: Dict[int, List[Dict[str, Any]]] = {}
        self.room_cache: Dict[int, Dict[str, Any]] = {}
        self.user_cache: Dict[int, Dict[str, Any]] = {}
        self.cache_ttl = 300  # 5 minutes
        
        # Performance settings
        self.max_messages_per_page = 100
        self.default_messages_per_page = 50
        self.cache_max_size = 1000
        
        # Background tasks
        self.cache_cleanup_task: Optional[asyncio.Task] = None
        self.analytics_task: Optional[asyncio.Task] = None
    
    async def start(self):
        """Start the chat service"""
        logger.info("Starting Chat Service")
        
        # Start background tasks
        self.cache_cleanup_task = asyncio.create_task(self._cache_cleanup_loop())
        self.analytics_task = asyncio.create_task(self._analytics_loop())
        
        logger.info("Chat Service started successfully")
    
    async def stop(self):
        """Stop the chat service"""
        logger.info("Stopping Chat Service")
        
        # Cancel background tasks
        if self.cache_cleanup_task:
            self.cache_cleanup_task.cancel()
        if self.analytics_task:
            self.analytics_task.cancel()
        
        # Clear caches
        self.message_cache.clear()
        self.room_cache.clear()
        self.user_cache.clear()
        
        logger.info("Chat Service stopped")
    
    # Room Management
    async def create_room(self, db: Session, room_data: ChatRoomCreate, user1_id: int) -> ChatRoom:
        """Create a new chat room"""
        try:
            # Validate users
            user1 = db.query(User).filter(User.id == user1_id).first()
            user2 = db.query(User).filter(User.id == room_data.user2_id).first()
            
            if not user1 or not user2:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="One or both users not found"
                )
            
            # Check if users are already in a room together
            existing_room = db.query(ChatRoom).filter(
                and_(
                    or_(
                        and_(ChatRoom.user1_id == user1_id, ChatRoom.user2_id == room_data.user2_id),
                        and_(ChatRoom.user1_id == room_data.user2_id, ChatRoom.user2_id == user1_id)
                    ),
                    ChatRoom.status == RoomStatus.ACTIVE
                )
            ).first()
            
            if existing_room:
                return existing_room
            
            # Create new room
            room = ChatRoom(
                type=room_data.type,
                user1_id=user1_id,
                user2_id=room_data.user2_id,
                title=room_data.title,
                description=room_data.description,
                settings=room_data.settings
            )
            
            db.add(room)
            db.flush()  # Get room ID
            
            # Create participants
            participants = [
                RoomParticipant(
                    room_id=room.id,
                    user_id=user1_id,
                    role='participant',
                    status=ParticipantStatus.ACTIVE
                ),
                RoomParticipant(
                    room_id=room.id,
                    user_id=room_data.user2_id,
                    role='participant',
                    status=ParticipantStatus.ACTIVE
                )
            ]
            
            db.add_all(participants)
            
            # Update user statuses
            user1.current_room_id = room.id
            user1.status = 'connected'
            user1.online_status = True
            
            user2.current_room_id = room.id
            user2.status = 'connected'
            user2.online_status = True
            
            db.commit()
            
            # Cache the room
            await self._cache_room(room)
            
            # Log event
            await self._log_room_event(db, room.id, 'room_created', user1_id)
            
            logger.info(f"Created room {room.id} for users {user1_id} and {room_data.user2_id}")
            return room
            
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating room: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create chat room"
            )
    
    async def get_room(self, db: Session, room_id: int, user_id: int) -> Optional[ChatRoom]:
        """Get room with validation"""
        try:
            # Check cache first
            cached_room = self.room_cache.get(room_id)
            if cached_room and (datetime.now(timezone.utc) - cached_room['cached_at']).seconds < self.cache_ttl:
                return cached_room['room']
            
            # Query database
            room = db.query(ChatRoom).options(
                joinedload(ChatRoom.user1),
                joinedload(ChatRoom.user2),
                joinedload(ChatRoom.participants)
            ).filter(ChatRoom.id == room_id).first()
            
            if not room:
                return None
            
            # Validate user access
            if room.user1_id != user_id and room.user2_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this room"
                )
            
            # Cache the room
            await self._cache_room(room)
            
            return room
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting room {room_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get room"
            )
    
    async def get_user_rooms(self, db: Session, user_id: int, limit: int = 10) -> List[ChatRoom]:
        """Get rooms for a specific user"""
        try:
            rooms = db.query(ChatRoom).filter(
                and_(
                    or_(ChatRoom.user1_id == user_id, ChatRoom.user2_id == user_id),
                    ChatRoom.status.in_([RoomStatus.ACTIVE, RoomStatus.PAUSED])
                )
            ).order_by(desc(ChatRoom.last_activity)).limit(limit).all()
            
            return rooms
            
        except Exception as e:
            logger.error(f"Error getting rooms for user {user_id}: {e}")
            return []
    
    async def end_room(self, db: Session, room_id: int, user_id: int, reason: str = "User ended") -> bool:
        """End a chat room"""
        try:
            room = await self.get_room(db, room_id, user_id)
            if not room:
                return False
            
            # Update room status
            room.status = RoomStatus.ENDED
            room.end_time = datetime.now(timezone.utc)
            room.last_activity = datetime.now(timezone.utc)
            
            # Update participants
            for participant in room.participants:
                participant.status = ParticipantStatus.OFFLINE
                participant.left_at = datetime.now(timezone.utc)
            
            # Update user statuses
            user1 = db.query(User).filter(User.id == room.user1_id).first()
            user2 = db.query(User).filter(User.id == room.user2_id).first()
            
            if user1:
                user1.current_room_id = None
                user1.status = 'idle'
                user1.online_status = False
            
            if user2:
                user2.current_room_id = None
                user2.status = 'idle'
                user2.online_status = False
            
            db.commit()
            
            # Clear caches
            self.room_cache.pop(room_id, None)
            self.message_cache.pop(room_id, None)
            
            # Log event
            await self._log_room_event(db, room_id, 'room_ended', user_id, {'reason': reason})
            
            # Notify WebSocket connections
            await connection_manager.broadcast_to_room({
                'type': 'room_ended',
                'room_id': room_id,
                'reason': reason,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, room_id)
            
            logger.info(f"Room {room_id} ended by user {user_id}: {reason}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error ending room {room_id}: {e}")
            return False
    
    # Message Management
    async def send_message(self, db: Session, message_data: ChatMessageCreate, user_id: int) -> ChatMessage:
        """Send a message in a room"""
        try:
            # Validate room access
            room = await self.get_room(db, message_data.room_id, user_id)
            if not room:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Room not found or access denied"
                )
            
            if room.status != RoomStatus.ACTIVE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot send message in inactive room"
                )
            
            # Create message
            message = ChatMessage(
                room_id=message_data.room_id,
                user_id=user_id,
                content=message_data.content,
                content_type=message_data.content_type,
                content_metadata=message_data.content_metadata,
                message_index=await self._get_next_message_index(db, message_data.room_id)
            )
            
            db.add(message)
            
            # Update room
            room.last_activity = datetime.now(timezone.utc)
            room.message_count += 1
            
            # Update participant
            participant = db.query(RoomParticipant).filter(
                and_(
                    RoomParticipant.room_id == message_data.room_id,
                    RoomParticipant.user_id == user_id
                )
            ).first()
            
            if participant:
                participant.last_message_at = datetime.now(timezone.utc)
                participant.message_count += 1
            
            db.commit()
            
            # Clear message cache for this room
            self.message_cache.pop(message_data.room_id, None)
            
            # Log event
            await self._log_room_event(db, message_data.room_id, 'message_sent', user_id, {
                'message_id': message.id,
                'content_length': len(message_data.content)
            })
            
            # Notify WebSocket connections
            await connection_manager.broadcast_to_room({
                'type': 'message',
                'message_id': message.id,
                'room_id': message.room_id,
                'user_id': user_id,
                'content': message.content,
                'content_type': message.content_type.value,
                'timestamp': message.timestamp.isoformat()
            }, message_data.room_id, exclude_user=user_id)
            
            logger.info(f"Message sent in room {message_data.room_id} by user {user_id}")
            return message
            
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error sending message: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send message"
            )
    
    async def get_messages(
        self, 
        db: Session, 
        room_id: int, 
        user_id: int,
        params: MessagePaginationParams
    ) -> MessagePaginationResponse:
        """Get messages with pagination and caching"""
        try:
            # Validate room access
            room = await self.get_room(db, room_id, user_id)
            if not room:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Room not found or access denied"
                )
            
            # Check cache first
            cache_key = f"{room_id}_{params.limit}_{params.offset}"
            cached_messages = self.message_cache.get(room_id)
            
            if cached_messages and len(cached_messages) >= params.offset + params.limit:
                messages = cached_messages[params.offset:params.offset + params.limit]
                return MessagePaginationResponse(
                    messages=messages,
                    total=len(cached_messages),
                    has_more=params.offset + params.limit < len(cached_messages),
                    next_offset=params.offset + params.limit if params.offset + params.limit < len(cached_messages) else None,
                    prev_offset=params.offset - params.limit if params.offset > 0 else None
                )
            
            # Query database
            query = db.query(ChatMessage).options(
                joinedload(ChatMessage.user),
                joinedload(ChatMessage.reactions)
            ).filter(ChatMessage.room_id == room_id)
            
            # Apply pagination
            if params.before_id:
                query = query.filter(ChatMessage.id < params.before_id)
            elif params.after_id:
                query = query.filter(ChatMessage.id > params.after_id)
            
            # Get total count
            total = query.count()
            
            # Get messages
            messages = query.order_by(desc(ChatMessage.id)).offset(params.offset).limit(params.limit).all()
            
            # Convert to response format
            message_responses = []
            for msg in messages:
                message_response = {
                    'id': msg.id,
                    'uuid': str(msg.uuid),
                    'room_id': msg.room_id,
                    'user_id': msg.user_id,
                    'content': msg.content,
                    'content_type': msg.content_type.value,
                    'content_metadata': msg.content_metadata,
                    'status': msg.status.value,
                    'is_edited': msg.is_edited,
                    'edited_at': msg.edited_at.isoformat() if msg.edited_at else None,
                    'timestamp': msg.timestamp.isoformat(),
                    'delivered_at': msg.delivered_at.isoformat() if msg.delivered_at else None,
                    'read_at': msg.read_at.isoformat() if msg.read_at else None,
                    'message_index': msg.message_index,
                    'is_flagged': msg.is_flagged,
                    'flag_reason': msg.flag_reason,
                    'reactions': [],
                    'username': msg.user.username if msg.user else 'Unknown',
                    'nickname': msg.user.nickname if msg.user else 'Unknown',
                    'avatar_url': msg.user.avatar_url if msg.user else 'default_avatar.jpg'
                }
                
                # Add reactions
                for reaction in msg.reactions:
                    message_response['reactions'].append({
                        'id': reaction.id,
                        'emoji': reaction.emoji,
                        'reaction_type': reaction.reaction_type.value,
                        'user_id': reaction.user_id,
                        'created_at': reaction.created_at.isoformat()
                    })
                
                message_responses.append(message_response)
            
            # Cache messages
            await self._cache_messages(room_id, message_responses)
            
            return MessagePaginationResponse(
                messages=message_responses,
                total=total,
                has_more=params.offset + params.limit < total,
                next_offset=params.offset + params.limit if params.offset + params.limit < total else None,
                prev_offset=params.offset - params.limit if params.offset > 0 else None
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting messages: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get messages"
            )
    
    async def add_reaction(self, db: Session, reaction_data: MessageReactionCreate, user_id: int) -> bool:
        """Add reaction to a message"""
        try:
            # Validate message exists and user has access
            message = db.query(ChatMessage).options(
                joinedload(ChatMessage.room)
            ).filter(ChatMessage.id == reaction_data.message_id).first()
            
            if not message:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Message not found"
                )
            
            # Check if user has access to the room
            room = await self.get_room(db, message.room_id, user_id)
            if not room:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this room"
                )
            
            # Check if reaction already exists
            existing_reaction = db.query(MessageReaction).filter(
                and_(
                    MessageReaction.message_id == reaction_data.message_id,
                    MessageReaction.user_id == user_id
                )
            ).first()
            
            if existing_reaction:
                # Update existing reaction
                existing_reaction.emoji = reaction_data.emoji
                existing_reaction.reaction_type = reaction_data.reaction_type
            else:
                # Create new reaction
                from ..models.chat_models import MessageReaction
                reaction = MessageReaction(
                    message_id=reaction_data.message_id,
                    user_id=user_id,
                    emoji=reaction_data.emoji,
                    reaction_type=reaction_data.reaction_type
                )
                db.add(reaction)
            
            db.commit()
            
            # Clear message cache
            self.message_cache.pop(message.room_id, None)
            
            # Notify WebSocket connections
            await connection_manager.broadcast_to_room({
                'type': 'reaction',
                'message_id': reaction_data.message_id,
                'user_id': user_id,
                'emoji': reaction_data.emoji,
                'reaction_type': reaction_data.reaction_type.value,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, message.room_id)
            
            logger.info(f"Reaction added to message {reaction_data.message_id} by user {user_id}")
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error adding reaction: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add reaction"
            )
    
    # Caching and Performance
    async def _cache_room(self, room: ChatRoom):
        """Cache room information"""
        try:
            if len(self.room_cache) >= self.cache_max_size:
                # Remove oldest entries
                oldest_key = min(self.room_cache.keys(), key=lambda k: self.room_cache[k]['cached_at'])
                del self.room_cache[oldest_key]
            
            self.room_cache[room.id] = {
                'room': room,
                'cached_at': datetime.now(timezone.utc)
            }
            
        except Exception as e:
            logger.error(f"Error caching room: {e}")
    
    async def _cache_messages(self, room_id: int, messages: List[Dict[str, Any]]):
        """Cache messages for a room"""
        try:
            if len(self.message_cache) >= self.cache_max_size:
                # Remove oldest entries
                oldest_key = min(self.message_cache.keys(), key=lambda k: len(self.message_cache[k]))
                del self.message_cache[oldest_key]
            
            self.message_cache[room_id] = messages
            
        except Exception as e:
            logger.error(f"Error caching messages: {e}")
    
    async def _get_next_message_index(self, db: Session, room_id: int) -> int:
        """Get next message index for a room"""
        try:
            result = db.query(func.max(ChatMessage.message_index)).filter(
                ChatMessage.room_id == room_id
            ).scalar()
            
            return (result or 0) + 1
            
        except Exception as e:
            logger.error(f"Error getting message index: {e}")
            return 1
    
    async def _log_room_event(self, db: Session, room_id: int, event_type: str, user_id: int, event_data: Dict[str, Any] = None):
        """Log room event for analytics"""
        try:
            event = ChatEvent(
                room_id=room_id,
                user_id=user_id,
                event_type=event_type,
                event_data=event_data or {},
                severity='info'
            )
            
            db.add(event)
            db.commit()
            
        except Exception as e:
            logger.error(f"Error logging room event: {e}")
    
    # Background Tasks
    async def _cache_cleanup_loop(self):
        """Background cache cleanup loop"""
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes
                await self._cleanup_expired_cache()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cache cleanup loop: {e}")
                await asyncio.sleep(60)
    
    async def _analytics_loop(self):
        """Background analytics loop"""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour
                await self._generate_room_analytics()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in analytics loop: {e}")
                await asyncio.sleep(300)
    
    async def _cleanup_expired_cache(self):
        """Clean up expired cache entries"""
        try:
            current_time = datetime.now(timezone.utc)
            
            # Clean room cache
            expired_rooms = [
                room_id for room_id, cache_data in self.room_cache.items()
                if (current_time - cache_data['cached_at']).seconds > self.cache_ttl
            ]
            
            for room_id in expired_rooms:
                del self.room_cache[room_id]
            
            # Clean message cache
            expired_messages = [
                room_id for room_id, messages in self.message_cache.items()
                if len(messages) == 0
            ]
            
            for room_id in expired_messages:
                del self.message_cache[room_id]
            
            if expired_rooms or expired_messages:
                logger.info(f"Cleaned up {len(expired_rooms)} room cache entries and {len(expired_messages)} message cache entries")
                
        except Exception as e:
            logger.error(f"Error cleaning up expired cache: {e}")
    
    async def _generate_room_analytics(self):
        """Generate room analytics"""
        try:
            # This would implement analytics generation
            # For now, just log that it's running
            logger.info("Room analytics generation completed")
            
        except Exception as e:
            logger.error(f"Error generating room analytics: {e}")
    
    # Utility Methods
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return {
            'room_cache_size': len(self.room_cache),
            'message_cache_size': len(self.message_cache),
            'user_cache_size': len(self.user_cache),
            'cache_max_size': self.cache_max_size,
            'cache_ttl': self.cache_ttl
        }
    
    async def clear_cache(self, room_id: Optional[int] = None):
        """Clear cache for specific room or all rooms"""
        if room_id:
            self.room_cache.pop(room_id, None)
            self.message_cache.pop(room_id, None)
            logger.info(f"Cache cleared for room {room_id}")
        else:
            self.room_cache.clear()
            self.message_cache.clear()
            self.user_cache.clear()
            logger.info("All caches cleared")

# Global instance
chat_service = ChatService()
