#!/usr/bin/env python3
"""
Test Basic Import
=================
Kiểm tra import cơ bản
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_basic_import():
    """Test basic import"""
    print("🧪 Testing Basic Import...")
    
    try:
        print("✅ Starting import test...")
        
        # Test 1: Basic imports
        print("📦 Testing basic imports...")
        import asyncio
        import json
        from datetime import datetime, timezone
        print("✅ Basic imports successful")
        
        # Test 2: App imports
        print("📦 Testing app imports...")
        from app.websocket_manager import manager
        print("✅ Manager import successful")
        
        # Test 3: Check manager
        print("🔍 Checking manager...")
        print(f"   Manager type: {type(manager)}")
        print(f"   Manager methods: {[m for m in dir(manager) if not m.startswith('_')]}")
        
        print("\n🎉 Basic import test passed!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_basic_import()
