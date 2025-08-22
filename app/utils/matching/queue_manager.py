"""
Queue Manager
============

Manages the matching queue - adding/removing users,
checking queue status, and coordinating matching operations.
"""

from typing import List, Tuple, Optional, Dict
from sqlalchemy.orm import Session
from app.models import User, MatchingQueue
from .compatibility import CompatibilityChecker


class QueueManager:
    """Manage matching queue operations"""
    
    def __init__(self):
        self.compatibility_checker = CompatibilityChecker()
    
    def add_to_queue(self, db: Session, user_id: int, search_type: str = "chat") -> Tuple[bool, Optional[Dict]]:
        """
        Add user to matching queue
        
        Args:
            db: Database session
            user_id: User ID to add
            search_type: Type of search (chat, voice, random)
            
        Returns:
            Tuple[bool, Optional[Dict]]: (success, match_info)
        """
        try:
            # Check if user is already in queue
            if self._is_user_in_queue(db, user_id):
                return False, None
            
            # Check if user profile is completed
            user = db.query(User).filter(User.id == user_id).first()
            if not user or not self.compatibility_checker.is_profile_complete(user):
                return False, None
            
            # Add user to queue
            self._add_user_to_queue(db, user_id, search_type)
            
            return True, None
            
        except Exception as e:
            db.rollback()
            return False, None
    
    def remove_from_queue(self, db: Session, user_id: int) -> bool:
        """
        Remove user from matching queue
        
        Args:
            db: Database session
            user_id: User ID to remove
            
        Returns:
            bool: Success status
        """
        try:
            db.query(MatchingQueue).filter(MatchingQueue.user_id == user_id).delete()
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            return False
    
    def get_queue_users(self, db: Session, search_type: str) -> List[User]:
        """
        Get all users in queue for a specific search type
        
        Args:
            db: Database session
            search_type: Type of search
            
        Returns:
            List[User]: List of users in queue
        """
        queue_entries = db.query(MatchingQueue).filter(MatchingQueue.type == search_type).all()
        if not queue_entries:
            return []
        
        user_ids = [entry.user_id for entry in queue_entries]
        return db.query(User).filter(User.id.in_(user_ids)).all()
    
    def update_users_to_searching(self, db: Session, users: List[User]) -> None:
        """
        Update all users in queue to SEARCHING status
        
        Args:
            db: Database session
            users: List of users to update
        """
        for user in users:
            user.status = 'searching'
        db.commit()
    
    def _is_user_in_queue(self, db: Session, user_id: int) -> bool:
        """Check if user is already in queue"""
        existing_entry = db.query(MatchingQueue).filter(MatchingQueue.user_id == user_id).first()
        return existing_entry is not None
    
    def _add_user_to_queue(self, db: Session, user_id: int, search_type: str) -> None:
        """Add user to queue"""
        queue_entry = MatchingQueue(
            user_id=user_id,
            type=search_type
        )
        db.add(queue_entry)
        db.commit()
    
    def get_queue_stats(self, db: Session) -> Dict[str, int]:
        """Get queue statistics"""
        total = db.query(MatchingQueue).count()
        chat = db.query(MatchingQueue).filter(MatchingQueue.type == "chat").count()
        voice = db.query(MatchingQueue).filter(MatchingQueue.type == "voice").count()
        random = db.query(MatchingQueue).filter(MatchingQueue.type == "random").count()
        
        return {
            "total": total,
            "chat": chat,
            "voice": voice,
            "random": random
        }
