#!/usr/bin/env python3
"""
Debug matching engine trực tiếp
"""
from app.database import get_db
from app.models import User, MatchingQueue
from app.utils.matching import matching_engine

def debug_matching():
    print("🔍 Debug Matching Engine Directly")
    print("=" * 50)
    
    try:
        db = next(get_db())
        
        # Get users in queue
        queue_entries = db.query(MatchingQueue).filter(MatchingQueue.type == "chat").all()
        print(f"Users in chat queue: {len(queue_entries)}")
        
        if len(queue_entries) >= 2:
            user_ids = [entry.user_id for entry in queue_entries]
            queue_users = db.query(User).filter(User.id.in_(user_ids)).all()
            
            print(f"Queue users:")
            for user in queue_users:
                print(f"  User {user.id}: {user.username}, Status: {user.status}, Room: {user.current_room_id}")
            
            # Test matching directly
            print(f"\n🔍 Testing _find_compatible_pairs...")
            matches_found = matching_engine._find_compatible_pairs(db, queue_users, "chat")
            print(f"Matches found: {matches_found}")
            
            # Check final status
            print(f"\n📊 Final status:")
            for user in queue_users:
                db.refresh(user)
                print(f"  User {user.id}: Status: {user.status}, Room: {user.current_room_id}")
                
        else:
            print("Not enough users in queue for matching")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_matching()
