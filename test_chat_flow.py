#!/usr/bin/env python3
"""
Test script để kiểm tra flow chat hoàn chỉnh
"""

import requests
import json
import time
import asyncio
import websockets

# Base URL
BASE_URL = "http://localhost:8000"

def test_api_endpoints():
    """Test các API endpoints cơ bản"""
    print("🔍 Testing API endpoints...")
    
    # Test health check
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"✅ Health check: {response.status_code}")
    except Exception as e:
        print(f"❌ Health check failed: {e}")
    
    # Test debug endpoints
    try:
        response = requests.get(f"{BASE_URL}/debug/rooms")
        print(f"✅ Debug rooms: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"❌ Debug rooms failed: {e}")

def test_database_connection():
    """Test kết nối database"""
    print("\n🔍 Testing database connection...")
    
    try:
        # Test một endpoint cần database
        response = requests.get(f"{BASE_URL}/debug/rooms")
        if response.status_code == 200:
            print("✅ Database connection working")
        else:
            print(f"❌ Database connection failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Database test failed: {e}")

def test_websocket_connection():
    """Test WebSocket connection"""
    print("\n🔍 Testing WebSocket connection...")
    
    async def test_ws():
        try:
            uri = "ws://localhost:8000/ws/chat/1?token=test_token"
            async with websockets.connect(uri) as websocket:
                print("✅ WebSocket connected")
                
                # Send test message
                test_message = {
                    "type": "message",
                    "content": "Test message",
                    "timestamp": "2024-01-01T00:00:00Z"
                }
                
                await websocket.send(json.dumps(test_message))
                print("✅ Test message sent")
                
        except Exception as e:
            print(f"❌ WebSocket test failed: {e}")
    
    # Run WebSocket test
    try:
        asyncio.run(test_ws())
    except Exception as e:
        print(f"❌ WebSocket test failed: {e}")

def main():
    """Main test function"""
    print("🚀 Starting Chat Flow Test...")
    print("=" * 50)
    
    # Test 1: API endpoints
    test_api_endpoints()
    
    # Test 2: Database connection
    test_database_connection()
    
    # Test 3: WebSocket connection
    test_websocket_connection()
    
    print("\n" + "=" * 50)
    print("🏁 Test completed!")

if __name__ == "__main__":
    main()
