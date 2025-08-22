from fastapi import WebSocket
from typing import Dict, List, Optional, Set
import structlog
import asyncio
import json
from datetime import datetime
import weakref

logger = structlog.get_logger()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.room_connections: Dict[int, Dict[int, WebSocket]] = {}
        self.user_rooms: Dict[int, int] = {}  # user_id -> room_id mapping
        self.room_locks: Dict[int, asyncio.Lock] = {}  # Prevent race conditions
        self._cleanup_task: Optional[asyncio.Task] = None

    def _get_or_create_room_lock(self, room_id: int) -> asyncio.Lock:
        """Get or create a lock for a specific room to prevent race conditions"""
        if room_id not in self.room_locks:
            self.room_locks[room_id] = asyncio.Lock()
        return self.room_locks[room_id]

    async def connect(self, websocket: WebSocket, user_id: int):
        """Connect user to status WebSocket"""
        try:
            self.active_connections[user_id] = websocket
            logger.info(f"User {user_id} connected to status WebSocket")
        except Exception as e:
            logger.error(f"Error connecting user {user_id}: {e}")
            raise

    def disconnect(self, user_id: int):
        """Disconnect user from status WebSocket"""
        try:
            if user_id in self.active_connections:
                del self.active_connections[user_id]
                logger.info(f"User {user_id} disconnected from status WebSocket")
            
            # Also remove from all rooms (synchronous removal)
            self._remove_user_from_all_rooms_sync(user_id)
        except Exception as e:
            logger.error(f"Error disconnecting user {user_id}: {e}")

    def _remove_user_from_all_rooms_sync(self, user_id: int):
        """Remove user from all rooms they're in (synchronous version)"""
        rooms_to_remove = []
        for room_id, users in self.room_connections.items():
            if user_id in users:
                rooms_to_remove.append((room_id, user_id))
        
        for room_id, user_id in rooms_to_remove:
            # Use synchronous removal
            if room_id in self.room_connections:
                if user_id in self.room_connections[room_id]:
                    del self.room_connections[room_id][user_id]
                    logger.info(f"User {user_id} removed from room {room_id}")
                
                # Remove user from user_rooms mapping
                if user_id in self.user_rooms:
                    del self.user_rooms[user_id]
                
                # Close room if no more users
                if not self.room_connections[room_id]:
                    del self.room_connections[room_id]
                    # Clean up lock
                    if room_id in self.room_locks:
                        del self.room_locks[room_id]
                    logger.info(f"Room {room_id} closed - no more users")
        
        # Also remove from active_connections if user was disconnected
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"User {user_id} removed from active connections")

    async def _remove_user_from_all_rooms(self, user_id: int):
        """Remove user from all rooms they're in"""
        rooms_to_remove = []
        for room_id, users in self.room_connections.items():
            if user_id in users:
                rooms_to_remove.append((room_id, user_id))
        
        for room_id, user_id in rooms_to_remove:
            await self.remove_from_room(room_id, user_id)

    async def send_personal_message(self, message: str, user_id: int):
        """Send message to specific user"""
        if user_id in self.active_connections:
            try:
                websocket = self.active_connections[user_id]
                if websocket.client_state.value < 3:  # Check if connection is still open
                    await websocket.send_text(message)
                    logger.info(f"Message sent to user {user_id}")
                else:
                    logger.warning(f"WebSocket for user {user_id} is closed, removing")
                    self.disconnect(user_id)
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")
                self.disconnect(user_id)

    def send_to_user(self, user_id: int, message: str):
        """Synchronous method to send message to user (for use in non-async contexts)"""
        if user_id in self.active_connections:
            try:
                # Use asyncio to run the async method
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        # If loop is running, create a task
                        asyncio.create_task(self.send_personal_message(message, user_id))
                    else:
                        # If no loop running, run in new loop
                        asyncio.run(self.send_personal_message(message, user_id))
                except RuntimeError:
                    # No event loop, create new one
                    asyncio.run(self.send_personal_message(message, user_id))
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")
                self.disconnect(user_id)

    async def broadcast_to_room(self, message: str, room_id: int, exclude_user: int = None):
        """Broadcast message to all users in a room"""
        async with self._get_or_create_room_lock(room_id):
            logger.info(f"Broadcasting message to room {room_id}")
            logger.info(f"Message: {message}")
            
            if room_id not in self.room_connections:
                logger.warning(f"Room {room_id} not found in room_connections")
                return
            
            users_in_room = list(self.room_connections[room_id].keys())
            logger.info(f"Users in room {room_id}: {users_in_room}")
            
            failed_connections = []
            
            for user_id, websocket in self.room_connections[room_id].items():
                try:
                    # Skip excluded user
                    if exclude_user is not None and user_id == exclude_user:
                        logger.info(f"Skipping excluded user {user_id}")
                        continue
                    
                    # Check if WebSocket is still open
                    if websocket.client_state.value >= 3:
                        logger.warning(f"WebSocket for user {user_id} is closed, marking for removal")
                        failed_connections.append((room_id, user_id))
                        continue
                    
                    logger.info(f"Sending message to user {user_id} in room {room_id}")
                    await websocket.send_text(message)
                    logger.info(f"Message successfully sent to user {user_id} in room {room_id}")
                    
                except Exception as e:
                    logger.error(f"Error broadcasting to user {user_id} in room {room_id}: {e}")
                    failed_connections.append((room_id, user_id))
            
            # Clean up failed connections
            for room_id, user_id in failed_connections:
                await self.remove_from_room(room_id, user_id)

    async def add_to_room(self, room_id: int, websocket: WebSocket, user_id: int):
        """Add user to a room with proper validation"""
        async with self._get_or_create_room_lock(room_id):
            logger.info(f"Adding user {user_id} to room {room_id}")
            
            # Validate room doesn't already have this user
            if room_id in self.room_connections and user_id in self.room_connections[room_id]:
                logger.warning(f"User {user_id} already in room {room_id}")
                return False
            
            # Check if user is already in another room
            if user_id in self.user_rooms:
                old_room_id = self.user_rooms[user_id]
                if old_room_id != room_id:
                    logger.warning(f"User {user_id} is already in room {old_room_id}, removing first")
                    await self.remove_from_room(old_room_id, user_id)
            
            # Create room if it doesn't exist
            if room_id not in self.room_connections:
                self.room_connections[room_id] = {}
                logger.info(f"Created new room {room_id}")
            
            # Store websocket with user_id
            self.room_connections[room_id][user_id] = websocket
            self.user_rooms[user_id] = room_id
            
            logger.info(f"User {user_id} added to room {room_id}")
            logger.info(f"Room {room_id} now has users: {list(self.room_connections[room_id].keys())}")
            return True

    async def remove_from_room(self, room_id: int, user_id: int):
        """Remove user from a room with proper cleanup"""
        async with self._get_or_create_room_lock(room_id):
            logger.info(f"Removing user {user_id} from room {room_id}")
            
            if room_id in self.room_connections:
                if user_id in self.room_connections[room_id]:
                    del self.room_connections[room_id][user_id]
                    logger.info(f"User {user_id} removed from room {room_id}")
                
                # Remove user from user_rooms mapping
                if user_id in self.user_rooms:
                    del self.user_rooms[user_id]
                
                # Close room if no more users
                if not self.room_connections[room_id]:
                    del self.room_connections[room_id]
                    # Clean up lock
                    if room_id in self.room_locks:
                        del self.room_locks[room_id]
                    logger.info(f"Room {room_id} closed - no more users")

    def get_room_info(self, room_id: int) -> dict:
        """Get information about users in a room for debugging"""
        if room_id not in self.room_connections:
            return {"room_id": room_id, "users": [], "connection_count": 0, "status": "closed"}
        
        users_in_room = list(self.room_connections[room_id].keys())
        
        return {
            "room_id": room_id,
            "users": users_in_room,
            "connection_count": len(self.room_connections[room_id]),
            "status": "active"
        }

    def is_user_in_room(self, user_id: int, room_id: int) -> bool:
        """Check if user is in specific room"""
        return (room_id in self.room_connections and 
                user_id in self.room_connections[room_id])

    def get_user_room(self, user_id: int) -> Optional[int]:
        """Get room ID where user is currently located"""
        return self.user_rooms.get(user_id)

    async def force_close_room(self, room_id: int):
        """Force close all connections in a room (used when ending chat)"""
        async with self._get_or_create_room_lock(room_id):
            if room_id not in self.room_connections:
                logger.warning(f"Room {room_id} not found for force close")
                return
            
            logger.info(f"Force closing room {room_id}")
            
            # Notify all users before closing
            try:
                await self.broadcast_to_room(
                    json.dumps({
                        "type": "room_closed",
                        "message": "Chat room has been closed",
                        "room_id": room_id,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }),
                    room_id
                )
            except Exception as e:
                logger.error(f"Error broadcasting room close message: {e}")
            
            # Close all WebSocket connections
            users_to_close = list(self.room_connections[room_id].keys())
            for user_id in users_to_close:
                try:
                    websocket = self.room_connections[room_id][user_id]
                    if websocket.client_state.value < 3:  # Only close if not already closed
                        await websocket.close(code=1000, reason="Chat ended")
                        logger.info(f"Force closed WebSocket for user {user_id} in room {room_id}")
                except Exception as e:
                    logger.error(f"Error closing WebSocket for user {user_id}: {e}")
                
                # Remove user from user_rooms mapping
                if user_id in self.user_rooms:
                    del self.user_rooms[user_id]
            
            # Cleanup users in database
            for user_id in users_to_close:
                await self.cleanup_user_from_database(user_id, room_id)
            
            # Clear room connections
            del self.room_connections[room_id]
            if room_id in self.room_locks:
                del self.room_locks[room_id]
            logger.info(f"Room {room_id} force closed")

    async def cleanup_user_from_database(self, user_id: int, room_id: int = None):
        """Cleanup user from database when disconnecting"""
        try:
            from .database import get_db
            from .models import User
            
            db = next(get_db())
            try:
                user = db.query(User).filter(User.id == user_id).first()
                
                if user:
                    # Only reset if user is still in this room
                    if room_id is None or user.current_room_id == room_id:
                        user.status = 'idle'
                        user.current_room_id = None
                        user.online_status = False
                        db.commit()
                        logger.info(f"User {user_id} status reset to idle in database")
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error cleaning up user {user_id} in database: {e}")

    async def cleanup_inactive_rooms(self):
        """Periodic cleanup of inactive rooms"""
        try:
            current_time = datetime.now(timezone.utc)
            rooms_to_cleanup = []
            
            for room_id, users in self.room_connections.items():
                # Check if room has been inactive for too long
                # This is a simple implementation - you might want to add more sophisticated logic
                if len(users) == 0:
                    rooms_to_cleanup.append(room_id)
            
            for room_id in rooms_to_cleanup:
                logger.info(f"Cleaning up inactive room {room_id}")
                await self.force_close_room(room_id)
                
        except Exception as e:
            logger.error(f"Error during room cleanup: {e}")

    def start_cleanup_task(self):
        """Start periodic cleanup task"""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def _cleanup_loop(self):
        """Background cleanup loop"""
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes
                await self.cleanup_inactive_rooms()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(60)  # Wait 1 minute on error

    def stop_cleanup_task(self):
        """Stop periodic cleanup task"""
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()

# Global instance
manager = ConnectionManager()
