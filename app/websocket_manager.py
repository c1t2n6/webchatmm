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
        self.connection_timestamps: Dict[int, datetime] = {}  # Track connection time
        self.heartbeat_interval = 30  # Send heartbeat every 30 seconds

    def _get_or_create_room_lock(self, room_id: int) -> asyncio.Lock:
        """Get or create a lock for a specific room to prevent race conditions"""
        if room_id not in self.room_locks:
            self.room_locks[room_id] = asyncio.Lock()
        return self.room_locks[room_id]

    async def connect(self, websocket: WebSocket, user_id: int):
        """Connect user to status WebSocket"""
        try:
            await websocket.accept()
            self.active_connections[user_id] = websocket
            self.connection_timestamps[user_id] = datetime.now(timezone.utc)
            logger.info(f"User {user_id} connected to status WebSocket")
            
            # Start heartbeat for this connection
            asyncio.create_task(self._heartbeat_connection(user_id))
            
        except Exception as e:
            logger.error(f"Error connecting user {user_id}: {e}")
            raise

    async def _heartbeat_connection(self, user_id: int):
        """Send periodic heartbeat to keep connection alive"""
        try:
            while user_id in self.active_connections:
                await asyncio.sleep(self.heartbeat_interval)
                if user_id in self.active_connections:
                    websocket = self.active_connections[user_id]
                    if websocket.client_state.value < 3:  # Connection still open
                        try:
                            await websocket.send_text(json.dumps({
                                "type": "heartbeat",
                                "timestamp": datetime.now(timezone.utc).isoformat()
                            }))
                        except Exception as e:
                            logger.warning(f"Heartbeat failed for user {user_id}: {e}")
                            break
                    else:
                        logger.warning(f"WebSocket closed for user {user_id}, stopping heartbeat")
                        break
        except asyncio.CancelledError:
            logger.info(f"Heartbeat cancelled for user {user_id}")
        except Exception as e:
            logger.error(f"Error in heartbeat for user {user_id}: {e}")

    def disconnect(self, user_id: int):
        """Disconnect user from status WebSocket"""
        try:
            if user_id in self.active_connections:
                del self.active_connections[user_id]
                logger.info(f"User {user_id} disconnected from status WebSocket")
            
            if user_id in self.connection_timestamps:
                del self.connection_timestamps[user_id]
            
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

    async def send_personal_message_json(self, message: dict, user_id: int):
        """Send JSON message to specific user"""
        if user_id in self.active_connections:
            try:
                websocket = self.active_connections[user_id]
                if websocket.client_state.value < 3:  # Check if connection is still open
                    await websocket.send_json(message)
                    logger.info(f"JSON message sent to user {user_id}")
                else:
                    logger.warning(f"WebSocket for user {user_id} is closed, removing")
                    self.disconnect(user_id)
            except Exception as e:
                logger.error(f"Error sending JSON message to user {user_id}: {e}")
                self.disconnect(user_id)

    async def broadcast(self, message: str):
        """Broadcast message to all connected users"""
        disconnected_users = []
        for user_id, websocket in self.active_connections.items():
            try:
                if websocket.client_state.value < 3:  # Check if connection is still open
                    await websocket.send_text(message)
                else:
                    disconnected_users.append(user_id)
            except Exception as e:
                logger.error(f"Error broadcasting to user {user_id}: {e}")
                disconnected_users.append(user_id)
        
        # Remove disconnected users
        for user_id in disconnected_users:
            self.disconnect(user_id)

    async def broadcast_json(self, message: dict):
        """Broadcast JSON message to all connected users"""
        disconnected_users = []
        for user_id, websocket in self.active_connections.items():
            try:
                if websocket.client_state.value < 3:  # Check if connection is still open
                    await websocket.send_json(message)
                else:
                    disconnected_users.append(user_id)
            except Exception as e:
                logger.error(f"Error broadcasting JSON to user {user_id}: {e}")
                disconnected_users.append(user_id)
        
        # Remove disconnected users
        for user_id in disconnected_users:
            self.disconnect(user_id)

    async def add_to_room(self, room_id: int, user_id: int, websocket: WebSocket):
        """Add user to a chat room"""
        async with self._get_or_create_room_lock(room_id):
            if room_id not in self.room_connections:
                self.room_connections[room_id] = {}
            
            self.room_connections[room_id][user_id] = websocket
            self.user_rooms[user_id] = room_id
            logger.info(f"User {user_id} added to room {room_id}")

    async def remove_from_room(self, room_id: int, user_id: int):
        """Remove user from a chat room"""
        async with self._get_or_create_room_lock(room_id):
            if room_id in self.room_connections and user_id in self.room_connections[room_id]:
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

    async def send_room_message(self, room_id: int, message: str, exclude_user: Optional[int] = None):
        """Send message to all users in a room"""
        if room_id in self.room_connections:
            async with self._get_or_create_room_lock(room_id):
                disconnected_users = []
                for user_id, websocket in self.room_connections[room_id].items():
                    if user_id != exclude_user:
                        try:
                            if websocket.client_state.value < 3:  # Check if connection is still open
                                await websocket.send_text(message)
                            else:
                                disconnected_users.append(user_id)
                        except Exception as e:
                            logger.error(f"Error sending room message to user {user_id}: {e}")
                            disconnected_users.append(user_id)
                
                # Remove disconnected users
                for user_id in disconnected_users:
                    await self.remove_from_room(room_id, user_id)

    async def send_room_message_json(self, room_id: int, message: dict, exclude_user: Optional[int] = None):
        """Send JSON message to all users in a room"""
        if room_id in self.room_connections:
            async with self._get_or_create_room_lock(room_id):
                disconnected_users = []
                for user_id, websocket in self.room_connections[room_id].items():
                    if user_id != exclude_user:
                        try:
                            if websocket.client_state.value < 3:  # Check if connection is still open
                                await websocket.send_json(message)
                            else:
                                disconnected_users.append(user_id)
                        except Exception as e:
                            logger.error(f"Error sending room JSON message to user {user_id}: {e}")
                            disconnected_users.append(user_id)
                
                # Remove disconnected users
                for user_id in disconnected_users:
                    await self.remove_from_room(room_id, user_id)

    def get_room_users(self, room_id: int) -> List[int]:
        """Get list of user IDs in a room"""
        if room_id in self.room_connections:
            return list(self.room_connections[room_id].keys())
        return []

    def get_user_room(self, user_id: int) -> Optional[int]:
        """Get room ID for a user"""
        return self.user_rooms.get(user_id)

    def get_connection_count(self) -> int:
        """Get total number of active connections"""
        return len(self.active_connections)

    def get_room_count(self) -> int:
        """Get total number of active rooms"""
        return len(self.room_connections)

    def get_connection_info(self) -> dict:
        """Get detailed connection information"""
        return {
            "total_connections": len(self.active_connections),
            "total_rooms": len(self.room_connections),
            "active_users": list(self.active_connections.keys()),
            "active_rooms": list(self.room_connections.keys()),
            "connection_timestamps": {
                str(user_id): timestamp.isoformat() 
                for user_id, timestamp in self.connection_timestamps.items()
            }
        }

# Global instance
manager = ConnectionManager()
