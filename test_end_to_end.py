#!/usr/bin/env python3
"""
Test script end-to-end để kiểm tra toàn bộ flow chat
"""

import requests
import json
import time
import asyncio
import websockets

# Base URL
BASE_URL = "http://localhost:8000"

async def test_end_to_end_chat():
    """Test end-to-end chat flow"""
    print("🔍 Testing End-to-End Chat Flow...")
    
    # Step 1: Create 2 new users
    print("\n1️⃣ Creating 2 new users...")
    
    user1_data = {
        "username": "chatuser1",
        "password": "password123",
        "nickname": "ChatUser1",
        "dob": "1990-01-01",
        "gender": "Nam",
        "preferred_gender": "[\"Nữ\"]",
        "needs": "[\"Nhẹ nhàng vui vẻ\"]",
        "interests": "[\"Gym\", \"Nhảy\"]"
    }
    
    user2_data = {
        "username": "chatuser2",
        "password": "password123",
        "nickname": "ChatUser2",
        "dob": "1992-01-01",
        "gender": "Nữ",
        "preferred_gender": "[\"Nam\"]",
        "needs": "[\"Nhẹ nhàng vui vẻ\"]",
        "interests": "[\"Gym\", \"Nhảy\"]"
    }
    
    # Register users
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json=user1_data)
        if response.status_code == 200:
            print("   ✅ User1 created")
        else:
            print(f"   ⚠️ User1 creation: {response.status_code}")
    except Exception as e:
        print(f"   ❌ User1 creation failed: {e}")
    
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json=user2_data)
        if response.status_code == 200:
            print("   ✅ User2 created")
        else:
            print(f"   ⚠️ User2 creation: {response.status_code}")
    except Exception as e:
        print(f"   ❌ User2 creation failed: {e}")
    
    # Step 2: Login both users
    print("\n2️⃣ Logging in both users...")
    
    # Login user1
    login1_data = {"username": "chatuser1", "password": "password123"}
    response = requests.post(f"{BASE_URL}/auth/login", json=login1_data)
    if response.status_code == 200:
        token1 = response.json().get("access_token")
        print("   ✅ User1 logged in")
    else:
        print(f"   ❌ User1 login failed: {response.status_code}")
        return
    
    # Login user2
    login2_data = {"username": "chatuser2", "password": "password123"}
    response = requests.post(f"{BASE_URL}/auth/login", json=login2_data)
    if response.status_code == 200:
        token2 = response.json().get("access_token")
        print("   ✅ User2 logged in")
    else:
        print(f"   ❌ User2 login failed: {response.status_code}")
        return
    
    # Step 3: Start searching for both users
    print("\n3️⃣ Starting search for both users...")
    
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}
    
    # User1 starts searching
    search_data = {"type": "chat"}
    response = requests.post(f"{BASE_URL}/chat/search", json=search_data, headers=headers1)
    print(f"   📊 User1 search: {response.status_code}")
    if response.status_code == 200:
        result1 = response.json()
        print(f"   📝 User1 result: {result1}")
    
    # User2 starts searching
    response = requests.post(f"{BASE_URL}/chat/search", json=search_data, headers=headers2)
    print(f"   📊 User2 search: {response.status_code}")
    if response.status_code == 200:
        result2 = response.json()
        print(f"   📝 User2 result: {result2}")
    
    # Step 4: Wait for matching and check room
    print("\n4️⃣ Waiting for matching and checking room...")
    time.sleep(3)  # Wait for matching process
    
    # Check rooms
    response = requests.get(f"{BASE_URL}/debug/rooms")
    print(f"   📊 Rooms: {response.json()}")
    
    # Check user statuses
    response = requests.get(f"{BASE_URL}/user/profile", headers=headers1)
    if response.status_code == 200:
        user1_info = response.json()
        print(f"   📊 User1 status: {user1_info.get('status')}, room: {user1_info.get('current_room_id')}")
    
    response = requests.get(f"{BASE_URL}/user/profile", headers=headers2)
    if response.status_code == 200:
        user2_info = response.json()
        print(f"   📊 User2 status: {user2_info.get('status')}, room: {user2_info.get('current_room_id')}")
    
    # Step 5: Test WebSocket connection if room exists
    print("\n5️⃣ Testing WebSocket connection...")
    
    # Get current room info
    response = requests.get(f"{BASE_URL}/user/profile", headers=headers1)
    if response.status_code == 200:
        user1_info = response.json()
        room_id = user1_info.get('current_room_id')
        
        if room_id:
            print(f"   🔗 Testing WebSocket for room {room_id}")
            
            # Test WebSocket for user1
            try:
                uri1 = f"ws://localhost:8000/ws/chat/{room_id}?token={token1}"
                async with websockets.connect(uri1) as ws1:
                    print("   ✅ User1 WebSocket connected")
                    
                    # Wait for welcome message
                    try:
                        welcome = await asyncio.wait_for(ws1.recv(), timeout=3.0)
                        print(f"   📥 User1 welcome: {welcome}")
                    except asyncio.TimeoutError:
                        print("   ⏰ User1 no welcome message")
                    
                    # Send message from user1
                    msg1 = {
                        "type": "message",
                        "content": "Hello from User1!",
                        "timestamp": "2024-01-01T00:00:00Z"
                    }
                    await ws1.send(json.dumps(msg1))
                    print("   📤 User1 message sent")
                    
                    # Wait for broadcast
                    try:
                        broadcast = await asyncio.wait_for(ws1.recv(), timeout=3.0)
                        print(f"   📥 User1 broadcast: {broadcast}")
                    except asyncio.TimeoutError:
                        print("   ⏰ User1 no broadcast received")
                        
            except Exception as e:
                print(f"   ❌ User1 WebSocket failed: {e}")
        else:
            print("   ❌ No room created for users")
    else:
        print("   ❌ Failed to get user1 profile")

def main():
    """Main test function"""
    print("🚀 Starting End-to-End Chat Test...")
    print("=" * 50)
    
    asyncio.run(test_end_to_end_chat())
    
    print("\n" + "=" * 50)
    print("🏁 Test completed!")

if __name__ == "__main__":
    main()
