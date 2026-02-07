const API_BASE = "http://127.0.0.1:8000";

export async function fetchAIParams(file) {
  // 1️⃣ Analyze audio (features + beatmap + structure)
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

  // 2️⃣ Generate visualizer params from features
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

  // 3️⃣ Extract structural data (✅ FIXED)
  const beats = analyzeData?.beatmap?.beats ?? [];
  const structure = analyzeData?.structure ?? {};

  const journeys = structure.journeys ?? [];          // ✅ plural
  const shapeChanges = structure.shapeChanges ?? [];  // ✅ camelCase
  const sections = structure.sections ?? [];

  // 🔎 Debug (keep these for now)
  console.log("[v0] Raw analyzeData.structure:", structure);
  console.log("[v0] Extracted journeys:", journeys);
  console.log("[v0] Extracted shapeChanges:", shapeChanges);
  console.log("[v0] Extracted sections:", sections);
  console.log("[v0] Beat count:", beats.length);
  console.log("[v0] paramsData.params keys:", Object.keys(paramsData.params || {}));

  // Final params object passed to frontend
  const result = {
    ...paramsData.params,
    beats,
    journeys,
    shapeChanges,
    sections,
  };

  console.log("[v0] Final aiParams.journeys:", result.journeys);
  console.log("[v0] Final aiParams.shapeChanges:", result.shapeChanges);

  return result;
}
