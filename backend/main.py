import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.analyze_audio import router as analyze_router
from api.generate_params import router as params_router
from api.audience_score import router as score_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

app = FastAPI(title="Audiolyze.ai API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(params_router)
app.include_router(score_router)
