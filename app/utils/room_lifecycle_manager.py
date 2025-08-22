"""
Room Lifecycle Manager
======================

Manages the complete lifecycle of chat rooms including:
- Automatic cleanup of expired rooms
- Handling room timeouts
- Managing user disconnections
- Background maintenance tasks
"""

import asyncio
import structlog
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Room, User, Message
from ..websocket_manager import manager
from ..utils.matching.room_creator import room_creator

logger = structlog.get_logger()

class RoomLifecycleManager:
    """Manages room lifecycle and automatic cleanup"""
    
    def __init__(self):
        self.logger = structlog.get_logger()
        self._cleanup_task: Optional[asyncio.Task] = None
        self._maintenance_task: Optional[asyncio.Task] = None
        self._is_running = False
        
        # Configuration
        self.room_timeout_hours = 24  # Rooms expire after 24 hours
        self.cleanup_interval_minutes = 30  # Run cleanup every 30 minutes
        self.maintenance_interval_minutes = 5  # Run maintenance every 5 minutes
        
        # Track rooms that need attention
        self.rooms_to_end: Set[int] = set()
        self.rooms_to_cleanup: Set[int] = set()
    
    def start(self):
        """Start the lifecycle manager"""
        if self._is_running:
            self.logger.warning("Room lifecycle manager is already running")
            return
        
        self._is_running = True
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        self._maintenance_task = asyncio.create_task(self._maintenance_loop())
        
        self.logger.info("Room lifecycle manager started")
    
    def stop(self):
        """Stop the lifecycle manager"""
        if not self._is_running:
            return
        
        self._is_running = False
        
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
        
        if self._maintenance_task and not self._maintenance_task.done():
            self._maintenance_task.cancel()
        
        self.logger.info("Room lifecycle manager stopped")
    
    async def _cleanup_loop(self):
        """Main cleanup loop for expired rooms"""
        while self._is_running:
            try:
                await asyncio.sleep(self.cleanup_interval_minutes * 60)
                await self._cleanup_expired_rooms()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(60)  # Wait 1 minute on error
    
    async def _maintenance_loop(self):
        """Maintenance loop for room health checks"""
        while self._is_running:
            try:
                await asyncio.sleep(self.maintenance_interval_minutes * 60)
                await self._perform_maintenance()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Error in maintenance loop: {e}")
                await asyncio.sleep(30)  # Wait 30 seconds on error
    
    async def _cleanup_expired_rooms(self):
        """Clean up rooms that have exceeded their timeout"""
        try:
            db = next(get_db())
            try:
                # Find rooms that have been active for too long
                cutoff_time = datetime.now(timezone.utc) - timedelta(hours=self.room_timeout_hours)
                
                expired_rooms = db.query(Room).filter(
                    Room.end_time.is_(None),
                    Room.start_time < cutoff_time
                ).all()
                
                self.logger.info(f"Found {len(expired_rooms)} expired rooms to clean up")
                
                for room in expired_rooms:
                    try:
                        await self._end_room_gracefully(room.id, "timeout")
                    except Exception as e:
                        self.logger.error(f"Error cleaning up expired room {room.id}: {e}")
                
                # Also clean up rooms with no active connections
                await self._cleanup_orphaned_rooms()
            finally:
                db.close()
                
        except Exception as e:
            self.logger.error(f"Error during expired room cleanup: {e}")
    
    async def _perform_maintenance(self):
        """Perform routine maintenance tasks"""
        try:
            # Check for rooms that need attention
            await self._check_room_health()
            
            # Clean up any pending operations
            await self._process_pending_operations()
            
        except Exception as e:
            self.logger.error(f"Error during maintenance: {e}")
    
    async def _check_room_health(self):
        """Check the health of all active rooms"""
        try:
            db = next(get_db())
            try:
                # Get all active rooms
                active_rooms = db.query(Room).filter(Room.end_time.is_(None)).all()
                
                for room in active_rooms:
                    # Check if room has active WebSocket connections
                    room_info = manager.get_room_info(room.id)
                    
                    if room_info["status"] == "closed" or room_info["connection_count"] == 0:
                        # Room has no active connections, mark for cleanup
                        self.rooms_to_cleanup.add(room.id)
                        self.logger.warning(f"Room {room.id} has no active connections, marked for cleanup")
                    
                    # Check if room has been inactive for too long
                    if room.last_message_time:
                        time_since_last_message = datetime.now(timezone.utc) - room.last_message_time
                        if time_since_last_message > timedelta(hours=2):  # 2 hours of inactivity
                            if not room.keep_active:
                                self.rooms_to_end.add(room.id)
                                self.logger.info(f"Room {room.id} marked for ending due to inactivity")
            finally:
                db.close()
            
        except Exception as e:
            self.logger.error(f"Error checking room health: {e}")
    
    async def _process_pending_operations(self):
        """Process any pending room operations"""
        try:
            # Process rooms to end
            rooms_to_end = list(self.rooms_to_end)
            self.rooms_to_end.clear()
            
            for room_id in rooms_to_end:
                try:
                    await self._end_room_gracefully(room_id, "inactivity")
                except Exception as e:
                    self.logger.error(f"Error ending room {room_id}: {e}")
            
            # Process rooms to cleanup
            rooms_to_cleanup = list(self.rooms_to_cleanup)
            self.rooms_to_cleanup.clear()
            
            for room_id in rooms_to_cleanup:
                try:
                    await self._cleanup_room(room_id)
                except Exception as e:
                    self.logger.error(f"Error cleaning up room {room_id}: {e}")
                    
        except Exception as e:
            self.logger.error(f"Error processing pending operations: {e}")
    
    async def _end_room_gracefully(self, room_id: int, reason: str):
        """End a room gracefully with proper cleanup"""
        try:
            self.logger.info(f"Ending room {room_id} with reason: {reason}")
            
            # Force close WebSocket connections
            await manager.force_close_room(room_id)
            
            # Mark room as ended in database
            db = next(get_db())
            success, error = room_creator.end_room(db, room_id, reason)
            
            if success:
                self.logger.info(f"Successfully ended room {room_id}")
            else:
                self.logger.error(f"Failed to end room {room_id}: {error}")
                
        except Exception as e:
            self.logger.error(f"Error ending room {room_id} gracefully: {e}")
    
    async def _cleanup_room(self, room_id: int):
        """Clean up a room completely"""
        try:
            self.logger.info(f"Cleaning up room {room_id}")
            
            # Force close WebSocket connections
            await manager.force_close_room(room_id)
            
            # Clean up database
            db = next(get_db())
            
            # Delete messages
            db.query(Message).filter(Message.room_id == room_id).delete()
            
            # Mark room as ended
            room = db.query(Room).filter(Room.id == room_id).first()
            if room:
                room.end_time = datetime.now(timezone.utc)
            
            # Reset user statuses
            if room:
                user1 = db.query(User).filter(User.id == room.user1_id).first()
                user2 = db.query(User).filter(User.id == room.user2_id).first()
                
                if user1:
                    user1.status = 'idle'
                    user1.current_room_id = None
                    user1.online_status = False
                
                if user2:
                    user2.status = 'idle'
                    user2.current_room_id = None
                    user2.online_status = False
            
            db.commit()
            self.logger.info(f"Successfully cleaned up room {room_id}")
            
        except Exception as e:
            self.logger.error(f"Error cleaning up room {room_id}: {e}")
    
    async def _cleanup_orphaned_rooms(self):
        """Clean up rooms that have no active connections"""
        try:
            # Get all rooms from manager
            active_rooms = manager.room_connections.keys()
            
            db = next(get_db())
            try:
                # Find rooms in database that don't have active connections
                db_rooms = db.query(Room).filter(Room.end_time.is_(None)).all()
                
                for room in db_rooms:
                    if room.id not in active_rooms:
                        # Room exists in database but has no active connections
                        self.logger.warning(f"Found orphaned room {room.id}, marking for cleanup")
                        self.rooms_to_cleanup.add(room.id)
            finally:
                db.close()
                    
        except Exception as e:
            self.logger.error(f"Error cleaning up orphaned rooms: {e}")
    
    def mark_room_for_ending(self, room_id: int):
        """Mark a room for ending (called from external code)"""
        self.rooms_to_end.add(room_id)
        self.logger.info(f"Room {room_id} marked for ending by external request")
    
    def mark_room_for_cleanup(self, room_id: int):
        """Mark a room for cleanup (called from external code)"""
        self.rooms_to_cleanup.add(room_id)
        self.logger.info(f"Room {room_id} marked for cleanup by external request")
    
    async def force_cleanup_all_rooms(self):
        """Force cleanup of all rooms (emergency function)"""
        try:
            self.logger.warning("Force cleanup of all rooms initiated")
            
            # Get all active rooms
            db = next(get_db())
            try:
                active_rooms = db.query(Room).filter(Room.end_time.is_(None)).all()
                
                for room in active_rooms:
                    try:
                        await self._end_room_gracefully(room.id, "force_cleanup")
                    except Exception as e:
                        self.logger.error(f"Error during force cleanup of room {room.id}: {e}")
                
                self.logger.info("Force cleanup completed")
            finally:
                db.close()
            
        except Exception as e:
            self.logger.error(f"Error during force cleanup: {e}")
    
    def get_status(self) -> dict:
        """Get current status of the lifecycle manager"""
        return {
            "is_running": self._is_running,
            "cleanup_task_active": self._cleanup_task and not self._cleanup_task.done() if self._cleanup_task else False,
            "maintenance_task_active": self._maintenance_task and not self._maintenance_task.done() if self._maintenance_task else False,
            "rooms_to_end": list(self.rooms_to_end),
            "rooms_to_cleanup": list(self.rooms_to_cleanup),
            "configuration": {
                "room_timeout_hours": self.room_timeout_hours,
                "cleanup_interval_minutes": self.cleanup_interval_minutes,
                "maintenance_interval_minutes": self.maintenance_interval_minutes
            }
        }

# Global instance
room_lifecycle_manager = RoomLifecycleManager()
