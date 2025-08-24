"""
Optimized Chat Models
====================

Enhanced models for better chat performance, scalability, and features.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Index, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone
import uuid
from ..database import Base
from enum import Enum

class ChatRoom(Base):
    """Enhanced chat room with better state management"""
    __tablename__ = 'chat_rooms'
    
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4, index=True)
    type = Column(String(20), nullable=False, default='chat')  # chat, voice, group
    status = Column(String(20), default='active')  # active, paused, ended, archived
    
    # User management
    user1_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    user2_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # Room metadata
    title = Column(String(100), nullable=True)  # For group chats
    description = Column(Text, nullable=True)
    settings = Column(JSON, default={})  # Room-specific settings
    
    # Timing
    start_time = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    end_time = Column(DateTime, nullable=True, index=True)
    last_activity = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
    # Engagement features
    like_responses = Column(JSON, default={})  # {"user1": "yes", "user2": "no"}
    reveal_level = Column(Integer, default=0)  # 0: blur, 1: semi, 2: full
    keep_active = Column(Boolean, default=False)
    
    # Performance metrics
    message_count = Column(BigInteger, default=0)
    participant_count = Column(Integer, default=2)
    
    # Moderation
    is_moderated = Column(Boolean, default=False)
    moderation_level = Column(String(20), default='low')  # low, medium, high
    
    # Relationships
    user1 = relationship('User', foreign_keys=[user1_id])
    user2 = relationship('User', foreign_keys=[user2_id])
    messages = relationship('ChatMessage', back_populates='room', cascade='all, delete-orphan')
    participants = relationship('RoomParticipant', back_populates='room', cascade='all, delete-orphan')
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_room_status_active', 'status', 'last_activity'),
        Index('idx_room_users', 'user1_id', 'user2_id'),
        Index('idx_room_activity', 'last_activity', 'status'),
    )

class ChatMessage(Base):
    """Enhanced message model with better performance"""
    __tablename__ = 'chat_messages'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    uuid = Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4, index=True)
    room_id = Column(Integer, ForeignKey('chat_rooms.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # Message content
    content = Column(Text, nullable=False)
    content_type = Column(String(20), default='text')  # text, image, file, system
    content_metadata = Column(JSON, default={})  # For rich content
    
    # Message state
    status = Column(String(20), default='sent')  # sent, delivered, read, failed
    is_edited = Column(Boolean, default=False)
    edited_at = Column(DateTime, nullable=True)
    original_content = Column(Text, nullable=True)
    
    # Timing
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    
    # Performance
    message_index = Column(BigInteger, nullable=True)  # For pagination
    
    # Moderation
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(String(100), nullable=True)
    
    # Relationships
    room = relationship('ChatRoom', back_populates='messages')
    user = relationship('User')
    reactions = relationship('MessageReaction', back_populates='message', cascade='all, delete-orphan')
    
    # Indexes
    __table_args__ = (
        Index('idx_message_room_timestamp', 'room_id', 'timestamp'),
        Index('idx_message_user_timestamp', 'user_id', 'timestamp'),
        Index('idx_message_status', 'status', 'timestamp'),
        Index('idx_message_index', 'room_id', 'message_index'),
    )

class RoomParticipant(Base):
    """Track participant state and permissions"""
    __tablename__ = 'room_participants'
    
    id = Column(Integer, primary_key=True)
    room_id = Column(Integer, ForeignKey('chat_rooms.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # Participant state
    status = Column(String(20), default='active')  # active, away, offline, banned
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    left_at = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Permissions
    role = Column(String(20), default='participant')  # participant, moderator, admin
    permissions = Column(JSON, default={})  # Specific permissions
    
    # Engagement
    message_count = Column(BigInteger, default=0)
    last_message_at = Column(DateTime, nullable=True)
    
    # Relationships
    room = relationship('ChatRoom', back_populates='participants')
    user = relationship('User')
    
    # Unique constraint
    __table_args__ = (
        Index('idx_participant_room_user', 'room_id', 'user_id', unique=True),
        Index('idx_participant_status', 'status', 'last_seen'),
    )

class MessageReaction(Base):
    """Track message reactions"""
    __tablename__ = 'message_reactions'
    
    id = Column(Integer, primary_key=True)
    message_id = Column(BigInteger, ForeignKey('chat_messages.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # Reaction data
    emoji = Column(String(10), nullable=False)  # Unicode emoji
    reaction_type = Column(String(20), default='emoji')  # emoji, custom
    
    # Timing
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    message = relationship('ChatMessage', back_populates='reactions')
    user = relationship('User')
    
    # Unique constraint
    __table_args__ = (
        Index('idx_reaction_message_user', 'message_id', 'user_id', unique=True),
    )

class ChatSession(Base):
    """Track active chat sessions for performance monitoring"""
    __tablename__ = 'chat_sessions'
    
    id = Column(Integer, primary_key=True)
    room_id = Column(Integer, ForeignKey('chat_rooms.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # Session state
    session_id = Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    connection_id = Column(String(100), nullable=True)  # WebSocket connection ID
    
    # Timing
    connected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    disconnected_at = Column(DateTime, nullable=True)
    last_heartbeat = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Performance metrics
    messages_sent = Column(Integer, default=0)
    messages_received = Column(Integer, default=0)
    
    # Relationships
    room = relationship('ChatRoom')
    user = relationship('User')
    
    # Indexes
    __table_args__ = (
        Index('idx_session_room_user', 'room_id', 'user_id'),
        Index('idx_session_active', 'disconnected_at', 'last_heartbeat'),
    )

class ChatEvent(Base):
    """Track important chat events for analytics and moderation"""
    __tablename__ = 'chat_events'
    
    id = Column(Integer, primary_key=True)
    room_id = Column(Integer, ForeignKey('chat_rooms.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    
    # Event data
    event_type = Column(String(50), nullable=False)  # user_joined, user_left, message_flagged, etc.
    event_data = Column(JSON, default={})
    severity = Column(String(20), default='info')  # info, warning, error, critical
    
    # Timing
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
    # Relationships
    room = relationship('ChatRoom')
    user = relationship('User')
    
    # Indexes
    __table_args__ = (
        Index('idx_event_type_timestamp', 'event_type', 'timestamp'),
        Index('idx_event_severity', 'severity', 'timestamp'),
    )

# Enums for better type safety
class MessageStatus(str, Enum):
    SENT = 'sent'
    DELIVERED = 'delivered'
    READ = 'read'
    FAILED = 'failed'

class ParticipantStatus(str, Enum):
    ACTIVE = 'active'
    AWAY = 'away'
    OFFLINE = 'offline'
    BANNED = 'banned'

class RoomStatus(str, Enum):
    ACTIVE = 'active'
    PAUSED = 'paused'
    ENDED = 'ended'
    ARCHIVED = 'archived'

class ContentType(str, Enum):
    TEXT = 'text'
    IMAGE = 'image'
    FILE = 'file'
    SYSTEM = 'system'
    REACTION = 'reaction'
