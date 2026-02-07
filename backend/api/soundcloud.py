import logging
import os
import json
import subprocess
import tempfile
import uuid
import shutil

from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel
print(">>> soundcloud.py import started")
router = APIRouter()
logger = logging.getLogger("audiolyze.soundcloud")
logger.setLevel(logging.INFO)
print(">>> soundcloud router created")

# Directory to store downloaded files temporarily
DOWNLOAD_DIR = os.path.join(tempfile.gettempdir(), "audiolyze_downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)


class SoundCloudRequest(BaseModel):
    url: str

@router.post("/soundcloud/info")
async def soundcloud_info(req: SoundCloudRequest):
    """
    Fetch metadata about a SoundCloud URL (track or playlist).
    Uses yt-dlp --flat-playlist --dump-json to get info without downloading.
    """
    url = req.url.strip()
    logger.info("Fetching SoundCloud info for: %s", url)

    try:
        # First try flat playlist to detect if it's a playlist
        result = subprocess.run(
            [
                "yt-dlp",
                "--flat-playlist",
                "--dump-json",
                "--no-warnings",
                url,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            logger.error("yt-dlp info failed: %s", result.stderr)
            return {"ok": False, "error": "Failed to fetch SoundCloud info. Check the URL."}

        # Parse JSON lines (one per track in a playlist, or one for a single track)
        lines = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
        entries = []
        for line in lines:
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue

        if len(entries) == 0:
            return {"ok": False, "error": "No tracks found at this URL."}

        if len(entries) == 1:
            # Single track
            entry = entries[0]
            return {
                "ok": True,
                "type": "track",
                "title": entry.get("title", "Unknown Track"),
                "url": entry.get("url", url),
                "duration": entry.get("duration"),
                "uploader": entry.get("uploader", ""),
            }
        else:
            # Playlist
            tracks = []
            for entry in entries:
                tracks.append({
                    "title": entry.get("title", "Unknown Track"),
                    "url": entry.get("url", ""),
                    "duration": entry.get("duration"),
                    "uploader": entry.get("uploader", ""),
                })

            return {
                "ok": True,
                "type": "playlist",
                "title": f"Playlist ({len(tracks)} tracks)",
                "tracks": tracks,
            }

    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Request timed out"}
    except FileNotFoundError:
        return {"ok": False, "error": "yt-dlp not found. Please install it: pip install yt-dlp"}
    except Exception as e:
        logger.exception("SoundCloud info error")
        return {"ok": False, "error": str(e)}


@router.post("/soundcloud/download")
async def soundcloud_download(req: SoundCloudRequest):
    """
    Download a single SoundCloud track as MP3 using yt-dlp.
    Returns a URL to the downloaded file.
    """
    url = req.url.strip()
    logger.info("Downloading SoundCloud track: %s", url)

    # Generate unique filename
    file_id = str(uuid.uuid4())[:8]
    output_path = os.path.join(DOWNLOAD_DIR, f"{file_id}.mp3")

    try:
        result = subprocess.run(
            [
                "yt-dlp",
                "-x",
                "--audio-format", "mp3",
                "--audio-quality", "0",
                "-o", output_path.replace(".mp3", ".%(ext)s"),
                "--no-playlist",
                "--no-warnings",
                url,
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            logger.error("yt-dlp download failed: %s", result.stderr)
            return {"ok": False, "error": "Download failed. Check the URL."}

        # yt-dlp may name the file slightly differently, find it
        actual_path = output_path
        if not os.path.exists(actual_path):
            # Check for the file with the base name
            base = os.path.join(DOWNLOAD_DIR, file_id)
            for ext in [".mp3", ".m4a", ".opus", ".ogg", ".wav"]:
                candidate = base + ext
                if os.path.exists(candidate):
                    actual_path = candidate
                    break

        if not os.path.exists(actual_path):
            return {"ok": False, "error": "Downloaded file not found"}

        logger.info("Download complete: %s", actual_path)

        return {
            "ok": True,
            "file_url": f"/soundcloud/file/{os.path.basename(actual_path)}",
            "filename": os.path.basename(actual_path),
        }

    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Download timed out (>120s)"}
    except FileNotFoundError:
        return {"ok": False, "error": "yt-dlp not found. Please install it: pip install yt-dlp"}
    except Exception as e:
        logger.exception("SoundCloud download error")
        return {"ok": False, "error": str(e)}


@router.get("/soundcloud/file/{filename}")
async def soundcloud_file(filename: str):
    """Serve a downloaded audio file."""
    filepath = os.path.join(DOWNLOAD_DIR, filename)
    if not os.path.exists(filepath):
        return {"ok": False, "error": "File not found"}

    return FileResponse(
        filepath,
        media_type="audio/mpeg",
        filename=filename,
    )
