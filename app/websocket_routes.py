from fastapi import APIRouter, WebSocket
from .websocket_handlers import handle_chat_websocket, handle_status_websocket

router = APIRouter()

# WebSocket endpoint for chat
@router.websocket("/ws/chat/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: int):
    await handle_chat_websocket(websocket, room_id)

# WebSocket endpoint for status updates
@router.websocket("/ws/status")
async def status_websocket(websocket: WebSocket):
    await handle_status_websocket(websocket)
