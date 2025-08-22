#!/usr/bin/env python3
"""
Test script để kiểm tra matching flow
"""

import requests
import json
import time

# Base URL
BASE_URL = "http://localhost:8000"

def test_matching_flow():
    """Test matching flow từ đầu đến cuối"""
    print("🔍 Testing Matching Flow...")
    
    # Test 1: Kiểm tra users trong database
    print("\n1️⃣ Checking users in database...")
    try:
        # Tạo 2 test users
        user1_data = {
            "username": "testuser1",
            "password": "password123",
            "nickname": "TestUser1",
            "dob": "1990-01-01",
            "gender": "Nam",
            "preferred_gender": "[\"Nữ\"]",
            "needs": "[\"Nhẹ nhàng vui vẻ\"]",
            "interests": "[\"Gym\", \"Nhảy\"]"
        }
        
        user2_data = {
            "username": "testuser2", 
            "password": "password123",
            "nickname": "TestUser2",
            "dob": "1992-01-01",
            "gender": "Nữ",
            "preferred_gender": "[\"Nam\"]",
            "needs": "[\"Nhẹ nhàng vui vẻ\"]",
            "interests": "[\"Gym\", \"Nhảy\"]"
        }
        
        # Đăng ký users
        print("   📝 Registering test users...")
        
        # Test user1
        try:
            response = requests.post(f"{BASE_URL}/auth/signup", json=user1_data)
            if response.status_code == 200:
                print("   ✅ User1 registered")
            else:
                print(f"   ⚠️ User1 registration: {response.status_code}")
                print(f"   📝 Response: {response.text}")
        except Exception as e:
            print(f"   ❌ User1 registration failed: {e}")
        
        # Test user2  
        try:
            response = requests.post(f"{BASE_URL}/auth/signup", json=user2_data)
            if response.status_code == 200:
                print("   ✅ User2 registered")
            else:
                print(f"   ⚠️ User2 registration: {response.status_code}")
                print(f"   📝 Response: {response.text}")
        except Exception as e:
            print(f"   ❌ User2 registration failed: {e}")
        
    except Exception as e:
        print(f"   ❌ User creation failed: {e}")
    
    # Test 2: Kiểm tra matching queue
    print("\n2️⃣ Checking matching queue...")
    try:
        response = requests.get(f"{BASE_URL}/debug/rooms")
        print(f"   📊 Current rooms: {response.json()}")
    except Exception as e:
        print(f"   ❌ Queue check failed: {e}")
    
    # Test 3: Kiểm tra user status
    print("\n3️⃣ Checking user status...")
    try:
        # Login user1
        login_data = {"username": "testuser1", "password": "password123"}
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            token1 = response.json().get("access_token")
            print("   ✅ User1 logged in")
            
            # Check user1 status
            headers = {"Authorization": f"Bearer {token1}"}
            response = requests.get(f"{BASE_URL}/user/profile", headers=headers)
            if response.status_code == 200:
                user_info = response.json()
                print(f"   📊 User1 status: {user_info.get('status')}")
                print(f"   📊 User1 room: {user_info.get('current_room_id')}")
        else:
            print(f"   ❌ User1 login failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Status check failed: {e}")

def main():
    """Main test function"""
    print("🚀 Starting Matching Flow Test...")
    print("=" * 50)
    
    test_matching_flow()
    
    print("\n" + "=" * 50)
    print("🏁 Test completed!")

if __name__ == "__main__":
    main()
