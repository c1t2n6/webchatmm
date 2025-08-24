#!/usr/bin/env python3
"""
Performance Benchmark Test
=========================

Test hiệu suất của hệ thống chat mới để đánh giá performance.
"""

import os
import sys
import time
import asyncio
import traceback
from pathlib import Path
from datetime import datetime, timezone, timedelta
import random
import string

# Thêm đường dẫn để import modules
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

def generate_random_string(length=10):
    """Tạo chuỗi ngẫu nhiên"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def benchmark_import_performance():
    """Benchmark thời gian import các modules"""
    print("🔍 Benchmark Import Performance...")
    
    results = {}
    
    # Test import models
    start_time = time.time()
    try:
        from app.models.chat_models import ChatRoom, ChatMessage, RoomParticipant
        import_time = time.time() - start_time
        results['models'] = import_time
        print(f"✅ Models import: {import_time:.4f}s")
    except Exception as e:
        print(f"❌ Models import failed: {e}")
        results['models'] = float('inf')
    
    # Test import schemas
    start_time = time.time()
    try:
        from app.schemas.chat_schemas import ChatRoomCreate, ChatMessageCreate
        import_time = time.time() - start_time
        results['schemas'] = import_time
        print(f"✅ Schemas import: {import_time:.4f}s")
    except Exception as e:
        print(f"❌ Schemas import failed: {e}")
        results['schemas'] = float('inf')
    
    # Test import connection manager
    start_time = time.time()
    try:
        from app.websocket.connection_manager import ConnectionManager
        import_time = time.time() - start_time
        results['connection_manager'] = import_time
        print(f"✅ Connection Manager import: {import_time:.4f}s")
    except Exception as e:
        print(f"❌ Connection Manager import failed: {e}")
        results['connection_manager'] = float('inf')
    
    # Test import chat service
    start_time = time.time()
    try:
        from app.services.chat_service import ChatService
        import_time = time.time() - start_time
        results['chat_service'] = import_time
        print(f"✅ Chat Service import: {import_time:.4f}s")
    except Exception as e:
        print(f"❌ Chat Service import failed: {e}")
        results['chat_service'] = float('inf')
    
    return results

def benchmark_memory_usage():
    """Benchmark memory usage"""
    print("\n🔍 Benchmark Memory Usage...")
    
    try:
        import psutil
        import gc
        
        # Force garbage collection
        gc.collect()
        
        # Get initial memory
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Import modules
        from app.models.chat_models import ChatRoom, ChatMessage, RoomParticipant
        from app.schemas.chat_schemas import ChatRoomCreate, ChatMessageCreate
        from app.websocket.connection_manager import ConnectionManager
        from app.services.chat_service import ChatService
        
        # Get memory after import
        gc.collect()
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        memory_increase = final_memory - initial_memory
        
        print(f"✅ Initial memory: {initial_memory:.2f} MB")
        print(f"✅ Final memory: {final_memory:.2f} MB")
        print(f"✅ Memory increase: {memory_increase:.2f} MB")
        
        if memory_increase < 10:
            print("✅ Memory usage tốt")
        elif memory_increase < 50:
            print("⚠️  Memory usage trung bình")
        else:
            print("❌ Memory usage cao")
        
        return {
            'initial': initial_memory,
            'final': final_memory,
            'increase': memory_increase
        }
        
    except ImportError:
        print("⚠️  psutil không có sẵn, bỏ qua memory benchmark")
        return None
    except Exception as e:
        print(f"❌ Memory benchmark failed: {e}")
        return None

def benchmark_object_creation():
    """Benchmark thời gian tạo objects"""
    print("\n🔍 Benchmark Object Creation...")
    
    try:
        from app.schemas.chat_schemas import ChatRoomCreate, ChatMessageCreate
        
        # Test tạo ChatRoomCreate
        start_time = time.time()
        for i in range(1000):
            room = ChatRoomCreate(
                user2_id=i,
                search_type="chat"
            )
        room_creation_time = time.time() - start_time
        print(f"✅ ChatRoomCreate (1000 objects): {room_creation_time:.4f}s")
        
        # Test tạo ChatMessageCreate
        start_time = time.time()
        for i in range(1000):
            message = ChatMessageCreate(
                content=f"Test message {i}",
                content_type="text",
                room_id=i
            )
        message_creation_time = time.time() - start_time
        print(f"✅ ChatMessageCreate (1000 objects): {message_creation_time:.4f}s")
        
        return {
            'room_creation': room_creation_time,
            'message_creation': message_creation_time
        }
        
    except Exception as e:
        print(f"❌ Object creation benchmark failed: {e}")
        traceback.print_exc()
        return None

def benchmark_validation_performance():
    """Benchmark hiệu suất validation"""
    print("\n🔍 Benchmark Validation Performance...")
    
    try:
        from app.schemas.chat_schemas import ChatRoomCreate, ChatMessageCreate
        
        # Test validation với dữ liệu hợp lệ
        start_time = time.time()
        for i in range(1000):
            room = ChatRoomCreate(
                user2_id=i,
                search_type="chat"
            )
            # Trigger validation
            room_dict = room.model_dump()
        valid_validation_time = time.time() - start_time
        print(f"✅ Valid validation (1000 objects): {valid_validation_time:.4f}s")
        
        # Test validation với dữ liệu không hợp lệ (sẽ raise exception)
        start_time = time.time()
        invalid_count = 0
        for i in range(100):
            try:
                room = ChatRoomCreate(
                    user2_id=-1,  # Invalid: negative user ID
                    search_type="invalid_type"  # Invalid search type
                )
            except:
                invalid_count += 1
        invalid_validation_time = time.time() - start_time
        print(f"✅ Invalid validation (100 objects): {invalid_validation_time:.4f}s")
        print(f"✅ Invalid objects caught: {invalid_count}/100")
        
        return {
            'valid_validation': valid_validation_time,
            'invalid_validation': invalid_validation_time
        }
        
    except Exception as e:
        print(f"❌ Validation benchmark failed: {e}")
        traceback.print_exc()
        return None

def benchmark_serialization_performance():
    """Benchmark hiệu suất serialization"""
    print("\n🔍 Benchmark Serialization Performance...")
    
    try:
        from app.schemas.chat_schemas import ChatRoomCreate, ChatMessageCreate
        
        # Tạo test objects
        room = ChatRoomCreate(
            user2_id=1,
            search_type="chat"
        )
        
        message = ChatMessageCreate(
            content="Test message",
            content_type="text",
            room_id=1
        )
        
        # Test JSON serialization
        start_time = time.time()
        for i in range(1000):
            room_json = room.model_dump_json()
        room_serialization_time = time.time() - start_time
        print(f"✅ Room JSON serialization (1000x): {room_serialization_time:.4f}s")
        
        start_time = time.time()
        for i in range(1000):
            message_json = message.model_dump_json()
        message_serialization_time = time.time() - start_time
        print(f"✅ Message JSON serialization (1000x): {message_serialization_time:.4f}s")
        
        # Test dict serialization
        start_time = time.time()
        for i in range(1000):
            room_dict = room.model_dump()
        room_dict_time = time.time() - start_time
        print(f"✅ Room dict serialization (1000x): {room_dict_time:.4f}s")
        
        return {
            'room_json': room_serialization_time,
            'message_json': message_serialization_time,
            'room_dict': room_dict_time
        }
        
    except Exception as e:
        print(f"❌ Serialization benchmark failed: {e}")
        traceback.print_exc()
        return None

def benchmark_database_operations():
    """Benchmark hiệu suất database operations (simulated)"""
    print("\n🔍 Benchmark Database Operations (Simulated)...")
    
    try:
        from app.services.chat_service import ChatService
        from app.schemas.chat_schemas import ChatRoomCreate, ChatMessageCreate
        
        # Simulate database operations
        chat_service = ChatService()
        
        # Test cache operations
        start_time = time.time()
        for i in range(1000):
            # Simulate cache operations
            cache_key = f"room:{i}"
            cache_value = {"id": i, "name": f"Room {i}"}
            # In real scenario, this would use Redis or in-memory cache
        cache_time = time.time() - start_time
        print(f"✅ Cache operations (1000x): {cache_time:.4f}s")
        
        # Test message processing simulation
        start_time = time.time()
        for i in range(1000):
            # Simulate message processing
            message_data = {
                "content": f"Message {i}",
                "content_type": "text",
                "user_id": i % 100,
                "room_id": i % 50
            }
            # In real scenario, this would process and store messages
        message_processing_time = time.time() - start_time
        print(f"✅ Message processing simulation (1000x): {message_processing_time:.4f}s")
        
        return {
            'cache_operations': cache_time,
            'message_processing': message_processing_time
        }
        
    except Exception as e:
        print(f"❌ Database operations benchmark failed: {e}")
        traceback.print_exc()
        return None

def generate_performance_report(all_results):
    """Tạo báo cáo hiệu suất tổng hợp"""
    print("\n" + "="*60)
    print("📊 BÁO CÁO HIỆU SUẤT TỔNG HỢP")
    print("="*60)
    
    # Import performance
    if 'import_performance' in all_results:
        print("\n🚀 IMPORT PERFORMANCE:")
        for module, time_taken in all_results['import_performance'].items():
            status = "✅ TỐT" if time_taken < 0.1 else "⚠️  TRUNG BÌNH" if time_taken < 0.5 else "❌ CHẬM"
            print(f"   {module}: {time_taken:.4f}s - {status}")
    
    # Memory usage
    if 'memory_usage' in all_results and all_results['memory_usage']:
        print("\n💾 MEMORY USAGE:")
        memory = all_results['memory_usage']
        print(f"   Memory increase: {memory['increase']:.2f} MB")
        if memory['increase'] < 10:
            print("   Status: ✅ TỐT")
        elif memory['increase'] < 50:
            print("   Status: ⚠️  TRUNG BÌNH")
        else:
            print("   Status: ❌ CAO")
    
    # Object creation
    if 'object_creation' in all_results:
        print("\n🏗️  OBJECT CREATION:")
        obj_creation = all_results['object_creation']
        for operation, time_taken in obj_creation.items():
            status = "✅ TỐT" if time_taken < 0.1 else "⚠️  TRUNG BÌNH" if time_taken < 0.5 else "❌ CHẬM"
            print(f"   {operation}: {time_taken:.4f}s - {status}")
    
    # Validation
    if 'validation_performance' in all_results:
        print("\n✅ VALIDATION PERFORMANCE:")
        validation = all_results['validation_performance']
        for operation, time_taken in validation.items():
            status = "✅ TỐT" if time_taken < 0.1 else "⚠️  TRUNG BÌNH" if time_taken < 0.5 else "❌ CHẬM"
            print(f"   {operation}: {time_taken:.4f}s - {status}")
    
    # Serialization
    if 'serialization_performance' in all_results:
        print("\n📤 SERIALIZATION PERFORMANCE:")
        serialization = all_results['serialization_performance']
        for operation, time_taken in serialization.items():
            status = "✅ TỐT" if time_taken < 0.1 else "⚠️  TRUNG BÌNH" if time_taken < 0.5 else "❌ CHẬM"
            print(f"   {operation}: {time_taken:.4f}s - {status}")
    
    # Database operations
    if 'database_operations' in all_results:
        print("\n🗄️  DATABASE OPERATIONS (SIMULATED):")
        db_ops = all_results['database_operations']
        for operation, time_taken in db_ops.items():
            status = "✅ TỐT" if time_taken < 0.1 else "⚠️  TRUNG BÌNH" if time_taken < 0.5 else "❌ CHẬM"
            print(f"   {operation}: {time_taken:.4f}s - {status}")
    
    # Overall assessment
    print("\n🎯 ĐÁNH GIÁ TỔNG THỂ:")
    
    # Count performance levels
    total_tests = 0
    good_tests = 0
    medium_tests = 0
    slow_tests = 0
    
    for category, results in all_results.items():
        if isinstance(results, dict):
            for operation, time_taken in results.items():
                if isinstance(time_taken, (int, float)):
                    total_tests += 1
                    if time_taken < 0.1:
                        good_tests += 1
                    elif time_taken < 0.5:
                        medium_tests += 1
                    else:
                        slow_tests += 1
    
    if total_tests > 0:
        good_percentage = (good_tests / total_tests) * 100
        medium_percentage = (medium_tests / total_tests) * 100
        slow_percentage = (slow_tests / total_tests) * 100
        
        print(f"   Tổng số tests: {total_tests}")
        print(f"   TỐT: {good_tests} ({good_percentage:.1f}%)")
        print(f"   TRUNG BÌNH: {medium_tests} ({medium_percentage:.1f}%)")
        print(f"   CHẬM: {slow_tests} ({slow_percentage:.1f}%)")
        
        if good_percentage >= 80:
            print("   🎉 Hệ thống có hiệu suất RẤT TỐT!")
        elif good_percentage >= 60:
            print("   ✅ Hệ thống có hiệu suất TỐT")
        elif good_percentage >= 40:
            print("   ⚠️  Hệ thống có hiệu suất TRUNG BÌNH")
        else:
            print("   ❌ Hệ thống có hiệu suất CHẬM, cần tối ưu hóa")

def main():
    """Main function"""
    print("🚀 Bắt đầu Performance Benchmark Test...")
    print("="*50)
    
    all_results = {}
    
    try:
        # Run all benchmarks
        all_results['import_performance'] = benchmark_import_performance()
        all_results['memory_usage'] = benchmark_memory_usage()
        all_results['object_creation'] = benchmark_object_creation()
        all_results['validation_performance'] = benchmark_validation_performance()
        all_results['serialization_performance'] = benchmark_serialization_performance()
        all_results['database_operations'] = benchmark_database_operations()
        
        # Generate performance report
        generate_performance_report(all_results)
        
        print("\n✅ Performance benchmark hoàn thành!")
        
    except Exception as e:
        print(f"❌ Lỗi trong benchmark: {e}")
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
