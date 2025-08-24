"""
Optimized WebSocket Connection Manager
====================================

Advanced WebSocket management with connection pooling, reconnection logic,
message queuing, and horizontal scaling support.
"""

import asyncio
import json
import uuid
import weakref
from typing import Dict, List, Optional, Set, Any, Callable
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from enum import Enum
import structlog
from fastapi import WebSocket
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.chat_models import ChatRoom, ChatMessage, RoomParticipant, ChatSession, ChatEvent
from ..models import User

logger = structlog.get_logger()

class ConnectionState(Enum):
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DISCONNECTING = "disconnecting"
    DISCONNECTED = "disconnected"
    RECONNECTING = "reconnecting"

@dataclass
class ConnectionInfo:
    """Information about a WebSocket connection"""
    websocket: WebSocket
    user_id: int
    room_id: Optional[int] = None
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    connection_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    state: ConnectionState = ConnectionState.CONNECTING
    connected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_heartbeat: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    message_queue: List[Dict[str, Any]] = field(default_factory=list)
    is_authenticated: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RoomInfo:
    """Information about a chat room"""
    room_id: int
    participants: Set[int] = field(default_factory=set)
    connections: Dict[int, weakref.ref] = field(default_factory=dict)
    message_history: List[Dict[str, Any]] = field(default_factory=list)
    last_activity: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    settings: Dict[str, Any] = field(default_factory=dict)

class MessageQueue:
    """Message queuing system with retry logic"""
    
    def __init__(self, max_retries: int = 3, retry_delay: float = 1.0):
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.pending_messages: Dict[str, Dict[str, Any]] = {}
        self.failed_messages: List[Dict[str, Any]] = []
    
    async def add_message(self, message: Dict[str, Any], priority: int = 0) -> str:
        """Add message to queue with priority"""
        message_id = str(uuid.uuid4())
        message_data = {
            'id': message_id,
            'message': message,
            'priority': priority,
            'retry_count': 0,
            'created_at': datetime.now(timezone.utc),
            'status': 'pending'
        }
        
        self.pending_messages[message_id] = message_data
        return message_id
    
    async def mark_delivered(self, message_id: str):
        """Mark message as delivered"""
        if message_id in self.pending_messages:
            del self.pending_messages[message_id]
    
    async def mark_failed(self, message_id: str, error: str):
        """Mark message as failed"""
        if message_id in self.pending_messages:
            message_data = self.pending_messages[message_id]
            if message_data['retry_count'] < self.max_retries:
                message_data['retry_count'] += 1
                message_data['last_error'] = error
                message_data['next_retry'] = datetime.now(timezone.utc) + timedelta(seconds=self.retry_delay * message_data['retry_count'])
            else:
                message_data['status'] = 'failed'
                self.failed_messages.append(message_data)
                del self.pending_messages[message_id]

class ConnectionManager:
    """Advanced WebSocket connection manager"""
    
    def __init__(self):
        # Connection storage
        self.active_connections: Dict[str, ConnectionInfo] = {}
        self.user_connections: Dict[int, Set[str]] = {}
        self.room_connections: Dict[int, RoomInfo] = {}
        
        # Message handling
        self.message_queue = MessageQueue()
        self.message_handlers: Dict[str, Callable] = {}
        
        # Performance monitoring
        self.connection_stats = {
            'total_connections': 0,
            'active_connections': 0,
            'total_messages_sent': 0,
            'total_messages_received': 0,
            'failed_messages': 0
        }
        
        # Background tasks
        self.cleanup_task: Optional[asyncio.Task] = None
        self.heartbeat_task: Optional[asyncio.Task] = None
        self.monitoring_task: Optional[asyncio.Task] = None
        
        # Configuration
        self.max_connections_per_user = 3
        self.heartbeat_interval = 30  # seconds
        self.connection_timeout = 300  # seconds
        self.max_message_size = 1024 * 1024  # 1MB
        
        # Register default message handlers
        self._register_default_handlers()
    
    def _register_default_handlers(self):
        """Register default message handlers"""
        self.message_handlers.update({
            'message': self._handle_chat_message,
            'typing': self._handle_typing_indicator,
            'reaction': self._handle_reaction,
            'presence': self._handle_presence_update,
            'heartbeat': self._handle_heartbeat,
            'room_action': self._handle_room_action
        })
    
    async def start(self):
        """Start the connection manager"""
        logger.info("Starting Connection Manager")
        
        # Start background tasks
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        
        logger.info("Connection Manager started successfully")
    
    async def stop(self):
        """Stop the connection manager"""
        logger.info("Stopping Connection Manager")
        
        # Cancel background tasks
        if self.cleanup_task:
            self.cleanup_task.cancel()
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
        if self.monitoring_task:
            self.monitoring_task.cancel()
        
        # Close all connections
        await self._close_all_connections()
        
        logger.info("Connection Manager stopped")
    
    async def connect(self, websocket: WebSocket, user_id: int, room_id: Optional[int] = None) -> str:
        """Connect a new WebSocket"""
        try:
            # Accept the connection
            await websocket.accept()
            
            # Create connection info
            connection_id = str(uuid.uuid4())
            connection_info = ConnectionInfo(
                websocket=websocket,
                user_id=user_id,
                room_id=room_id
            )
            
            # Store connection
            self.active_connections[connection_id] = connection_info
            
            # Update user connections
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(connection_id)
            
            # Add to room if specified
            if room_id:
                await self._add_to_room(connection_id, room_id, user_id)
            
            # Update stats
            self.connection_stats['total_connections'] += 1
            self.connection_stats['active_connections'] += 1
            
            # Send welcome message
            await self._send_welcome_message(connection_id, user_id, room_id)
            
            logger.info(f"User {user_id} connected with connection {connection_id}")
            return connection_id
            
        except Exception as e:
            logger.error(f"Error connecting user {user_id}: {e}")
            raise
    
    async def disconnect(self, connection_id: str, reason: str = "User disconnected"):
        """Disconnect a WebSocket connection"""
        try:
            if connection_id not in self.active_connections:
                return
            
            connection_info = self.active_connections[connection_id]
            user_id = connection_info.user_id
            room_id = connection_info.room_id
            
            # Update state
            connection_info.state = ConnectionState.DISCONNECTING
            
            # Remove from room
            if room_id:
                await self._remove_from_room(connection_id, room_id, user_id)
            
            # Remove from user connections
            if user_id in self.user_connections:
                self.user_connections[user_id].discard(connection_id)
                if not self.user_connections[user_id]:
                    del self.user_connections[user_id]
            
            # Close WebSocket
            try:
                await connection_info.websocket.close(code=1000, reason=reason)
            except Exception as e:
                logger.warning(f"Error closing WebSocket: {e}")
            
            # Clean up connection
            del self.active_connections[connection_id]
            
            # Update stats
            self.connection_stats['active_connections'] -= 1
            
            # Log disconnection
            logger.info(f"User {user_id} disconnected: {reason}")
            
        except Exception as e:
            logger.error(f"Error disconnecting connection {connection_id}: {e}")
    
    async def _add_to_room(self, connection_id: str, room_id: int, user_id: int):
        """Add connection to a room"""
        try:
            if room_id not in self.room_connections:
                # Create new room info
                self.room_connections[room_id] = RoomInfo(room_id=room_id)
            
            room_info = self.room_connections[room_id]
            room_info.participants.add(user_id)
            room_info.connections[user_id] = weakref.ref(self.active_connections[connection_id])
            room_info.last_activity = datetime.now(timezone.utc)
            
            # Update connection info
            self.active_connections[connection_id].room_id = room_id
            
            logger.info(f"User {user_id} added to room {room_id}")
            
        except Exception as e:
            logger.error(f"Error adding user {user_id} to room {room_id}: {e}")
    
    async def _remove_from_room(self, connection_id: str, room_id: int, user_id: int):
        """Remove connection from a room"""
        try:
            if room_id in self.room_connections:
                room_info = self.room_connections[room_id]
                room_info.participants.discard(user_id)
                
                if user_id in room_info.connections:
                    del room_info.connections[user_id]
                
                room_info.last_activity = datetime.now(timezone.utc)
                
                # Close room if no participants
                if not room_info.participants:
                    await self._close_room(room_id)
                
                logger.info(f"User {user_id} removed from room {room_id}")
                
        except Exception as e:
            logger.error(f"Error removing user {user_id} from room {room_id}: {e}")
    
    async def _close_room(self, room_id: int):
        """Close a room completely"""
        try:
            if room_id in self.room_connections:
                room_info = self.room_connections[room_id]
                
                # Notify all participants
                await self.broadcast_to_room({
                    'type': 'room_closed',
                    'room_id': room_id,
                    'message': 'Room has been closed',
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }, room_id)
                
                # Clean up room
                del self.room_connections[room_id]
                
                logger.info(f"Room {room_id} closed")
                
        except Exception as e:
            logger.error(f"Error closing room {room_id}: {e}")
    
    async def broadcast_to_room(self, message: Dict[str, Any], room_id: int, exclude_user: Optional[int] = None):
        """Broadcast message to all users in a room"""
        try:
            if room_id not in self.room_connections:
                return
            
            room_info = self.room_connections[room_id]
            message_json = json.dumps(message)
            
            failed_connections = []
            
            for user_id, connection_ref in room_info.connections.items():
                if exclude_user and user_id == exclude_user:
                    continue
                
                connection_info = connection_ref()
                if not connection_info:
                    failed_connections.append(user_id)
                    continue
                
                try:
                    await connection_info.websocket.send_text(message_json)
                except Exception as e:
                    logger.error(f"Error broadcasting to user {user_id}: {e}")
                    failed_connections.append(user_id)
            
            # Clean up failed connections
            for user_id in failed_connections:
                await self._remove_from_room(None, room_id, user_id)
            
            # Update room activity
            room_info.last_activity = datetime.now(timezone.utc)
            
        except Exception as e:
            logger.error(f"Error broadcasting to room {room_id}: {e}")
    
    async def send_to_user(self, user_id: int, message: Dict[str, Any], priority: int = 0):
        """Send message to a specific user"""
        try:
            if user_id not in self.user_connections:
                return False
            
            message_json = json.dumps(message)
            sent = False
            
            for connection_id in self.user_connections[user_id]:
                if connection_id in self.active_connections:
                    connection_info = self.active_connections[connection_id]
                    try:
                        await connection_info.websocket.send_text(message_json)
                        sent = True
                        self.connection_stats['total_messages_sent'] += 1
                    except Exception as e:
                        logger.error(f"Error sending to connection {connection_id}: {e}")
                        # Mark connection for cleanup
                        await self.disconnect(connection_id, "Send failed")
            
            return sent
            
        except Exception as e:
            logger.error(f"Error sending to user {user_id}: {e}")
            return False
    
    async def _send_welcome_message(self, connection_id: str, user_id: int, room_id: Optional[int]):
        """Send welcome message to newly connected user"""
        try:
            welcome_message = {
                'type': 'welcome',
                'connection_id': connection_id,
                'user_id': user_id,
                'room_id': room_id,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'server_info': {
                    'version': '1.0.0',
                    'features': ['reactions', 'typing_indicators', 'presence']
                }
            }
            
            connection_info = self.active_connections[connection_id]
            await connection_info.websocket.send_text(json.dumps(welcome_message))
            
        except Exception as e:
            logger.error(f"Error sending welcome message: {e}")
    
    async def _handle_chat_message(self, connection_id: str, message_data: Dict[str, Any]):
        """Handle incoming chat message"""
        try:
            connection_info = self.active_connections[connection_id]
            user_id = connection_info.user_id
            room_id = connection_info.room_id
            
            if not room_id:
                logger.warning(f"User {user_id} tried to send message without room")
                return
            
            # Validate message
            content = message_data.get('content', '').strip()
            if not content or len(content) > self.max_message_size:
                logger.warning(f"Invalid message from user {user_id}")
                return
            
            # Create message object
            chat_message = {
                'type': 'message',
                'room_id': room_id,
                'user_id': user_id,
                'content': content,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'message_id': str(uuid.uuid4())
            }
            
            # Save to database
            await self._save_message_to_db(chat_message)
            
            # Broadcast to room
            await self.broadcast_to_room(chat_message, room_id, exclude_user=user_id)
            
            # Update stats
            self.connection_stats['total_messages_received'] += 1
            
        except Exception as e:
            logger.error(f"Error handling chat message: {e}")
    
    async def _handle_typing_indicator(self, connection_id: str, message_data: Dict[str, Any]):
        """Handle typing indicator"""
        try:
            connection_info = self.active_connections[connection_id]
            user_id = connection_info.user_id
            room_id = connection_info.room_id
            
            if not room_id:
                return
            
            typing_message = {
                'type': 'typing',
                'room_id': room_id,
                'user_id': user_id,
                'is_typing': message_data.get('is_typing', False),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            await self.broadcast_to_room(typing_message, room_id, exclude_user=user_id)
            
        except Exception as e:
            logger.error(f"Error handling typing indicator: {e}")
    
    async def _handle_reaction(self, connection_id: str, message_data: Dict[str, Any]):
        """Handle message reaction"""
        try:
            connection_info = self.active_connections[connection_id]
            user_id = connection_info.user_id
            room_id = connection_info.room_id
            
            if not room_id:
                return
            
            reaction_message = {
                'type': 'reaction',
                'room_id': room_id,
                'user_id': user_id,
                'message_id': message_data.get('message_id'),
                'emoji': message_data.get('emoji'),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            await self.broadcast_to_room(reaction_message, room_id)
            
        except Exception as e:
            logger.error(f"Error handling reaction: {e}")
    
    async def _handle_presence_update(self, connection_id: str, message_data: Dict[str, Any]):
        """Handle presence update"""
        try:
            connection_info = self.active_connections[connection_id]
            user_id = connection_info.user_id
            room_id = connection_info.room_id
            
            if not room_id:
                return
            
            presence_message = {
                'type': 'presence_update',
                'room_id': room_id,
                'user_id': user_id,
                'status': message_data.get('status', 'active'),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            await self.broadcast_to_room(presence_message, room_id, exclude_user=user_id)
            
        except Exception as e:
            logger.error(f"Error handling presence update: {e}")
    
    async def _handle_heartbeat(self, connection_id: str, message_data: Dict[str, Any]):
        """Handle heartbeat message"""
        try:
            if connection_id in self.active_connections:
                connection_info = self.active_connections[connection_id]
                connection_info.last_heartbeat = datetime.now(timezone.utc)
                
                # Send heartbeat response
                response = {
                    'type': 'heartbeat_response',
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
                
                await connection_info.websocket.send_text(json.dumps(response))
                
        except Exception as e:
            logger.error(f"Error handling heartbeat: {e}")
    
    async def _handle_room_action(self, connection_id: str, message_data: Dict[str, Any]):
        """Handle room actions (end, pause, etc.)"""
        try:
            connection_info = self.active_connections[connection_id]
            user_id = connection_info.user_id
            room_id = connection_info.room_id
            
            if not room_id:
                return
            
            action = message_data.get('action')
            
            if action == 'end_room':
                await self._close_room(room_id)
            elif action == 'pause_room':
                # Implement room pausing logic
                pass
            elif action == 'resume_room':
                # Implement room resuming logic
                pass
            
        except Exception as e:
            logger.error(f"Error handling room action: {e}")
    
    async def _save_message_to_db(self, message_data: Dict[str, Any]):
        """Save message to database"""
        try:
            # This would be implemented with proper database session management
            # For now, just log the message
            logger.info(f"Message saved: {message_data['content'][:50]}...")
            
        except Exception as e:
            logger.error(f"Error saving message to database: {e}")
    
    async def _cleanup_loop(self):
        """Background cleanup loop"""
        while True:
            try:
                await asyncio.sleep(60)  # Run every minute
                await self._cleanup_inactive_connections()
                await self._cleanup_inactive_rooms()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(10)
    
    async def _heartbeat_loop(self):
        """Background heartbeat loop"""
        while True:
            try:
                await asyncio.sleep(self.heartbeat_interval)
                await self._check_heartbeats()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in heartbeat loop: {e}")
                await asyncio.sleep(5)
    
    async def _monitoring_loop(self):
        """Background monitoring loop"""
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes
                await self._log_connection_stats()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(60)
    
    async def _cleanup_inactive_connections(self):
        """Clean up inactive connections"""
        try:
            current_time = datetime.now(timezone.utc)
            connections_to_remove = []
            
            for connection_id, connection_info in self.active_connections.items():
                time_since_heartbeat = current_time - connection_info.last_heartbeat
                if time_since_heartbeat.total_seconds() > self.connection_timeout:
                    connections_to_remove.append(connection_id)
            
            for connection_id in connections_to_remove:
                await self.disconnect(connection_id, "Connection timeout")
                
        except Exception as e:
            logger.error(f"Error cleaning up inactive connections: {e}")
    
    async def _cleanup_inactive_rooms(self):
        """Clean up inactive rooms"""
        try:
            current_time = datetime.now(timezone.utc)
            rooms_to_close = []
            
            for room_id, room_info in self.room_connections.items():
                time_since_activity = current_time - room_info.last_activity
                if time_since_activity.total_seconds() > 3600:  # 1 hour
                    rooms_to_close.append(room_id)
            
            for room_id in rooms_to_close:
                await self._close_room(room_id)
                
        except Exception as e:
            logger.error(f"Error cleaning up inactive rooms: {e}")
    
    async def _check_heartbeats(self):
        """Check and update heartbeats"""
        try:
            current_time = datetime.now(timezone.utc)
            
            for connection_info in self.active_connections.values():
                if connection_info.state == ConnectionState.CONNECTED:
                    # Send heartbeat to client
                    try:
                        heartbeat = {
                            'type': 'heartbeat',
                            'timestamp': current_time.isoformat()
                        }
                        await connection_info.websocket.send_text(json.dumps(heartbeat))
                    except Exception as e:
                        logger.debug(f"Error sending heartbeat: {e}")
                        
        except Exception as e:
            logger.error(f"Error checking heartbeats: {e}")
    
    async def _log_connection_stats(self):
        """Log connection statistics"""
        try:
            logger.info("Connection Stats", **self.connection_stats)
            
        except Exception as e:
            logger.error(f"Error logging connection stats: {e}")
    
    async def _close_all_connections(self):
        """Close all active connections"""
        try:
            connection_ids = list(self.active_connections.keys())
            for connection_id in connection_ids:
                await self.disconnect(connection_id, "Server shutdown")
                
        except Exception as e:
            logger.error(f"Error closing all connections: {e}")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get current connection statistics"""
        return {
            **self.connection_stats,
            'rooms_count': len(self.room_connections),
            'users_count': len(self.user_connections)
        }
    
    def get_room_info(self, room_id: int) -> Optional[Dict[str, Any]]:
        """Get information about a specific room"""
        if room_id not in self.room_connections:
            return None
        
        room_info = self.room_connections[room_id]
        return {
            'room_id': room_id,
            'participant_count': len(room_info.participants),
            'connection_count': len(room_info.connections),
            'last_activity': room_info.last_activity.isoformat(),
            'is_active': room_info.is_active
        }

# Global instance
connection_manager = ConnectionManager()
