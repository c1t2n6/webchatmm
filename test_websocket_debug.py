#!/usr/bin/env python3
"""
Test script để debug WebSocket connection
"""

import asyncio
import websockets
import json
import time

async def test_websocket():
    # Test WebSocket connection
    uri = "ws://localhost:8000/ws/chat/1?token=test_token"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected to WebSocket")
            
            # Send a test message
            test_message = {
                "type": "message",
                "content": "Hello from test script!",
                "timestamp": "2024-01-01T00:00:00Z"
            }
            
            print(f"📤 Sending message: {test_message}")
            await websocket.send(json.dumps(test_message))
            
            # Wait for response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"📥 Received response: {response}")
            except asyncio.TimeoutError:
                print("⏰ Timeout waiting for response")
                
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🚀 Testing WebSocket connection...")
    asyncio.run(test_websocket())
