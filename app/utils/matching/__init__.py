"""
Matching Engine Module
======================

A modular matching system for pairing users in chat rooms.
"""

from .engine import MatchingEngine
from .scoring import MatchScoring
from .queue_manager import QueueManager
from .room_creator import RoomCreator
from .compatibility import CompatibilityChecker

# Main export
matching_engine = MatchingEngine()

__all__ = [
    'matching_engine',
    'MatchingEngine',
    'MatchScoring',
    'QueueManager', 
    'RoomCreator',
    'CompatibilityChecker'
]
