import { Routes, Route, Navigate } from "react-router-dom";
import InsertAudio from "./pages/InsertAudio";
import Visualizer from "./pages/Visualizer";
import Scoring from "./pages/Scoring";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<InsertAudio />} />
      <Route path="/visualizer" element={<Visualizer />} />
      <Route path="/scoring" element={<Scoring />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
