"""
Constants and Configuration for Matching Engine
==============================================
"""

# User needs options
NEEDS_LIST = [
    "Nhẹ nhàng vui vẻ", "Nghiêm túc", "Khám phá", 
    "Kết hôn", "Bạn đời lâu dài", "Mối quan hệ mở", "Kết bạn mới"
]

# User interests options
INTERESTS_LIST = [
    "Gym", "Nhảy", "Ảnh", "Cafe", "Du lịch", "Game", 
    "Đọc", "Nhạc", "Tình nguyện", "Phim", "Leo núi", 
    "Nghệ thuật", "Ăn", "Tâm linh", "Thời trang"
]

# Scoring weights
SCORING_WEIGHTS = {
    'needs': 10,        # Weight for matching needs
    'interests': 2,     # Weight for matching interests
    'base_score': 1.0,  # Base score for valid matches
    'min_score': 1.0    # Minimum score to consider a match
}

# Search types
SEARCH_TYPES = {
    'CHAT': 'chat',
    'VOICE': 'voice',
    'RANDOM': 'random'
}

# Gender options
GENDER_OPTIONS = {
    'MALE': 'Nam',
    'FEMALE': 'Nữ', 
    'OTHER': 'Khác',
    'ALL': 'Tất cả'
}
