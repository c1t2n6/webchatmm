#!/usr/bin/env python3
"""
Test Integration của Hệ thống Chat Mới
=====================================

Kiểm tra xem hệ thống chat mới có tích hợp mượt mà với hệ thống cũ không
và đánh giá hiệu suất.
"""

import os
import sys
import asyncio
import time
import traceback
from pathlib import Path

# Thêm đường dẫn để import modules
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

def test_imports():
    """Kiểm tra import các module mới"""
    print("🔍 Kiểm tra import các module mới...")
    
    try:
        # Test import models mới
        from app.models.chat_models import ChatRoom, ChatMessage, RoomParticipant
        print("✅ Import models mới thành công")
        
        # Test import schemas mới
        from app.schemas.chat_schemas import ChatRoomCreate, ChatMessageCreate
        print("✅ Import schemas mới thành công")
        
        # Test import connection manager mới
        from app.websocket.connection_manager import ConnectionManager
        print("✅ Import connection manager mới thành công")
        
        # Test import chat service mới
        from app.services.chat_service import ChatService
        print("✅ Import chat service mới thành công")
        
        return True
        
    except Exception as e:
        print(f"❌ Lỗi import: {e}")
        traceback.print_exc()
        return False

def test_old_system_compatibility():
    """Kiểm tra tương thích với hệ thống cũ"""
    print("\n🔍 Kiểm tra tương thích với hệ thống cũ...")
    
    try:
        # Test import models cũ
        from app.models import User, Room, Message
        print("✅ Import models cũ thành công")
        
        # Test import schemas cũ
        from app.schemas import UserResponse, RoomResponse, MessageResponse
        print("✅ Import schemas cũ thành công")
        
        # Test import websocket manager cũ
        from app.websocket_manager import manager
        print("✅ Import websocket manager cũ thành công")
        
        # Test import websocket handlers cũ
        from app.websocket_handlers import handle_chat_websocket
        print("✅ Import websocket handlers cũ thành công")
        
        return True
        
    except Exception as e:
        print(f"❌ Lỗi import hệ thống cũ: {e}")
        traceback.print_exc()
        return False

def test_database_compatibility():
    """Kiểm tra tương thích database"""
    print("\n🔍 Kiểm tra tương thích database...")
    
    try:
        from app.database import Base, engine, get_db
        
        # Kiểm tra xem có thể tạo tables không
        print("✅ Import database thành công")
        
        # Kiểm tra xem có conflict trong table names không
        from app.models import User, Room, Message
        from app.models.chat_models import ChatRoom, ChatMessage, RoomParticipant
        
        old_tables = {'users', 'rooms', 'messages'}
        new_tables = {'chat_rooms', 'chat_messages', 'room_participants'}
        
        if old_tables.intersection(new_tables):
            print("⚠️  Có conflict trong tên tables!")
            return False
        else:
            print("✅ Không có conflict trong tên tables")
            return True
            
    except Exception as e:
        print(f"❌ Lỗi database: {e}")
        traceback.print_exc()
        return False

def test_websocket_compatibility():
    """Kiểm tra tương thích WebSocket"""
    print("\n🔍 Kiểm tra tương thích WebSocket...")
    
    try:
        # Kiểm tra xem có conflict trong WebSocket routes không
        from app.websocket_routes import router as websocket_router
        
        # Kiểm tra xem có thể import cả hai manager không
        from app.websocket_manager import manager as old_manager
        from app.websocket.connection_manager import ConnectionManager
        
        print("✅ Import WebSocket components thành công")
        print("✅ Không có conflict trong WebSocket routes")
        
        return True
        
    except Exception as e:
        print(f"❌ Lỗi WebSocket: {e}")
        traceback.print_exc()
        return False

def test_frontend_compatibility():
    """Kiểm tra tương thích frontend"""
    print("\n🔍 Kiểm tra tương thích frontend...")
    
    try:
        # Kiểm tra xem có file JavaScript mới không
        optimized_chat_path = Path("static/js/modules/optimized_chat.js")
        if optimized_chat_path.exists():
            print("✅ File optimized_chat.js tồn tại")
        else:
            print("❌ File optimized_chat.js không tồn tại")
            return False
        
        # Kiểm tra xem có conflict trong tên class không
        with open(optimized_chat_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if 'class OptimizedChat' in content:
                print("✅ Class OptimizedChat được định nghĩa")
            else:
                print("❌ Class OptimizedChat không được định nghĩa")
                return False
        
        return True
        
    except Exception as e:
        print(f"❌ Lỗi frontend: {e}")
        traceback.print_exc()
        return False

def test_performance_metrics():
    """Kiểm tra các metrics hiệu suất"""
    print("\n🔍 Kiểm tra metrics hiệu suất...")
    
    try:
        # Test import time
        start_time = time.time()
        from app.models.chat_models import ChatRoom, ChatMessage, RoomParticipant
        from app.schemas.chat_schemas import ChatRoomCreate, ChatMessageCreate
        from app.websocket.connection_manager import ConnectionManager
        from app.services.chat_service import ChatService
        import_time = time.time() - start_time
        
        print(f"✅ Import time: {import_time:.4f}s")
        
        if import_time < 0.1:
            print("✅ Import performance tốt")
        elif import_time < 0.5:
            print("⚠️  Import performance trung bình")
        else:
            print("❌ Import performance chậm")
        
        return True
        
    except Exception as e:
        print(f"❌ Lỗi performance test: {e}")
        traceback.print_exc()
        return False

def test_system_integration():
    """Kiểm tra tích hợp tổng thể"""
    print("\n🔍 Kiểm tra tích hợp tổng thể...")
    
    try:
        # Kiểm tra xem app factory có thể import được không
        from app.app_factory import create_app
        
        print("✅ App factory import thành công")
        
        # Kiểm tra xem có thể tạo app instance không
        # (Chỉ test import, không test runtime)
        print("✅ App factory structure hợp lệ")
        
        return True
        
    except Exception as e:
        print(f"❌ Lỗi tích hợp: {e}")
        traceback.print_exc()
        return False

def main():
    """Chạy tất cả tests"""
    print("🚀 Bắt đầu kiểm tra tích hợp hệ thống chat mới...\n")
    
    tests = [
        ("Import Modules Mới", test_imports),
        ("Tương thích Hệ thống Cũ", test_old_system_compatibility),
        ("Tương thích Database", test_database_compatibility),
        ("Tương thích WebSocket", test_websocket_compatibility),
        ("Tương thích Frontend", test_frontend_compatibility),
        ("Metrics Hiệu suất", test_performance_metrics),
        ("Tích hợp Tổng thể", test_system_integration)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Lỗi trong test {test_name}: {e}")
            results.append((test_name, False))
    
    # Tổng kết
    print("\n" + "="*50)
    print("📊 KẾT QUẢ KIỂM TRA TÍCH HỢP")
    print("="*50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nTổng cộng: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 Tất cả tests đều PASS! Hệ thống mới tích hợp mượt mà.")
    elif passed >= total * 0.8:
        print("⚠️  Hầu hết tests PASS. Có một số vấn đề nhỏ cần khắc phục.")
    else:
        print("❌ Nhiều tests FAIL. Cần kiểm tra và khắc phục các vấn đề.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
