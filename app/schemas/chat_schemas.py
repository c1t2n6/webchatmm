"""
Optimized Chat Schemas
=====================

Enhanced Pydantic schemas for better validation, performance, and features.
"""

from pydantic import BaseModel, Field, validator, root_validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from enum import Enum
import json

# Enums
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

class ReactionType(str, Enum):
    EMOJI = 'emoji'
    CUSTOM = 'custom'

# Base schemas
class ChatRoomBase(BaseModel):
    type: str = Field(default='chat', description='Room type: chat, voice, group')
    title: Optional[str] = Field(None, max_length=100, description='Room title')
    description: Optional[str] = Field(None, description='Room description')
    settings: Dict[str, Any] = Field(default_factory=dict, description='Room-specific settings')

class ChatRoomCreate(ChatRoomBase):
    user2_id: int = Field(..., description='ID of the second user')
    search_type: str = Field(default='chat', description='Type of search that led to this room')

class ChatRoomUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    keep_active: Optional[bool] = None

class ChatRoomResponse(ChatRoomBase):
    id: int
    uuid: str
    status: RoomStatus
    user1_id: int
    user2_id: int
    start_time: datetime
    end_time: Optional[datetime]
    last_activity: datetime
    like_responses: Dict[str, str] = Field(default_factory=dict)
    reveal_level: int = Field(ge=0, le=2)
    keep_active: bool
    message_count: int
    participant_count: int
    is_moderated: bool
    moderation_level: str
    created_at: datetime
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Message schemas
class ChatMessageBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000, description='Message content')
    content_type: ContentType = Field(default=ContentType.TEXT)
    content_metadata: Dict[str, Any] = Field(default_factory=dict)

class ChatMessageCreate(ChatMessageBase):
    room_id: int = Field(..., description='ID of the chat room')
    reply_to_id: Optional[int] = Field(None, description='ID of message being replied to')
    forward_from_id: Optional[int] = Field(None, description='ID of original message if forwarded')

class ChatMessageUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    content_metadata: Optional[Dict[str, Any]] = None

class ChatMessageResponse(ChatMessageBase):
    id: int
    uuid: str
    room_id: int
    user_id: int
    status: MessageStatus
    is_edited: bool
    edited_at: Optional[datetime]
    timestamp: datetime
    delivered_at: Optional[datetime]
    read_at: Optional[datetime]
    message_index: Optional[int]
    is_flagged: bool
    flag_reason: Optional[str]
    reactions: List['MessageReactionResponse'] = Field(default_factory=list)
    
    # User info for display
    username: str
    nickname: str
    avatar_url: str
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Reaction schemas
class MessageReactionBase(BaseModel):
    emoji: str = Field(..., max_length=10, description='Unicode emoji')
    reaction_type: ReactionType = Field(default=ReactionType.EMOJI)

class MessageReactionCreate(MessageReactionBase):
    message_id: int = Field(..., description='ID of the message to react to')

class MessageReactionResponse(MessageReactionBase):
    id: int
    message_id: int
    user_id: int
    created_at: datetime
    username: str
    nickname: str
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Participant schemas
class RoomParticipantBase(BaseModel):
    role: str = Field(default='participant', description='Participant role')
    permissions: Dict[str, Any] = Field(default_factory=dict)

class RoomParticipantResponse(RoomParticipantBase):
    id: int
    room_id: int
    user_id: int
    status: ParticipantStatus
    joined_at: datetime
    left_at: Optional[datetime]
    last_seen: datetime
    message_count: int
    last_message_at: Optional[datetime]
    
    # User info
    username: str
    nickname: str
    avatar_url: str
    online_status: bool
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Session schemas
class ChatSessionBase(BaseModel):
    room_id: int = Field(..., description='ID of the chat room')

class ChatSessionResponse(ChatSessionBase):
    id: int
    session_id: str
    user_id: int
    connection_id: Optional[str]
    connected_at: datetime
    disconnected_at: Optional[datetime]
    last_heartbeat: datetime
    messages_sent: int
    messages_received: int
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Event schemas
class ChatEventBase(BaseModel):
    event_type: str = Field(..., max_length=50, description='Type of event')
    event_data: Dict[str, Any] = Field(default_factory=dict)
    severity: str = Field(default='info', description='Event severity')

class ChatEventCreate(ChatEventBase):
    room_id: int = Field(..., description='ID of the chat room')
    user_id: Optional[int] = Field(None, description='ID of the user involved')

class ChatEventResponse(ChatEventBase):
    id: int
    room_id: int
    user_id: Optional[int]
    timestamp: datetime
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# WebSocket message schemas
class WebSocketMessage(BaseModel):
    type: str = Field(..., description='Message type')
    data: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now())
    message_id: Optional[str] = Field(None, description='Unique message ID for tracking')

class ChatWebSocketMessage(WebSocketMessage):
    room_id: int = Field(..., description='ID of the chat room')
    user_id: int = Field(..., description='ID of the user sending the message')

class TypingIndicatorMessage(BaseModel):
    type: str = Field(default='typing')
    room_id: int
    user_id: int
    is_typing: bool
    timestamp: datetime = Field(default_factory=lambda: datetime.now())

class PresenceUpdateMessage(BaseModel):
    type: str = Field(default='presence_update')
    user_id: int
    status: ParticipantStatus
    last_seen: datetime = Field(default_factory=lambda: datetime.now())

# Search and matching schemas
class ChatSearchRequest(BaseModel):
    type: str = Field(default='chat', description='Type of search')
    preferences: Dict[str, Any] = Field(default_factory=dict, description='Search preferences')
    filters: Dict[str, Any] = Field(default_factory=dict, description='Search filters')

class ChatSearchResponse(BaseModel):
    success: bool
    message: str
    room_id: Optional[int] = None
    matched_user: Optional[Dict[str, Any]] = None
    icebreaker: Optional[str] = None
    search_id: Optional[str] = None

# Pagination schemas
class MessagePaginationParams(BaseModel):
    room_id: int
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    before_id: Optional[int] = Field(None, description='Get messages before this ID')
    after_id: Optional[int] = Field(None, description='Get messages after this ID')

class MessagePaginationResponse(BaseModel):
    messages: List[ChatMessageResponse]
    total: int
    has_more: bool
    next_offset: Optional[int]
    prev_offset: Optional[int]

# Room management schemas
class RoomEndRequest(BaseModel):
    reason: str = Field(..., description='Reason for ending the room')
    force: bool = Field(default=False, description='Force end even if users want to keep')

class RoomPauseRequest(BaseModel):
    duration_minutes: Optional[int] = Field(None, ge=1, le=1440, description='Pause duration in minutes')
    reason: Optional[str] = Field(None, description='Reason for pausing')

class RoomResumeRequest(BaseModel):
    reason: Optional[str] = Field(None, description='Reason for resuming')

# Moderation schemas
class MessageFlagRequest(BaseModel):
    message_id: int
    reason: str = Field(..., max_length=100, description='Reason for flagging')
    details: Optional[str] = Field(None, max_length=500, description='Additional details')

class RoomModerationUpdate(BaseModel):
    is_moderated: bool
    moderation_level: str = Field(..., description='low, medium, high')
    auto_moderation: bool = Field(default=False, description='Enable automatic moderation')

# Analytics schemas
class RoomAnalytics(BaseModel):
    room_id: int
    total_messages: int
    total_participants: int
    average_message_length: float
    most_active_hours: List[int]
    engagement_score: float
    created_at: datetime
    last_activity: datetime

# Update forward references
ChatMessageResponse.model_rebuild()
MessageReactionResponse.model_rebuild()

# Export all schemas
__all__ = [
    'ChatRoomBase', 'ChatRoomCreate', 'ChatRoomUpdate', 'ChatRoomResponse',
    'ChatMessageBase', 'ChatMessageCreate', 'ChatMessageUpdate', 'ChatMessageResponse',
    'MessageReactionBase', 'MessageReactionCreate', 'MessageReactionResponse',
    'RoomParticipantBase', 'RoomParticipantResponse',
    'ChatSessionBase', 'ChatSessionResponse',
    'ChatEventBase', 'ChatEventCreate', 'ChatEventResponse',
    'WebSocketMessage', 'ChatWebSocketMessage', 'TypingIndicatorMessage', 'PresenceUpdateMessage',
    'ChatSearchRequest', 'ChatSearchResponse',
    'MessagePaginationParams', 'MessagePaginationResponse',
    'RoomEndRequest', 'RoomPauseRequest', 'RoomResumeRequest',
    'MessageFlagRequest', 'RoomModerationUpdate',
    'RoomAnalytics',
    'MessageStatus', 'ParticipantStatus', 'RoomStatus', 'ContentType', 'ReactionType'
]
