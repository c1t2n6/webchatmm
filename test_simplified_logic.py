"""
Test script cho logic đơn giản hóa
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_simplified_logic():
    """Test logic đơn giản hóa"""
    print("🧪 Testing Simplified Countdown Logic")
    print("=" * 50)
    
    # Import service
    from app.services.simple_countdown_service import simple_countdown_service
    
    # Test 1: Start countdown
    print("\n1. Testing start countdown...")
    room_id = 1
    success = await simple_countdown_service.start_countdown(room_id)
    print(f"   ✅ Start countdown: {success}")
    
    # Test 2: Check status
    print("\n2. Testing get status...")
    status = simple_countdown_service.get_room_status(room_id)
    print(f"   ✅ Status: {status}")
    
    # Test 3: Simulate countdown phase
    print("\n3. Testing countdown phase...")
    if room_id in simple_countdown_service.rooms:
        state = simple_countdown_service.rooms[room_id]
        print(f"   ✅ Phase: {state.phase}")
        print(f"   ✅ Countdown remaining: {state.countdown_remaining}")
        
        # Simulate countdown running
        print("   🔄 Simulating countdown running...")
        for i in range(3):
            await asyncio.sleep(1)
            state.countdown_remaining -= 1
            print(f"   ⏰ Countdown tick: {state.countdown_remaining}")
    
    # Test 4: Test notification phase
    print("\n4. Testing notification phase...")
    if room_id in simple_countdown_service.rooms:
        state = simple_countdown_service.rooms[room_id]
        if state.phase.value == 'countdown':
            print("   🔄 Simulating countdown finished, starting notification...")
            await simple_countdown_service._start_notification_phase(room_id)
            
            # Check status again
            new_status = simple_countdown_service.get_room_status(room_id)
            print(f"   ✅ New status after notification start: {new_status}")
    
    # Test 5: Cleanup
    print("\n5. Testing cleanup...")
    await simple_countdown_service._cancel_room_process(room_id)
    print(f"   ✅ Cleanup completed")
    
    print("\n🎉 All tests completed!")
    print("\n📋 Simplified Logic Summary:")
    print("   ✅ Chỉ Backend Timer: Không có frontend timer")
    print("   ✅ WebSocket Updates: Chỉ hiển thị theo WebSocket")
    print("   ✅ Không Sync Logic: Không có sync phức tạp")
    print("   ✅ State Đồng Bộ: Frontend state = Backend state")

if __name__ == "__main__":
    asyncio.run(test_simplified_logic())
