import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"]
)

response = client.models.generate_content(
    model="models/gemini-2.5-flash",
    contents="Return ONLY a JSON object with fields energy, warmth, turbulence."
)

print(response.text)
