# Audiolyze.AI

Audiolyze.AI is a web-based platform for listening to music together, combining perfectly synchronized playback with immersive, real-time 3D visuals — all directly in the browser.

Unlike Discord bots or screen sharing, Audiolyze is built specifically for reliable shared listening. Hosts can play music from uploads or SoundCloud links, and audience members hear the same audio at the same time, with automatic synchronization and drift correction. A custom Three.js visualizer turns each song into a cinematic experience.

This opens the door to a new kind of web-native music platform for creators, listening parties, and livestream-style experiences.

---
## 🎥 Demo Video

[![Audiolyze Demo](https://img.youtube.com/vi/VIDEO_ID/0.jpg)](https://www.youtube.com/watch?v=VIDEO_ID)

---

## ✨ Features

* 🎧 **Real-time synchronized music playback**
* 🌐 **Web-based — no downloads or plugins**
* 🎵 Upload audio files or use **SoundCloud tracks & playlists**
* 🎨 **Immersive 3D visualizer** powered by Three.js
* ⚡ Drift correction for late joins and unstable connections
* 🎚️ Live EQ tuning and playback control
* 👥 Public and private listening stages

---

## 🧠 How It Works

* Audio is analyzed on the backend using **Librosa** to extract beat timing and energy curves.
* Structured timing data drives visual transitions and progression.
* Playback state (play/pause/seek/speed) is synchronized across clients in real time.
* The frontend renders GPU-optimized visuals using **@react-three/fiber** and the Web Audio API.

---

## 🛠 Tech Stack

### Frontend

* React
* Three.js
* @react-three/fiber
* Web Audio API
* Vite

### Backend

* Python
* FastAPI
* Librosa
* NumPy
* yt-dlp (SoundCloud ingestion)

---

## 🚀 Running Locally

### Prerequisites

Make sure you have the following installed:

* **Node.js** (v18+ recommended)
* **Python** (3.9+)
* **ffmpeg** (required for audio processing)
* **yt-dlp**

```bash
pip install yt-dlp
```

Verify:

```bash
ffmpeg -version
```

---

## 🔧 Backend Setup (FastAPI)

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the API:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at:

```
http://127.0.0.1:8000
```

Swagger docs:

```
http://127.0.0.1:8000/docs
```

---

## 🎨 Frontend Setup (React)

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
VITE_API_BASE=http://127.0.0.1:8000
```

Run the dev server:

```bash
npm run dev
```

Frontend will be available at:

```
http://localhost:5173
```

---

## 🧪 Known Limitations

* Browser autoplay restrictions may require user interaction
* Performance depends on GPU for complex visual scenes
* Large SoundCloud playlists may take time to queue

---

## 🌱 Future Improvements

* Always-on creator stages
* Visual presets & themes
* User accounts & saved rooms
* Creator monetization tools
* Mobile optimization

---

## 📄 License

MIT License

---

## 🙌 Acknowledgements

* Librosa for audio analysis
* Three.js & react-three-fiber for rendering
* SoundCloud & yt-dlp for audio ingestion
