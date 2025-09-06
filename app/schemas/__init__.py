from pydantic import BaseModel, EmailStr, validator, field_serializer
from typing import Optional, List
from datetime import date, datetime
from enum import Enum

# Enums
class Gender(str, Enum):
    NAM = "Nam"
    NU = "Nữ"
    KHAC = "Khác"



# Base schemas
class UserBase(BaseModel):
    username: str
    nickname: str
    dob: date
    gender: Gender
    preferred_gender: List[str]
    needs: List[str]
    interests: List[str]

class UserCreate(UserBase):
    password: str
    email: Optional[EmailStr] = None

class UserSignup(BaseModel):
    username: str
    password: str
    email: Optional[EmailStr] = None

class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[Gender] = None
    preferred_gender: Optional[List[str]] = None
    needs: Optional[List[str]] = None
    interests: Optional[List[str]] = None

class UserResponse(UserBase):
    id: int
    profile_completed: bool
    status: str
    online_status: bool
    avatar_url: str
    role: str
    created_at: datetime
    current_room_id: Optional[int] = None

    @field_serializer('dob')
    def serialize_dob(self, value: date) -> str:
        return value.isoformat() if value else None
    
    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime) -> str:
        return value.isoformat() if value else None

    class Config:
        from_attributes = True

class UserSignupResponse(BaseModel):
    id: int
    username: str
    nickname: str
    profile_completed: bool
    status: str
    online_status: bool
    avatar_url: str
    role: str
    created_at: datetime

    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime) -> str:
        return value.isoformat() if value else None

    class Config:
        from_attributes = True

# Auth schemas
class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenSignup(BaseModel):
    access_token: str
    token_type: str
    user: UserSignupResponse

class TokenData(BaseModel):
    username: Optional[str] = None

# Chat schemas
class MessageCreate(BaseModel):
    content: str

class MessageResponse(BaseModel):
    id: int
    content: str
    timestamp: datetime
    user_id: int

    @field_serializer('timestamp')
    def serialize_timestamp(self, value: datetime) -> str:
        return value.isoformat() if value else None

    class Config:
        from_attributes = True

class RoomResponse(BaseModel):
    id: int
    type: str
    user1_id: int
    user2_id: int
    start_time: datetime
    reveal_level: int
    keep_active: bool
    last_message_time: datetime

    @field_serializer('timestamp')
    def serialize_timestamp(self, value: datetime) -> str:
        return value.isoformat() if value else None

    class Config:
        from_attributes = True

class ChatSearch(BaseModel):
    type: str = "chat"

class ChatLike(BaseModel):
    response: str  # "yes" or "no"

class ChatKeep(BaseModel):
    keep_active: bool

class ChatReport(BaseModel):
    reason: Optional[str] = None

# Admin schemas
class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    banned_until: Optional[date] = None
    reports_count: Optional[int] = None

class ReportCreate(BaseModel):
    reported_user_id: int
    reason: Optional[str] = None

class ReportResponse(BaseModel):
    id: int
    reporter_id: int
    reported_user_id: int
    room_id: Optional[int]
    reason: Optional[str]
    timestamp: datetime

    @field_serializer('timestamp')
    def serialize_timestamp(self, value: datetime) -> str:
        return value.isoformat() if value else None

    class Config:
        from_attributes = True

# Matching schemas
class MatchingResponse(BaseModel):
    room_id: Optional[int] = None
    matched_user: Optional[UserResponse] = None
    icebreaker: Optional[str] = None

# File upload schemas
class FileUploadResponse(BaseModel):
    filename: str
    url: str
    size: int

# Error schemas
class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None

# Success schemas
class SuccessResponse(BaseModel):
    message: str
    data: Optional[dict] = None
