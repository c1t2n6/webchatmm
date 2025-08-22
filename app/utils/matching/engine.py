"""
Main Matching Engine
===================

Orchestrates the matching process by coordinating between
scoring, compatibility, queue management, and room creation.
"""

import random
from typing import List, Tuple, Optional, Dict
from sqlalchemy.orm import Session
from app.models import User, Icebreaker
from .scoring import MatchScoring
from .queue_manager import QueueManager
from .room_creator import RoomCreator
from .compatibility import CompatibilityChecker


class MatchingEngine:
    """Main matching engine that coordinates all matching operations"""
    
    def __init__(self):
        self.scoring = MatchScoring()
        self.queue_manager = QueueManager()
        self.room_creator = RoomCreator()
        self.compatibility_checker = CompatibilityChecker()
    
    def add_to_queue(self, db: Session, user_id: int, search_type: str = "chat") -> Tuple[bool, Optional[Dict]]:
        """
        Add user to matching queue and try immediate match
        
        Args:
            db: Database session
            user_id: User ID to add
            search_type: Type of search
            
        Returns:
            Tuple[bool, Optional[Dict]]: (success, match_info)
        """
        try:
            # Add user to queue
            success, _ = self.queue_manager.add_to_queue(db, user_id, search_type)
            if not success:
                return False, None
            
            # Try to find immediate match
            return self._try_immediate_match(db, user_id, search_type)
            
        except Exception as e:
            db.rollback()
            return False, None
    
    def remove_from_queue(self, db: Session, user_id: int) -> bool:
        """Remove user from matching queue"""
        return self.queue_manager.remove_from_queue(db, user_id)
    
    def find_compatible_pairs(self, db: Session, queue_users: List[User], search_type: str) -> int:
        """
        Find compatible pairs and create rooms
        
        Args:
            db: Database session
            queue_users: List of users in queue
            search_type: Type of search
            
        Returns:
            int: Number of matches found
        """
        matches_found = 0
        processed_users = set()
        
        try:
            for user1 in queue_users:
                if user1.id in processed_users or user1.current_room_id is not None:
                    continue
                
                # Find best match for user1
                best_match = self._find_best_match(user1, queue_users, processed_users)
                
                # Create room if match found
                if best_match:
                    success, room = self.room_creator.create_room_for_pair(db, user1, best_match)
                    if success:
                        matches_found += 1
                        processed_users.add(user1.id)
                        processed_users.add(best_match.id)
            
            return matches_found
            
        except Exception as e:
            db.rollback()
            return matches_found
    
    def get_icebreaker(self, db: Session, user1: User, user2: User) -> Optional[str]:
        """Get an icebreaker message based on common interests"""
        common_interests = self.compatibility_checker.get_common_interests(user1, user2)
        
        if not common_interests:
            return None
        
        # Get a random icebreaker for one of the common interests
        interest = random.choice(list(common_interests))
        icebreaker = db.query(Icebreaker).filter(Icebreaker.interest == interest).first()
        
        return icebreaker.prompt if icebreaker else None
    
    def _try_immediate_match(self, db: Session, user_id: int, search_type: str) -> Tuple[bool, Optional[Dict]]:
        """Try to find immediate match when user is added to queue"""
        queue_users = self.queue_manager.get_queue_users(db, search_type)
        
        if len(queue_users) < 2:
            return True, None
        
        # Update all users to SEARCHING status
        self.queue_manager.update_users_to_searching(db, queue_users)
        
        # Try to find matches
        matches_found = self.find_compatible_pairs(db, queue_users, search_type)
        
        if matches_found > 0:
            # Return match info for the newly added user
            return self._get_match_info_for_user(db, user_id)
        
        return True, None
    
    def _find_best_match(self, user1: User, queue_users: List[User], processed_users: set) -> Optional[User]:
        """Find the best match for a user"""
        best_match = None
        best_score = 0.0
        
        for user2 in queue_users:
            if user2.id == user1.id:
                continue
            
            if user2.id in processed_users or user2.current_room_id is not None:
                continue
            
            score = self.scoring.calculate_match_score(user1, user2)
            
            if score > best_score and self.scoring.is_valid_match(score):
                best_score = score
                best_match = user2
        
        return best_match
    
    def _get_match_info_for_user(self, db: Session, user_id: int) -> Tuple[bool, Optional[Dict]]:
        """Get match information for a specific user"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.current_room_id:
            return True, None
        
        room_info = self.room_creator.get_room_info(db, user.current_room_id)
        if not room_info:
            return True, None
        
        # Find the other user in the room
        other_user = None
        if room_info["user1"]["id"] == user_id:
            other_user = room_info["user2"]
        else:
            other_user = room_info["user1"]
        
        if other_user:
            return True, {
                "room_id": room_info["room_id"],
                "matched_user_id": other_user["id"],
                "matched_user": other_user
            }
        
        return True, None
    
    def get_queue_stats(self, db: Session) -> Dict[str, int]:
        """Get current queue statistics"""
        return self.queue_manager.get_queue_stats(db)
