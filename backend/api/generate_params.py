from fastapi import APIRouter

router = APIRouter()

@router.post("/generate-params")
def generate_params(payload: dict):
    # Later: use features + Gemini to output numbers only
    return {"ok": True, "params": {"colorTheme": "cool", "fovAmp": 16}}
