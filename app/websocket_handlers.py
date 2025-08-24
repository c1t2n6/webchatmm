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
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating connection: {e}")
            await self.websocket.close(code=4000, reason=f"Validation error: {str(e)}")
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
            
            if self.room.user1_id != self.user.id and self.room.user2_id != self.user.id:
                logger.error(f"User {self.user.id} not authorized for room {self.room_id}")
                await self.websocket.close(code=4006, reason="Not authorized for this room")
                return False
            
            logger.info(f"User {self.user.id} access granted to room {self.room_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error validating room access: {e}")
            await self.websocket.close(code=4000, reason=f"Room validation error: {str(e)}")
            return False

    async def add_to_room(self) -> bool:
        """Add user to the room"""
        try:
            logger.info(f"Adding user {self.user_id} to room {self.room_id}")
            
            # Check if user is already in this room
            if manager.is_user_in_room(self.user_id, self.room_id):
                logger.warning(f"User {self.user_id} already in room {self.room_id}")
                return True
            
            # Add to room
            success = await manager.add_to_room(self.room_id, self.websocket, self.user_id)
            if not success:
                logger.error(f"Failed to add user {self.user_id} to room {self.room_id}")
                return False
            
            # Verify user was added
            room_info = manager.get_room_info(self.room_id)
            logger.info(f"Room {self.room_id} info after adding user: {room_info}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error adding user {self.user_id} to room {self.room_id}: {e}")
            return False

    async def send_welcome_message(self):
        """Send welcome message to user"""
        try:
            welcome_message = {
                "type": "connection",
                "message": "Connected to chat room",
                "room_id": self.room_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "user_info": {
                    "user_id": self.user_id,
                    "username": self.username
                }
            }
            
            await self.websocket.send_text(json.dumps(welcome_message))
            logger.info(f"Welcome message sent to user {self.user_id}")
            
        except Exception as e:
            logger.error(f"Error sending welcome message: {e}")

    async def handle_message(self, message_data: dict) -> bool:
        """Handle incoming message from user"""
        try:
            message_type = message_data.get("type")
            if not message_type:
                logger.error(f"Missing message type: {message_data}")
                return False
            
            logger.info(f"Processing message type: {message_type} from user {self.user_id}")
            
            if message_type == "message":
                return await self._handle_chat_message(message_data)
            elif message_type == "typing":
                return await self._handle_typing_indicator(message_data)
            elif message_type == "stop_typing":
                return await self._handle_stop_typing_indicator(message_data)
            elif message_type == "like_response":
                return await self._handle_like_response(message_data)
            elif message_type == "heartbeat":
                return await self._handle_heartbeat()
            else:
                logger.warning(f"Unknown message type: {message_type}")
                return False
                
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            return False

    async def _handle_chat_message(self, message_data: dict) -> bool:
        """Handle chat message"""
        try:
            content = message_data.get("content")
            if not content or not content.strip():
                logger.warning(f"Empty message content from user {self.user_id}")
                return False
            
            # Save message to database
            message = Message(
                room_id=self.room_id,
                user_id=self.user_id,
                content=content.strip(),
                timestamp=datetime.now(timezone.utc)
            )
            self.db.add(message)
            
            # Update room's last message time
            self.room.last_message_time = datetime.now(timezone.utc)
            
            self.db.commit()
            
            # Create message JSON for broadcasting
            message_json = json.dumps({
                "type": "message",
                "message_id": message.id,
                "user_id": self.user_id,
                "username": self.username,
                "content": content.strip(),
                "timestamp": message.timestamp.isoformat()
            })
            
            # Broadcast message to room
            await manager.broadcast_to_room(message_json, self.room_id)
            logger.info(f"Message broadcasted to room {self.room_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error handling chat message: {e}")
            self.db.rollback()
            return False

    async def _handle_typing_indicator(self, message_data: dict) -> bool:
        """Handle typing indicator"""
        try:
            is_typing = message_data.get("is_typing", False)
            
            typing_message = json.dumps({
                "type": "typing",
                "user_id": self.user_id,
                "username": self.username,
                "is_typing": is_typing,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            # Broadcast typing indicator to other users in room
            await manager.broadcast_to_room(typing_message, self.room_id, exclude_user=self.user_id)
            logger.info(f"Typing indicator broadcasted for user {self.user_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error handling typing indicator: {e}")
            return False

    async def _handle_stop_typing_indicator(self, message_data: dict) -> bool:
        """Handle stop typing indicator"""
        try:
            stop_typing_message = json.dumps({
                "type": "stop_typing",
                "user_id": self.user_id,
                "username": self.username,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            # Broadcast stop typing indicator to other users in room
            await manager.broadcast_to_room(stop_typing_message, self.room_id, exclude_user=self.user_id)
            logger.info(f"Stop typing indicator broadcasted for user {self.user_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error handling stop typing indicator: {e}")
            return False

    async def _handle_like_response(self, message_data: dict) -> bool:
        """Handle like response"""
        try:
            response = message_data.get("response")
            if response not in ["yes", "no"]:
                logger.warning(f"Invalid like response: {response}")
                return False
            
            # Update room like responses
            like_responses = json.loads(self.room.like_responses) if self.room.like_responses else {}
            user_key = "user1" if self.user_id == self.room.user1_id else "user2"
            like_responses[user_key] = response
            
            self.room.like_responses = json.dumps(like_responses)
            
            # Check if both users have responded
            if len(like_responses) == 2:
                user1_response = like_responses.get("user1")
                user2_response = like_responses.get("user2")
                
                if user1_response == "yes" and user2_response == "yes":
                    # Both like each other - increase reveal level
                    self.room.reveal_level = min(self.room.reveal_level + 1, 2)
                elif user1_response == "no" or user2_response == "no":
                    # One or both don't like - room will be ended
                    pass
            
            self.db.commit()
            
            # Broadcast like response to room
            like_message = json.dumps({
                "type": "like_response",
                "user_id": self.user_id,
                "username": self.username,
                "response": response,
                "reveal_level": self.room.reveal_level,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            await manager.broadcast_to_room(like_message, self.room_id)
            logger.info(f"Like response broadcasted for user {self.user_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error handling like response: {e}")
            self.db.rollback()
            return False

    async def _handle_heartbeat(self) -> bool:
        """Handle heartbeat message"""
        try:
            heartbeat_response = {
                "type": "heartbeat",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "room_id": self.room_id
            }
            
            await self.websocket.send_text(json.dumps(heartbeat_response))
            return True
            
        except Exception as e:
            logger.error(f"Error handling heartbeat: {e}")
            return False

    async def cleanup(self):
        """Cleanup resources when connection ends"""
        try:
            if self.user_id and self.room_id:
                try:
                    await manager.remove_from_room(self.room_id, self.user_id)
                    await manager.cleanup_user_from_database(self.user_id, self.room_id)
                    logger.info(f"Cleaned up user {self.user_id} from room {self.room_id}")
                except Exception as e:
                    logger.warning(f"Error during manager cleanup: {e}")
            
            # Close database session if exists
            if self.db:
                try:
                    self.db.close()
                    logger.info(f"Database session closed for user {self.user_id}")
                except Exception as e:
                    logger.warning(f"Error closing database session: {e}")
                
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            # Ensure database session is closed even on error
            if self.db:
                try:
                    self.db.close()
                except:
                    pass

async def handle_chat_websocket(websocket: WebSocket, room_id: int):
    """Handle chat WebSocket connection"""
    handler = WebSocketHandler(websocket, room_id)
    
    try:
        await websocket.accept()
        logger.info(f"WebSocket accepted for room {room_id}")
        
        # Validate connection
        if not await handler.validate_connection():
            return
        
        # Add user to room
        if not await handler.add_to_room():
            await websocket.close(code=4000, reason="Failed to add to room")
            return
        
        # Send welcome message
        await handler.send_welcome_message()
        
        logger.info(f"User {handler.user_id} successfully connected to room {room_id}")
        
        # Handle messages with proper error handling
        try:
            while True:
                try:
                    data = await websocket.receive_text()
                    logger.debug(f"Received raw data: {data}")
                    
                    message_data = json.loads(data)
                    logger.debug(f"Parsed message data: {message_data}")
                    
                    # Validate message format
                    if not isinstance(message_data, dict):
                        logger.error(f"Invalid message format: {message_data}")
                        continue
                    
                    # Handle message
                    await handler.handle_message(message_data)
                    
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error: {e}, data: {data}")
                    continue
                except WebSocketDisconnect:
                    logger.info(f"WebSocket disconnected for room {room_id}")
                    break
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    # Don't continue on critical errors
                    break
                    
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for room {room_id}")
        except Exception as e:
            logger.error(f"Error in message loop: {e}")
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for room {room_id}")
    except Exception as e:
        logger.error(f"WebSocket error in room {room_id}: {e}")
    finally:
        await handler.cleanup()

async def handle_status_websocket(websocket: WebSocket):
    """Handle status WebSocket connection"""
    handler = WebSocketHandler(websocket)
    
    try:
        await websocket.accept()
        logger.info("Status WebSocket accepted")
        
        # Validate connection
        if not await handler.validate_connection():
            return
        
        # Add to active connections
        await manager.connect(websocket, handler.user_id)
        
        # Send initial status
        status_message = {
            "type": "status_update",
            "user_id": handler.user_id,
            "status": handler.user.status,
            "current_room_id": handler.user.current_room_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await websocket.send_text(json.dumps(status_message))
        
        # Keep connection alive with heartbeat - with proper error handling
        try:
            while True:
                try:
                    data = await websocket.receive_text()
                    message_data = json.loads(data)
                    
                    if message_data.get("type") == "heartbeat":
                        await handler._handle_heartbeat()
                        
                except json.JSONDecodeError:
                    # Send heartbeat response anyway
                    await handler._handle_heartbeat()
                except WebSocketDisconnect:
                    logger.info("Status WebSocket disconnected")
                    break
                except Exception as e:
                    logger.error(f"Error in status WebSocket: {e}")
                    break
                    
        except WebSocketDisconnect:
            logger.info("Status WebSocket disconnected")
        except Exception as e:
            logger.error(f"Error in status message loop: {e}")
                
    except WebSocketDisconnect:
        logger.info("Status WebSocket disconnected")
    except Exception as e:
        logger.error(f"Status WebSocket error: {e}")
    finally:
        if handler.user_id:
            manager.disconnect(handler.user_id)

def get_favicon_response():
    """Get favicon response"""
    # Return a simple 1x1 transparent PNG as favicon
    favicon_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x00\x00\x02\x00\x01\xe5\x27\xde\xfc\x00\x00\x00\x00IEND\xaeB`\x82'
    return Response(content=favicon_data, media_type="image/x-icon")
