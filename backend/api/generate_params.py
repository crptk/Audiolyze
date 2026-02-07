from fastapi import APIRouter
import os
import json
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

router = APIRouter()

# Initialize Gemini client once
client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"]
)

MODEL_NAME = "models/gemini-2.5-flash"


@router.post("/generate-params")
def generate_params(payload: dict):
    """
    Convert normalized audio features into visualizer parameters
    using Gemini. Returns STRICT JSON only.
    """

    prompt = f"""
You are an AI that maps music features to 3D visualizer parameters.

INPUT FEATURES (all values are normalized 0–1 unless stated):
{json.dumps(payload, indent=2)}

RULES:
- Return ONLY valid JSON
- NO markdown
- NO explanation
- NO extra keys
- All numbers must be within the specified ranges

OUTPUT FORMAT:
{{
  "colorScheme": {{
    "warmth": number between 0 and 1,
    "hueBase": number between 0 and 1,
    "saturation": number between 0.6 and 1,
    "brightness": number between 0.4 and 0.8
  }},
  "energy": {{
    "baseFlow": number between 0.3 and 1.5,
    "turbulence": number between 0.5 and 2.5,
    "particleSize": number between 0.08 and 0.25
  }},
  "camera": {{
    "baseFOV": 60,
    "fovRange": number between 8 and 24
  }},
  "timeline": []
}}
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt
    )

    # Parse Gemini output safely
    try:
        params = json.loads(response.text)
    except json.JSONDecodeError:
        return {
            "ok": False,
            "error": "Gemini returned invalid JSON",
            "raw": response.text
        }

    return {
        "ok": True,
        "params": params
    }
