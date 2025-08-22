from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import json
import os
import uuid

from ..database import get_db
from ..models import User
from ..schemas import UserResponse, UserUpdate, FileUploadResponse
from ..utils.auth_utils import get_current_user
from ..utils.image_utils import image_processor
from ..config import settings

router = APIRouter()
security = HTTPBearer()

@router.get("/profile", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current user profile"""
    
    # Convert to response schema
    user_response = UserResponse(
        id=current_user.id,
        username=current_user.username,
        nickname=current_user.nickname,
        dob=current_user.dob,
        gender=current_user.gender,
        preferred_gender=json.loads(current_user.preferred_gender) if current_user.preferred_gender else [],
        needs=json.loads(current_user.needs) if current_user.needs else [],
        interests=json.loads(current_user.interests) if current_user.interests else [],
        profile_completed=current_user.profile_completed,
                    status=current_user.status,
        online_status=current_user.online_status,
        avatar_url=current_user.avatar_url,
        role=current_user.role,
        created_at=current_user.created_at,
        current_room_id=current_user.current_room_id
    )
    
    return user_response

@router.put("/profile/update", response_model=UserResponse)
async def update_profile(
    profile_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile"""
    
    try:
        # Update fields if provided
        if profile_data.nickname is not None:
            # Check if nickname is already taken by another user
            existing_nickname = db.query(User).filter(
                User.nickname == profile_data.nickname,
                User.id != current_user.id
            ).first()
            if existing_nickname:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Biệt danh đã tồn tại"
                )
            current_user.nickname = profile_data.nickname
        
        if profile_data.dob is not None:
            # Validate age
            from datetime import date
            today = date.today()
            age = today.year - profile_data.dob.year - ((today.month, today.day) < (profile_data.dob.month, profile_data.dob.day))
            if age < 18:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Phải từ 18 tuổi trở lên"
                )
            current_user.dob = profile_data.dob
        
        if profile_data.gender is not None:
            current_user.gender = profile_data.gender
        
        if profile_data.preferred_gender is not None:
            current_user.preferred_gender = json.dumps(profile_data.preferred_gender)
        
        if profile_data.needs is not None:
            if len(profile_data.needs) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Phải chọn ít nhất 1 nhu cầu"
                )
            current_user.needs = json.dumps(profile_data.needs)
        
        if profile_data.interests is not None:
            if len(profile_data.interests) > 5:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Chỉ được chọn tối đa 5 sở thích"
                )
            current_user.interests = json.dumps(profile_data.interests)
        
        # Check if profile is completed
        if (current_user.nickname and current_user.dob and current_user.gender and 
            current_user.preferred_gender and current_user.needs and current_user.interests):
            current_user.profile_completed = True
        
        db.commit()
        db.refresh(current_user)
        
        # Convert to response schema
        user_response = UserResponse(
            id=current_user.id,
            username=current_user.username,
            nickname=current_user.nickname,
            dob=current_user.dob,
            gender=current_user.gender,
            preferred_gender=json.loads(current_user.preferred_gender) if current_user.preferred_gender else [],
            needs=json.loads(current_user.needs) if current_user.needs else [],
            interests=json.loads(current_user.interests) if current_user.interests else [],
            profile_completed=current_user.profile_completed,
            status=current_user.status,
            online_status=current_user.online_status,
            avatar_url=current_user.avatar_url,
            role=current_user.role,
            created_at=current_user.created_at,
            current_room_id=current_user.current_room_id
        )
        
        return user_response
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi cập nhật hồ sơ: {str(e)}"
        )

@router.post("/avatar/upload", response_model=FileUploadResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload user avatar"""
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ chấp nhận file ảnh"
        )
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Save temporary file
    temp_path = os.path.join(settings.upload_dir, f"temp_{unique_filename}")
    try:
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Validate and process image
        is_valid, error_msg = image_processor.validate_image(temp_path)
        if not is_valid:
            os.remove(temp_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )
        
        # Process image and create variants
        result = image_processor.process_avatar(temp_path, unique_filename)
        if not result['success']:
            os.remove(temp_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Lỗi xử lý ảnh: {result['error']}"
            )
        
        # Clean up temp file
        image_processor.cleanup_temp_files(temp_path)
        
        # Update user avatar in database
        if current_user.avatar_url != 'default_avatar.jpg':
            # Delete old avatar variants
            image_processor.delete_avatar_variants(current_user.avatar_url)
        
        current_user.avatar_url = result['original']
        db.commit()
        
        return FileUploadResponse(
            filename=result['original'],
            url=f"/static/uploads/{result['original']}",
            size=len(content)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up on error
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi upload ảnh: {str(e)}"
        )

@router.get("/status")
async def get_user_status(current_user: User = Depends(get_current_user)):
    """Get current user status"""
    return {
        "id": current_user.id,
        "status": current_user.status,
        "online_status": current_user.online_status,
        "current_room_id": current_user.current_room_id
    }

@router.post("/status/update")
async def update_user_status(
    status_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user status"""
    
    try:
        if "status" in status_data:
            current_user.status = status_data["status"]
        
        if "online_status" in status_data:
            current_user.online_status = status_data["online_status"]
        
        if "current_room_id" in status_data:
            current_user.current_room_id = status_data["current_room_id"]
        
        db.commit()
        
        return {"message": "Cập nhật trạng thái thành công"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi cập nhật trạng thái: {str(e)}"
        )
