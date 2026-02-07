"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Music, BarChart3, Sparkles } from "lucide-react";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("audio/")) {
      setFile(droppedFile);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    // Placeholder: will connect to backend later
    alert(`Analyzing: ${file.name}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <Music className="h-8 w-8 text-foreground" />
            <h1 className="text-4xl font-bold tracking-tight text-foreground text-balance">
              Audiolyze
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            AI-powered audio analysis, visualization, and audience scoring.
          </p>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : file
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/50"
          }`}
          role="button"
          tabIndex={0}
          aria-label="Upload audio file"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              inputRef.current?.click();
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="sr-only"
          />
          <Upload className="h-10 w-10 text-muted-foreground" />
          {file ? (
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium text-foreground">
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium text-foreground">
                Drop your audio file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Supports MP3, WAV, FLAC, and other audio formats
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!file}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          Analyze Audio
        </button>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Music className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-medium text-card-foreground">
                Feature Extraction
              </h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Extract BPM, key, energy, and other audio features automatically.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-medium text-card-foreground">
                AI Visualizer
              </h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Generate dynamic visualizer parameters powered by AI.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-medium text-card-foreground">
                Audience Scoring
              </h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Get AI-generated audience scores and simulated feedback.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
