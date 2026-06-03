"use client";

import { useState } from "react";

export function MusicPreviewButton({ label = "Preview song" }: { label?: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <button
      type="button"
      className={`souv-music-fab ${playing ? "is-playing" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        setPlaying((p) => !p);
      }}
      aria-label={playing ? "Pause song" : label}
    >
      {playing ? (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M9 17V5l11-2v12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="17" r="2.4" />
          <circle cx="17" cy="15" r="2.4" />
        </svg>
      )}
    </button>
  );
}
