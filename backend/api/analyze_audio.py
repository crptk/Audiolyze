from fastapi import APIRouter, UploadFile, File
import librosa
import numpy as np
import tempfile
import os

router = APIRouter()

@router.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    """
    Analyze uploaded audio and extract normalized features
    suitable for AI-driven visualization.
    """

    # -------------------------
    # Save uploaded file temp
    # -------------------------
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        # -------------------------
        # Load audio
        # -------------------------
        y, sr = librosa.load(tmp_path, mono=True)

        duration = librosa.get_duration(y=y, sr=sr)

        # -------------------------
        # Feature extraction
        # -------------------------

        # Tempo (BPM)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)

        # RMS Energy
        rms = librosa.feature.rms(y=y)[0]
        rms_energy = float(np.mean(rms))

        # Bass energy (low-frequency focus)
        stft = np.abs(librosa.stft(y))
        freqs = librosa.fft_frequencies(sr=sr)
        bass_mask = freqs < 150  # bass < 150 Hz
        bass_energy = float(np.mean(stft[bass_mask]))

        # Spectral centroid (brightness)
        spectral_centroid = float(
            np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
        )

        # Zero crossing rate (percussiveness)
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))

        # -------------------------
        # Normalization (IMPORTANT)
        # -------------------------

        features = {
            "tempo": float(np.clip(tempo / 200.0, 0.0, 1.0)),  # normalize BPM
            "rms_energy": float(np.clip(rms_energy * 10.0, 0.0, 1.0)),
            "bass_energy": float(np.clip(bass_energy / 100.0, 0.0, 1.0)),
            "brightness": float(np.clip(spectral_centroid / 5000.0, 0.0, 1.0)),
            "percussiveness": float(np.clip(zcr * 5.0, 0.0, 1.0)),
            "duration": float(duration)
        }

        return {
            "ok": True,
            "features": features
        }

    finally:
        # Cleanup temp file
        os.remove(tmp_path)
