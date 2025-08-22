import asyncio
import websockets
import json

async def test_websocket():
    # Test WebSocket connection to room 2
    uri = "ws://localhost:8000/ws/chat/2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmaW5hbDFfMTc1NTYxODIwNCIsImV4cCI6MTc1NTc5NTA2M30.l0nyph1SfkqsOEHzUlzgx0WIyiZttmywQbxLj7G-ZyM"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected successfully!")
            
            # Send a test message
            test_message = {
                "type": "message",
                "content": "Hello from test script!",
                "timestamp": "2025-08-21T15:43:00Z"
            }
            
            await websocket.send(json.dumps(test_message))
            print("✅ Test message sent!")
            
            # Wait for response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"✅ Received response: {response}")
            except asyncio.TimeoutError:
                print("⚠️ No response received within 5 seconds")
            
            # Keep connection alive for a bit longer
            print("🔄 Keeping connection alive for 10 seconds...")
            await asyncio.sleep(10)
                
    except Exception as e:
        print(f"❌ WebSocket connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket())
