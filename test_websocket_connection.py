#!/usr/bin/env python3
"""
Test script để kiểm tra WebSocket connection vào phòng chat
"""

import requests
import json
import time
import asyncio
import websockets

# Base URL
BASE_URL = "http://localhost:8000"

async def test_websocket_connection():
    """Test WebSocket connection vào phòng chat"""
    print("🔍 Testing WebSocket Connection...")
    
    # Step 1: Login user1
    print("\n1️⃣ Logging in user1...")
    login_data = {"username": "testuser1", "password": "password123"}
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    if response.status_code != 200:
        print(f"   ❌ User1 login failed: {response.status_code}")
        return
    
    token1 = response.json().get("access_token")
    print("   ✅ User1 logged in")
    
    # Step 2: Get user1's room info
    print("\n2️⃣ Getting user1's room info...")
    headers = {"Authorization": f"Bearer {token1}"}
    response = requests.get(f"{BASE_URL}/user/profile", headers=headers)
    if response.status_code == 200:
        user_info = response.json()
        room_id = user_info.get('current_room_id')
        print(f"   📊 User1 room_id: {room_id}")
        
        if not room_id:
            print("   ❌ User1 has no room")
            return
    else:
        print(f"   ❌ Failed to get user1 profile: {response.status_code}")
        return
    
    # Step 3: Test WebSocket connection to room
    print(f"\n3️⃣ Testing WebSocket connection to room {room_id}...")
    
    try:
        uri = f"ws://localhost:8000/ws/chat/{room_id}?token={token1}"
        print(f"   🔗 Connecting to: {uri}")
        
        async with websockets.connect(uri) as websocket:
            print("   ✅ WebSocket connected successfully!")
            
            # Wait for welcome message
            try:
                welcome_msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"   📥 Welcome message: {welcome_msg}")
                
                # Send a test message
                test_message = {
                    "type": "message",
                    "content": "Hello from test script!",
                    "timestamp": "2024-01-01T00:00:00Z"
                }
                
                print(f"   📤 Sending test message: {test_message}")
                await websocket.send(json.dumps(test_message))
                print("   ✅ Test message sent")
                
                # Wait for response
                try:
                    response_msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    print(f"   📥 Response message: {response_msg}")
                except asyncio.TimeoutError:
                    print("   ⏰ No response received (timeout)")
                
            except asyncio.TimeoutError:
                print("   ⏰ No welcome message received (timeout)")
                
    except Exception as e:
        print(f"   ❌ WebSocket connection failed: {e}")

def main():
    """Main test function"""
    print("🚀 Starting WebSocket Connection Test...")
    print("=" * 50)
    
    asyncio.run(test_websocket_connection())
    
    print("\n" + "=" * 50)
    print("🏁 Test completed!")

if __name__ == "__main__":
    main()
