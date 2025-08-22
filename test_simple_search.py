#!/usr/bin/env python3
"""
Simple Test for User Creation and Search
========================================

This script tests basic user creation and search functionality
"""

import requests
import json

def test_user_creation():
    """Test user creation"""
    base_url = "http://localhost:8000"
    
    # Test user data
    user_data = {
        "username": "testuser123",
        "password": "password"
    }
    
    print("Testing user creation...")
    
    # Create user
    response = requests.post(f"{base_url}/auth/signup", json=user_data)
    print(f"Signup response: {response.status_code}")
    if response.status_code == 200:
        print("User created successfully!")
        data = response.json()
        print(f"User ID: {data['user']['id']}")
        return data['access_token']
    else:
        print(f"Signup failed: {response.text}")
        return None

def test_user_login(username, password):
    """Test user login"""
    base_url = "http://localhost:8000"
    
    login_data = {
        "username": username,
        "password": password
    }
    
    print("Testing user login...")
    
    response = requests.post(f"{base_url}/auth/login", json=login_data)
    print(f"Login response: {response.status_code}")
    if response.status_code == 200:
        print("Login successful!")
        data = response.json()
        print(f"User ID: {data['user']['id']}")
        return data['access_token']
    else:
        print(f"Login failed: {response.text}")
        return None

def test_search(token):
    """Test search functionality"""
    base_url = "http://localhost:8000"
    
    headers = {"Authorization": f"Bearer {token}"}
    search_data = {"type": "chat"}
    
    print("Testing search...")
    
    response = requests.post(f"{base_url}/chat/search", headers=headers, json=search_data)
    print(f"Search response: {response.status_code}")
    if response.status_code == 200:
        print("Search successful!")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        return True
    else:
        print(f"Search failed: {response.text}")
        return False

def main():
    """Main test function"""
    print("🚀 Starting Simple User Creation and Search Test...")
    
    # Test user creation
    token = test_user_creation()
    if not token:
        print("❌ Cannot continue without user creation")
        return
    
    # Test user login
    token = test_user_login("testuser123", "password")
    if not token:
        print("❌ Cannot continue without user login")
        return
    
    # Test search
    success = test_search(token)
    if success:
        print("✅ All tests passed!")
    else:
        print("❌ Search test failed!")

if __name__ == "__main__":
    main()
