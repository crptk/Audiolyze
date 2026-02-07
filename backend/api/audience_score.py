from fastapi import APIRouter

router = APIRouter()

@router.post("/score")
def score(payload: dict):
    # Later: generate 50-100 comments + score, write history.json
    return {"ok": True, "score": 8.7, "comments": []}
