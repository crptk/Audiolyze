from fastapi import APIRouter, UploadFile, File

router = APIRouter()

@router.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    # Later: save temp file, librosa load, extract features
    return {"ok": True, "filename": file.filename}
