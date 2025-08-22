import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import manager

def test_manager():
    print("🧪 Testing ConnectionManager...")
    
    # Test add_to_room
    print(f"Initial room_connections: {manager.room_connections}")
    
    # Mock websocket object
    class MockWebSocket:
        def __init__(self, user_id):
            self.user_id = user_id
    
    mock_ws = MockWebSocket(5)  # user_id = 5
    
    try:
        print("Adding user 5 to room 2...")
        manager.add_to_room(2, mock_ws, 5)
        print(f"After adding: {manager.room_connections}")
        
        room_info = manager.get_room_info(2)
        print(f"Room 2 info: {room_info}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_manager()
