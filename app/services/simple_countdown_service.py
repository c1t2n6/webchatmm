"""
Simple Countdown & Notification Service
Hệ thống đơn giản hóa với state machine pattern
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Optional
from dataclasses import dataclass

from app.database import get_db
from app.models import Room, User
from app.websocket_manager import manager

logger = logging.getLogger(__name__)

class RoomPhase(Enum):
    IDLE = "idle"
    COUNTDOWN = "countdown" 
    NOTIFICATION = "notification"
    ENDED = "ended"

@dataclass
class RoomState:
    room_id: int
    phase: RoomPhase = RoomPhase.IDLE
    countdown_remaining: int = 0
    notification_remaining: int = 0
    user_responses: Dict[str, str] = None
    task: Optional[asyncio.Task] = None
    
    def __post_init__(self):
        if self.user_responses is None:
            self.user_responses = {}

class SimpleCountdownService:
    """Service đơn giản với state machine pattern"""
    
    def __init__(self):
        self.rooms: Dict[int, RoomState] = {}
        self.COUNTDOWN_DURATION = 15
        self.NOTIFICATION_DURATION = 30
    
    async def start_countdown(self, room_id: int) -> bool:
        """Bắt đầu countdown cho room"""
        try:
            logger.info(f"🚀 Starting countdown for room {room_id}")
            
            # Validate room
            if not await self._validate_room(room_id):
                logger.error(f"❌ Room {room_id} validation failed")
                return False
            
            # Cancel existing process
            await self._cancel_room_process(room_id)
            
            # Create new room state
            self.rooms[room_id] = RoomState(room_id=room_id)
            logger.info(f"📝 Created room state for room {room_id}")
            
            # Start countdown phase
            await self._start_countdown_phase(room_id)
            
            logger.info(f"✅ Countdown started for room {room_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error starting countdown for room {room_id}: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            return False
    
    async def _start_countdown_phase(self, room_id: int):
        """Bắt đầu phase countdown"""
        state = self.rooms[room_id]
        state.phase = RoomPhase.COUNTDOWN
        state.countdown_remaining = self.COUNTDOWN_DURATION
        
        # Send countdown start message
        await self._send_websocket_message(room_id, {
            "type": "countdown_start",
            "room_id": room_id,
            "duration": self.COUNTDOWN_DURATION
        })
        
        # Start countdown task
        state.task = asyncio.create_task(self._run_countdown(room_id))
    
    async def _run_countdown(self, room_id: int):
        """Chạy countdown timer"""
        try:
            state = self.rooms[room_id]
            
            # Countdown loop - sửa timing để đảm bảo chính xác 1 giây
            while state.countdown_remaining > 0:
                # Gửi update trước khi sleep để frontend nhận được ngay
                await self._send_websocket_message(room_id, {
                    "type": "countdown_update",
                    "room_id": room_id,
                    "remaining": state.countdown_remaining
                })
                
                # Sleep 1 giây chính xác
                await asyncio.sleep(1)
                state.countdown_remaining -= 1
            
            # Countdown finished, start notification
            await self._start_notification_phase(room_id)
            
        except asyncio.CancelledError:
            logger.info(f"Countdown cancelled for room {room_id}")
        except Exception as e:
            logger.error(f"❌ Error in countdown for room {room_id}: {e}")
    
    async def _start_notification_phase(self, room_id: int):
        """Bắt đầu phase notification"""
        logger.info(f"🔔 Starting notification phase for room {room_id}")
        
        state = self.rooms[room_id]
        state.phase = RoomPhase.NOTIFICATION
        state.notification_remaining = self.NOTIFICATION_DURATION
        
        # Get users to notify
        users_to_notify = await self._get_users_to_notify(room_id)
        logger.info(f"Users to notify for room {room_id}: {users_to_notify}")
        
        if not users_to_notify:
            logger.info(f"No users to notify for room {room_id} - all users already kept active")
            # Nếu không có user nào cần notify, kiểm tra xem cả 2 đã keep active chưa
            if await self._both_users_responded_yes(room_id):
                await self._keep_room(room_id)
            else:
                await self._end_room(room_id, "no_users_to_notify")
            return
        
        # Send notification cho TẤT CẢ users trong room (không chỉ những user cần thiết)
        # Vì notification cần hiển thị cho cả 2 để họ có thể phản hồi
        try:
            db = next(get_db())
            try:
                room = db.query(Room).filter(Room.id == room_id).first()
                if room:
                    logger.info(f"📤 Sending notifications to users {room.user1_id} and {room.user2_id} for room {room_id}")
                    
                    # Gửi notification_show message trước
                    logger.info(f"📤 Sending notification_show message for room {room_id}")
                    await self._send_websocket_message(room_id, {
                        "type": "notification_show",
                        "room_id": room_id,
                        "timeout": self.NOTIFICATION_DURATION,
                        "message": "Bạn có muốn tiếp tục cuộc trò chuyện với người này không?"
                    })
                    
                    # Sau đó gửi personal notifications
                    await self._send_personal_notification(room_id, room.user1_id, self.NOTIFICATION_DURATION)
                    await self._send_personal_notification(room_id, room.user2_id, self.NOTIFICATION_DURATION)
                    logger.info(f"✅ Notifications sent to both users for room {room_id}")
                else:
                    logger.error(f"Room {room_id} not found for notification")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error sending notifications for room {room_id}: {e}")
            # Fallback: gửi broadcast
            logger.info(f"📤 Sending fallback broadcast notification for room {room_id}")
            await self._send_websocket_message(room_id, {
                "type": "notification_show",
                "room_id": room_id,
                "timeout": self.NOTIFICATION_DURATION,
                "message": "Bạn có muốn tiếp tục cuộc trò chuyện với người này không?"
            })
        
        # Start notification timeout
        state.task = asyncio.create_task(self._run_notification_timeout(room_id))
        logger.info(f"⏰ Notification timeout started for room {room_id}")
    
    async def _run_notification_timeout(self, room_id: int):
        """Chạy notification timeout"""
        try:
            state = self.rooms[room_id]
            
            # Notification timeout loop - sửa timing để đảm bảo chính xác 1 giây
            while state.notification_remaining > 0:
                # Gửi update trước khi sleep để frontend nhận được ngay
                await self._send_websocket_message(room_id, {
                    "type": "notification_update",
                    "room_id": room_id,
                    "remaining": state.notification_remaining
                })
                
                # Sleep 1 giây chính xác
                await asyncio.sleep(1)
                state.notification_remaining -= 1
            
            # Timeout reached, check responses
            await self._check_responses_and_end(room_id)
            
        except asyncio.CancelledError:
            logger.info(f"Notification timeout cancelled for room {room_id}")
        except Exception as e:
            logger.error(f"❌ Error in notification timeout for room {room_id}: {e}")
    
    async def handle_user_response(self, room_id: int, user_id: int, response: str) -> dict:
        """Xử lý phản hồi từ user"""
        try:
            if room_id not in self.rooms:
                return {"error": "Room not found"}
            
            state = self.rooms[room_id]
            if state.phase != RoomPhase.NOTIFICATION:
                return {"error": "Not in notification phase"}
            
            # Get user key
            user_key = await self._get_user_key(room_id, user_id)
            if not user_key:
                return {"error": "User not in room"}
            
            # Update response
            state.user_responses[user_key] = response
            
            # If "no" response, end room immediately
            if response == "no":
                await self._end_room(room_id, "user_ended")
                return {"room_ended": True, "message": "Phòng chat đã được kết thúc"}
            
            # If "yes" response, check if both users responded
            if response == "yes":
                if await self._both_users_responded_yes(room_id):
                    await self._keep_room(room_id)
                    return {"room_kept": True, "message": "Cả 2 đều muốn tiếp tục cuộc trò chuyện!"}
                else:
                    return {"waiting_for_other": True, "message": "Đang chờ phản hồi từ người chat khác..."}
            
            return {"error": "Invalid response"}
            
        except Exception as e:
            logger.error(f"❌ Error handling user response for room {room_id}: {e}")
            return {"error": str(e)}
    
    async def _check_responses_and_end(self, room_id: int):
        """Kiểm tra responses và kết thúc room nếu cần"""
        if await self._both_users_responded_yes(room_id):
            await self._keep_room(room_id)
        else:
            await self._end_room(room_id, "timeout")
    
    async def _both_users_responded_yes(self, room_id: int) -> bool:
        """Kiểm tra xem cả 2 user đã chọn 'yes' chưa"""
        state = self.rooms[room_id]
        return (state.user_responses.get("user1") == "yes" and 
                state.user_responses.get("user2") == "yes")
    
    async def _keep_room(self, room_id: int):
        """Giữ room và kết thúc process"""
        await self._send_websocket_message(room_id, {
            "type": "room_kept",
            "room_id": room_id,
            "message": "Cả 2 đều muốn tiếp tục cuộc trò chuyện!"
        })
        
        await self._cancel_room_process(room_id)
        logger.info(f"✅ Room {room_id} kept by both users")
    
    async def _end_room(self, room_id: int, reason: str):
        """Kết thúc room"""
        try:
            # Update database
            db = next(get_db())
            try:
                room = db.query(Room).filter(Room.id == room_id).first()
                if room:
                    room.end_time = datetime.now(timezone.utc)
                    
                    # Update user statuses
                    user1 = db.query(User).filter(User.id == room.user1_id).first()
                    user2 = db.query(User).filter(User.id == room.user2_id).first()
                    
                    if user1:
                        user1.status = 'idle'
                        user1.current_room_id = None
                    if user2:
                        user2.status = 'idle'
                        user2.current_room_id = None
                    
                    db.commit()
                    
            finally:
                db.close()
            
            # Send room ended message
            await self._send_websocket_message(room_id, {
                "type": "room_ended",
                "room_id": room_id,
                "reason": reason,
                "message": "Phòng chat đã kết thúc"
            })
            
            # Cleanup
            await self._cancel_room_process(room_id)
            logger.info(f"✅ Room {room_id} ended: {reason}")
            
        except Exception as e:
            logger.error(f"❌ Error ending room {room_id}: {e}")
    
    async def _cancel_room_process(self, room_id: int):
        """Hủy process của room"""
        if room_id in self.rooms:
            state = self.rooms[room_id]
            if state.task:
                state.task.cancel()
            del self.rooms[room_id]
    
    async def _validate_room(self, room_id: int) -> bool:
        """Validate room tồn tại và chưa kết thúc"""
        try:
            db = next(get_db())
            try:
                room = db.query(Room).filter(Room.id == room_id).first()
                return room and not room.end_time
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error validating room {room_id}: {e}")
            return False
    
    async def _get_users_to_notify(self, room_id: int) -> list:
        """Lấy danh sách users cần notify (chỉ những user chưa giữ cuộc trò chuyện)"""
        try:
            db = next(get_db())
            try:
                room = db.query(Room).filter(Room.id == room_id).first()
                if not room:
                    logger.error(f"Room {room_id} not found")
                    return []
                
                # Get keep_active_responses
                keep_active_responses = json.loads(room.keep_active_responses) if room.keep_active_responses else {}
                users_to_notify = []
                
                logger.info(f"Room {room_id} keep_active_responses: {keep_active_responses}")
                
                # Check user1 - chỉ notify nếu chưa giữ cuộc trò chuyện
                user1_response = keep_active_responses.get("user1")
                if user1_response != "yes":
                    users_to_notify.append(room.user1_id)
                    logger.info(f"User1 {room.user1_id} needs notification (response: {user1_response})")
                else:
                    logger.info(f"User1 {room.user1_id} already kept active, skipping notification")
                
                # Check user2 - chỉ notify nếu chưa giữ cuộc trò chuyện
                user2_response = keep_active_responses.get("user2")
                if user2_response != "yes":
                    users_to_notify.append(room.user2_id)
                    logger.info(f"User2 {room.user2_id} needs notification (response: {user2_response})")
                else:
                    logger.info(f"User2 {room.user2_id} already kept active, skipping notification")
                
                logger.info(f"Final users to notify for room {room_id}: {users_to_notify}")
                return users_to_notify
                
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error getting users to notify for room {room_id}: {e}")
            return []
    
    async def _get_user_key(self, room_id: int, user_id: int) -> Optional[str]:
        """Lấy user key (user1 hoặc user2)"""
        try:
            db = next(get_db())
            try:
                room = db.query(Room).filter(Room.id == room_id).first()
                if not room:
                    return None
                
                if room.user1_id == user_id:
                    return "user1"
                elif room.user2_id == user_id:
                    return "user2"
                else:
                    return None
                    
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error getting user key for room {room_id}, user {user_id}: {e}")
            return None
    
    async def _send_websocket_message(self, room_id: int, message: dict):
        """Gửi WebSocket message"""
        try:
            await manager.broadcast_to_room(json.dumps(message), room_id)
        except Exception as e:
            logger.error(f"Error sending WebSocket message to room {room_id}: {e}")
    
    async def _send_personal_notification(self, room_id: int, user_id: int, timeout: int):
        """Gửi notification cá nhân cho user"""
        try:
            notification_message = {
                "type": "notification_show",
                "room_id": room_id,
                "timeout": timeout,
                "message": "Bạn có muốn tiếp tục cuộc trò chuyện với người này không?",
                "buttons": {
                    "yes": "✅ Có - Tôi muốn tiếp tục",
                    "no": "❌ Không - Kết thúc cuộc trò chuyện"
                }
            }
            
            logger.info(f"📤 Sending personal notification to user {user_id} for room {room_id}")
            
            # Thử gửi personal message trước
            try:
                await manager.send_personal_message(
                    json.dumps(notification_message), 
                    user_id
                )
                logger.info(f"✅ Personal notification sent to user {user_id} for room {room_id}")
            except Exception as personal_error:
                logger.warning(f"⚠️ Personal message failed for user {user_id}: {personal_error}")
                # Fallback: gửi broadcast
                await manager.broadcast_to_room(json.dumps(notification_message), room_id)
                logger.info(f"✅ Fallback broadcast sent for room {room_id}")
            
        except Exception as e:
            logger.error(f"❌ Error sending notification to user {user_id}: {e}")
            # Final fallback: gửi broadcast
            try:
                notification_message = {
                    "type": "notification_show",
                    "room_id": room_id,
                    "timeout": timeout,
                    "message": "Bạn có muốn tiếp tục cuộc trò chuyện với người này không?"
                }
                await manager.broadcast_to_room(json.dumps(notification_message), room_id)
                logger.info(f"✅ Final fallback broadcast sent for room {room_id}")
            except Exception as e2:
                logger.error(f"❌ All notification methods failed: {e2}")
    
    def get_room_status(self, room_id: int) -> dict:
        """Lấy trạng thái room"""
        if room_id not in self.rooms:
            return {"phase": "idle", "active": False}
        
        state = self.rooms[room_id]
        return {
            "phase": state.phase.value,
            "active": True,
            "countdown_remaining": state.countdown_remaining,
            "notification_remaining": state.notification_remaining,
            "user_responses": state.user_responses
        }

# Global instance
simple_countdown_service = SimpleCountdownService()
