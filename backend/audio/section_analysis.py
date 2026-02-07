import numpy as np
import librosa


def compute_energy_curve(y, sr):
    rms = librosa.feature.rms(y=y)[0]
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    onset = librosa.onset.onset_strength(y=y, sr=sr)

    def norm(x):
        return (x - np.min(x)) / (np.max(x) - np.min(x) + 1e-6)

    rms_n = norm(rms)
    centroid_n = norm(centroid)
    onset_n = norm(onset)

    energy = (
        0.45 * rms_n +
        0.35 * onset_n +
        0.20 * centroid_n
    )

    energy = np.convolve(energy, np.ones(12) / 12, mode="same")

    times = librosa.frames_to_time(
        np.arange(len(energy)),
        sr=sr
    )

    return times, energy


def segment_sections(times, energy, min_section_duration=6.0):
    sections = []

    low_th = np.percentile(energy, 35)
    high_th = np.percentile(energy, 70)

    def band(e):
        if e < low_th:
            return "low"
        elif e < high_th:
            return "mid"
        return "high"

    current_band = band(energy[0])
    start_idx = 0

    for i in range(1, len(energy)):
        if band(energy[i]) != current_band:
            start = times[start_idx]
            end = times[i]

            if end - start >= min_section_duration:
                sections.append({
                    "start": float(start),
                    "end": float(end),
                    "energy": float(np.max(energy[start_idx:i]))
                })
                start_idx = i
                current_band = band(energy[i])

    sections.append({
        "start": float(times[start_idx]),
        "end": float(times[-1]),
        "energy": float(np.max(energy[start_idx:]))
    })

    return sections


def detect_journeys(
    sections,
    max_journeys=5,
    min_duration=8.0,
    min_gap=12.0,
    force_at_least_one=True,
):
    """
    Picks up to max_journeys high-energy sustained sections.
    Guarantees at least one journey if force_at_least_one=True.
    """

    if not sections:
        return []

    # Candidates that meet the duration requirement
    candidates = [
        s for s in sections
        if (s["end"] - s["start"]) >= min_duration
    ]

    # If nothing meets min_duration, fall back to "best energy" section
    if not candidates:
        if not force_at_least_one:
            return []

        best = max(sections, key=lambda s: float(s.get("energy", 0.0)))
        return [{
            "start": float(best["start"]),
            "end": float(best["end"]),
            "duration": float(best["end"] - best["start"]),
            "energy": float(best.get("energy", 0.0)),
        }]

    # Sort by energy descending
    candidates.sort(key=lambda s: float(s.get("energy", 0.0)), reverse=True)

    journeys = []
    for sec in candidates:
        if len(journeys) >= max_journeys:
            break

        s0 = float(sec["start"])
        e0 = float(sec["end"])

        # Require time separation between journey starts
        if any(abs(s0 - j["start"]) < min_gap for j in journeys):
            continue

        journeys.append({
            "start": s0,
            "end": e0,
            "duration": e0 - s0,
            "energy": float(sec.get("energy", 0.0)),
        })

    # Sort chronologically
    journeys.sort(key=lambda j: j["start"])

    # If we somehow filtered everything out by min_gap, still force one
    if force_at_least_one and len(journeys) == 0:
        best = max(candidates, key=lambda s: float(s.get("energy", 0.0)))
        journeys = [{
            "start": float(best["start"]),
            "end": float(best["end"]),
            "duration": float(best["end"] - best["start"]),
            "energy": float(best.get("energy", 0.0)),
        }]

    return journeys



def generate_shape_changes(sections, journeys, min_gap=10.0):
    shape_times = []
    last_time = -999

    def in_journey(t):
        return any(j["start"] <= t <= j["end"] for j in journeys)

    for s in sections:
        t = s["start"]

        if in_journey(t):
            continue

        if t - last_time >= min_gap:
            shape_times.append(float(t))
            last_time = t

    return shape_times
