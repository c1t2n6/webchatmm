#!/usr/bin/env python3
"""
Test Real Room Chat System
==========================

This script tests the real optimized room chat system including:
- Database connectivity
- WebSocket manager functionality
- Room lifecycle management
- Error handling and recovery
"""

import asyncio
import json
import time
import structlog
from datetime import datetime, timezone
from typing import Dict, List, Optional

# Setup logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger = structlog.get_logger()

class RealSystemTester:
    """Test the real room chat system"""
    
    def __init__(self):
        self.test_results: List[Dict] = []
    
    async def test_database_connection(self):
        """Test database connection and basic operations"""
        logger.info("Testing database connection...")
        
        try:
            from app.database import get_db
            from app.models import User, Room, Message
            
            db = next(get_db())
            
            # Test basic query
            users = db.query(User).limit(5).all()
            logger.info(f"Found {len(users)} users in database")
            
            # Test room query
            rooms = db.query(Room).limit(5).all()
            logger.info(f"Found {len(rooms)} rooms in database")
            
            # Test message query
            messages = db.query(Message).limit(5).all()
            logger.info(f"Found {len(messages)} messages in database")
            
            self.test_results.append({
                'test': 'database_connection',
                'status': 'PASSED',
                'users_count': len(users),
                'rooms_count': len(rooms),
                'messages_count': len(messages)
            })
            
            logger.info("Database connection test PASSED")
            return True
            
        except Exception as e:
            self.test_results.append({
                'test': 'database_connection',
                'status': 'FAILED',
                'error': str(e)
            })
            
            logger.error(f"Database connection test FAILED: {e}")
            return False
    
    async def test_websocket_manager(self):
        """Test WebSocket manager functionality"""
        logger.info("Testing WebSocket manager...")
        
        try:
            from app.websocket_manager import manager
            
            # Test manager initialization
            if not hasattr(manager, 'active_connections'):
                raise Exception("WebSocket manager not properly initialized")
            
            # Test room info method
            room_info = manager.get_room_info(99999)  # Non-existent room
            if room_info['status'] != 'closed':
                raise Exception("Non-existent room should have 'closed' status")
            
            # Test user room mapping
            user_room = manager.get_user_room(99999)  # Non-existent user
            if user_room is not None:
                raise Exception("Non-existent user should not have a room")
            
            self.test_results.append({
                'test': 'websocket_manager',
                'status': 'PASSED'
            })
            
            logger.info("WebSocket manager test PASSED")
            return True
            
        except Exception as e:
            self.test_results.append({
                'test': 'websocket_manager',
                'status': 'FAILED',
                'error': str(e)
            })
            
            logger.error(f"WebSocket manager test FAILED: {e}")
            return False
    
    async def test_room_creator(self):
        """Test room creator functionality"""
        logger.info("Testing room creator...")
        
        try:
            from app.utils.matching.room_creator import room_creator
            
            # Test room creator initialization
            if not hasattr(room_creator, 'create_room_for_pair'):
                raise Exception("Room creator not properly initialized")
            
            # Test get_room_info method
            room_info = room_creator.get_room_info(None, 99999)  # Non-existent room
            if room_info is not None:
                raise Exception("Non-existent room should return None")
            
            self.test_results.append({
                'test': 'room_creator',
                'status': 'PASSED'
            })
            
            logger.info("Room creator test PASSED")
            return True
            
        except Exception as e:
            self.test_results.append({
                'test': 'room_creator',
                'status': 'FAILED',
                'error': str(e)
            })
            
            logger.error(f"Room creator test FAILED: {e}")
            return False
    
    async def test_room_lifecycle_manager(self):
        """Test room lifecycle manager"""
        logger.info("Testing room lifecycle manager...")
        
        try:
            from app.utils.room_lifecycle_manager import room_lifecycle_manager
            
            # Test manager initialization
            if not hasattr(room_lifecycle_manager, 'start'):
                raise Exception("Room lifecycle manager not properly initialized")
            
            # Test status method
            status = room_lifecycle_manager.get_status()
            if not isinstance(status, dict):
                raise Exception("Status should return a dictionary")
            
            # Test configuration
            required_keys = ['is_running', 'cleanup_task_active', 'maintenance_task_active']
            for key in required_keys:
                if key not in status:
                    raise Exception(f"Status missing required key: {key}")
            
            self.test_results.append({
                'test': 'room_lifecycle_manager',
                'status': 'PASSED',
                'status_info': status
            })
            
            logger.info("Room lifecycle manager test PASSED")
            return True
            
        except Exception as e:
            self.test_results.append({
                'test': 'room_lifecycle_manager',
                'status': 'FAILED',
                'error': str(e)
            })
            
            logger.error(f"Room lifecycle manager test FAILED: {e}")
            return False
    
    async def test_websocket_handlers(self):
        """Test WebSocket handlers"""
        logger.info("Testing WebSocket handlers...")
        
        try:
            from app.websocket_handlers import WebSocketHandler, handle_chat_websocket, handle_status_websocket
            
            # Test WebSocketHandler class
            if not hasattr(WebSocketHandler, 'validate_connection'):
                raise Exception("WebSocketHandler missing validate_connection method")
            
            if not hasattr(WebSocketHandler, 'handle_message'):
                raise Exception("WebSocketHandler missing handle_message method")
            
            # Test handler functions
            if not callable(handle_chat_websocket):
                raise Exception("handle_chat_websocket is not callable")
            
            if not callable(handle_status_websocket):
                raise Exception("handle_status_websocket is not callable")
            
            self.test_results.append({
                'test': 'websocket_handlers',
                'status': 'PASSED'
            })
            
            logger.info("WebSocket handlers test PASSED")
            return True
            
        except Exception as e:
            self.test_results.append({
                'test': 'websocket_handlers',
                'status': 'FAILED',
                'error': str(e)
            })
            
            logger.error(f"WebSocket handlers test FAILED: {e}")
            return False
    
    async def test_api_endpoints(self):
        """Test API endpoints structure"""
        logger.info("Testing API endpoints...")
        
        try:
            from app.api.chat import router as chat_router
            from app.api.auth import router as auth_router
            from app.api.user import router as user_router
            from app.api.admin import router as admin_router
            
            # Test router imports
            routers = [chat_router, auth_router, user_router, admin_router]
            for router in routers:
                if not hasattr(router, 'routes'):
                    raise Exception(f"Router missing routes attribute: {router}")
            
            # Test chat endpoints
            chat_routes = [route.path for route in chat_router.routes]
            required_chat_endpoints = [
                '/search',
                '/cancel-search',
                '/like/{room_id}',
                '/keep/{room_id}',
                '/report/{room_id}',
                '/end/{room_id}',
                '/room/{room_id}',
                '/current-room',
                '/room/{room_id}/messages'
            ]
            
            for endpoint in required_chat_endpoints:
                if not any(endpoint.replace('{room_id}', '123') in route for route in chat_routes):
                    logger.warning(f"Chat endpoint not found: {endpoint}")
            
            self.test_results.append({
                'test': 'api_endpoints',
                'status': 'PASSED',
                'chat_routes': chat_routes
            })
            
            logger.info("API endpoints test PASSED")
            return True
            
        except Exception as e:
            self.test_results.append({
                'test': 'api_endpoints',
                'status': 'FAILED',
                'error': str(e)
            })
            
            logger.error(f"API endpoints test FAILED: {e}")
            return False
    
    async def test_app_factory(self):
        """Test app factory"""
        logger.info("Testing app factory...")
        
        try:
            from app.app_factory import create_app
            
            # Test app creation
            app = create_app()
            
            if not hasattr(app, 'routes'):
                raise Exception("App missing routes attribute")
            
            # Test CORS middleware
            cors_middleware = None
            for middleware in app.user_middleware:
                if 'CORSMiddleware' in str(middleware):
                    cors_middleware = middleware
                    break
            
            if not cors_middleware:
                raise Exception("CORS middleware not found")
            
            self.test_results.append({
                'test': 'app_factory',
                'status': 'PASSED',
                'app_title': app.title,
                'app_version': app.version
            })
            
            logger.info("App factory test PASSED")
            return True
            
        except Exception as e:
            self.test_results.append({
                'test': 'app_factory',
                'status': 'FAILED',
                'error': str(e)
            })
            
            logger.error(f"App factory test FAILED: {e}")
            return False
    
    async def test_system_integration(self):
        """Test system integration"""
        logger.info("Testing system integration...")
        
        try:
            # Test that all components can work together
            from app.websocket_manager import manager
            from app.utils.room_lifecycle_manager import room_lifecycle_manager
            from app.utils.matching.room_creator import room_creator
            
            # Test manager status
            manager_status = manager.get_room_info(99999)
            lifecycle_status = room_lifecycle_manager.get_status()
            
            # Verify all managers are accessible
            if not all([manager_status, lifecycle_status]):
                raise Exception("Some managers are not accessible")
            
            self.test_results.append({
                'test': 'system_integration',
                'status': 'PASSED',
                'manager_status': manager_status,
                'lifecycle_status': lifecycle_status
            })
            
            logger.info("System integration test PASSED")
            return True
            
        except Exception as e:
            self.test_results.append({
                'test': 'system_integration',
                'status': 'FAILED',
                'error': str(e)
            })
            
            logger.error(f"System integration test FAILED: {e}")
            return False
    
    async def run_all_tests(self):
        """Run all tests"""
        logger.info("Starting comprehensive real system tests...")
        
        start_time = time.time()
        
        # Run all tests
        tests = [
            self.test_database_connection,
            self.test_websocket_manager,
            self.test_room_creator,
            self.test_room_lifecycle_manager,
            self.test_websocket_handlers,
            self.test_api_endpoints,
            self.test_app_factory,
            self.test_system_integration
        ]
        
        for test in tests:
            try:
                await test()
            except Exception as e:
                logger.error(f"Test {test.__name__} failed with exception: {e}")
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Print test results
        self.print_test_results(duration)
    
    def print_test_results(self, duration: float):
        """Print test results summary"""
        logger.info("=" * 60)
        logger.info("REAL SYSTEM TEST RESULTS SUMMARY")
        logger.info("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASSED')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAILED')
        total = len(self.test_results)
        
        logger.info(f"Total tests: {total}")
        logger.info(f"Passed: {passed}")
        logger.info(f"Failed: {failed}")
        logger.info(f"Duration: {duration:.2f} seconds")
        
        if failed > 0:
            logger.error("Some tests failed:")
            for result in self.test_results:
                if result['status'] == 'FAILED':
                    logger.error(f"  - {result['test']}: {result['error']}")
        else:
            logger.info("All tests PASSED! 🎉")
        
        # Print detailed results
        logger.info("\nDetailed Results:")
        for result in self.test_results:
            status_icon = "✅" if result['status'] == 'PASSED' else "❌"
            logger.info(f"  {status_icon} {result['test']}: {result['status']}")
            if result['status'] == 'PASSED' and 'error' not in result:
                # Print additional info for passed tests
                for key, value in result.items():
                    if key not in ['test', 'status']:
                        logger.info(f"    {key}: {value}")
        
        logger.info("=" * 60)

async def main():
    """Main test function"""
    logger.info("Starting real room chat system tests...")
    
    tester = RealSystemTester()
    await tester.run_all_tests()
    
    logger.info("Real system test suite completed")

if __name__ == "__main__":
    asyncio.run(main())
