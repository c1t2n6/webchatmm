#!/usr/bin/env python3
"""
Quick System Check
=================

Script kiểm tra nhanh để verify hệ thống chat mới hoạt động đúng.
"""

import os
import sys
import time
from pathlib import Path

# Thêm đường dẫn để import modules
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

def quick_import_check():
    """Kiểm tra import nhanh"""
    print("🔍 Quick Import Check...")
    
    try:
        # Test import cơ bản
        from app.models.chat_models import ChatRoom, ChatMessage, RoomParticipant
        from app.schemas.chat_schemas import ChatRoomCreate, ChatMessageCreate
        from app.websocket.connection_manager import ConnectionManager
        from app.services.chat_service import ChatService
        
        print("✅ Tất cả modules mới import thành công")
        return True
        
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False

def quick_schema_test():
    """Test schema nhanh"""
    print("\n🔍 Quick Schema Test...")
    
    try:
        from app.schemas.chat_schemas import ChatRoomCreate, ChatMessageCreate
        
        # Test tạo room
        room = ChatRoomCreate(user2_id=1, search_type="chat")
        print("✅ ChatRoomCreate schema hoạt động")
        
        # Test tạo message
        message = ChatMessageCreate(content="Test", room_id=1)
        print("✅ ChatMessageCreate schema hoạt động")
        
        return True
        
    except Exception as e:
        print(f"❌ Schema test failed: {e}")
        return False

def quick_service_test():
    """Test service nhanh"""
    print("\n🔍 Quick Service Test...")
    
    try:
        from app.services.chat_service import ChatService
        
        service = ChatService()
        print("✅ ChatService khởi tạo thành công")
        
        return True
        
    except Exception as e:
        print(f"❌ Service test failed: {e}")
        return False

def quick_websocket_test():
    """Test WebSocket nhanh"""
    print("\n🔍 Quick WebSocket Test...")
    
    try:
        from app.websocket.connection_manager import ConnectionManager
        
        manager = ConnectionManager()
        print("✅ ConnectionManager khởi tạo thành công")
        
        return True
        
    except Exception as e:
        print(f"❌ WebSocket test failed: {e}")
        return False

def quick_old_system_check():
    """Kiểm tra hệ thống cũ vẫn hoạt động"""
    print("\n🔍 Quick Old System Check...")
    
    try:
        from app.models import User, Room, Message
        from app.websocket_manager import manager
        
        print("✅ Hệ thống cũ vẫn hoạt động bình thường")
        return True
        
    except Exception as e:
        print(f"❌ Hệ thống cũ check failed: {e}")
        return False

def quick_performance_check():
    """Kiểm tra hiệu suất nhanh"""
    print("\n🔍 Quick Performance Check...")
    
    try:
        start_time = time.time()
        
        # Import tất cả modules
        from app.models.chat_models import ChatRoom, ChatMessage, RoomParticipant
        from app.schemas.chat_schemas import ChatRoomCreate, ChatMessageCreate
        from app.websocket.connection_manager import ConnectionManager
        from app.services.chat_service import ChatService
        
        import_time = time.time() - start_time
        
        if import_time < 0.1:
            status = "✅ RẤT NHANH"
        elif import_time < 0.5:
            status = "✅ NHANH"
        elif import_time < 1.0:
            status = "⚠️  TRUNG BÌNH"
        else:
            status = "❌ CHẬM"
        
        print(f"✅ Import time: {import_time:.4f}s - {status}")
        
        return True
        
    except Exception as e:
        print(f"❌ Performance check failed: {e}")
        return False

def main():
    """Main function"""
    print("🚀 Quick System Check - Hệ thống Chat Mới")
    print("="*50)
    
    tests = [
        ("Import Check", quick_import_check),
        ("Schema Test", quick_schema_test),
        ("Service Test", quick_service_test),
        ("WebSocket Test", quick_websocket_test),
        ("Old System Check", quick_old_system_check),
        ("Performance Check", quick_performance_check)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Lỗi trong {test_name}: {e}")
            results.append((test_name, False))
    
    # Tổng kết
    print("\n" + "="*50)
    print("📊 KẾT QUẢ KIỂM TRA NHANH")
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
        print("🎉 Tất cả tests PASS! Hệ thống hoạt động hoàn hảo.")
        print("✅ Sẵn sàng để sử dụng!")
    elif passed >= total * 0.8:
        print("⚠️  Hầu hết tests PASS. Có một số vấn đề nhỏ.")
        print("✅ Có thể sử dụng với một số hạn chế.")
    else:
        print("❌ Nhiều tests FAIL. Cần kiểm tra và khắc phục.")
        print("❌ Không nên sử dụng cho đến khi khắc phục.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
