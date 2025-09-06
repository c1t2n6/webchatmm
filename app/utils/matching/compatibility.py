"""
Compatibility Checker
====================

Handles user compatibility checks including gender preferences,
needs, and interests matching.
"""

import json
from typing import List, Set
from app.models import User
from .constants import GENDER_OPTIONS


class CompatibilityChecker:
    """Check compatibility between users"""
    
    @staticmethod
    def check_gender_preference(user1: User, user2: User) -> bool:
        """
        Check if users match each other's gender preferences
        
        Args:
            user1: First user
            user2: Second user
            
        Returns:
            bool: True if users are compatible
        """
        pref1 = json.loads(user1.preferred_gender) if user1.preferred_gender else []
        pref2 = json.loads(user2.preferred_gender) if user2.preferred_gender else []
        
        # If users haven't set preferences yet, allow matching
        if len(pref1) == 0 and len(pref2) == 0:
            return True
        
        # Get user genders
        gender1 = user1.gender
        gender2 = user2.gender
        
        # Check if user1 accepts user2's gender
        user1_accepts_user2 = (
            GENDER_OPTIONS['ALL'] in pref1 or  # User1 accepts all genders
            gender2 in pref1                    # User1 specifically accepts user2's gender
        )
        
        # Check if user2 accepts user1's gender
        user2_accepts_user1 = (
            GENDER_OPTIONS['ALL'] in pref2 or  # User2 accepts all genders
            gender1 in pref2                    # User2 specifically accepts user1's gender
        )
        
        # Both users must accept each other
        return user1_accepts_user2 and user2_accepts_user1
    
    @staticmethod
    def get_common_needs(user1: User, user2: User) -> Set[str]:
        """Get common needs between two users"""
        needs1 = json.loads(user1.needs) if user1.needs else []
        needs2 = json.loads(user2.needs) if user2.needs else []
        return set(needs1) & set(needs2)
    
    @staticmethod
    def get_common_interests(user1: User, user2: User) -> Set[str]:
        """Get common interests between two users"""
        interests1 = json.loads(user1.interests) if user1.interests else []
        interests2 = json.loads(user2.interests) if user2.interests else []
        return set(interests1) & set(interests2)
    
    @staticmethod
    def is_profile_complete(user: User) -> bool:
        """Check if user profile is complete for matching"""
        return bool(
            user.nickname and 
            user.dob and 
            user.gender and 
            user.preferred_gender and 
            user.needs and 
            user.interests
        )
