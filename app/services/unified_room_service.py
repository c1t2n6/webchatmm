"""
Unified Room Service - Service duy nhất quản lý toàn bộ room lifecycle
========================================================================

Thay thế hoàn toàn RoomLifecycleService và SimpleCountdownService
- Single source of truth: Database
- Logic rõ ràng và đơn giản
- Không có state inconsistency
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Optional, List
from dataclasses import dataclass

from app.database import get_db
from app.models import Room, User
from app.websocket_manager import manager

logger = logging.getLogger(__name__)

class RoomPhase(Enum):
    IDLE = "idle"
    COUNTDOWN = "countdown"
    NOTIFICATION = "notification"
    KEPT = "kept"
    ENDED = "ended"

@dataclass
class RoomState:
    room_id: int
    phase: RoomPhase = RoomPhase.IDLE
    countdown_remaining: int = 0
    notification_remaining: int = 0
    task: Optional[asyncio.Task] = None

class UnifiedRoomService:
    """Service duy nhất quản lý toàn bộ room lifecycle"""
    
    def __init__(self):
        self.rooms: Dict[int, RoomState] = {}
        self.COUNTDOWN_DURATION = 15
        self.NOTIFICATION_DURATION = 30
    
    # ==================== PUBLIC API ====================
    
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
            
            # Start countdown phase
            await self._start_countdown_phase(room_id)
            
            logger.info(f"✅ Countdown started for room {room_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error starting countdown for room {room_id}: {e}")
            return False
    
    async def handle_keep_active_request(self, room_id: int, user_id: int, response: str) -> Dict:
        """Xử lý yêu cầu giữ hoạt động từ user"""
        try:
            db = next(get_db())
            try:
                # Validate room
                room = db.query(Room).filter(Room.id == room_id).first()
                if not room or room.end_time:
                    return {"error": "Phòng chat không tồn tại hoặc đã kết thúc"}
                
                # Get user key
                user_key = self._get_user_key(room, user_id)
                if not user_key:
                    return {"error": "Bạn không có quyền truy cập phòng này"}
                
                # Update keep_active_responses
                keep_active_responses = json.loads(room.keep_active_responses) if room.keep_active_responses else {}
                keep_active_responses[user_key] = response
                room.keep_active_responses = json.dumps(keep_active_responses)
                db.commit()
                
                logger.info(f"📝 Updated {user_key} response to '{response}' for room {room_id}")
                
                # Handle response
                if response == "no":
                    # User không muốn tiếp tục - kết thúc phòng
                    await self._end_room(room_id, "user_dislike", db)
                    return {
                        "room_ended": True, 
                        "message": "Phòng chat đã kết thúc do một trong hai người không muốn tiếp tục"
                    }
                else:
                    # User muốn tiếp tục - kiểm tra cả 2 user
                    return await self._check_both_users_response(room_id, keep_active_responses, db)
                    
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error handling keep active request: {e}")
            return {"error": f"Lỗi xử lý yêu cầu: {str(e)}"}
    
    async def handle_user_response(self, room_id: int, user_id: int, response: str) -> Dict:
        """Xử lý phản hồi từ user trong notification phase"""
        try:
            if room_id not in self.rooms:
                return {"error": "Room not found"}
            
            state = self.rooms[room_id]
            if state.phase != RoomPhase.NOTIFICATION:
                return {"error": "Not in notification phase"}
            
            # Delegate to keep_active_request
            result = await self.handle_keep_active_request(room_id, user_id, response)
            
            # If room kept or ended, cancel process
            if "room_kept" in result or "room_ended" in result:
                await self._cancel_room_process(room_id)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error handling user response for room {room_id}: {e}")
            return {"error": str(e)}
    
    def get_room_status(self, room_id: int) -> dict:
        """Lấy trạng thái room"""
        if room_id not in self.rooms:
            return {"phase": "idle", "active": False}
        
        state = self.rooms[room_id]
        return {
            "phase": state.phase.value,
            "active": True,
            "countdown_remaining": state.countdown_remaining,
            "notification_remaining": state.notification_remaining
        }
    
    # ==================== PRIVATE METHODS ====================
    
    async def _validate_room(self, room_id: int) -> bool:
        """Validate room exists and is active"""
        try:
            db = next(get_db())
            try:
                room = db.query(Room).filter(Room.id == room_id).first()
                return room is not None and room.end_time is None
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error validating room {room_id}: {e}")
            return False
    
    def _get_user_key(self, room: Room, user_id: int) -> Optional[str]:
        """Get user key (user1 or user2)"""
        if room.user1_id == user_id:
            return "user1"
        elif room.user2_id == user_id:
            return "user2"
        return None
    
    async def _start_countdown_phase(self, room_id: int):
        """Bắt đầu countdown phase"""
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
        logger.info(f"⏰ Countdown started for room {room_id}")
    
    async def _run_countdown(self, room_id: int):
        """Chạy countdown"""
        try:
            state = self.rooms[room_id]
            
            while state.countdown_remaining > 0:
                # Send update
                await self._send_websocket_message(room_id, {
                    "type": "countdown_update",
                    "room_id": room_id,
                    "remaining": state.countdown_remaining
                })
                
                await asyncio.sleep(1)
                state.countdown_remaining -= 1
            
            # Countdown finished, start notification phase
            await self._start_notification_phase(room_id)
            
        except asyncio.CancelledError:
            logger.info(f"Countdown cancelled for room {room_id}")
        except Exception as e:
            logger.error(f"❌ Error in countdown for room {room_id}: {e}")
    
    async def _start_notification_phase(self, room_id: int):
        """Bắt đầu notification phase"""
        logger.info(f"🔔 Starting notification phase for room {room_id}")
        
        state = self.rooms[room_id]
        state.phase = RoomPhase.NOTIFICATION
        state.notification_remaining = self.NOTIFICATION_DURATION
        
        # Check if both users already kept active
        if await self._both_users_already_kept_active(room_id):
            logger.info(f"Both users already kept active for room {room_id} - skipping notification")
            await self._keep_room(room_id)
            return
        
        # Get users to notify
        users_to_notify = await self._get_users_to_notify(room_id)
        logger.info(f"Users to notify for room {room_id}: {users_to_notify}")
        
        if not users_to_notify:
            logger.info(f"No users to notify for room {room_id} - all users already kept active")
            await self._keep_room(room_id)
            return
        
        # Send notification
        notification_message = {
            "type": "notification_show",
            "room_id": room_id,
            "timeout": self.NOTIFICATION_DURATION,
            "message": "Bạn có muốn tiếp tục cuộc trò chuyện với người này không?",
            "users_to_notify": users_to_notify
        }
        
        logger.info(f"📤 Sending notification message: {notification_message}")
        await self._send_websocket_message(room_id, notification_message)
        
        # Start notification timeout
        state.task = asyncio.create_task(self._run_notification_timeout(room_id))
        logger.info(f"⏰ Notification timeout started for room {room_id}")
    
    async def _run_notification_timeout(self, room_id: int):
        """Chạy notification timeout"""
        try:
            state = self.rooms[room_id]
            
            while state.notification_remaining > 0:
                # Send update
                await self._send_websocket_message(room_id, {
                    "type": "notification_update",
                    "room_id": room_id,
                    "remaining": state.notification_remaining
                })
                
                await asyncio.sleep(1)
                state.notification_remaining -= 1
            
            # Timeout reached, check responses
            await self._handle_notification_timeout(room_id)
            
        except asyncio.CancelledError:
            logger.info(f"Notification timeout cancelled for room {room_id}")
        except Exception as e:
            logger.error(f"❌ Error in notification timeout for room {room_id}: {e}")
    
    async def _handle_notification_timeout(self, room_id: int):
        """Xử lý khi notification hết giờ - LOGIC RÕ RÀNG"""
        try:
            db = next(get_db())
            try:
                room = db.query(Room).filter(Room.id == room_id).first()
                if not room:
                    return
                
                keep_active_responses = json.loads(room.keep_active_responses) if room.keep_active_responses else {}
                user1_response = keep_active_responses.get("user1")
                user2_response = keep_active_responses.get("user2")
                
                logger.info(f"Timeout check for room {room_id}: user1={user1_response}, user2={user2_response}")
                
                # LOGIC RÕ RÀNG:
                if user1_response == "yes" and user2_response == "yes":
                    # Cả 2 chọn "Có" → Giữ phòng
                    logger.info(f"Both users chose 'yes' - keeping room {room_id}")
                    await self._keep_room(room_id, db)
                elif user1_response == "no" or user2_response == "no":
                    # Có ít nhất 1 chọn "Không" → Kết thúc phòng
                    logger.info(f"At least one user chose 'no' - ending room {room_id}")
                    await self._end_room(room_id, "user_dislike", db)
                else:
                    # Có ít nhất 1 không chọn gì → Kết thúc phòng
                    logger.info(f"At least one user didn't respond - ending room {room_id}")
                    await self._end_room(room_id, "timeout", db)
                    
            finally:
                db.close()
        except Exception as e:
            logger.error(f"❌ Error handling notification timeout for room {room_id}: {e}")
    
    async def _both_users_already_kept_active(self, room_id: int) -> bool:
        """Kiểm tra xem cả 2 user đã ấn 'giữ hoạt động' chưa"""
        try:
            db = next(get_db())
            try:
                room = db.query(Room).filter(Room.id == room_id).first()
                if not room:
                    return False
                
                keep_active_responses = json.loads(room.keep_active_responses) if room.keep_active_responses else {}
                user1_response = keep_active_responses.get("user1")
                user2_response = keep_active_responses.get("user2")
                
                return user1_response == "yes" and user2_response == "yes"
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error checking both users kept active for room {room_id}: {e}")
            return False
    
    async def _get_users_to_notify(self, room_id: int) -> List[int]:
        """Lấy danh sách users cần notify"""
        try:
            db = next(get_db())
            try:
                room = db.query(Room).filter(Room.id == room_id).first()
                if not room:
                    return []
                
                keep_active_responses = json.loads(room.keep_active_responses) if room.keep_active_responses else {}
                users_to_notify = []
                
                # Check user1
                user1_response = keep_active_responses.get("user1")
                if user1_response != "yes":
                    users_to_notify.append(room.user1_id)
                
                # Check user2
                user2_response = keep_active_responses.get("user2")
                if user2_response != "yes":
                    users_to_notify.append(room.user2_id)
                
                return users_to_notify
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error getting users to notify for room {room_id}: {e}")
            return []
    
    async def _check_both_users_response(self, room_id: int, keep_active_responses: Dict, db) -> Dict:
        """Kiểm tra phản hồi của cả 2 user"""
        user1_response = keep_active_responses.get("user1")
        user2_response = keep_active_responses.get("user2")
        
        if user1_response and user2_response:
            # Cả 2 user đã phản hồi
            if user1_response == "yes" and user2_response == "yes":
                # Cả 2 đồng ý - giữ phòng
                await self._keep_room(room_id, db)
                return {
                    "room_kept": True,
                    "message": "Cả 2 user đã đồng ý giữ phòng!"
                }
            else:
                # Có ít nhất 1 không đồng ý - kết thúc phòng
                await self._end_room(room_id, "user_dislike", db)
                return {
                    "room_ended": True,
                    "message": "Phòng chat đã kết thúc do một trong hai người không muốn tiếp tục"
                }
        else:
            # Chỉ 1 user phản hồi - chờ user kia
            await self._notify_waiting(room_id)
            return {
                "waiting_for_other": True,
                "message": "Đang chờ phản hồi từ người chat khác..."
            }
    
    async def _keep_room(self, room_id: int, db=None):
        """Giữ phòng"""
        try:
            if db is None:
                db = next(get_db())
                should_close = True
            else:
                should_close = False
            
            try:
                room = db.query(Room).filter(Room.id == room_id).first()
                if room:
                    room.keep_active = True
                    db.commit()
                    logger.info(f"✅ Room {room_id} kept active")
            finally:
                if should_close:
                    db.close()
        except Exception as e:
            logger.error(f"❌ Error keeping room {room_id}: {e}")
        
        # Send WebSocket message
        await self._send_websocket_message(room_id, {
            "type": "room_kept",
            "room_id": room_id,
            "message": "Cả 2 đều muốn tiếp tục cuộc trò chuyện!"
        })
        
        # Update state
        if room_id in self.rooms:
            self.rooms[room_id].phase = RoomPhase.KEPT
            await self._cancel_room_process(room_id)
    
    async def _end_room(self, room_id: int, reason: str, db=None):
        """Kết thúc phòng"""
        try:
            if db is None:
                db = next(get_db())
                should_close = True
            else:
                should_close = False
            
            try:
                room = db.query(Room).filter(Room.id == room_id).first()
                if room and not room.end_time:
                    room.end_time = datetime.now(timezone.utc)
                    
                    # Reset user statuses
                    user1 = db.query(User).filter(User.id == room.user1_id).first()
                    user2 = db.query(User).filter(User.id == room.user2_id).first()
                    
                    if user1:
                        user1.status = 'idle'
                        user1.current_room_id = None
                    if user2:
                        user2.status = 'idle'
                        user2.current_room_id = None
                    
                    db.commit()
                    logger.info(f"✅ Room {room_id} ended: {reason}")
            finally:
                if should_close:
                    db.close()
        except Exception as e:
            logger.error(f"❌ Error ending room {room_id}: {e}")
        
        # Send WebSocket message
        await self._send_websocket_message(room_id, {
            "type": "room_ended",
            "room_id": room_id,
            "reason": reason,
            "message": "Phòng chat đã kết thúc",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Update state
        if room_id in self.rooms:
            self.rooms[room_id].phase = RoomPhase.ENDED
            await self._cancel_room_process(room_id)
    
    async def _notify_waiting(self, room_id: int):
        """Thông báo đang chờ user kia"""
        await self._send_websocket_message(room_id, {
            "type": "waiting_for_other",
            "room_id": room_id,
            "message": "Đang chờ phản hồi từ người chat khác..."
        })
    
    async def _cancel_room_process(self, room_id: int):
        """Hủy process của room"""
        if room_id in self.rooms:
            state = self.rooms[room_id]
            if state.task and not state.task.done():
                state.task.cancel()
            del self.rooms[room_id]
            logger.info(f"🗑️ Cancelled process for room {room_id}")
    
    async def _send_websocket_message(self, room_id: int, message: Dict):
        """Gửi WebSocket message"""
        try:
            await manager.broadcast_to_room(json.dumps(message), room_id)
        except Exception as e:
            logger.error(f"❌ Error sending WebSocket message to room {room_id}: {e}")

# Global instance
unified_room_service = UnifiedRoomService()
