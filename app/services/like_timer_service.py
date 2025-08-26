"""
Like Timer Service - Quản lý timer hiển thị like modal từ backend
"""

import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Room, User
from app.websocket.connection_manager import manager
import logging

logger = logging.getLogger(__name__)

class LikeTimerService:
    """Service để quản lý timer hiển thị like modal"""
    
    def __init__(self):
        self.active_timers: Dict[int, asyncio.Task] = {}
        self.like_prompt_delay = 1 * 60  # 1 phút (tạm thời để test)
        self.second_round_delay = 1 * 60  # 1 phút cho second round (tạm thời để test)
    
    async def schedule_like_prompt(self, room_id: int, is_second_round: bool = False) -> bool:
        """
        Lên lịch hiển thị like modal sau 1 phút (tạm thời để test)
        
        Args:
            room_id: ID của phòng chat
            is_second_round: Có phải là lần hiển thị thứ 2 không
        """
        try:
            # Clear timer cũ nếu có
            if room_id in self.active_timers:
                self.active_timers[room_id].cancel()
                del self.active_timers[room_id]
            
            # Tính delay
            delay = self.second_round_delay if is_second_round else self.like_prompt_delay
            
            # Tạo timer task
            timer_task = asyncio.create_task(
                self._show_like_prompt(room_id, is_second_round)
            )
            
            self.active_timers[room_id] = timer_task
            
            logger.info(f"✅ Scheduled like prompt for room {room_id} in {delay} seconds (second_round: {is_second_round})")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error scheduling like prompt for room {room_id}: {e}")
            return False
    
    async def _show_like_prompt(self, room_id: int, is_second_round: bool = False):
        """
        Hiển thị like prompt sau khi timer kết thúc (1 phút)
        """
        try:
            # Đợi theo delay
            await asyncio.sleep(self.second_round_delay if is_second_round else self.like_prompt_delay)
            
            # Kiểm tra xem phòng còn tồn tại không
            db = next(get_db())
            try:
                room = db.query(Room).filter(Room.id == room_id).first()
                if not room or room.end_time:
                    logger.info(f"Room {room_id} no longer exists or has ended, skipping like prompt")
                    return
                
                # Kiểm tra xem user có còn trong phòng không
                user1 = db.query(User).filter(User.id == room.user1_id).first()
                user2 = db.query(User).filter(User.id == room.user2_id).first()
                
                if not user1 or not user2 or user1.current_room_id != room_id or user2.current_room_id != room_id:
                    logger.info(f"Users no longer in room {room_id}, skipping like prompt")
                    return
                
                # Gửi WebSocket notification để hiển thị like modal
                like_prompt_message = {
                    "type": "like_prompt",
                    "room_id": room_id,
                    "is_second_round": is_second_round,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "message": "Đã đến lúc đánh giá người chat!" if not is_second_round else "Hãy đánh giá lại người chat!"
                }
                
                await manager.broadcast_to_room(
                    json.dumps(like_prompt_message), 
                    room_id
                )
                
                logger.info(f"✅ Like prompt sent for room {room_id} (second_round: {is_second_round})")
                
            finally:
                db.close()
                
        except asyncio.CancelledError:
            logger.info(f"Like prompt timer for room {room_id} was cancelled")
        except Exception as e:
            logger.error(f"❌ Error showing like prompt for room {room_id}: {e}")
        finally:
            # Xóa timer khỏi active timers
            if room_id in self.active_timers:
                del self.active_timers[room_id]
    
    def cancel_like_prompt(self, room_id: int) -> bool:
        """
        Hủy like prompt timer cho một phòng
        
        Args:
            room_id: ID của phòng chat
            
        Returns:
            True nếu hủy thành công, False nếu không
        """
        try:
            if room_id in self.active_timers:
                self.active_timers[room_id].cancel()
                del self.active_timers[room_id]
                logger.info(f"✅ Cancelled like prompt timer for room {room_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"❌ Error cancelling like prompt timer for room {room_id}: {e}")
            return False
    
    def cancel_all_timers(self) -> int:
        """
        Hủy tất cả like prompt timers
        
        Returns:
            Số lượng timer đã hủy
        """
        try:
            cancelled_count = 0
            for room_id, timer_task in self.active_timers.items():
                try:
                    timer_task.cancel()
                    cancelled_count += 1
                except Exception as e:
                    logger.warning(f"Error cancelling timer for room {room_id}: {e}")
            
            self.active_timers.clear()
            logger.info(f"✅ Cancelled {cancelled_count} like prompt timers")
            return cancelled_count
            
        except Exception as e:
            logger.error(f"❌ Error cancelling all timers: {e}")
            return 0
    
    def get_active_timer_count(self) -> int:
        """Lấy số lượng timer đang hoạt động"""
        return len(self.active_timers)
    
    def list_active_timers(self) -> list:
        """Liệt kê tất cả room ID có timer đang hoạt động"""
        return list(self.active_timers.keys())
    
    def is_timer_active(self, room_id: int) -> bool:
        """Kiểm tra xem một phòng có timer đang hoạt động không"""
        return room_id in self.active_timers

# Global instance
like_timer_service = LikeTimerService()
