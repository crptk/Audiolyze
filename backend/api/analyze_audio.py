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
    """
    Analyze uploaded audio and extract normalized features
    suitable for AI-driven visualization.
    """
    t0 = time.time()
    logger.info("=== /analyze START ===")
    logger.info("Incoming file: name=%s content_type=%s", file.filename, file.content_type)

    # -------------------------
    # Save uploaded file temp
    # -------------------------
    suffix = os.path.splitext(file.filename)[1] or ".bin"
    logger.info("Saving upload to temp file (suffix=%s)...", suffix)

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        raw = await file.read()
        tmp.write(raw)
        tmp_path = tmp.name

    logger.info("Saved temp file: %s (bytes=%d)", tmp_path, len(raw))

    try:
        # -------------------------
        # Load audio
        # -------------------------
        logger.info("Loading audio with librosa.load(mono=True)...")
        y, sr = librosa.load(tmp_path, mono=True)
        logger.info("Loaded audio: sr=%d samples=%d seconds=%.2f",
                    sr, len(y), librosa.get_duration(y=y, sr=sr))

        duration = float(librosa.get_duration(y=y, sr=sr))

        # -------------------------
        # Feature extraction
        # -------------------------
        logger.info("Extracting tempo (beat_track)...")
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        logger.info("Tempo (raw BPM): %.2f", float(tempo))

        logger.info("Extracting RMS energy...")
        rms = librosa.feature.rms(y=y)[0]
        rms_energy = float(np.mean(rms))
        logger.info("RMS mean (raw): %.6f | RMS min/max: %.6f/%.6f",
                    rms_energy, float(np.min(rms)), float(np.max(rms)))

        logger.info("Computing STFT magnitude...")
        stft = np.abs(librosa.stft(y))
        freqs = librosa.fft_frequencies(sr=sr)

        logger.info("Extracting bass energy (<150Hz)...")
        bass_mask = freqs < 150
        bass_energy = float(np.mean(stft[bass_mask]))
        logger.info("Bass energy (raw): %.6f", bass_energy)

        logger.info("Extracting spectral centroid (brightness)...")
        spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        logger.info("Spectral centroid (raw): %.2f Hz", spectral_centroid)

        logger.info("Extracting zero crossing rate (percussiveness)...")
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))
        logger.info("Zero crossing rate (raw): %.6f", zcr)

        # -------------------------
        # Normalization
        # -------------------------
        logger.info("Normalizing features to stable ranges...")

        features = {
            "tempo": float(np.clip(float(tempo) / 200.0, 0.0, 1.0)),
            "rms_energy": float(np.clip(rms_energy * 10.0, 0.0, 1.0)),
            "bass_energy": float(np.clip(bass_energy / 100.0, 0.0, 1.0)),
            "brightness": float(np.clip(spectral_centroid / 5000.0, 0.0, 1.0)),
            "percussiveness": float(np.clip(zcr * 5.0, 0.0, 1.0)),
            "duration": duration,
        }

        logger.info("Normalized features: %s", features)
        logger.info("=== /analyze END (%.2fs) ===", time.time() - t0)

        return {"ok": True, "features": features}

    except Exception:
        logger.exception("Error during /analyze processing")
        raise

    finally:
        try:
            os.remove(tmp_path)
            logger.info("Temp file cleaned up: %s", tmp_path)
        except Exception:
            logger.warning("Failed to delete temp file: %s", tmp_path)
