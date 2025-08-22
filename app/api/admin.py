from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta, datetime
import json

from ..database import get_db
from ..models import User, Room, Message, Report, MatchingQueue
from ..schemas import AdminUserUpdate, ReportResponse
from ..utils.auth_utils import get_current_user
from ..config import settings

router = APIRouter()
security = HTTPBearer()

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    """Get current admin user"""
    
    from ..utils.auth_utils import verify_token
    token = credentials.credentials
    token_data = verify_token(token)
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ"
        )
    
    user = db.query(User).filter(User.username == token_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại"
        )
    
    # Check if user is admin
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Không có quyền truy cập"
        )
    
    return user

@router.get("/dashboard")
async def admin_dashboard(admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    """Get admin dashboard statistics"""
    
    try:
        # User statistics
        total_users = db.query(func.count(User.id)).scalar()
        online_users = db.query(func.count(User.id)).filter(User.online_status == True).scalar()
        searching_users = db.query(func.count(User.id)).filter(User.status == "Searching").scalar()
        connected_users = db.query(func.count(User.id)).filter(User.status == "Connected").scalar()
        
        # Room statistics
        total_rooms = db.query(func.count(Room.id)).scalar()
        active_rooms = db.query(func.count(Room.id)).filter(Room.end_time == None).scalar()
        
        # Report statistics
        total_reports = db.query(func.count(Report.id)).scalar()
        today_reports = db.query(func.count(Report.id)).filter(
            func.date(Report.timestamp) == date.today()
        ).scalar()
        
        # Banned users
        banned_users = db.query(func.count(User.id)).filter(
            User.banned_until > date.today()
        ).scalar()
        
        # Queue statistics
        queue_size = db.query(func.count(MatchingQueue.id)).scalar()
        
        return {
            "users": {
                "total": total_users,
                "online": online_users,
                "searching": searching_users,
                "connected": connected_users
            },
            "rooms": {
                "total": total_rooms,
                "active": active_rooms
            },
            "reports": {
                "total": total_reports,
                "today": today_reports
            },
            "banned_users": banned_users,
            "queue_size": queue_size
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lấy thống kê: {str(e)}"
        )

@router.get("/users")
async def get_users(
    page: int = 1,
    limit: int = 50,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get paginated list of users"""
    
    try:
        offset = (page - 1) * limit
        
        users = db.query(User).offset(offset).limit(limit).all()
        total_users = db.query(func.count(User.id)).scalar()
        
        user_list = []
        for user in users:
            user_data = {
                "id": user.id,
                "username": user.username,
                "nickname": user.nickname,
                "email": user.email,
                "gender": user.gender,
                "status": user.status,
                "online_status": user.online_status,
                "role": user.role,
                "reports_count": user.reports_count,
                "banned_until": user.banned_until.isoformat() if user.banned_until else None,
                "created_at": user.created_at.isoformat(),
                "profile_completed": user.profile_completed
            }
            user_list.append(user_data)
        
        return {
            "users": user_list,
            "total": total_users,
            "page": page,
            "limit": limit,
            "pages": (total_users + limit - 1) // limit
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lấy danh sách người dùng: {str(e)}"
        )

@router.get("/users/{user_id}")
async def get_user_details(
    user_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get detailed user information"""
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy người dùng"
            )
        
        # Get user's reports
        reports = db.query(Report).filter(Report.reported_user_id == user_id).all()
        report_list = []
        for report in reports:
            report_data = {
                "id": report.id,
                "reporter_id": report.reporter_id,
                "room_id": report.room_id,
                "reason": report.reason,
                "timestamp": report.timestamp.isoformat()
            }
            report_list.append(report_data)
        
        user_data = {
            "id": user.id,
            "username": user.username,
            "nickname": user.nickname,
            "email": user.email,
            "dob": user.dob.isoformat(),
            "gender": user.gender,
            "preferred_gender": json.loads(user.preferred_gender) if user.preferred_gender else [],
            "needs": json.loads(user.needs) if user.needs else [],
            "interests": json.loads(user.interests) if user.interests else [],
            "status": user.status,
            "online_status": user.online_status,
            "role": user.role,
            "reports_count": user.reports_count,
            "banned_until": user.banned_until.isoformat() if user.banned_until else None,
            "created_at": user.created_at.isoformat(),
            "profile_completed": user.profile_completed,
            "reports": report_list
        }
        
        return user_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lấy thông tin người dùng: {str(e)}"
        )

@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    user_data: AdminUserUpdate,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Update user (admin only)"""
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy người dùng"
            )
        
        # Update fields if provided
        if user_data.role is not None:
            user.role = user_data.role
        
        if user_data.banned_until is not None:
            user.banned_until = user_data.banned_until
        
        if user_data.reports_count is not None:
            user.reports_count = user_data.reports_count
        
        db.commit()
        
        return {"message": "Cập nhật người dùng thành công"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi cập nhật người dùng: {str(e)}"
        )

@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: int,
    ban_days: int = 1,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Ban user for specified number of days"""
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy người dùng"
            )
        
        # Set ban until date
        user.banned_until = date.today() + timedelta(days=ban_days)
        
        # If user is currently in a room, end the session
        if user.current_room_id:
            room = db.query(Room).filter(Room.id == user.current_room_id).first()
            if room:
                # End the room session
                room.end_time = datetime.now(timezone.utc)
                
                # Update other user's status
                other_user_id = room.user2_id if user.id == room.user1_id else room.user1_id
                other_user = db.query(User).filter(User.id == other_user_id).first()
                if other_user:
                    other_user.status = "Idle"
                    other_user.current_room_id = None
        
        # Update current user status
        user.status = "Idle"
        user.current_room_id = None
        user.online_status = False
        
        db.commit()
        
        return {"message": f"Đã khóa người dùng {ban_days} ngày"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khóa người dùng: {str(e)}"
        )

@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Unban user"""
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy người dùng"
            )
        
        user.banned_until = None
        db.commit()
        
        return {"message": "Đã mở khóa người dùng"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi mở khóa người dùng: {str(e)}"
        )

@router.get("/reports")
async def get_reports(
    page: int = 1,
    limit: int = 50,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get paginated list of reports"""
    
    try:
        offset = (page - 1) * limit
        
        reports = db.query(Report).order_by(Report.timestamp.desc()).offset(offset).limit(limit).all()
        total_reports = db.query(func.count(Report.id)).scalar()
        
        report_list = []
        for report in reports:
            # Get reporter and reported user details
            reporter = db.query(User).filter(User.id == report.reporter_id).first()
            reported_user = db.query(User).filter(User.id == report.reported_user_id).first()
            
            report_data = {
                "id": report.id,
                "reporter": {
                    "id": reporter.id,
                    "username": reporter.username,
                    "nickname": reporter.nickname
                } if reporter else None,
                "reported_user": {
                    "id": reported_user.id,
                    "username": reported_user.username,
                    "nickname": reported_user.nickname
                } if reported_user else None,
                "room_id": report.room_id,
                "reason": report.reason,
                "timestamp": report.timestamp.isoformat()
            }
            report_list.append(report_data)
        
        return {
            "reports": report_list,
            "total": total_reports,
            "page": page,
            "limit": limit,
            "pages": (total_reports + limit - 1) // limit
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lấy danh sách báo cáo: {str(e)}"
        )

@router.get("/rooms")
async def get_rooms(
    page: int = 1,
    limit: int = 50,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get paginated list of rooms"""
    
    try:
        offset = (page - 1) * limit
        
        rooms = db.query(Room).order_by(Room.created_at.desc()).offset(offset).limit(limit).all()
        total_rooms = db.query(func.count(Room.id)).scalar()
        
        room_list = []
        for room in rooms:
            # Get user details
            user1 = db.query(User).filter(User.id == room.user1_id).first()
            user2 = db.query(User).filter(User.id == room.user2_id).first()
            
            room_data = {
                "id": room.id,
                "type": room.type,
                "user1": {
                    "id": user1.id,
                    "username": user1.username,
                    "nickname": user1.nickname
                } if user1 else None,
                "user2": {
                    "id": user2.id,
                    "username": user2.username,
                    "nickname": user2.nickname
                } if user2 else None,
                "start_time": room.start_time.isoformat(),
                "end_time": room.end_time.isoformat() if room.end_time else None,
                "reveal_level": room.reveal_level,
                "keep_active": room.keep_active,
                "created_at": room.created_at.isoformat()
            }
            room_list.append(room_data)
        
        return {
            "rooms": room_list,
            "total": total_rooms,
            "page": page,
            "limit": limit,
            "pages": (total_rooms + limit - 1) // limit
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lấy danh sách phòng: {str(e)}"
        )
