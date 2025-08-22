from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import timedelta, date
import json

from ..database import get_db
from ..models import User
from ..schemas import UserCreate, UserSignup, UserLogin, Token, TokenSignup, UserResponse, UserSignupResponse
from ..utils.auth_utils import verify_password, get_password_hash, create_access_token, verify_token
from ..config import settings

router = APIRouter()
security = HTTPBearer()

@router.post("/signup", response_model=TokenSignup)
async def signup(user_data: UserSignup, db: Session = Depends(get_db)):
    """User signup endpoint - creates user with minimal info"""
    
    # Validate input data
    if not user_data.username or user_data.username.strip() == "":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập không được để trống"
        )
    
    if not user_data.password or len(user_data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu phải có ít nhất 6 ký tự"
        )
    
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập đã tồn tại"
        )
    
    try:
        # Create new user with minimal information
        hashed_password = get_password_hash(user_data.password)
        
        new_user = User(
            username=user_data.username,
            password_hash=hashed_password,
            email=user_data.email,
            nickname=f"user_{user_data.username}",  # Temporary nickname
            dob=date(1990, 1, 1),  # Placeholder date
            gender="Khác",  # Default gender
            preferred_gender="[]",  # Empty JSON array
            needs="[]",  # Empty JSON array
            interests="[]",  # Empty JSON array
            profile_completed=False,  # Profile not completed yet
            role='free'
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Create access token
        access_token = create_access_token(
            data={"sub": new_user.username}
        )
        
        # Convert to response schema
        user_response = UserSignupResponse(
            id=new_user.id,
            username=new_user.username,
            nickname=new_user.nickname,
            profile_completed=False,
            status=new_user.status,
            online_status=new_user.online_status,
            avatar_url=new_user.avatar_url,
            role=new_user.role,
            created_at=new_user.created_at
        )
        
        return TokenSignup(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi tạo tài khoản: {str(e)}"
        )

@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """User login endpoint"""
    
    # Find user by username
    user = db.query(User).filter(User.username == user_credentials.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không đúng"
        )
    
    # Check if user is banned
    if user.banned_until and user.banned_until > date.today():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tài khoản bị tạm khóa đến {user.banned_until.strftime('%d/%m/%Y')}"
        )
    
    # Verify password
    if not verify_password(user_credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không đúng"
        )
    
    # Update online status
    user.online_status = True
    db.commit()
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user.username}
    )
    
    # Convert to response schema
    user_response = UserResponse(
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
        avatar_url=user.avatar_url,
        role=user.role,
        created_at=user.created_at,
        current_room_id=user.current_room_id
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@router.post("/refresh", response_model=Token)
async def refresh_token(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    """Refresh access token"""
    
    token = credentials.credentials
    token_data = verify_token(token)
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ"
        )
    
    # Get user from database
    user = db.query(User).filter(User.username == token_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại"
        )
    
    # Check if user is banned
    if user.banned_until and user.banned_until > date.today():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tài khoản bị tạm khóa đến {user.banned_until.strftime('%d/%m/%Y')}"
        )
    
    # Create new access token
    access_token = create_access_token(
        data={"sub": user.username}
    )
    
    # Convert to response schema
    user_response = UserResponse(
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
        avatar_url=user.avatar_url,
        role=user.role,
        created_at=user.created_at
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@router.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    """User logout endpoint"""
    
    token = credentials.credentials
    token_data = verify_token(token)
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ"
        )
    
    # Get user and reset all status
    user = db.query(User).filter(User.username == token_data.username).first()
    if user:
        # Reset user status to idle
        user.online_status = False
        user.status = 'idle'
        
        db.commit()
    
    return {"message": "Đăng xuất thành công"}

# Helper function to get current user - REMOVED (duplicate with auth_utils.py)
# Use get_current_user from auth_utils instead
