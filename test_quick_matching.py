#!/usr/bin/env python3
"""
Quick test script để verify matching engine
"""
import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"

def log(message):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def test_quick_matching():
    log("🧪 Quick Matching Test")
    log("=" * 40)
    
    # Generate unique usernames
    timestamp = str(int(time.time()))[-8:]
    
    try:
        # Create and setup User 1
        log("👤 Setting up User 1...")
        user1_data = {
            "username": f"testuser1_{timestamp}",
            "password": "password123",
            "email": f"test1_{timestamp}@example.com"
        }
        response = requests.post(f"{BASE_URL}/auth/signup", json=user1_data)
        user1_token = response.json()["access_token"]
        
        profile1 = {
            "nickname": f"TestUser1_{timestamp}",
            "dob": "1990-01-01",
            "gender": "Nam",
            "preferred_gender": ["Nữ"],
            "needs": ["Kết bạn mới"],
            "interests": ["Game", "Nhạc"]
        }
        requests.put(f"{BASE_URL}/user/profile/update", json=profile1,
                    headers={"Authorization": f"Bearer {user1_token}"})
        
        # Create and setup User 2
        log("👤 Setting up User 2...")
        user2_data = {
            "username": f"testuser2_{timestamp}",
            "password": "password123", 
            "email": f"test2_{timestamp}@example.com"
        }
        response = requests.post(f"{BASE_URL}/auth/signup", json=user2_data)
        user2_token = response.json()["access_token"]
        
        profile2 = {
            "nickname": f"TestUser2_{timestamp}",
            "dob": "1992-01-02",
            "gender": "Nữ",
            "preferred_gender": ["Nam"],
            "needs": ["Kết bạn mới"], 
            "interests": ["Game", "Phim"]
        }
        requests.put(f"{BASE_URL}/user/profile/update", json=profile2,
                    headers={"Authorization": f"Bearer {user2_token}"})
        
        # User 1 searches
        log("🔍 User 1 searching...")
        response = requests.post(f"{BASE_URL}/chat/search", json={"type": "chat"},
                               headers={"Authorization": f"Bearer {user1_token}"})
        search1_result = response.json()
        
        # User 2 searches
        log("🔍 User 2 searching...")
        response = requests.post(f"{BASE_URL}/chat/search", json={"type": "chat"},
                               headers={"Authorization": f"Bearer {user2_token}"})
        search2_result = response.json()
        
        # Wait and check
        log("⏳ Waiting...")
        time.sleep(2)
        
        # Check final status
        response1 = requests.get(f"{BASE_URL}/user/profile",
                               headers={"Authorization": f"Bearer {user1_token}"})
        response2 = requests.get(f"{BASE_URL}/user/profile",
                               headers={"Authorization": f"Bearer {user2_token}"})
        
        user1_final = response1.json()
        user2_final = response2.json()
        
        log(f"User 1: Status={user1_final['status']}, Room={user1_final.get('current_room_id')}")
        log(f"User 2: Status={user2_final['status']}, Room={user2_final.get('current_room_id')}")
        
        # Check success
        if (user1_final.get('status') == 'Connected' and 
            user2_final.get('status') == 'Connected' and
            user1_final.get('current_room_id') and
            user1_final.get('current_room_id') == user2_final.get('current_room_id')):
            log("🎉 SUCCESS: Matching works!")
            return True
        else:
            log("❌ FAILED: Matching not working properly")
            return False
            
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False

if __name__ == "__main__":
    success = test_quick_matching()
    exit(0 if success else 1)
