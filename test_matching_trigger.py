#!/usr/bin/env python3
"""
Test script để trigger matching process
"""

import requests
import json
import time

# Base URL
BASE_URL = "http://localhost:8000"

def test_matching_trigger():
    """Test trigger matching process"""
    print("🔍 Testing Matching Trigger...")
    
    # Step 1: Login users
    print("\n1️⃣ Logging in users...")
    
    # Login user1
    login1_data = {"username": "testuser1", "password": "password123"}
    response = requests.post(f"{BASE_URL}/auth/login", json=login1_data)
    if response.status_code == 200:
        token1 = response.json().get("access_token")
        print("   ✅ User1 logged in")
    else:
        print(f"   ❌ User1 login failed: {response.status_code}")
        return
    
    # Login user2
    login2_data = {"username": "testuser2", "password": "password123"}
    response = requests.post(f"{BASE_URL}/auth/login", json=login2_data)
    if response.status_code == 200:
        token2 = response.json().get("access_token")
        print("   ✅ User2 logged in")
    else:
        print(f"   ❌ User2 login failed: {response.status_code}")
        return
    
    # Step 2: Trigger matching for user1
    print("\n2️⃣ Triggering matching for user1...")
    try:
        headers1 = {"Authorization": f"Bearer {token1}"}
        
        # Start searching
        search_data = {"type": "chat"}
        response = requests.post(f"{BASE_URL}/chat/search", json=search_data, headers=headers1)
        print(f"   📊 Start search response: {response.status_code}")
        if response.status_code == 200:
            print(f"   📝 Response: {response.json()}")
        else:
            print(f"   📝 Error: {response.text}")
            
    except Exception as e:
        print(f"   ❌ Start search failed: {e}")
    
    # Step 3: Trigger matching for user2
    print("\n3️⃣ Triggering matching for user2...")
    try:
        headers2 = {"Authorization": f"Bearer {token2}"}
        
        # Start searching
        search_data = {"type": "chat"}
        response = requests.post(f"{BASE_URL}/chat/search", json=search_data, headers=headers2)
        print(f"   📊 Start search response: {response.status_code}")
        if response.status_code == 200:
            print(f"   📝 Response: {response.json()}")
        else:
            print(f"   📝 Error: {response.text}")
            
    except Exception as e:
        print(f"   ❌ Start search failed: {e}")
    
    # Step 4: Check if room was created
    print("\n4️⃣ Checking if room was created...")
    time.sleep(2)  # Wait for matching process
    
    try:
        response = requests.get(f"{BASE_URL}/debug/rooms")
        print(f"   📊 Rooms: {response.json()}")
        
        # Check user1 status
        response = requests.get(f"{BASE_URL}/user/profile", headers=headers1)
        if response.status_code == 200:
            user_info = response.json()
            print(f"   📊 User1 status: {user_info.get('status')}")
            print(f"   📊 User1 room: {user_info.get('current_room_id')}")
        
        # Check user2 status
        response = requests.get(f"{BASE_URL}/user/profile", headers=headers2)
        if response.status_code == 200:
            user_info = response.json()
            print(f"   📊 User2 status: {user_info.get('status')}")
            print(f"   📊 User2 room: {user_info.get('current_room_id')}")
            
    except Exception as e:
        print(f"   ❌ Status check failed: {e}")

def main():
    """Main test function"""
    print("🚀 Starting Matching Trigger Test...")
    print("=" * 50)
    
    test_matching_trigger()
    
    print("\n" + "=" * 50)
    print("🏁 Test completed!")

if __name__ == "__main__":
    main()
