const API_BASE = "http://127.0.0.1:8000";

export async function fetchAIParams(file) {
  // 1️Analyze audio
  const formData = new FormData();
  formData.append("file", file);

  const analyzeRes = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!analyzeRes.ok) {
    throw new Error("Audio analysis failed");
  }

  const analyzeData = await analyzeRes.json();

  // Generate visualizer params
  const paramsRes = await fetch(`${API_BASE}/generate-params`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(analyzeData.features),
  });

  if (!paramsRes.ok) {
    throw new Error("AI param generation failed");
  }

  const paramsData = await paramsRes.json();

  return paramsData.params;
}
