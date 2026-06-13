"use client";

import * as React from "react";

export type DemoLibraryCard = {
  id: string;
  pal: string;
  glyph: string;
  song?: boolean;
  days: number;
  title: string;
  saved: string;
};

export type DemoLibrarySong = {
  id: string;
  name: string;
  voice: string;
  card: string;
  days: number;
};

export type DemoLibrary = {
  cards: DemoLibraryCard[];
  songs: DemoLibrarySong[];
};

export type GeneratedSouvenoteInput = {
  title?: string;
  palette?: string;
  glyph?: string;
  songName?: string;
  voice?: string;
};

export const DEMO_LIBRARY_STORAGE_KEY = "souv_demo_library";

const EMPTY_DEMO_LIBRARY: DemoLibrary = {
  cards: [],
  songs: [],
};

function normalizeLibrary(value: unknown): DemoLibrary {
  const source = value && typeof value === "object" ? value as Partial<DemoLibrary> : {};
  return {
    cards: Array.isArray(source.cards) ? source.cards : [],
    songs: Array.isArray(source.songs) ? source.songs : [],
  };
}

export function readDemoLibrary(): DemoLibrary {
  if (typeof window === "undefined") return EMPTY_DEMO_LIBRARY;

  try {
    const raw = window.localStorage.getItem(DEMO_LIBRARY_STORAGE_KEY);
    return raw ? normalizeLibrary(JSON.parse(raw)) : EMPTY_DEMO_LIBRARY;
  } catch {
    return EMPTY_DEMO_LIBRARY;
  }
}

function writeDemoLibrary(library: DemoLibrary): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(DEMO_LIBRARY_STORAGE_KEY, JSON.stringify(library));
  window.dispatchEvent(new CustomEvent("souv-demo-library", { detail: library }));
}

export function addGeneratedSouvenote(input: GeneratedSouvenoteInput = {}): DemoLibrary {
  if (typeof window === "undefined") return EMPTY_DEMO_LIBRARY;

  const current = readDemoLibrary();
  const now = Date.now();
  const title = input.title || "Custom Souvenote";
  const id = `generated-${now}`;
  const card: DemoLibraryCard = {
    id,
    pal: input.palette || "rose",
    glyph: input.glyph || "S",
    song: true,
    days: 30,
    title,
    saved: "just now",
  };
  const song: DemoLibrarySong = {
    id: `song-${now}`,
    name: input.songName || `${title} Song`,
    voice: input.voice || "Generated Souvenote song",
    card: title,
    days: 30,
  };

  const next = {
    cards: [card, ...current.cards].slice(0, 24),
    songs: [song, ...current.songs].slice(0, 24),
  };
  writeDemoLibrary(next);
  return next;
}

export function clearDemoLibrary(): void {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(DEMO_LIBRARY_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("souv-demo-library", { detail: EMPTY_DEMO_LIBRARY }));
}

export function useDemoLibrary(): DemoLibrary {
  const [library, setLibrary] = React.useState<DemoLibrary>(EMPTY_DEMO_LIBRARY);

  React.useEffect(() => {
    const sync = () => setLibrary(readDemoLibrary());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("souv-demo-library", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("souv-demo-library", sync);
    };
  }, []);

  return library;
}
