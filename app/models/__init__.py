from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, Text, Enum as SQLEnum, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from enum import Enum
from datetime import datetime, timezone
from ..database import Base

class UserStatus(Enum):
    IDLE = 'idle'
    SEARCHING = 'searching'
    CONNECTED = 'connected'

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(128))
    google_id = Column(String(128), unique=True, nullable=True)
    email = Column(String(120), unique=True, nullable=True)
    is_verified = Column(Boolean, default=False)
    nickname = Column(String(50), unique=True, nullable=False, index=True)
    dob = Column(Date, nullable=False)
    gender = Column(String(10), nullable=False)  # Nam, Nữ, Khác
    preferred_gender = Column(Text)  # JSON string: ["Nam", "Nữ"] or ["Tất cả"]
    needs = Column(Text)  # JSON string: ["Nhẹ nhàng vui vẻ", "Nghiêm túc"]
    interests = Column(Text)  # JSON string: ["Gym", "Nhảy", "Ảnh"]
    profile_completed = Column(Boolean, default=False)
    status = Column(String(20), default='idle', index=True)
    online_status = Column(Boolean, default=False)
    current_room_id = Column(Integer, ForeignKey('rooms.id'), nullable=True)
    avatar_url = Column(String(255), default='default_avatar.jpg')
    reports_count = Column(Integer, default=0)
    banned_until = Column(Date, nullable=True)
    role = Column(String(20), default='free')  # free, premium, admin
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    rooms_as_user1 = relationship('Room', foreign_keys='Room.user1_id', back_populates='user1')
    rooms_as_user2 = relationship('Room', foreign_keys='Room.user2_id', back_populates='user2')
    messages = relationship('Message', back_populates='user')
    reports = relationship('Report', foreign_keys='Report.reporter_id', back_populates='reporter')

class Room(Base):
    __tablename__ = 'rooms'
    
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(10), nullable=False, default='chat')  # chat, voice
    user1_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    user2_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    start_time = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    end_time = Column(DateTime, nullable=True)
    like_responses = Column(Text)  # JSON string: {"user1": "yes", "user2": "no"}
    keep_active_responses = Column(Text)  # JSON string: {"user1": "yes", "user2": "no"} for keep active responses
    reveal_level = Column(Integer, default=0)  # 0: blur, 1: semi, 2: full
    keep_active = Column(Boolean, default=False)
    last_message_time = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user1 = relationship('User', foreign_keys=[user1_id], back_populates='rooms_as_user1')
    user2 = relationship('User', foreign_keys=[user2_id], back_populates='rooms_as_user2')
    messages = relationship('Message', back_populates='room')

class Message(Base):
    __tablename__ = 'messages'
    
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey('rooms.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    room = relationship('Room', back_populates='messages')
    user = relationship('User', back_populates='messages')

class Report(Base):
    __tablename__ = 'reports'
    
    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    reported_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    room_id = Column(Integer, ForeignKey('rooms.id'), nullable=True)
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    reporter = relationship('User', foreign_keys=[reporter_id], back_populates='reports')
    reported_user = relationship('User', foreign_keys=[reported_user_id])

class MatchingQueue(Base):
    __tablename__ = 'matching_queue'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), unique=True, nullable=False, index=True)
    type = Column(String(10), nullable=False, default='chat')  # chat, voice
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    retry_count = Column(Integer, default=0)

class Icebreaker(Base):
    __tablename__ = 'icebreakers'
    
    id = Column(Integer, primary_key=True, index=True)
    interest = Column(String(50), nullable=False, index=True)
    prompt = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

# Import all models to ensure they are registered
__all__ = [
    'User', 'Room', 'Message', 'Report', 
    'MatchingQueue', 'Icebreaker', 'UserStatus'
]
