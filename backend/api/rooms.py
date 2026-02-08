"""
Real-time room / Stage system for Audiolyze.

Every WebSocket connection represents one user.
Messages are JSON with a "type" field that determines the action.

Room lifecycle:
  - Host creates a room (type: "create_room")
  - Room starts private; host can toggle public (type: "toggle_public")
  - Other users list public rooms via REST, then join via WebSocket
  - Chat, now-playing, sync, and host-action updates all flow through the socket

Audio sync:
  - Host stores the audio source (SoundCloud URL or uploaded file path) on the room
  - Audience members receive audio_source on join so they can load the same audio
  - Host periodically sends sync_state (currentTime, isPlaying, playbackSpeed)
  - Host sends host_action for discrete events (play, pause, seek, shape change, etc.)
  - Audience applies these to stay in sync

Host visiting:
  - A host can "visit" another room without destroying their own
  - Their room stays alive; audience keeps playing from their local audio chains
  - Host gets a miniplayer overlay and can return any time
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, File, UploadFile, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rooms", tags=["rooms"])

# Temp directory for uploaded audio files
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "rooms")
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
    # The room this user is hosting (persists even if they visit another room)
    hosted_room_id: str | None = None


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
class QueueItem:
    id: str
    title: str
    source: str  # "file" | "soundcloud"
    url: str  # download URL or upload URL
    added_by: str  # user_id
    added_by_name: str
    status: str = "pending"  # pending | analyzing | ready | playing | played
    ai_params: dict | None = None
    soundcloud_url: str | None = None  # original SoundCloud URL for re-downloading
    download_status: str = "pending"  # pending | downloading | ready | failed


@dataclass
class Suggestion:
    id: str
    title: str
    source: str  # "file" | "soundcloud"
    url: str
    user_id: str
    username: str
    status: str = "pending"  # pending | approved | rejected
    timestamp: float = field(default_factory=time.time)


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
    # Audio source for audience to load the same track
    audio_source: dict | None = None  # {type: "soundcloud"|"upload", url: str, title: str}
    # AI params so audience gets the same visualizer timeline
    ai_params: dict | None = None
    # Last known host playback state for late-joiners
    last_sync: dict | None = None  # {currentTime, isPlaying, playbackSpeed, timestamp}
    # Last known host visualizer state for late-joiners
    host_visualizer_state: dict | None = None  # {shape, environment, audioTuning, ...}
    # Whether host is currently visiting another room
    host_visiting: bool = False
    # Song queue
    queue: list[QueueItem] = field(default_factory=list)
    # Audience suggestions
    suggestions: list[Suggestion] = field(default_factory=list)


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
        "audienceCount": max(0, len(room.members) - (0 if room.host_visiting else 1)),
        "createdAt": room.created_at,
    }


def _room_full(room: Room) -> dict:
    """Full room state including audio source (for joiners)."""
    summary = _room_summary(room)
    summary["audioSource"] = room.audio_source
    summary["aiParams"] = room.ai_params
    summary["lastSync"] = room.last_sync
    summary["hostVisualizerState"] = room.host_visualizer_state
    summary["queue"] = [_queue_item_dict(item) for item in room.queue]
    summary["suggestions"] = [_suggestion_dict(s) for s in room.suggestions if s.status == "pending"]
    return summary


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


async def _broadcast_to_audience(room: Room, data: dict):
    """Send to all audience members (everyone except host)."""
    tasks = []
    for uid, user in room.members.items():
        if uid != room.host_id:
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


def _hosted_room_summary(room: Room) -> dict:
    """Summary of a room for the miniplayer when host is visiting elsewhere."""
    return {
        "id": room.id,
        "name": room.name,
        "nowPlaying": room.now_playing,
        "audienceCount": max(0, len(room.members) - (0 if room.host_visiting else 1)),
        "isPublic": room.is_public,
    }


def _queue_item_dict(item: QueueItem) -> dict:
    """Serialize a QueueItem for JSON broadcast."""
    return {
        "id": item.id,
        "title": item.title,
        "source": item.source,
        "url": item.url,
        "added_by": item.added_by,
        "added_by_name": item.added_by_name,
        "status": item.status,
        "ai_params": item.ai_params,
        "soundcloud_url": item.soundcloud_url,
        "download_status": item.download_status,
    }


def _suggestion_dict(s: Suggestion) -> dict:
    return {
        "id": s.id,
        "title": s.title,
        "source": s.source,
        "url": s.url,
        "userId": s.user_id,
        "username": s.username,
        "status": s.status,
        "timestamp": s.timestamp,
    }


def _queue_state(room: Room) -> dict:
    """Full queue state for broadcasting."""
    return {
        "queue": [_queue_item_dict(item) for item in room.queue],
        "suggestions": [_suggestion_dict(s) for s in room.suggestions if s.status == "pending"],
    }


async def _broadcast_queue(room: Room):
    """Broadcast queue state to all members of a room."""
    await _broadcast(room, {
        "type": "queue_update",
        **_queue_state(room),
    })


async def _predownload_priority_tracks(room: Room):
    """
    Pre-download SoundCloud tracks in the priority queue (top 3).
    This ensures instant playback when advancing to the next track.
    """
    import asyncio
    import aiohttp
    
    priority_items = [item for item in room.queue if item.status in ["playing", "priority"]][:3]
    
    for item in priority_items:
        # Skip if already downloaded or not a SoundCloud track
        if item.source != "soundcloud":
            continue
        if not item.soundcloud_url:
            continue
        # Check if already has a downloaded blob URL
        if item.url and item.url.startswith("/soundcloud/file/"):
            continue
            
        # Download in background
        logger.info(f"Pre-downloading SoundCloud track: {item.title}")
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "http://127.0.0.1:8000/soundcloud/download",
                    json={"url": item.soundcloud_url},
                    timeout=aiohttp.ClientTimeout(total=120)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get("ok"):
                            item.url = data["file_url"]
                            logger.info(f"Pre-downloaded: {item.title} -> {item.url}")
                        else:
                            logger.error(f"Download failed for {item.title}: {data.get('error')}")
                    else:
                        logger.error(f"Download request failed for {item.title}: {resp.status}")
        except asyncio.TimeoutError:
            logger.error(f"Download timeout for {item.title}")
        except Exception as e:
            logger.error(f"Download error for {item.title}: {e}")


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("/public")
async def list_public_rooms():
    return [_room_summary(r) for r in rooms.values() if r.is_public]


@router.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    """Upload an audio file so audience members can download it."""
    file_id = str(uuid.uuid4())[:12]
    ext = os.path.splitext(file.filename or "audio.mp3")[1] or ".mp3"
    filename = f"{file_id}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_url = f"/rooms/uploads/{filename}"
    return {"ok": True, "fileUrl": file_url, "filename": filename}


from fastapi.responses import FileResponse

@router.get("/uploads/{filename}")
async def serve_upload(filename: str):
    """Serve an uploaded audio file."""
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(filepath):
        return {"error": "File not found"}
    return FileResponse(filepath, media_type="audio/mpeg")


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
                # Leave current visited room if any, but keep hosted room logic
                if user.room_id and user.room_id in rooms and user.room_id != user.hosted_room_id:
                    await _leave_visited_room(user)

                # If already hosting a room, close it first
                if user.hosted_room_id and user.hosted_room_id in rooms:
                    await _destroy_hosted_room(user)

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
                user.hosted_room_id = room_id

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

                # If host is joining another room, use "visit" mode
                if user.hosted_room_id and user.hosted_room_id in rooms and user.hosted_room_id != target_id:
                    # Leave any currently visited room first
                    if user.room_id and user.room_id != user.hosted_room_id and user.room_id in rooms:
                        await _leave_visited_room(user)
                    
                    hosted = rooms[user.hosted_room_id]
                    hosted.host_visiting = True
                    # Remove host from their own room's members (they're visiting)
                    hosted.members.pop(user_id, None)
                    
                    # Join the target room as audience
                    user.room_id = target_id
                    user.is_host = False
                    target.members[user_id] = user

                    sys_msg = ChatMessage(
                        id=str(uuid.uuid4())[:12],
                        user_id="system",
                        username="System",
                        text=f"{user.name} joined the stage",
                        timestamp=time.time(),
                        is_system=True,
                    )
                    target.messages.append(sys_msg)

                    recent = target.messages[-50:]
                    await _send(ws, {
                        "type": "room_joined",
                        "room": _room_full(target),
                        "members": _member_list(target),
                        "messages": [_chat_msg_dict(m) for m in recent],
                        "hostedRoom": _hosted_room_summary(hosted),
                    })

                    await _broadcast(target, {
                        "type": "user_joined",
                        "userId": user_id,
                        "username": user.name,
                        "members": _member_list(target),
                        "systemMessage": _chat_msg_dict(sys_msg),
                    }, exclude_id=user_id)

                    await _broadcast_public_rooms()
                    continue

                # Normal join (non-host user)
                if user.room_id and user.room_id in rooms:
                    await _leave_room(user)

                user.room_id = target_id
                user.is_host = False
                target.members[user_id] = user

                sys_msg = ChatMessage(
                    id=str(uuid.uuid4())[:12],
                    user_id="system",
                    username="System",
                    text=f"{user.name} joined the stage",
                    timestamp=time.time(),
                    is_system=True,
                )
                target.messages.append(sys_msg)

                # Send joiner the FULL room state including audio source + sync
                recent = target.messages[-50:]
                await _send(ws, {
                    "type": "room_joined",
                    "room": _room_full(target),
                    "members": _member_list(target),
                    "messages": [_chat_msg_dict(m) for m in recent],
                })

                await _broadcast(target, {
                    "type": "user_joined",
                    "userId": user_id,
                    "username": user.name,
                    "members": _member_list(target),
                    "systemMessage": _chat_msg_dict(sys_msg),
                }, exclude_id=user_id)

                await _broadcast_public_rooms()

            # ------ RETURN TO HOSTED ROOM ------
            elif msg_type == "return_to_room":
                if not user.hosted_room_id or user.hosted_room_id not in rooms:
                    await _send(ws, {"type": "error", "message": "No hosted room to return to"})
                    continue

                hosted = rooms[user.hosted_room_id]

                # Leave the currently visited room (if visiting another room)
                if user.room_id and user.room_id != user.hosted_room_id and user.room_id in rooms:
                    await _leave_visited_room(user)

                # Re-join own room as host
                hosted.host_visiting = False
                hosted.members[user_id] = user
                user.room_id = user.hosted_room_id
                user.is_host = True

                await _send(ws, {
                    "type": "returned_to_room",
                    "room": _room_full(hosted),
                    "members": _member_list(hosted),
                    "messages": [_chat_msg_dict(m) for m in hosted.messages[-50:]],
                    "needsAudioReload": True,
                })

                await _broadcast_public_rooms()

            # ------ END HOSTED ROOM ------
            elif msg_type == "end_room":
                if not user.hosted_room_id or user.hosted_room_id not in rooms:
                    continue
                await _destroy_hosted_room(user)
                await _send(ws, {"type": "hosted_room_ended"})

            # ------ GO TO MENU (host leaves visualizer but keeps room alive) ------
            elif msg_type == "go_to_menu":
                if user.hosted_room_id and user.hosted_room_id in rooms:
                    hosted = rooms[user.hosted_room_id]
                    hosted.host_visiting = True
                    # Remove host from their own room's members (they're on the menu)
                    hosted.members.pop(user_id, None)
                    user.room_id = None
                    user.is_host = False
                    await _send(ws, {
                        "type": "went_to_menu",
                        "hostedRoom": _hosted_room_summary(hosted),
                    })
                    await _broadcast_public_rooms()
                elif user.room_id and user.hosted_room_id and user.room_id != user.hosted_room_id:
                    # Host is visiting another room, wants to go to menu
                    if user.room_id in rooms:
                        await _leave_visited_room(user)
                    # Don't rejoin hosted room, just mark as on menu
                    hosted = rooms.get(user.hosted_room_id)
                    if hosted:
                        hosted.host_visiting = True
                        hosted.members.pop(user_id, None)
                    user.room_id = None
                    user.is_host = False
                    await _send(ws, {
                        "type": "went_to_menu",
                        "hostedRoom": _hosted_room_summary(hosted) if hosted else None,
                    })
                    await _broadcast_public_rooms()
                else:
                    # Not a host, just leave normally
                    await _leave_room(user)
                    await _send(ws, {"type": "left_room"})

            # ------ LEAVE ROOM ------
            elif msg_type == "leave_room":
                if user.hosted_room_id and user.room_id == user.hosted_room_id:
                    # Host leaving their own room = destroy it
                    await _leave_room(user)
                elif user.room_id and user.room_id != user.hosted_room_id:
                    # Visiting audience leaving the visited room
                    await _leave_visited_room(user)
                    # If they have a hosted room, return to it
                    if user.hosted_room_id and user.hosted_room_id in rooms:
                        hosted = rooms[user.hosted_room_id]
                        hosted.host_visiting = False
                        hosted.members[user_id] = user
                        user.room_id = user.hosted_room_id
                        user.is_host = True
                        await _send(ws, {
                            "type": "returned_to_room",
                            "room": _room_full(hosted),
                            "members": _member_list(hosted),
                            "messages": [_chat_msg_dict(m) for m in hosted.messages[-50:]],
                        })
                    else:
                        user.room_id = None
                        user.is_host = False
                        await _send(ws, {"type": "left_room"})
                else:
                    await _leave_room(user)

            # ------ TOGGLE PUBLIC ------
            elif msg_type == "toggle_public":
                rid = user.hosted_room_id or user.room_id
                if not rid or rid not in rooms:
                    continue
                room = rooms[rid]
                if room.host_id != user_id:
                    continue

                room.is_public = not room.is_public
                await _broadcast(room, {
                    "type": "room_updated",
                    "room": _room_summary(room),
                })
                # Also tell the host if they're visiting elsewhere
                if user.room_id != rid:
                    await _send(ws, {
                        "type": "hosted_room_updated",
                        "hostedRoom": _hosted_room_summary(room),
                    })
                await _broadcast_public_rooms()

            # ------ RENAME ROOM ------
            elif msg_type == "rename_room":
                new_name = raw.get("name", "").strip()[:50]
                rid = user.hosted_room_id or user.room_id
                if not new_name or not rid or rid not in rooms:
                    continue
                room = rooms[rid]
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
                rid = user.hosted_room_id or user.room_id
                if not rid or rid not in rooms:
                    continue
                room = rooms[rid]
                if room.host_id != user_id:
                    continue
                room.now_playing = raw.get("nowPlaying")
                await _broadcast(room, {
                    "type": "room_updated",
                    "room": _room_summary(room),
                })
                if room.is_public:
                    await _broadcast_public_rooms()

            # ------ SET AUDIO SOURCE (host tells server what track to play) ------
            elif msg_type == "set_audio_source":
                rid = user.hosted_room_id or user.room_id
                if not rid or rid not in rooms:
                    continue
                room = rooms[rid]
                if room.host_id != user_id:
                    continue
                room.audio_source = raw.get("audioSource")
                room.ai_params = raw.get("aiParams")
                # Reset sync state for new track
                room.last_sync = {"currentTime": 0, "isPlaying": False, "playbackSpeed": 1, "timestamp": time.time()}
                room.host_visualizer_state = None
                # Broadcast to audience so they can load the new track
                await _broadcast_to_audience(room, {
                    "type": "audio_source",
                    "audioSource": room.audio_source,
                    "aiParams": room.ai_params,
                })

            # ------ SYNC STATE (host sends periodic playback state) ------
            elif msg_type == "sync_state":
                rid = user.hosted_room_id or user.room_id
                if not rid or rid not in rooms:
                    continue
                room = rooms[rid]
                if room.host_id != user_id:
                    continue
                sync_data = {
                    "currentTime": raw.get("currentTime", 0),
                    "isPlaying": raw.get("isPlaying", False),
                    "playbackSpeed": raw.get("playbackSpeed", 1),
                    "timestamp": time.time(),
                }
                room.last_sync = sync_data
                await _broadcast_to_audience(room, {
                    "type": "sync_state",
                    **sync_data,
                })

            # ------ HOST ACTION (discrete control events) ------
            elif msg_type == "host_action":
                rid = user.hosted_room_id or user.room_id
                if not rid or rid not in rooms:
                    continue
                room = rooms[rid]
                if room.host_id != user_id:
                    continue
                action = raw.get("action")
                payload = raw.get("payload", {})

                # Store relevant state for late-joiners
                if action in ("shape_change", "environment_change", "eq_change", "anaglyph_toggle"):
                    if room.host_visualizer_state is None:
                        room.host_visualizer_state = {}
                    if action == "shape_change":
                        room.host_visualizer_state["shape"] = payload.get("shape")
                    elif action == "environment_change":
                        room.host_visualizer_state["environment"] = payload.get("environment")
                    elif action == "eq_change":
                        room.host_visualizer_state["audioTuning"] = payload.get("audioTuning")
                        room.host_visualizer_state["audioPlaybackTuning"] = payload.get("audioPlaybackTuning")
                    elif action == "anaglyph_toggle":
                        room.host_visualizer_state["anaglyphEnabled"] = payload.get("enabled")

                # Update last_sync for play/pause/seek/speed
                if action == "play_pause":
                    is_playing = payload.get("isPlaying", False)
                    if room.last_sync:
                        room.last_sync["isPlaying"] = is_playing
                        room.last_sync["timestamp"] = time.time()
                    else:
                        room.last_sync = {"currentTime": 0, "isPlaying": is_playing, "playbackSpeed": 1, "timestamp": time.time()}
                elif action == "seek":
                    ct = payload.get("currentTime", 0)
                    if room.last_sync:
                        room.last_sync["currentTime"] = ct
                        room.last_sync["timestamp"] = time.time()
                elif action == "speed_change":
                    spd = payload.get("speed", 1)
                    if room.last_sync:
                        room.last_sync["playbackSpeed"] = spd

                await _broadcast_to_audience(room, {
                    "type": "host_action",
                    "action": action,
                    "payload": payload,
                })

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
                if len(room.messages) > 200:
                    room.messages = room.messages[-100:]

                await _broadcast(room, {
                    "type": "chat_message",
                    "message": _chat_msg_dict(msg),
                })

            # ------ QUEUE: ADD SONG (host only) ------
            elif msg_type == "queue_add":
                rid = user.hosted_room_id or user.room_id
                if not rid or rid not in rooms:
                    continue
                room = rooms[rid]
                if room.host_id != user_id:
                    continue
                item = QueueItem(
                    id=str(uuid.uuid4())[:12],
                    title=raw.get("title", "Unknown")[:200],
                    source=raw.get("source", "file"),
                    url=raw.get("url", ""),
                    added_by=user_id,
                    added_by_name=user.name,
                    soundcloud_url=raw.get("soundcloudUrl"),
                )
                room.queue.append(item)
                await _broadcast_queue(room)
                # Pre-download if it enters priority queue
                asyncio.create_task(_predownload_priority_tracks(room))

            # ------ QUEUE: REMOVE SONG (host only) ------
            elif msg_type == "queue_remove":
                rid = user.hosted_room_id or user.room_id
                if not rid or rid not in rooms:
                    continue
                room = rooms[rid]
                if room.host_id != user_id:
                    continue
                item_id = raw.get("itemId")
                # Can only remove items that aren't currently playing
                room.queue = [q for q in room.queue if not (q.id == item_id and q.status != "playing")]
                await _broadcast_queue(room)
                # Pre-download if removal caused new tracks to enter priority
                asyncio.create_task(_predownload_priority_tracks(room))

            # ------ QUEUE: REORDER (host only, low-priority items only) ------
            elif msg_type == "queue_reorder":
                rid = user.hosted_room_id or user.room_id
                if not rid or rid not in rooms:
                    continue
                room = rooms[rid]
                if room.host_id != user_id:
                    continue
                new_order = raw.get("order", [])  # list of item IDs in desired order
                if not new_order:
                    continue
                # Separate priority (first 3 non-played) and low-priority
                active_queue = [q for q in room.queue if q.status not in ("played",)]
                played = [q for q in room.queue if q.status == "played"]
                priority = active_queue[:3]
                low_priority = active_queue[3:]
                # Reorder only low-priority based on new_order
                id_to_item = {q.id: q for q in low_priority}
                reordered = []
                for item_id in new_order:
                    if item_id in id_to_item:
                        reordered.append(id_to_item.pop(item_id))
                # Add any items not in new_order at the end
                reordered.extend(id_to_item.values())
                room.queue = played + priority + reordered
                await _broadcast_queue(room)
                # No need to predownload on reorder - only low priority items move

            # ------ QUEUE: UPDATE ITEM STATUS (host only, e.g. mark as analyzing/ready) ------
            elif msg_type == "queue_update_item":
                rid = user.hosted_room_id or user.room_id
                if not rid or rid not in rooms:
                    continue
                room = rooms[rid]
                if room.host_id != user_id:
                    continue
                item_id = raw.get("itemId")
                new_status = raw.get("status")
                ai_params = raw.get("aiParams")
                for q in room.queue:
                    if q.id == item_id:
                        if new_status:
                            q.status = new_status
                        if ai_params is not None:
                            q.ai_params = ai_params
                        break
                await _broadcast_queue(room)

            # ------ QUEUE: ADVANCE (host signals song finished, move to next) ------
            elif msg_type == "queue_advance":
                rid = user.hosted_room_id or user.room_id
                if not rid or rid not in rooms:
                    continue
                room = rooms[rid]
                if room.host_id != user_id:
                    continue
                # Mark current playing as played
                for q in room.queue:
                    if q.status == "playing":
                        q.status = "played"
                        break
                # Find next ready/pending item and mark as playing
                next_item = None
                for q in room.queue:
                    if q.status in ("ready", "pending"):
                        q.status = "playing"
                        next_item = q
                        break
                if next_item:
                    await _broadcast(room, {
                        "type": "queue_play_next",
                        "item": _queue_item_dict(next_item),
                    })
                await _broadcast_queue(room)
                # Pre-download newly priority tracks after advance
                asyncio.create_task(_predownload_priority_tracks(room))

            # ------ SUGGEST SONG (audience) ------
            elif msg_type == "suggest_song":
                if not user.room_id or user.room_id not in rooms:
                    continue
                room = rooms[user.room_id]
                # Only audience can suggest
                if room.host_id == user_id:
                    continue
                # Check if user already has a pending suggestion
                has_pending = any(s.user_id == user_id and s.status == "pending" for s in room.suggestions)
                if has_pending:
                    await _send(ws, {"type": "error", "message": "You already have a pending suggestion"})
                    continue
                suggestion = Suggestion(
                    id=str(uuid.uuid4())[:12],
                    title=raw.get("title", "Unknown")[:200],
                    source=raw.get("source", "file"),
                    url=raw.get("url", ""),
                    user_id=user_id,
                    username=user.name,
                )
                room.suggestions.append(suggestion)
                # Notify host
                host_user = room.members.get(room.host_id)
                if host_user:
                    await _send(host_user.ws, {
                        "type": "new_suggestion",
                        "suggestion": _suggestion_dict(suggestion),
                    })
                # Confirm to suggester
                await _send(ws, {
                    "type": "suggestion_sent",
                    "suggestion": _suggestion_dict(suggestion),
                })

            # ------ RESPOND TO SUGGESTION (host only) ------
            elif msg_type == "respond_suggestion":
                rid = user.hosted_room_id or user.room_id
                if not rid or rid not in rooms:
                    continue
                room = rooms[rid]
                if room.host_id != user_id:
                    continue
                suggestion_id = raw.get("suggestionId")
                action = raw.get("action")  # "approve" or "reject"
                for s in room.suggestions:
                    if s.id == suggestion_id and s.status == "pending":
                        s.status = "approved" if action == "approve" else "rejected"
                        # If approved, add to queue
                        if action == "approve":
                            item = QueueItem(
                                id=str(uuid.uuid4())[:12],
                                title=s.title,
                                source=s.source,
                                url=s.url,
                                added_by=s.user_id,
                                added_by_name=s.username,
                                soundcloud_url=s.url if s.source == "soundcloud" else None,
                            )
                            room.queue.append(item)
                        # Notify the suggester
                        suggester = room.members.get(s.user_id)
                        if suggester:
                            await _send(suggester.ws, {
                                "type": "suggestion_response",
                                "suggestionId": s.id,
                                "action": action,
                            })
                        break
                await _broadcast_queue(room)

    except WebSocketDisconnect:
        logger.info(f"User {user_id} ({user.name}) disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for {user_id}: {e}")
    finally:
        # On disconnect: clean up visited room, then destroy hosted room
        if user.room_id and user.hosted_room_id and user.room_id != user.hosted_room_id:
            if user.room_id in rooms:
                await _leave_visited_room(user)
        if user.hosted_room_id and user.hosted_room_id in rooms:
            # Destroy the hosted room (browser closed = room ends)
            await _destroy_hosted_room(user)
        if user.room_id and user.room_id in rooms:
            await _leave_room(user)
        users.pop(user_id, None)


# ---------------------------------------------------------------------------
# Room cleanup helpers
# ---------------------------------------------------------------------------

async def _leave_visited_room(user: User):
    """Remove user from a room they are visiting (not their hosted room)."""
    if not user.room_id or user.room_id not in rooms:
        return
    room = rooms[user.room_id]
    room.members.pop(user.id, None)

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

    if room.is_public:
        await _broadcast_public_rooms()

    user.room_id = None
    user.is_host = False


async def _destroy_hosted_room(user: User):
    rid = user.hosted_room_id
    if not rid or rid not in rooms:
        user.hosted_room_id = None
        return

    room = rooms[rid]

    # Notify ALL members INCLUDING HOST
    for member in list(room.members.values()):
        member.room_id = None
        member.is_host = False
        await _send(member.ws, {
            "type": "room_closed",
            "reason": "Host ended the stage"
        })

    rooms.pop(rid, None)

    user.hosted_room_id = None
    user.room_id = None
    user.is_host = False

    await _broadcast_public_rooms()



async def _leave_room(user: User):
    """Remove user from their current room, clean up if needed."""
    if not user.room_id or user.room_id not in rooms:
        user.room_id = None
        user.is_host = False
        return

    room = rooms[user.room_id]
    room.members.pop(user.id, None)
    was_host = (room.host_id == user.id)
    old_room_id = user.room_id
    user.is_host = False
    user.room_id = None

    if was_host or len(room.members) == 0:
        # Host left or room empty -> destroy room
        if room.audio_source and room.audio_source.get("type") == "upload":
            file_url = room.audio_source.get("url", "")
            filename = file_url.split("/")[-1] if file_url else ""
            filepath = os.path.join(UPLOAD_DIR, filename)
            if os.path.isfile(filepath):
                try:
                    os.remove(filepath)
                except Exception:
                    pass

        for member in list(room.members.values()):
            member.room_id = None
            member.is_host = False
            await _send(member.ws, {"type": "room_closed", "reason": "Host left the stage"})
        rooms.pop(old_room_id, None)

        if was_host:
            user.hosted_room_id = None

        await _broadcast_public_rooms()
    else:
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

        if room.is_public:
            await _broadcast_public_rooms()

    await _send(user.ws, {"type": "left_room"})
