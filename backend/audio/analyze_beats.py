import librosa
import numpy as np
import json

AUDIO_PATH = "song.mp3"
OUT_PATH = "beats.json"

# Load audio
y, sr = librosa.load(AUDIO_PATH, sr=None)

# Onset envelope (energy spikes)
onset_env = librosa.onset.onset_strength(y=y, sr=sr)

# Beat tracking
tempo, beat_frames = librosa.beat.beat_track(
    onset_envelope=onset_env,
    sr=sr
)

# Convert frames → time
beat_times = librosa.frames_to_time(beat_frames, sr=sr)

# Get beat intensities
beat_strengths = onset_env[beat_frames]

# Normalize strengths
beat_strengths = beat_strengths / np.max(beat_strengths)

beats = [
    {
        "time": float(t),
        "strength": float(s)
    }
    for t, s in zip(beat_times, beat_strengths)
]

with open(OUT_PATH, "w") as f:
    json.dump({
        "tempo": float(tempo),
        "beats": beats
    }, f, indent=2)

print(f"Saved {len(beats)} beats → {OUT_PATH}")
