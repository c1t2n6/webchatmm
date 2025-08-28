from fastapi import WebSocket, WebSocketDisconnect
from fastapi.responses import Response
import structlog
import json
from typing import Dict, Optional
from datetime import datetime, timezone, date

from .websocket_manager import manager
from .database import get_db
from .models import User, Room, Message
from .utils.auth_utils import verify_token

logger = structlog.get_logger()

class WebSocketHandler:
    """Centralized WebSocket handling with proper validation and error handling"""
    
    def __init__(self, websocket: WebSocket, room_id: int = None):
        self.websocket = websocket
        self.room_id = room_id
        self.user_id: Optional[int] = None
        self.username: Optional[str] = None
        self.user: Optional[User] = None
        self.room: Optional[Room] = None
        self.db = None

    async def validate_connection(self) -> bool:
        """Validate WebSocket connection and user permissions"""
        try:
            # Accept WebSocket connection first
            await self.websocket.accept()
            logger.info(f"WebSocket connection accepted for room {self.room_id}")
            
            # Get token from query parameters
            token = self.websocket.query_params.get("token")
            if not token:
                logger.error(f"Missing token for room {self.room_id}")
                await self.websocket.close(code=4001, reason="Missing token")
                return False
            
            # Verify token and get user
            logger.info(f"Verifying token for room {self.room_id}")
            token_data = verify_token(token)
            if not token_data:
                logger.error(f"Invalid token for room {self.room_id}")
                await self.websocket.close(code=4001, reason="Invalid token")
                return False
            
            logger.info(f"Token verified for user: {token_data.username}")
            
            # Get database session
            self.db = next(get_db())
            
            # Get user from database
            logger.info(f"Getting user from database: {token_data.username}")
            self.user = self.db.query(User).filter(User.username == token_data.username).first()
            if not self.user:
                logger.error(f"User not found: {token_data.username}")
                await self.websocket.close(code=4001, reason="User not found")
                return False
            
            # Check if user is banned
            if self.user.banned_until and self.user.banned_until > date.today():
                logger.error(f"User {self.user.id} is banned until {self.user.banned_until}")
                await self.websocket.close(code=4002, reason="Account banned")
                return False
            
            # Store user info
            self.user_id = self.user.id
            self.username = self.user.username
            
            logger.info(f"User found: {self.user.username}, ID: {self.user.id}, current_room_id: {self.user.current_room_id}")
            
            # Validate room access if this is a chat WebSocket
            if self.room_id:
                if not await self._validate_room_access():
                    return False
            
            # Send connection success message
            await self.websocket.send_json({
                "type": "connection_success",
                "message": "Connected successfully",
                "user_id": self.user_id,
                "username": self.username,
                "room_id": self.room_id,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating connection: {e}")
            try:
                await self.websocket.close(code=4000, reason=f"Validation error: {str(e)}")
            except:
                pass
            return False

    async def _validate_room_access(self) -> bool:
        """Validate user's access to the specific room"""
        try:
            # Check if user is in this room
            if self.user.current_room_id != self.room_id:
                logger.error(f"Access denied: user {self.user.id} not in room {self.room_id}")
                await self.websocket.close(code=4003, reason="Access denied to this room")
                return False
            
            # Verify room exists and user belongs to it
            self.room = self.db.query(Room).filter(Room.id == self.room_id).first()
            if not self.room:
                logger.error(f"Room {self.room_id} not found")
                await self.websocket.close(code=4004, reason="Room not found")
                return False
            
            # Check if room is still active
            if self.room.end_time:
                logger.error(f"Room {self.room_id} has already ended")
                await self.websocket.close(code=4005, reason="Room has ended")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating room access: {e}")
            return False

    async def handle_connection(self):
        """Main connection handling method"""
        try:
            if not await self.validate_connection():
                return
            
            # Add user to room if this is a chat WebSocket
            if self.room_id:
                await manager.add_to_room(self.room_id, self.user_id, self.websocket)
                logger.info(f"User {self.user_id} added to room {self.room_id}")
                
                # Notify other users in room
                await manager.send_room_message_json(
                    self.room_id,
                    {
                        "type": "user_joined",
                        "user_id": self.user_id,
                        "username": self.username,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    },
                    exclude_user=self.user_id
                )
            
            # Handle incoming messages
            await self._handle_messages()
            
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for user {self.user_id} in room {self.room_id}")
        except Exception as e:
            logger.error(f"Error in WebSocket connection: {e}")
        finally:
            await self._cleanup()

    async def _handle_messages(self):
        """Handle incoming WebSocket messages"""
        try:
            while True:
                # Receive message
                data = await self.websocket.receive_text()
                message_data = json.loads(data)
                
                logger.info(f"Received message from user {self.user_id}: {message_data}")
                
                # Handle different message types
                message_type = message_data.get("type")
                if message_type == "chat_message":
                    await self._handle_chat_message(message_data)
                elif message_type == "typing":
                    await self._handle_typing(message_data)
                elif message_type == "heartbeat":
                    await self._handle_heartbeat()
                else:
                    logger.warning(f"Unknown message type: {message_type}")
                    
        except WebSocketDisconnect:
            raise
        except Exception as e:
            logger.error(f"Error handling messages: {e}")
            await self.websocket.send_json({
                "type": "error",
                "message": "Error processing message",
                "error": str(e)
            })

    async def _handle_chat_message(self, message_data: dict):
        """Handle chat message"""
        try:
            content = message_data.get("content", "").strip()
            if not content:
                return
            
            # Save message to database
            message = Message(
                content=content,
                user_id=self.user_id,
                room_id=self.room_id,
                timestamp=datetime.now(timezone.utc)
            )
            self.db.add(message)
            self.db.commit()
            
            # Send message to all users in room
            message_json = {
                "type": "chat_message",
                "message_id": message.id,
                "content": content,
                "user_id": self.user_id,
                "username": self.username,
                "timestamp": message.timestamp.isoformat()
            }
            
            await manager.send_room_message_json(self.room_id, message_json)
            logger.info(f"Message sent to room {self.room_id}")
            
        except Exception as e:
            logger.error(f"Error handling chat message: {e}")
            self.db.rollback()

    async def _handle_typing(self, message_data: dict):
        """Handle typing indicator"""
        try:
            is_typing = message_data.get("is_typing", False)
            
            # Send typing indicator to other users in room
            typing_json = {
                "type": "typing",
                "user_id": self.user_id,
                "username": self.username,
                "is_typing": is_typing,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            await manager.send_room_message_json(self.room_id, typing_json, exclude_user=self.user_id)
            
        except Exception as e:
            logger.error(f"Error handling typing indicator: {e}")

    async def _handle_heartbeat(self):
        """Handle heartbeat message"""
        try:
            await self.websocket.send_json({
                "type": "heartbeat_response",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            logger.error(f"Error handling heartbeat: {e}")

    async def _cleanup(self):
        """Cleanup when connection ends"""
        try:
            if self.room_id and self.user_id:
                await manager.remove_from_room(self.room_id, self.user_id)
                logger.info(f"User {self.user_id} removed from room {self.room_id}")
                
                # Notify other users in room
                await manager.send_room_message_json(
                    self.room_id,
                    {
                        "type": "user_left",
                        "user_id": self.user_id,
                        "username": self.username,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    },
                    exclude_user=self.user_id
                )
            
            if self.db:
                self.db.close()
                
        except Exception as e:
            logger.error(f"Error in cleanup: {e}")

async def handle_chat_websocket(websocket: WebSocket, room_id: int):
    """Handle chat WebSocket connection"""
    handler = WebSocketHandler(websocket, room_id)
    await handler.handle_connection()

async def handle_status_websocket(websocket: WebSocket):
    """Handle status WebSocket connection"""
    try:
        await websocket.accept()
        logger.info("Status WebSocket connected")
        
        # Send initial status
        await websocket.send_json({
            "type": "status_connected",
            "message": "Status WebSocket connected",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Keep connection alive
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                if message_data.get("type") == "heartbeat":
                    await websocket.send_json({
                        "type": "heartbeat_response",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                    
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error in status WebSocket: {e}")
                break
                
    except WebSocketDisconnect:
        logger.info("Status WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in status WebSocket: {e}")

def get_favicon_response():
    """Get favicon response"""
    # Return a simple 1x1 transparent PNG as favicon
    favicon_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x00\x00\x02\x00\x01\xe5\x27\xde\xfc\x00\x00\x00\x00IEND\xaeB`\x82'
    return Response(content=favicon_data, media_type="image/x-icon")
