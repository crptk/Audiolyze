const API_BASE = import.meta.env.VITE_API_BASE;
console.log("[env] API_BASE =", API_BASE);

/**
 * Fetch SoundCloud URL info (track or playlist metadata).
 */
export async function fetchSoundCloudInfo(url) {
  const res = await fetch(`${API_BASE}/soundcloud/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    throw new Error("SoundCloud info request failed");
  }

  return res.json();
}

/**
 * Download a single SoundCloud track. Returns { ok, file_url, filename }.
 */
export async function fetchSoundCloudDownload(url) {
  const res = await fetch(`${API_BASE}/soundcloud/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    throw new Error("SoundCloud download request failed");
  }

  return res.json();
}

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

  // Final params object passed to frontend
  const result = {
    ...paramsData.params,
    beats,
    journeys,
    shapeChanges,
    sections,
  };

  return result;
}
