const API_BASE = "http://localhost:8000";

export async function analyzeAudio(file) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error("Analyze failed");
  return res.json();
}
