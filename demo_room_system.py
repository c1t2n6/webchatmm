#!/usr/bin/env python3
"""
Demo Room Chat System
=====================

This script demonstrates the optimized room chat system:
- Starts the room lifecycle manager
- Creates test rooms
- Simulates user connections
- Shows system monitoring
- Demonstrates cleanup processes
"""

import asyncio
import json
import time
import structlog
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

class RoomSystemDemo:
    """Demonstrate the room chat system"""
    
    def __init__(self):
        self.demo_rooms: List[int] = []
        self.demo_users: List[int] = []
    
    async def start_system(self):
        """Start the room lifecycle manager"""
        logger.info("🚀 Starting Room Chat System Demo...")
        
        try:
            from app.utils.room_lifecycle_manager import room_lifecycle_manager
            from app.websocket_manager import manager
            
            # Start room lifecycle manager
            room_lifecycle_manager.start()
            logger.info("✅ Room lifecycle manager started")
            
            # Start WebSocket cleanup task
            manager.start_cleanup_task()
            logger.info("✅ WebSocket cleanup task started")
            
            # Wait a moment for tasks to initialize
            await asyncio.sleep(2)
            
            # Show initial status
            await self.show_system_status()
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to start system: {e}")
            return False
    
    async def create_demo_rooms(self):
        """Create some demo rooms for testing"""
        logger.info("🏠 Creating demo rooms...")
        
        try:
            from app.database import get_db
            from app.models import User, Room
            from app.utils.matching.room_creator import room_creator
            
            db = next(get_db())
            
            # Create demo users if they don't exist
            demo_user1 = db.query(User).filter(User.username == "demo_user1").first()
            if not demo_user1:
                demo_user1 = User(
                    username="demo_user1",
                    nickname="Demo User 1",
                    dob=datetime.now().date(),
                    gender="Nam",
                    preferred_gender='["Nữ"]',
                    needs='["Nhẹ nhàng vui vẻ"]',
                    interests='["Gym", "Nhảy"]',
                    profile_completed=True,
                    status="idle"
                )
                db.add(demo_user1)
                db.flush()
                logger.info(f"✅ Created demo user: {demo_user1.username}")
            
            demo_user2 = db.query(User).filter(User.username == "demo_user2").first()
            if not demo_user2:
                demo_user2 = User(
                    username="demo_user2",
                    nickname="Demo User 2",
                    dob=datetime.now().date(),
                    gender="Nữ",
                    preferred_gender='["Nam"]',
                    needs='["Nghiêm túc"]',
                    interests='["Ảnh", "Nhảy"]',
                    profile_completed=True,
                    status="idle"
                )
                db.add(demo_user2)
                db.flush()
                logger.info(f"✅ Created demo user: {demo_user2.username}")
            
            # Create demo room
            demo_room = Room(
                user1_id=demo_user1.id,
                user2_id=demo_user2.id,
                type="chat",
                start_time=datetime.now(timezone.utc),
                created_at=datetime.now(timezone.utc)
            )
            db.add(demo_room)
            db.flush()
            
            # Update user statuses
            demo_user1.status = "connected"
            demo_user1.current_room_id = demo_room.id
            demo_user1.online_status = True
            
            demo_user2.status = "connected"
            demo_user2.current_room_id = demo_room.id
            demo_user2.online_status = True
            
            db.commit()
            
            self.demo_rooms.append(demo_room.id)
            self.demo_users.extend([demo_user1.id, demo_user2.id])
            
            logger.info(f"✅ Created demo room {demo_room.id} with users {demo_user1.username} and {demo_user2.username}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to create demo rooms: {e}")
            return False
    
    async def simulate_user_activity(self):
        """Simulate user activity in rooms"""
        logger.info("👥 Simulating user activity...")
        
        try:
            from app.websocket_manager import manager
            
            # Simulate adding users to rooms
            for room_id in self.demo_rooms:
                for user_id in self.demo_users:
                    # Create a mock WebSocket for demo
                    mock_websocket = MockWebSocket(user_id, f"demo_user_{user_id}")
                    
                    # Add user to room
                    success = await manager.add_to_room(room_id, mock_websocket, user_id)
                    if success:
                        logger.info(f"✅ User {user_id} added to room {room_id}")
                    else:
                        logger.warning(f"⚠️ Failed to add user {user_id} to room {room_id}")
            
            # Wait for activity to settle
            await asyncio.sleep(2)
            
            # Show room status
            await self.show_room_status()
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to simulate user activity: {e}")
            return False
    
    async def show_system_status(self):
        """Show current system status"""
        logger.info("📊 System Status:")
        
        try:
            from app.utils.room_lifecycle_manager import room_lifecycle_manager
            from app.websocket_manager import manager
            
            # Lifecycle manager status
            lifecycle_status = room_lifecycle_manager.get_status()
            logger.info(f"  🔄 Lifecycle Manager: {'Running' if lifecycle_status['is_running'] else 'Stopped'}")
            logger.info(f"  🧹 Cleanup Task: {'Active' if lifecycle_status['cleanup_task_active'] else 'Inactive'}")
            logger.info(f"  🔧 Maintenance Task: {'Active' if lifecycle_status['maintenance_task_active'] else 'Inactive'}")
            
            # WebSocket manager status
            active_rooms = len(manager.room_connections)
            total_connections = sum(len(users) for users in manager.room_connections.values())
            logger.info(f"  🌐 Active Rooms: {active_rooms}")
            logger.info(f"  👥 Total Connections: {total_connections}")
            
        except Exception as e:
            logger.error(f"❌ Failed to get system status: {e}")
    
    async def show_room_status(self):
        """Show current room status"""
        logger.info("🏠 Room Status:")
        
        try:
            from app.websocket_manager import manager
            
            for room_id in self.demo_rooms:
                room_info = manager.get_room_info(room_id)
                logger.info(f"  Room {room_id}: {room_info['status']}, {room_info['connection_count']} users")
                
                if room_info['users']:
                    logger.info(f"    Users: {room_info['users']}")
            
        except Exception as e:
            logger.error(f"❌ Failed to get room status: {e}")
    
    async def demonstrate_cleanup(self):
        """Demonstrate cleanup processes"""
        logger.info("🧹 Demonstrating cleanup processes...")
        
        try:
            from app.utils.room_lifecycle_manager import room_lifecycle_manager
            
            # Mark a room for ending
            if self.demo_rooms:
                room_id = self.demo_rooms[0]
                room_lifecycle_manager.mark_room_for_ending(room_id)
                logger.info(f"✅ Marked room {room_id} for ending")
                
                # Wait for cleanup to process
                await asyncio.sleep(3)
                
                # Show updated status
                await self.show_system_status()
                await self.show_room_status()
            
        except Exception as e:
            logger.error(f"❌ Failed to demonstrate cleanup: {e}")
    
    async def run_demo(self):
        """Run the complete demo"""
        logger.info("🎬 Starting Room Chat System Demo...")
        
        try:
            # Start system
            if not await self.start_system():
                return
            
            # Create demo rooms
            if not await self.create_demo_rooms():
                return
            
            # Simulate user activity
            if not await self.simulate_user_activity():
                return
            
            # Show status
            await self.show_system_status()
            await self.show_room_status()
            
            # Demonstrate cleanup
            await self.demonstrate_cleanup()
            
            # Final status
            logger.info("🎯 Demo completed! Final status:")
            await self.show_system_status()
            
        except Exception as e:
            logger.error(f"❌ Demo failed: {e}")
        
        finally:
            # Cleanup
            await self.cleanup_demo()
    
    async def cleanup_demo(self):
        """Clean up demo resources"""
        logger.info("🧹 Cleaning up demo resources...")
        
        try:
            from app.utils.room_lifecycle_manager import room_lifecycle_manager
            from app.websocket_manager import manager
            
            # Stop lifecycle manager
            room_lifecycle_manager.stop()
            logger.info("✅ Room lifecycle manager stopped")
            
            # Stop cleanup task
            manager.stop_cleanup_task()
            logger.info("✅ WebSocket cleanup task stopped")
            
        except Exception as e:
            logger.error(f"❌ Failed to cleanup: {e}")

class MockWebSocket:
    """Mock WebSocket for demo purposes"""
    
    def __init__(self, user_id: int, username: str):
        self.user_id = user_id
        self.username = username
        self.client_state = MockClientState()
    
    async def send_text(self, message: str):
        """Mock send text"""
        pass
    
    async def close(self, code: int = 1000, reason: str = "Normal closure"):
        """Mock close"""
        pass

class MockClientState:
    """Mock WebSocket client state"""
    
    def __init__(self):
        self.value = 2  # 2 = open

async def main():
    """Main demo function"""
    demo = RoomSystemDemo()
    await demo.run_demo()

if __name__ == "__main__":
    asyncio.run(main())
