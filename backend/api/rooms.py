"""
Real-time room / Stage system for Audiolyze.

Every WebSocket connection represents one user in one room.
Messages are JSON with a "type" field that determines the action.

Room lifecycle:
  - Host creates a room (type: "create_room")
  - Room starts private; host can toggle public (type: "toggle_public")
  - Other users can list public rooms via REST, then join via WebSocket
  - Chat, now-playing updates, username changes all flow through the socket
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rooms", tags=["rooms"])

# ---------------------------------------------------------------------------
# Data models (in-memory)
# ---------------------------------------------------------------------------

@dataclass
class User:
    id: str
    name: str
    ws: WebSocket
    room_id: str | None = None
    is_host: bool = False


@dataclass
class ChatMessage:
    id: str
    user_id: str
    username: str
    text: str
    timestamp: float
    is_host: bool = False
    is_system: bool = False


@dataclass
class Room:
    id: str
    name: str
    host_id: str
    host_name: str
    is_public: bool = False
    now_playing: dict | None = None
    created_at: float = field(default_factory=time.time)
    members: dict[str, User] = field(default_factory=dict)  # user_id -> User
    messages: list[ChatMessage] = field(default_factory=list)


# ---------------------------------------------------------------------------
# In-memory stores
# ---------------------------------------------------------------------------

rooms: dict[str, Room] = {}          # room_id -> Room
users: dict[str, User] = {}          # user_id -> User (connected users)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _room_summary(room: Room) -> dict:
    """Public-facing room summary (for listing)."""
    return {
        "id": room.id,
        "name": room.name,
        "hostName": room.host_name,
        "hostId": room.host_id,
        "isPublic": room.is_public,
        "nowPlaying": room.now_playing,
        "audienceCount": max(0, len(room.members) - 1),  # exclude host
        "createdAt": room.created_at,
    }


def _member_list(room: Room) -> list[dict]:
    return [
        {"id": u.id, "name": u.name, "isHost": u.is_host}
        for u in room.members.values()
    ]


async def _send(ws: WebSocket, data: dict):
    """Safe send that swallows errors on closed connections."""
    try:
        if ws.client_state == WebSocketState.CONNECTED:
            await ws.send_json(data)
    except Exception:
        pass


async def _broadcast(room: Room, data: dict, exclude_id: str | None = None):
    """Send to every member of a room (optionally skip one user)."""
    tasks = []
    for uid, user in room.members.items():
        if uid != exclude_id:
            tasks.append(_send(user.ws, data))
    if tasks:
        await asyncio.gather(*tasks)


async def _broadcast_public_rooms():
    """Broadcast the updated public rooms list to ALL connected users."""
    public = [_room_summary(r) for r in rooms.values() if r.is_public]
    msg = {"type": "public_rooms", "rooms": public}
    tasks = [_send(u.ws, msg) for u in users.values()]
    if tasks:
        await asyncio.gather(*tasks)


# ---------------------------------------------------------------------------
# REST endpoint: list public rooms (for initial page load before WS)
# ---------------------------------------------------------------------------

@router.get("/public")
async def list_public_rooms():
    return [_room_summary(r) for r in rooms.values() if r.is_public]


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws")
async def room_websocket(ws: WebSocket):
    await ws.accept()

    user_id = str(uuid.uuid4())[:12]
    user = User(id=user_id, name="", ws=ws)
    users[user_id] = user

    # Send the user their assigned ID + initial public rooms list
    public = [_room_summary(r) for r in rooms.values() if r.is_public]
    await _send(ws, {
        "type": "connected",
        "userId": user_id,
        "publicRooms": public,
    })

    try:
        while True:
            raw = await ws.receive_json()
            msg_type = raw.get("type")

            # ------ SET USERNAME ------
            if msg_type == "set_username":
                old_name = user.name
                user.name = raw.get("name", "Anon")[:30]
                # If in a room, broadcast the name change
                if user.room_id and user.room_id in rooms:
                    room = rooms[user.room_id]
                    await _broadcast(room, {
                        "type": "user_renamed",
                        "userId": user_id,
                        "oldName": old_name,
                        "newName": user.name,
                        "members": _member_list(room),
                    })
                await _send(ws, {"type": "username_set", "name": user.name})

            # ------ CREATE ROOM ------
            elif msg_type == "create_room":
                # Leave current room first
                await _leave_room(user)

                room_id = str(uuid.uuid4())[:12]
                room_name = raw.get("name", f"{user.name}'s Stage")[:50]
                room = Room(
                    id=room_id,
                    name=room_name,
                    host_id=user_id,
                    host_name=user.name,
                )
                room.members[user_id] = user
                rooms[room_id] = room
                user.room_id = room_id
                user.is_host = True

                await _send(ws, {
                    "type": "room_created",
                    "room": _room_summary(room),
                    "members": _member_list(room),
                    "messages": [],
                })

            # ------ JOIN ROOM ------
            elif msg_type == "join_room":
                target_id = raw.get("roomId")
                if target_id not in rooms:
                    await _send(ws, {"type": "error", "message": "Room not found"})
                    continue

                target = rooms[target_id]
                if not target.is_public:
                    await _send(ws, {"type": "error", "message": "Room is private"})
                    continue

                # Leave current room
                await _leave_room(user)

                # Join new room
                user.room_id = target_id
                user.is_host = False
                target.members[user_id] = user

                # System message
                sys_msg = ChatMessage(
                    id=str(uuid.uuid4())[:12],
                    user_id="system",
                    username="System",
                    text=f"{user.name} joined the stage",
                    timestamp=time.time(),
                    is_system=True,
                )
                target.messages.append(sys_msg)

                # Send joiner the full room state + recent chat history
                recent = target.messages[-50:]
                await _send(ws, {
                    "type": "room_joined",
                    "room": _room_summary(target),
                    "members": _member_list(target),
                    "messages": [_chat_msg_dict(m) for m in recent],
                })

                # Broadcast to existing members
                await _broadcast(target, {
                    "type": "user_joined",
                    "userId": user_id,
                    "username": user.name,
                    "members": _member_list(target),
                    "systemMessage": _chat_msg_dict(sys_msg),
                }, exclude_id=user_id)

                # Update public room counts
                await _broadcast_public_rooms()

            # ------ LEAVE ROOM ------
            elif msg_type == "leave_room":
                await _leave_room(user)

            # ------ TOGGLE PUBLIC ------
            elif msg_type == "toggle_public":
                if not user.room_id or user.room_id not in rooms:
                    continue
                room = rooms[user.room_id]
                if room.host_id != user_id:
                    continue  # only host can toggle

                room.is_public = not room.is_public

                await _broadcast(room, {
                    "type": "room_updated",
                    "room": _room_summary(room),
                })

                # Update global public rooms list
                await _broadcast_public_rooms()

            # ------ RENAME ROOM ------
            elif msg_type == "rename_room":
                new_name = raw.get("name", "").strip()[:50]
                if not new_name or not user.room_id or user.room_id not in rooms:
                    continue
                room = rooms[user.room_id]
                if room.host_id != user_id:
                    continue
                room.name = new_name
                await _broadcast(room, {
                    "type": "room_updated",
                    "room": _room_summary(room),
                })
                if room.is_public:
                    await _broadcast_public_rooms()

            # ------ UPDATE NOW PLAYING ------
            elif msg_type == "update_now_playing":
                if not user.room_id or user.room_id not in rooms:
                    continue
                room = rooms[user.room_id]
                if room.host_id != user_id:
                    continue
                room.now_playing = raw.get("nowPlaying")
                await _broadcast(room, {
                    "type": "room_updated",
                    "room": _room_summary(room),
                })
                if room.is_public:
                    await _broadcast_public_rooms()

            # ------ CHAT MESSAGE ------
            elif msg_type == "chat_message":
                text = raw.get("text", "").strip()[:500]
                if not text or not user.room_id or user.room_id not in rooms:
                    continue
                room = rooms[user.room_id]
                msg = ChatMessage(
                    id=str(uuid.uuid4())[:12],
                    user_id=user_id,
                    username=user.name,
                    text=text,
                    timestamp=time.time(),
                    is_host=(room.host_id == user_id),
                )
                room.messages.append(msg)

                # Keep message history bounded
                if len(room.messages) > 200:
                    room.messages = room.messages[-100:]

                await _broadcast(room, {
                    "type": "chat_message",
                    "message": _chat_msg_dict(msg),
                })

    except WebSocketDisconnect:
        logger.info(f"User {user_id} ({user.name}) disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for {user_id}: {e}")
    finally:
        await _leave_room(user)
        users.pop(user_id, None)


# ---------------------------------------------------------------------------
# Leave room helper
# ---------------------------------------------------------------------------

async def _leave_room(user: User):
    """Remove user from their current room, clean up if needed."""
    if not user.room_id or user.room_id not in rooms:
        user.room_id = None
        user.is_host = False
        return

    room = rooms[user.room_id]
    room.members.pop(user.id, None)
    was_host = user.is_host
    user.is_host = False
    old_room_id = user.room_id
    user.room_id = None

    if was_host or len(room.members) == 0:
        # Host left or room empty -> destroy room
        for member in list(room.members.values()):
            member.room_id = None
            member.is_host = False
            await _send(member.ws, {"type": "room_closed", "reason": "Host left the stage"})
        rooms.pop(old_room_id, None)
        await _broadcast_public_rooms()
    else:
        # Audience member left
        sys_msg = ChatMessage(
            id=str(uuid.uuid4())[:12],
            user_id="system",
            username="System",
            text=f"{user.name} left the stage",
            timestamp=time.time(),
            is_system=True,
        )
        room.messages.append(sys_msg)

        await _broadcast(room, {
            "type": "user_left",
            "userId": user.id,
            "username": user.name,
            "members": _member_list(room),
            "systemMessage": _chat_msg_dict(sys_msg),
        })
        await _broadcast_public_rooms()

    # Confirm to the leaving user
    await _send(user.ws, {"type": "left_room"})


def _chat_msg_dict(msg: ChatMessage) -> dict:
    return {
        "id": msg.id,
        "userId": msg.user_id,
        "username": msg.username,
        "text": msg.text,
        "timestamp": msg.timestamp,
        "isHost": msg.is_host,
        "isSystem": msg.is_system,
    }
