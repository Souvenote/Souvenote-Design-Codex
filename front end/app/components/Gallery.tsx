"use client";

import * as React from "react";
import { scrollContainerToItem } from "../lib/galleryScroll";
import { Eyebrow } from "./Ornaments";
import { MusicPreviewButton } from "./Hero";

type GalleryTemplate = {
  id: number;
  name: string;
  occasion: string;
  surface: string;
};

type CardImageSwapProps = {
  image: string | null;
  onChange: (url: string) => void;
  onClear: () => void;
  label?: string;
};

type GalleryCardProps = {
  c: GalleryTemplate;
  active: boolean;
};

const TEMPLATES: GalleryTemplate[] = [
  { id: 1, name: "Your Life As A Hero", occasion: "Comic Strip", surface: "surface-gold-animated" },
  { id: 2, name: "Stars Aligned For You", occasion: "Horoscope", surface: "surface-rosegold-animated" },
  { id: 3, name: "A Day In History", occasion: "On This Day", surface: "surface-silver-animated" },
  { id: 4, name: "Once Upon A Card", occasion: "Fairy Tale", surface: "surface-rosegold-animated" },
  { id: 5, name: "Find The Birthday", occasion: "Where's Waldo", surface: "surface-trimetal-animated" },
  { id: 6, name: "Cards For The Strange", occasion: "Dark Holidays", surface: "surface-silver-animated" },
];

function CardImageSwap({ image, onChange, onClear, label = "Change image" }: CardImageSwapProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    onChange(url);
    event.target.value = "";
  };

  return (
    <div className="souv-gallery-swap" onClick={(event) => event.stopPropagation()}>
      {image ? (
        <button
          type="button"
          className="souv-gallery-swap-btn is-clear"
          onClick={(event) => {
            event.stopPropagation();
            onClear();
          }}
          aria-label="Remove image"
          title="Remove image"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          className="souv-gallery-swap-btn"
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
          aria-label={label}
          title={label}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="11" r="2" />
            <path d="M3 17l5-5 4 4 3-3 6 6" />
          </svg>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="souv-gallery-swap-input"
        aria-label={label}
        onChange={handlePick}
        tabIndex={-1}
      />
    </div>
  );
}

function GalleryCard({ c, active }: GalleryCardProps) {
  const [frontImg, setFrontImg] = React.useState<string | null>(null);
  const [backImg, setBackImg] = React.useState<string | null>(null);

  return (
    <div className={`souv-gallery-card ${active ? "is-active" : ""}`}>
      <div className="souv-gallery-flip">
        <div className="souv-gallery-flip-inner">
          <div className={`souv-gallery-surface souv-gallery-flip-face souv-gallery-flip-front ${c.surface}`}>
            {frontImg && <img src={frontImg} alt="" className="souv-gallery-surface-img" />}
            <div className="souv-gallery-surface-center">
              {!frontImg && <div className="souv-gallery-occasion">{c.occasion}</div>}
            </div>
            <CardImageSwap
              image={frontImg}
              onChange={setFrontImg}
              onClear={() => setFrontImg(null)}
              label="Change front image"
            />
            <MusicPreviewButton label={`Preview ${c.name} song`} />
          </div>
          <div className={`souv-gallery-surface souv-gallery-flip-face souv-gallery-flip-back ${c.surface}`}>
            {backImg && <img src={backImg} alt="" className="souv-gallery-surface-img" />}
            <div className="souv-gallery-surface-center">
              {!backImg && <div className="souv-gallery-occasion">{c.occasion}</div>}
            </div>
            <CardImageSwap
              image={backImg}
              onChange={setBackImg}
              onClear={() => setBackImg(null)}
              label="Change back image"
            />
            <MusicPreviewButton label={`Preview ${c.name} song`} />
          </div>
        </div>
      </div>
      <div className="souv-gallery-meta">
        <div className="souv-gallery-name">{c.name}</div>
      </div>
    </div>
  );
}

function Gallery() {
  const [i, setI] = React.useState(0);
  const trackRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const track = trackRef.current;
    const card = track?.children[i];
    if (track && card) {
      scrollContainerToItem(track, card, i === 0 ? "auto" : "smooth");
    }
  }, [i]);

  return (
    <section className="souv-gallery">
      <div className="souv-gallery-head">
        <div className="souv-gallery-rail">
          <div className="souv-gallery-rail-line" />
          <Eyebrow>Gallery</Eyebrow>
          <h2 className="souv-h1">
            <span className="souv-hero-italic text-metallic-silver">Explore the</span>{" "}
            <span className="souv-hero-italic text-metallic-rose-gold">possibilities</span>
          </h2>
          <p className="souv-gallery-sub">Remix our card templates to match the vibe of your loved one.</p>
          <div className="souv-gallery-controls">
            <button className="souv-chev" onClick={() => setI(Math.max(0, i - 1))} aria-label="Previous">&lsaquo;</button>
            <button className="souv-chev" onClick={() => setI(Math.min(TEMPLATES.length - 1, i + 1))} aria-label="Next">&rsaquo;</button>
          </div>
        </div>
        <div className="souv-gallery-track-wrap">
          <div ref={trackRef} className="souv-gallery-track">
            {TEMPLATES.map((template, idx) => (
              <GalleryCard key={template.id} c={template} active={idx === i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export { Gallery };
