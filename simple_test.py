#!/usr/bin/env python3
"""
Simple test script để kiểm tra từng bước một
"""

import requests
import json

# Base URL
BASE_URL = "http://localhost:8000"

def test_step_by_step():
    """Test từng bước một"""
    print("🚀 Starting Simple Test...")
    
    # Step 1: Test server health
    print("\n1️⃣ Testing server health...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"   ✅ Server health: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Server health failed: {e}")
        return
    
    # Step 2: Test debug endpoint
    print("\n2️⃣ Testing debug endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/debug/rooms", timeout=5)
        print(f"   ✅ Debug endpoint: {response.status_code}")
        print(f"   📊 Response: {response.json()}")
    except Exception as e:
        print(f"   ❌ Debug endpoint failed: {e}")
    
    # Step 3: Test auth endpoint
    print("\n3️⃣ Testing auth endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/auth/login", timeout=5)
        print(f"   ✅ Auth endpoint: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Auth endpoint failed: {e}")
    
    print("\n🏁 Simple test completed!")

if __name__ == "__main__":
    test_step_by_step()
