#!/usr/bin/env python3
"""
Simulate Chat Search and Chat
============================

This script simulates the complete flow:
1. User1 and User2 login with password "password"
2. User1 searches for a chat partner
3. User2 searches for a chat partner
4. System matches them and creates a room
5. Both users connect to the room via WebSocket
6. Exchange messages
7. End the chat session
"""

import asyncio
import json
import time
import structlog
import requests
from datetime import datetime, timezone
from typing import Dict, List, Optional

# Setup logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger = structlog.get_logger()

class ChatSimulator:
    """Simulate chat search and chat functionality"""
    
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.user1_token = None
        self.user2_token = None
        self.room_id = None
        self.user1_id = None
        self.user2_id = None
        
        # Test credentials
        self.user1_credentials = {
            "username": "simuser1",
            "password": "password"
        }
        
        self.user2_credentials = {
            "username": "simuser2", 
            "password": "password"
        }
    
    async def setup_test_users(self):
        """Create test users if they don't exist"""
        logger.info("🔧 Setting up test users...")
        
        try:
            # Try to create user1
            response = requests.post(f"{self.base_url}/auth/signup", json={
                "username": "simuser1",
                "password": "password"
            })
            
            if response.status_code == 201:
                logger.info("✅ Created user1")
            elif response.status_code == 400 and "already exists" in response.text:
                logger.info("ℹ️ user1 already exists")
            else:
                logger.warning(f"⚠️ Unexpected response for user1: {response.status_code}")
            
            # Try to create user2
            response = requests.post(f"{self.base_url}/auth/signup", json={
                "username": "simuser2",
                "password": "password"
            })
            
            if response.status_code == 201:
                logger.info("✅ Created user2")
            elif response.status_code == 400 and "already exists" in response.text:
                logger.info("ℹ️ user2 already exists")
            else:
                logger.warning(f"⚠️ Unexpected response for user2: {response.status_code}")
                
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to setup test users: {e}")
            return False
    
    async def login_users(self):
        """Login both users and get tokens"""
        logger.info("🔐 Logging in users...")
        
        try:
            # Login user1
            response = requests.post(f"{self.base_url}/auth/login", json=self.user1_credentials)
            if response.status_code == 200:
                data = response.json()
                self.user1_token = data["access_token"]
                self.user1_id = data["user"]["id"]
                logger.info(f"✅ user1 logged in, ID: {self.user1_id}")
            else:
                logger.error(f"❌ Failed to login user1: {response.status_code} - {response.text}")
                return False
            
            # Login user2
            response = requests.post(f"{self.base_url}/auth/login", json=self.user2_credentials)
            if response.status_code == 200:
                data = response.json()
                self.user2_token = data["access_token"]
                self.user2_id = data["user"]["id"]
                logger.info(f"✅ user2 logged in, ID: {self.user2_id}")
            else:
                logger.error(f"❌ Failed to login user2: {response.status_code} - {response.text}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to login users: {e}")
            return False
    
    async def simulate_search(self):
        """Simulate both users searching for chat partners"""
        logger.info("🔍 Simulating chat search...")
        
        try:
            # User1 starts searching
            headers = {"Authorization": f"Bearer {self.user1_token}"}
            response = requests.post(f"{self.base_url}/chat/search", headers=headers, json={"type": "chat"})
            
            if response.status_code == 200:
                logger.info("✅ user1 started searching")
            else:
                logger.error(f"❌ user1 search failed: {response.status_code} - {response.text}")
                return False
            
            # Wait a moment
            await asyncio.sleep(1)
            
            # User2 starts searching
            headers = {"Authorization": f"Bearer {self.user2_token}"}
            response = requests.post(f"{self.base_url}/chat/search", headers=headers, json={"type": "chat"})
            
            if response.status_code == 200:
                data = response.json()
                if "room_id" in data:
                    self.room_id = data["room_id"]
                    logger.info(f"✅ user2 started searching and got matched! Room ID: {self.room_id}")
                else:
                    logger.info("✅ user2 started searching")
            else:
                logger.error(f"❌ user2 search failed: {response.status_code} - {response.text}")
                return False
            
            # Wait for matching to complete
            await asyncio.sleep(2)
            
            # Check if room was created
            if not self.room_id:
                # Try to get current room for user1
                headers = {"Authorization": f"Bearer {self.user1_token}"}
                response = requests.get(f"{self.base_url}/chat/current-room", headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    if "room" in data and data["room"]:
                        self.room_id = data["room"]["id"]
                        logger.info(f"✅ Found room ID: {self.room_id}")
                    else:
                        logger.warning("⚠️ No room found after search")
                        return False
                else:
                    logger.error(f"❌ Failed to get current room: {response.status_code}")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to simulate search: {e}")
            return False
    
    async def simulate_websocket_connection(self):
        """Simulate WebSocket connections to the chat room"""
        logger.info("🌐 Simulating WebSocket connections...")
        
        try:
            from app.websocket_manager import manager
            
            # Create mock WebSockets
            mock_ws1 = MockWebSocket(self.user1_id, "user1")
            mock_ws2 = MockWebSocket(self.user2_id, "user2")
            
            # Add users to room
            success1 = await manager.add_to_room(self.room_id, mock_ws1, self.user1_id)
            success2 = await manager.add_to_room(self.room_id, mock_ws2, self.user2_id)
            
            if success1 and success2:
                logger.info("✅ Both users added to room via WebSocket")
                
                # Show room status
                room_info = manager.get_room_info(self.room_id)
                logger.info(f"📊 Room {self.room_id} status: {room_info}")
                
                return True
            else:
                logger.error("❌ Failed to add users to room")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to simulate WebSocket connection: {e}")
            return False
    
    async def simulate_message_exchange(self):
        """Simulate message exchange between users"""
        logger.info("💬 Simulating message exchange...")
        
        try:
            from app.websocket_manager import manager
            
            # User1 sends a message
            message1 = {
                "type": "message",
                "content": "Hello from user1! How are you?",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            await manager.broadcast_to_room(
                json.dumps(message1), 
                self.room_id, 
                exclude_user=self.user2_id  # Exclude user2 to simulate user1 sending
            )
            logger.info("✅ user1 sent message")
            
            # Wait a moment
            await asyncio.sleep(1)
            
            # User2 sends a message
            message2 = {
                "type": "message", 
                "content": "Hi user1! I'm doing great, thanks for asking!",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            await manager.broadcast_to_room(
                json.dumps(message2),
                self.room_id,
                exclude_user=self.user1_id  # Exclude user1 to simulate user2 sending
            )
            logger.info("✅ user2 sent message")
            
            # Wait a moment
            await asyncio.sleep(1)
            
            # User1 sends another message
            message3 = {
                "type": "message",
                "content": "That's wonderful! Would you like to chat more?",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            await manager.broadcast_to_room(
                json.dumps(message3),
                self.room_id,
                exclude_user=self.user2_id
            )
            logger.info("✅ user1 sent another message")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to simulate message exchange: {e}")
            return False
    
    async def simulate_chat_end(self):
        """Simulate ending the chat session"""
        logger.info("🔚 Simulating chat end...")
        
        try:
            # User1 ends the chat
            headers = {"Authorization": f"Bearer {self.user1_token}"}
            response = requests.post(f"{self.base_url}/chat/end/{self.room_id}", headers=headers)
            
            if response.status_code == 200:
                logger.info("✅ user1 ended the chat")
                
                # Wait for cleanup
                await asyncio.sleep(2)
                
                # Check room status
                from app.websocket_manager import manager
                room_info = manager.get_room_info(self.room_id)
                logger.info(f"📊 Room {self.room_id} status after ending: {room_info}")
                
                return True
            else:
                logger.error(f"❌ Failed to end chat: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to simulate chat end: {e}")
            return False
    
    async def cleanup_test(self):
        """Clean up test data"""
        logger.info("🧹 Cleaning up test data...")
        
        try:
            # Cancel search for both users if they're still searching
            if self.user1_token:
                headers = {"Authorization": f"Bearer {self.user1_token}"}
                requests.post(f"{self.base_url}/chat/cancel-search", headers=headers)
                logger.info("✅ Cancelled user1 search")
            
            if self.user2_token:
                headers = {"Authorization": f"Bearer {self.user2_token}"}
                requests.post(f"{self.base_url}/chat/cancel-search", headers=headers)
                logger.info("✅ Cancelled user2 search")
            
            # Remove users from room if still connected
            if self.room_id:
                from app.websocket_manager import manager
                
                if self.user1_id:
                    await manager.remove_from_room(self.room_id, self.user1_id)
                if self.user2_id:
                    await manager.remove_from_room(self.room_id, self.user2_id)
                
                logger.info("✅ Removed users from room")
            
            logger.info("✅ Test cleanup completed")
            
        except Exception as e:
            logger.error(f"❌ Failed to cleanup test: {e}")
    
    async def run_simulation(self):
        """Run the complete simulation"""
        logger.info("🎬 Starting Chat Search and Chat Simulation...")
        
        try:
            # Setup test users
            if not await self.setup_test_users():
                logger.error("❌ Failed to setup test users")
                return False
            
            # Login users
            if not await self.login_users():
                logger.error("❌ Failed to login users")
                return False
            
            # Simulate search
            if not await self.simulate_search():
                logger.error("❌ Failed to simulate search")
                return False
            
            if not self.room_id:
                logger.error("❌ No room created from search")
                return False
            
            # Simulate WebSocket connection
            if not await self.simulate_websocket_connection():
                logger.error("❌ Failed to simulate WebSocket connection")
                return False
            
            # Simulate message exchange
            if not await self.simulate_message_exchange():
                logger.error("❌ Failed to simulate message exchange")
                return False
            
            # Simulate chat end
            if not await self.simulate_chat_end():
                logger.error("❌ Failed to simulate chat end")
                return False
            
            logger.info("🎯 Simulation completed successfully! 🎉")
            return True
            
        except Exception as e:
            logger.error(f"❌ Simulation failed: {e}")
            return False
        
        finally:
            # Always cleanup
            await self.cleanup_test()

class MockWebSocket:
    """Mock WebSocket for simulation"""
    
    def __init__(self, user_id: int, username: str):
        self.user_id = user_id
        self.username = username
        self.client_state = MockClientState()
        self.sent_messages = []
    
    async def send_text(self, message: str):
        """Mock send text"""
        self.sent_messages.append(message)
        logger.info(f"📤 Mock WebSocket sent to {self.username}: {message[:50]}...")
    
    async def close(self, code: int = 1000, reason: str = "Normal closure"):
        """Mock close"""
        logger.info(f"🔌 Mock WebSocket closed for {self.username}: {code} - {reason}")

class MockClientState:
    """Mock WebSocket client state"""
    
    def __init__(self):
        self.value = 2  # 2 = open

async def main():
    """Main simulation function"""
    logger.info("🚀 Starting Chat Search and Chat Simulation...")
    
    simulator = ChatSimulator()
    success = await simulator.run_simulation()
    
    if success:
        logger.info("✅ Simulation completed successfully!")
    else:
        logger.error("❌ Simulation failed!")
    
    logger.info("🏁 Simulation finished")

if __name__ == "__main__":
    asyncio.run(main())
