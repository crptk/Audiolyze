## Inspiration

Music visualizers today are either extremely basic, offline-only, or locked behind heavy desktop software. I wanted to build something that feels alive, intelligent, and accessible directly in the browser.

The idea behind Audiolyze.AI was to move beyond visuals that simply react to volume and instead create a system that understands the structure of music. Songs naturally have buildups, drops, high-energy sections, and calmer moments. I wanted the visuals to evolve with those moments in a way that feels intentional and cinematic.

I was also inspired by how people enjoy music socially. Karaoke nights, parties, livestreams, or even just having visuals running on a second monitor are all experiences that could be enhanced with high-quality, adaptive visuals without requiring any setup.

---

## What it does

Audiolyze.AI is a web-based AI music visualizer that analyzes audio to generate immersive, real-time 3D visuals.

The system extracts beats, energy curves, and structural sections from songs to drive dynamic shape changes, environment transitions, and camera motion. Instead of looping a single effect, the visualizer evolves throughout the song based on its musical progression.

Users can upload audio or provide SoundCloud links and playlists to instantly generate visuals in the browser. The project also includes an AI-generated livestream-style chat that reacts to the music and visuals, turning the experience into something shared rather than passive.

---

## How we built it

The backend is built in Python using FastAPI and Librosa for audio analysis. Audio features such as RMS energy, onset strength, spectral centroid, and beat timing are combined to compute energy curves and detect high-energy musical sections. These sections are used to generate timestamps for visual transitions and journey segments.

The frontend is built with React and Three.js using @react-three/fiber. A custom 3D visualizer renders particle-based and geometric scenes that respond in real time to both audio playback and AI-generated structure data. Web Audio API is used for real-time frequency analysis and user-controlled EQ tuning.

AI-generated parameters are used to control visual intensity, color behavior, camera motion, and environment switching. The entire system runs fully in the browser without requiring specialized hardware or installations.

---

## Challenges we ran into

One of the biggest challenges was reliably detecting meaningful musical structure rather than noise. Songs vary wildly in genre, tempo, and dynamics, so energy segmentation had to be adaptive and robust.

Another challenge was synchronizing backend-generated timestamps with real-time audio playback on the frontend. Even small timing mismatches could break the illusion of intentional visual progression.

Performance was also a concern. Rendering high-quality 3D visuals in a browser while processing audio in real time required careful optimization to maintain smooth frame rates across different devices.

---

## What we learned

This project taught me how to bridge signal processing, AI-driven analysis, and real-time 3D graphics into a single coherent system. I gained deeper experience working with audio feature extraction, temporal segmentation, and synchronizing AI outputs with interactive visuals.

I also learned how important UX consistency is when combining automated behavior with manual user controls, especially in creative tools.

---

## Built With

* **Languages:** Python, JavaScript
* **Frontend:** React, Three.js, @react-three/fiber
* **Backend:** FastAPI
* **Audio Analysis:** Librosa, NumPy
* **Web Audio:** Web Audio API
* **AI APIs:** Google Gemini API
* **Visualization:** Custom GPU-optimized particle and geometry systems