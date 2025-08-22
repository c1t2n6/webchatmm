"""
Match Scoring System
===================

Calculates compatibility scores between users based on
various factors like needs, interests, and preferences.
"""

from typing import Tuple
from app.models import User
from .compatibility import CompatibilityChecker
from .constants import SCORING_WEIGHTS


class MatchScoring:
    """Calculate compatibility scores between users"""
    
    def __init__(self):
        self.compatibility_checker = CompatibilityChecker()
    
    def calculate_match_score(self, user1: User, user2: User) -> float:
        """
        Calculate compatibility score between two users
        
        Args:
            user1: First user
            user2: Second user
            
        Returns:
            float: Compatibility score (0.0 = no match, higher = better match)
        """
        # Gender preference matching (highest priority)
        if not self.compatibility_checker.check_gender_preference(user1, user2):
            return 0.0
        
        score = 0.0
        
        # Needs matching (bonus points, not required)
        needs_score = self._calculate_needs_score(user1, user2)
        if needs_score > 0:
            score += needs_score * SCORING_WEIGHTS['needs']
        
        # Ensure we have at least a base score for any valid match
        if score == 0:
            score = SCORING_WEIGHTS['base_score']
        
        # Interests matching (bonus points)
        interests_score = self._calculate_interests_score(user1, user2)
        score += interests_score * SCORING_WEIGHTS['interests']
        
        return score
    
    def _calculate_needs_score(self, user1: User, user2: User) -> int:
        """Calculate how many needs users have in common"""
        common_needs = self.compatibility_checker.get_common_needs(user1, user2)
        return len(common_needs)
    
    def _calculate_interests_score(self, user1: User, user2: User) -> int:
        """Calculate how many interests users have in common"""
        common_interests = self.compatibility_checker.get_common_interests(user1, user2)
        return len(common_interests)
    
    def is_valid_match(self, score: float) -> bool:
        """Check if a score represents a valid match"""
        return score >= SCORING_WEIGHTS['min_score']
    
    def get_match_quality(self, score: float) -> str:
        """Get human-readable match quality description"""
        if score >= 15:
            return "Excellent"
        elif score >= 10:
            return "Very Good"
        elif score >= 5:
            return "Good"
        elif score >= 1:
            return "Basic"
        else:
            return "No Match"
