#!/usr/bin/env python3
"""
Database initialization script for Mapmo.vn
Creates admin user and populates initial data
"""

import sys
import os
import datetime
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, SessionLocal, create_tables
from app.models import User, Icebreaker
from app.utils.auth_utils import get_password_hash
from app.config import settings
import json

def create_admin_user():
    """Create admin user"""
    db = SessionLocal()
    try:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.username == settings.admin_username).first()
        if existing_admin:
            print(f"Admin user '{settings.admin_username}' already exists")
            return existing_admin
        
        # Create admin user
        admin_user = User(
            username=settings.admin_username,
            password_hash=get_password_hash(settings.admin_password),
            nickname="Administrator",
            dob=datetime.date(1990, 1, 1),  # Placeholder date
            gender="Khác",
            preferred_gender=json.dumps(["Tất cả"]),
            needs=json.dumps(["Nghiêm túc"]),
            interests=json.dumps(["Đọc", "Nhạc", "Phim"]),
            profile_completed=True,
            role="admin",
            online_status=False
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print(f"Admin user '{settings.admin_username}' created successfully")
        return admin_user
        
    except Exception as e:
        db.rollback()
        print(f"Error creating admin user: {e}")
        return None
    finally:
        db.close()

def create_icebreakers():
    """Create initial icebreaker prompts"""
    db = SessionLocal()
    try:
        # Check if icebreakers already exist
        existing_count = db.query(Icebreaker).count()
        if existing_count > 0:
            print(f"{existing_count} icebreakers already exist")
            return
        
        icebreakers_data = [
            # Gym
            {"interest": "Gym", "prompt": "Bạn thích Gym à? Kể routine đi!"},
            {"interest": "Gym", "prompt": "Bạn tập được bao lâu rồi? Có tip gì không?"},
            {"interest": "Gym", "prompt": "Bạn thích tập nhóm cơ nào nhất?"},
            
            # Nhảy
            {"interest": "Nhảy", "prompt": "Bạn nhảy được bao lâu rồi? Thể loại gì?"},
            {"interest": "Nhảy", "prompt": "Bạn có tham gia biểu diễn không?"},
            {"interest": "Nhảy", "prompt": "Bạn thích nhạc gì để nhảy?"},
            
            # Ảnh
            {"interest": "Ảnh", "prompt": "Bạn chụp ảnh gì nhiều nhất?"},
            {"interest": "Ảnh", "prompt": "Bạn có máy ảnh riêng không?"},
            {"interest": "Ảnh", "prompt": "Bạn thích chụp ảnh gì nhất?"},
            
            # Cafe
            {"interest": "Cafe", "prompt": "Bạn thích loại cafe nào?"},
            {"interest": "Cafe", "prompt": "Bạn có quán cafe yêu thích không?"},
            {"interest": "Cafe", "prompt": "Bạn thích cafe đắng hay ngọt?"},
            
            # Du lịch
            {"interest": "Du lịch", "prompt": "Bạn đã đi đâu nhiều nhất?"},
            {"interest": "Du lịch", "prompt": "Bạn thích du lịch kiểu gì?"},
            {"interest": "Du lịch", "prompt": "Bạn có muốn đi nước ngoài không?"},
            
            # Game
            {"interest": "Game", "prompt": "Bạn chơi game gì nhiều nhất?"},
            {"interest": "Game", "prompt": "Bạn thích game mobile hay PC?"},
            {"interest": "Game", "prompt": "Bạn có chơi game online không?"},
            
            # Đọc
            {"interest": "Đọc", "prompt": "Bạn thích đọc sách gì?"},
            {"interest": "Đọc", "prompt": "Bạn đọc bao nhiêu cuốn một tháng?"},
            {"interest": "Đọc", "prompt": "Bạn có tác giả yêu thích không?"},
            
            # Nhạc
            {"interest": "Nhạc", "prompt": "Bạn thích thể loại nhạc gì?"},
            {"interest": "Nhạc", "prompt": "Bạn có ca sĩ yêu thích không?"},
            {"interest": "Nhạc", "prompt": "Bạn có nghe nhạc khi làm việc không?"},
            
            # Tình nguyện
            {"interest": "Tình nguyện", "prompt": "Bạn tham gia hoạt động gì?"},
            {"interest": "Tình nguyện", "prompt": "Bạn có muốn tham gia không?"},
            {"interest": "Tình nguyện", "prompt": "Bạn thích giúp đỡ người khác không?"},
            
            # Phim
            {"interest": "Phim", "prompt": "Bạn thích xem phim gì?"},
            {"interest": "Phim", "prompt": "Bạn có diễn viên yêu thích không?"},
            {"interest": "Phim", "prompt": "Bạn thích xem phim ở rạp hay ở nhà?"},
            
            # Leo núi
            {"interest": "Leo núi", "prompt": "Bạn đã leo núi nào rồi?"},
            {"interest": "Leo núi", "prompt": "Bạn có muốn thử leo núi không?"},
            {"interest": "Leo núi", "prompt": "Bạn thích leo núi cao hay thấp?"},
            
            # Nghệ thuật
            {"interest": "Nghệ thuật", "prompt": "Bạn thích loại nghệ thuật nào?"},
            {"interest": "Nghệ thuật", "prompt": "Bạn có vẽ tranh không?"},
            {"interest": "Nghệ thuật", "prompt": "Bạn có thích đi bảo tàng không?"},
            
            # Ăn
            {"interest": "Ăn", "prompt": "Bạn thích món ăn gì nhất?"},
            {"interest": "Ăn", "prompt": "Bạn có nấu ăn không?"},
            {"interest": "Ăn", "prompt": "Bạn thích ăn ở nhà hay ngoài?"},
            
            # Tâm linh
            {"interest": "Tâm linh", "prompt": "Bạn có tin vào tâm linh không?"},
            {"interest": "Tâm linh", "prompt": "Bạn có thực hành gì không?"},
            {"interest": "Tâm linh", "prompt": "Bạn có muốn tìm hiểu không?"},
            
            # Thời trang
            {"interest": "Thời trang", "prompt": "Bạn thích phong cách gì?"},
            {"interest": "Thời trang", "prompt": "Bạn có mua sắm nhiều không?"},
            {"interest": "Thời trang", "prompt": "Bạn có thích mặc đồ gì không?"}
        ]
        
        for data in icebreakers_data:
            icebreaker = Icebreaker(
                interest=data["interest"],
                prompt=data["prompt"]
            )
            db.add(icebreaker)
        
        db.commit()
        print(f"Created {len(icebreakers_data)} icebreakers successfully")
        
    except Exception as e:
        db.rollback()
        print(f"Error creating icebreakers: {e}")
    finally:
        db.close()

def main():
    """Main initialization function"""
    print("Initializing Mapmo.vn database...")
    
    try:
        # Create tables
        create_tables()
        print("Database tables created successfully")
        
        # Create admin user
        admin_user = create_admin_user()
        
        # Create icebreakers
        create_icebreakers()
        
        print("\nDatabase initialization completed successfully!")
        print(f"Admin credentials: {settings.admin_username} / {settings.admin_password}")
        
    except Exception as e:
        print(f"Error during initialization: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
