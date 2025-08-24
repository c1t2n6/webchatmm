from fastapi import WebSocket
from typing import Dict, List, Optional, Set
import structlog
import asyncio
import json
from datetime import datetime, timezone

logger = structlog.get_logger()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.room_connections: Dict[int, Dict[int, WebSocket]] = {}
        self.user_rooms: Dict[int, int] = {}  # user_id -> room_id mapping
        self.room_locks: Dict[int, asyncio.Lock] = {}  # Prevent race conditions
        # Note: Background cleanup tasks removed to prevent CancelledError

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
                        loop.create_task(self.send_personal_message(message, user_id))
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
        lock = self._get_or_create_room_lock(room_id)
        acquired = False
        try:
            # Use shield to prevent cancellation during lock acquisition
            await asyncio.shield(lock.acquire())
            acquired = True
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
            
            # Clean up failed connections (don't call remove_from_room to avoid infinite loop)
            for room_id, user_id in failed_connections:
                logger.info(f"Marking failed connection for user {user_id} in room {room_id}")
                # Just log the failure, don't call remove_from_room here
                
        except asyncio.CancelledError:
            logger.info(f"Broadcast operation cancelled for room {room_id}")
            # Clean up any partial state if needed
            # This is normal during shutdown, not an error
            # No need to clean up failed connections during cancellation
        except Exception as e:
            logger.error(f"Error broadcasting to room {room_id}: {e}")
        finally:
            if acquired and lock.locked():
                lock.release()

    async def add_to_room(self, room_id: int, websocket: WebSocket, user_id: int):
        """Add user to a room with proper validation"""
        lock = self._get_or_create_room_lock(room_id)
        acquired = False
        try:
            # Use shield to prevent cancellation during lock acquisition
            await asyncio.shield(lock.acquire())
            acquired = True
            logger.info(f"Adding user {user_id} to room {room_id}")
            
            # Validate room doesn't already have this user
            if room_id in self.room_connections and user_id in self.room_connections[room_id]:
                logger.warning(f"User {user_id} already in room {room_id}")
                return False
            
            # Check if user is already in another room - REMOVE THIS TO PREVENT INFINITE LOOP
            # if user_id in self.user_rooms:
            #     old_room_id = self.user_rooms[user_id]
            #     if old_room_id != room_id:
            #         logger.warning(f"User {user_id} is already in room {old_room_id}, removing first")
            #         await self.remove_from_room(old_room_id, user_id)
            
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
            
        except asyncio.CancelledError:
            logger.info(f"Add user operation cancelled for user {user_id} to room {room_id}")
            # This is normal during shutdown, not an error
            # Return False to indicate operation was not completed
            return False
        except Exception as e:
            logger.error(f"Error adding user {user_id} to room {room_id}: {e}")
            return False
        finally:
            if acquired and lock.locked():
                lock.release()

    async def remove_from_room(self, room_id: int, user_id: int):
        """Remove user from a room with proper cleanup"""
        lock = self._get_or_create_room_lock(room_id)
        acquired = False
        try:
            # Use shield to prevent cancellation during lock acquisition
            await asyncio.shield(lock.acquire())
            acquired = True
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
                    
        except asyncio.CancelledError:
            logger.info(f"Remove user operation cancelled for user {user_id} from room {room_id}")
            # This is normal during shutdown, not an error
            # During cancellation, we can't guarantee cleanup was completed
            # But this is acceptable during shutdown
        except Exception as e:
            logger.error(f"Error removing user {user_id} from room {room_id}: {e}")
        finally:
            if acquired and lock.locked():
                lock.release()

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

    async def force_close_room_with_delay(self, room_id: int, delay_seconds: int = 3):
        """Force close all connections in a room with delay to ensure notifications are received"""
        try:
            logger.info(f"Force closing room {room_id} with {delay_seconds}s delay")
            
            # Wait for specified delay to ensure notifications are received
            await asyncio.sleep(delay_seconds)
            
            # Now call the original force_close_room method
            await self.force_close_room(room_id)
            
        except Exception as e:
            logger.error(f"Error in force_close_room_with_delay for room {room_id}: {e}")
            # Fallback to immediate close if delay fails
            await self.force_close_room(room_id)

    async def force_close_room(self, room_id: int):
        """Force close all connections in a room (used when ending chat)"""
        try:
            if room_id not in self.room_connections:
                logger.warning(f"Room {room_id} not found for force close")
                return
            
            logger.info(f"Force closing room {room_id}")
            
            # Get users before clearing connections
            users_to_close = list(self.room_connections[room_id].keys())
            
            # Send final room closed notification to all users
            try:
                await self.broadcast_to_room(
                    json.dumps({
                        "type": "room_closed",
                        "message": "Phòng chat đã được đóng",
                        "room_id": room_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "force_close": True
                    }),
                    room_id
                )
                logger.info(f"Final room closed notification sent to room {room_id}")
                
                # Give users a moment to receive the notification
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.warning(f"Could not send final room closed notification: {e}")
            
            # Close all WebSocket connections
            successful_closes = 0
            for user_id in users_to_close:
                try:
                    websocket = self.room_connections[room_id].get(user_id)
                    if websocket and websocket.client_state.value < 3:
                        await websocket.close(code=1000, reason="Chat ended")
                        successful_closes += 1
                        logger.info(f"Room {room_id} force closed successfully")
                except Exception as e:
                    logger.info(f"WebSocket close failed for user {user_id}: {e}")
                
                # Remove user from mappings
                if user_id in self.user_rooms:
                    del self.user_rooms[user_id]
            
            logger.info(f"Closed {successful_closes}/{len(users_to_close)} WebSocket connections")
            
            # Clear room connections
            if room_id in self.room_connections:
                del self.room_connections[room_id]
            if room_id in self.room_locks:
                del self.room_locks[room_id]
                
            logger.info(f"Room {room_id} force closed successfully")
            
        except Exception as e:
            logger.error(f"Error force closing room {room_id}: {e}")
            # Clean up what we can even on error
            if room_id in self.room_connections:
                del self.room_connections[room_id]
            if room_id in self.room_locks:
                del self.room_locks[room_id]

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

    # Note: Background cleanup tasks have been removed to prevent CancelledError during shutdown
    # Rooms are cleaned up immediately when users disconnect or rooms are ended

# Global instance
manager = ConnectionManager()
