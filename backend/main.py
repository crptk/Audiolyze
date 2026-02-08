import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.analyze_audio import router as analyze_router
from api.generate_params import router as params_router
from api.audience_score import router as score_router
from api.soundcloud import router as soundcloud_router
from api.rooms import router as rooms_router
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

app = FastAPI(title="Audiolyze.ai API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.audiolyze.xyz",
        "https://audiolyze.xyz",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(analyze_router)
app.include_router(params_router)
app.include_router(score_router)
app.include_router(soundcloud_router)
app.include_router(rooms_router)
