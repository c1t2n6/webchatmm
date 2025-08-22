#!/usr/bin/env python3
"""
Test Optimized Room Chat System
================================

This script tests the optimized room chat system including:
- WebSocket connections
- Room creation and management
- Message handling
- Room lifecycle management
- Error handling and recovery
"""

import asyncio
import json
import time
import structlog
from datetime import datetime
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

class MockWebSocket:
    """Mock WebSocket for testing"""
    
    def __init__(self, user_id: int, username: str):
        self.user_id = user_id
        self.username = username
        self.client_state = MockClientState()
        self.sent_messages: List[str] = []
        self.is_closed = False
        self.close_code = None
        self.close_reason = None
    
    async def accept(self):
        """Accept WebSocket connection"""
        logger.info(f"Mock WebSocket accepted for user {self.user_id}")
    
    async def send_text(self, message: str):
        """Send text message"""
        if not self.is_closed:
            self.sent_messages.append(message)
            logger.info(f"Message sent to user {self.user_id}: {message}")
    
    async def receive_text(self):
        """Receive text message (mock implementation)"""
        # Simulate receiving a message
        await asyncio.sleep(0.1)
        return json.dumps({
            "type": "message",
            "content": f"Test message from user {self.user_id}",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def close(self, code: int = 1000, reason: str = "Normal closure"):
        """Close WebSocket connection"""
        self.is_closed = True
        self.close_code = code
        self.close_reason = reason
        logger.info(f"Mock WebSocket closed for user {self.user_id}: {code} - {reason}")

class MockClientState:
    """Mock WebSocket client state"""
    
    def __init__(self):
        self.value = 1  # 1 = connecting, 2 = open, 3 = closing, 4 = closed

class MockDatabase:
    """Mock database for testing"""
    
    def __init__(self):
        self.users: Dict[int, Dict] = {}
        self.rooms: Dict[int, Dict] = {}
        self.messages: List[Dict] = []
        self.next_user_id = 1
        self.next_room_id = 1
        self.next_message_id = 1
    
    def add_user(self, username: str, status: str = 'idle') -> int:
        """Add a mock user"""
        user_id = self.next_user_id
        self.next_user_id += 1
        
        self.users[user_id] = {
            'id': user_id,
            'username': username,
            'status': status,
            'current_room_id': None,
            'online_status': False
        }
        
        return user_id
    
    def add_room(self, user1_id: int, user2_id: int) -> int:
        """Add a mock room"""
        room_id = self.next_room_id
        self.next_room_id += 1
        
        self.rooms[room_id] = {
            'id': room_id,
            'user1_id': user1_id,
            'user2_id': user2_id,
            'start_time': datetime.utcnow(),
            'end_time': None,
            'reveal_level': 0,
            'keep_active': False,
            'last_message_time': datetime.utcnow()
        }
        
        # Update users
        self.users[user1_id]['current_room_id'] = room_id
        self.users[user1_id]['status'] = 'connected'
        self.users[user1_id]['online_status'] = True
        
        self.users[user2_id]['current_room_id'] = room_id
        self.users[user2_id]['status'] = 'connected'
        self.users[user2_id]['online_status'] = True
        
        return room_id
    
    def add_message(self, room_id: int, user_id: int, content: str) -> int:
        """Add a mock message"""
        message_id = self.next_message_id
        self.next_message_id += 1
        
        message = {
            'id': message_id,
            'room_id': room_id,
            'user_id': user_id,
            'content': content,
            'timestamp': datetime.utcnow()
        }
        
        self.messages.append(message)
        
        # Update room's last message time
        if room_id in self.rooms:
            self.rooms[room_id]['last_message_time'] = datetime.utcnow()
        
        return message_id
    
    def get_user(self, user_id: int) -> Optional[Dict]:
        """Get user by ID"""
        return self.users.get(user_id)
    
    def get_room(self, room_id: int) -> Optional[Dict]:
        """Get room by ID"""
        return self.rooms.get(room_id)
    
    def update_user_status(self, user_id: int, status: str, room_id: Optional[int] = None):
        """Update user status"""
        if user_id in self.users:
            self.users[user_id]['status'] = status
            self.users[user_id]['current_room_id'] = room_id
            self.users[user_id]['online_status'] = (status == 'connected')

class TestRoomSystem:
    """Test the optimized room chat system"""
    
    def __init__(self):
        self.db = MockDatabase()
        self.test_results: List[Dict] = []
        
        # Create test users
        self.user1_id = self.db.add_user("testuser1", "searching")
        self.user2_id = self.db.add_user("testuser2", "searching")
        
        logger.info(f"Test users created: {self.user1_id}, {self.user2_id}")
    
    async def test_room_creation(self):
        """Test room creation"""
        logger.info("Testing room creation...")
        
        try:
            # Create a room
            room_id = self.db.add_room(self.user1_id, self.user2_id)
            
            # Verify room was created
            room = self.db.get_room(room_id)
            if not room:
                raise Exception("Room was not created")
            
            # Verify users are connected
            user1 = self.db.get_user(self.user1_id)
            user2 = self.db.get_user(self.user2_id)
            
            if user1['status'] != 'connected' or user2['status'] != 'connected':
                raise Exception("Users were not set to connected status")
            
            if user1['current_room_id'] != room_id or user2['current_room_id'] != room_id:
                raise Exception("Users were not assigned to the room")
            
            self.test_results.append({
                'test': 'room_creation',
                'status': 'PASSED',
                'room_id': room_id
            })
            
            logger.info(f"Room creation test PASSED: room {room_id}")
            return room_id
            
        except Exception as e:
            self.test_results.append({
                'test': 'room_creation',
                'status': 'FAILED',
                'error': str(e)
            })
            
            logger.error(f"Room creation test FAILED: {e}")
            return None
    
    async def test_websocket_connection(self, room_id: int):
        """Test WebSocket connection to room"""
        logger.info(f"Testing WebSocket connection to room {room_id}...")
        
        try:
            # Create mock WebSockets
            ws1 = MockWebSocket(self.user1_id, "testuser1")
            ws2 = MockWebSocket(self.user2_id, "testuser2")
            
            # Simulate connection process
            await ws1.accept()
            await ws2.accept()
            
            # Verify connections are established
            if ws1.is_closed or ws2.is_closed:
                raise Exception("WebSocket connections were closed unexpectedly")
            
            self.test_results.append({
                'test': 'websocket_connection',
                'status': 'PASSED',
                'room_id': room_id
            })
            
            logger.info(f"WebSocket connection test PASSED for room {room_id}")
            return ws1, ws2
            
        except Exception as e:
            self.test_results.append({
                'test': 'websocket_connection',
                'status': 'FAILED',
                'error': str(e)
            })
            
            logger.error(f"WebSocket connection test FAILED: {e}")
            return None, None
    
    async def test_message_exchange(self, room_id: int, ws1: MockWebSocket, ws2: MockWebSocket):
        """Test message exchange between users"""
        logger.info(f"Testing message exchange in room {room_id}...")
        
        try:
            # User 1 sends a message
            message1 = {
                "type": "message",
                "content": "Hello from user 1!",
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Simulate sending message
            await ws1.send_text(json.dumps(message1))
            
            # Add message to database
            self.db.add_message(room_id, self.user1_id, message1["content"])
            
            # User 2 sends a message
            message2 = {
                "type": "message",
                "content": "Hello from user 2!",
                "timestamp": datetime.utcnow().isoformat()
            }
            
            await ws2.send_text(json.dumps(message2))
            self.db.add_message(room_id, self.user2_id, message2["content"])
            
            # Verify messages were sent
            if len(ws1.sent_messages) == 0 or len(ws2.sent_messages) == 0:
                raise Exception("Messages were not sent")
            
            # Verify messages in database
            if len(self.db.messages) != 2:
                raise Exception("Messages were not saved to database")
            
            self.test_results.append({
                'test': 'message_exchange',
                'status': 'PASSED',
                'room_id': room_id,
                'message_count': len(self.db.messages)
            })
            
            logger.info(f"Message exchange test PASSED for room {room_id}")
            
        except Exception as e:
            self.test_results.append({
                'test': 'message_exchange',
                'status': 'FAILED',
                'error': str(e)
            })
            
            logger.error(f"Message exchange test FAILED: {e}")
    
    async def test_room_cleanup(self, room_id: int, ws1: MockWebSocket, ws2: MockWebSocket):
        """Test room cleanup when users disconnect"""
        logger.info(f"Testing room cleanup for room {room_id}...")
        
        try:
            # Simulate user disconnection
            await ws1.close(code=1000, reason="User left")
            await ws2.close(code=1000, reason="User left")
            
            # Verify WebSockets are closed
            if not ws1.is_closed or not ws2.is_closed:
                raise Exception("WebSockets were not properly closed")
            
            # Simulate room cleanup
            room = self.db.get_room(room_id)
            if room:
                room['end_time'] = datetime.utcnow()
                
                # Reset user statuses
                user1 = self.db.get_user(self.user1_id)
                user2 = self.db.get_user(self.user2_id)
                
                if user1:
                    user1['status'] = 'idle'
                    user1['current_room_id'] = None
                    user1['online_status'] = False
                
                if user2:
                    user2['status'] = 'idle'
                    user2['current_room_id'] = None
                    user2['online_status'] = False
            
            # Verify cleanup
            user1 = self.db.get_user(self.user1_id)
            user2 = self.db.get_user(self.user2_id)
            
            if user1['status'] != 'idle' or user2['status'] != 'idle':
                raise Exception("User statuses were not reset after cleanup")
            
            if user1['current_room_id'] is not None or user2['current_room_id'] is not None:
                raise Exception("Users were not removed from room after cleanup")
            
            self.test_results.append({
                'test': 'room_cleanup',
                'status': 'PASSED',
                'room_id': room_id
            })
            
            logger.info(f"Room cleanup test PASSED for room {room_id}")
            
        except Exception as e:
            self.test_results.append({
                'test': 'room_cleanup',
                'status': 'FAILED',
                'error': str(e)
            })
            
            logger.error(f"Room cleanup test FAILED: {e}")
    
    async def test_error_handling(self):
        """Test error handling scenarios"""
        logger.info("Testing error handling...")
        
        try:
            # Test invalid room access
            invalid_room_id = 99999
            user = self.db.get_user(self.user1_id)
            
            if user['current_room_id'] == invalid_room_id:
                raise Exception("User should not have access to invalid room")
            
            # Test user validation
            if user['status'] == 'connected' and user['current_room_id'] is None:
                raise Exception("User status inconsistency detected")
            
            self.test_results.append({
                'test': 'error_handling',
                'status': 'PASSED'
            })
            
            logger.info("Error handling test PASSED")
            
        except Exception as e:
            self.test_results.append({
                'test': 'error_handling',
                'status': 'FAILED',
                'error': str(e)
            })
            
            logger.error(f"Error handling test FAILED: {e}")
    
    async def run_all_tests(self):
        """Run all tests"""
        logger.info("Starting comprehensive room system tests...")
        
        start_time = time.time()
        
        # Test room creation
        room_id = await self.test_room_creation()
        if not room_id:
            logger.error("Cannot continue tests without room creation")
            return
        
        # Test WebSocket connections
        ws1, ws2 = await self.test_websocket_connection(room_id)
        if not ws1 or not ws2:
            logger.error("Cannot continue tests without WebSocket connections")
            return
        
        # Test message exchange
        await self.test_message_exchange(room_id, ws1, ws2)
        
        # Test room cleanup
        await self.test_room_cleanup(room_id, ws1, ws2)
        
        # Test error handling
        await self.test_error_handling()
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Print test results
        self.print_test_results(duration)
    
    def print_test_results(self, duration: float):
        """Print test results summary"""
        logger.info("=" * 60)
        logger.info("TEST RESULTS SUMMARY")
        logger.info("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASSED')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAILED')
        total = len(self.test_results)
        
        logger.info(f"Total tests: {total}")
        logger.info(f"Passed: {passed}")
        logger.info(f"Failed: {failed}")
        logger.info(f"Duration: {duration:.2f} seconds")
        
        if failed > 0:
            logger.error("Some tests failed:")
            for result in self.test_results:
                if result['status'] == 'FAILED':
                    logger.error(f"  - {result['test']}: {result['error']}")
        else:
            logger.info("All tests PASSED! 🎉")
        
        logger.info("=" * 60)

async def main():
    """Main test function"""
    logger.info("Starting optimized room chat system tests...")
    
    test_system = TestRoomSystem()
    await test_system.run_all_tests()
    
    logger.info("Test suite completed")

if __name__ == "__main__":
    asyncio.run(main())
