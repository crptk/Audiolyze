from fastapi import APIRouter, UploadFile, File
import librosa
import numpy as np
import tempfile
import os
import logging
import time

router = APIRouter()

logger = logging.getLogger("audiolyze.analyze")
logger.setLevel(logging.INFO)


@router.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    t0 = time.time()
    logger.info("=== /analyze START ===")

    suffix = os.path.splitext(file.filename)[1] or ".bin"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        raw = await file.read()
        tmp.write(raw)
        tmp_path = tmp.name

    try:
        # ---- Load audio ----
        y, sr = librosa.load(tmp_path, mono=True)
        duration = float(librosa.get_duration(y=y, sr=sr))

        # ---- Global features ----
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)

        rms = librosa.feature.rms(y=y)[0]
        rms_energy = float(np.mean(rms))

        stft = np.abs(librosa.stft(y))
        freqs = librosa.fft_frequencies(sr=sr)

        bass_energy = float(np.mean(stft[freqs < 150]))

        spectral_centroid = float(
            np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
        )

        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))

        features = {
            "tempo": float(np.clip(float(tempo) / 200.0, 0.0, 1.0)),
            "rms_energy": float(np.clip(rms_energy * 10.0, 0.0, 1.0)),
            "bass_energy": float(np.clip(bass_energy / 100.0, 0.0, 1.0)),
            "brightness": float(np.clip(spectral_centroid / 5000.0, 0.0, 1.0)),
            "percussiveness": float(np.clip(zcr * 5.0, 0.0, 1.0)),
            "duration": duration,
        }

        # ---- Beatmap extraction (IMPORTANT PART) ----
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)

        tempo_bt, beat_frames = librosa.beat.beat_track(
            onset_envelope=onset_env,
            sr=sr
        )

        logger.info("Audio loaded: y=%d samples, sr=%d", len(y), sr)


        # Fallback if no beats detected
        if len(beat_frames) == 0:
            beat_frames = librosa.onset.onset_detect(
                onset_envelope=onset_env,
                sr=sr,
                backtrack=False,
                delta=0.2
            )

        beat_times = librosa.frames_to_time(beat_frames, sr=sr)

        beat_strengths = onset_env[
            np.clip(beat_frames, 0, len(onset_env) - 1)
        ]

        max_s = float(np.max(beat_strengths)) if len(beat_strengths) else 1.0
        beat_strengths = beat_strengths / max_s

        beats = [
            {
                "time": float(t),
                "strength": float(np.clip(s, 0, 1))
            }
            for t, s in zip(beat_times, beat_strengths)
        ]

        logger.info("Detected %d beats", len(beats))
        logger.info("Beat frames: %s", beat_frames[:10])

        return {
            "ok": True,
            "features": features,
            "beatmap": {
                "tempo": float(tempo_bt),
                "beats": beats
            }
        }

    finally:
        os.remove(tmp_path)
