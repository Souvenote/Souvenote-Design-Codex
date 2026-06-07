"use client";

import * as React from "react";
import { Eyebrow } from "./Ornaments";
import { MusicPreviewButton } from "./Hero";

// Gallery.jsx — horizontal carousel of card template previews; hover-to-flip 3D rotation

const TEMPLATES = [
  { id: 1, name: 'Your Life As A Hero',     occasion: 'Comic Strip',     surface: 'surface-gold-animated' },
  { id: 2, name: 'Stars Aligned For You',   occasion: 'Horoscope',       surface: 'surface-rosegold-animated' },
  { id: 3, name: 'A Day In History',        occasion: 'On This Day',     surface: 'surface-silver-animated' },
  { id: 4, name: 'Once Upon A Card',        occasion: 'Fairy Tale',      surface: 'surface-rosegold-animated' },
  { id: 5, name: 'Find The Birthday',       occasion: "Where's Waldo",   surface: 'surface-trimetal-animated' },
  { id: 6, name: 'Cards For The Strange',   occasion: 'Dark Holidays',   surface: 'surface-silver-animated' },
];

// Small "swap image" affordance, anchored to the top-right of a card face.
// Click → pick file → preview overlays the gradient. Click × to clear.
function CardImageSwap({ image, onChange, onClear, label = 'Change image' }) {
  const inputRef = React.useRef(null);
  const handlePick = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onChange(url);
    e.target.value = '';
  };
  return (
    <div className="souv-gallery-swap" onClick={(e) => e.stopPropagation()}>
      {image ? (
        <button
          type="button"
          className="souv-gallery-swap-btn is-clear"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
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
          onClick={(e) => { e.stopPropagation(); inputRef.current && inputRef.current.click(); }}
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
        onChange={handlePick}
        tabIndex={-1}
      />
    </div>
  );
}

function GalleryMusicOrnament() {
  return (
    <div className="souv-music-orn souv-music-orn-card" aria-hidden="true">
      <div className="souv-music-row">
        <span className="souv-music-note">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 17V5l11-2v12" /><circle cx="6" cy="17" r="2.5" /><circle cx="17" cy="15" r="2.5" /></svg>
        </span>
        <button className="souv-music-play" aria-label="Play">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <div className="souv-music-track">
          <div className="souv-music-progress" />
          <div className="souv-music-handle" />
        </div>
        <span className="souv-music-time">0:42</span>
      </div>
    </div>
  );
}

function GalleryCard({ c, active }) {
  // Per-face image state. Front/back can be swapped independently.
  const [frontImg, setFrontImg] = React.useState(null);
  const [backImg, setBackImg]   = React.useState(null);

  return (
    <div className={`souv-gallery-card ${active ? 'is-active' : ''}`}>
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
  const trackRef = React.useRef(null);

  React.useEffect(() => {
    if (!trackRef.current) return;
    const el = trackRef.current.children[i];
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }, [i]);

  return (
    <section className="souv-gallery">
      <div className="souv-gallery-head">
        <div className="souv-gallery-rail">
          <div className="souv-gallery-rail-line" />
          <Eyebrow>Gallery</Eyebrow>
          <h2 className="souv-h1">
            <span className="souv-hero-italic text-metallic-silver">Explore the</span>{' '}
            <span className="souv-hero-italic text-metallic-rose-gold">possibilities</span>
          </h2>
          <p className="souv-gallery-sub">Remix our card templates to match the vibe of your loved one.</p>
          <div className="souv-gallery-controls">
            <button className="souv-chev" onClick={() => setI(Math.max(0, i - 1))} aria-label="Previous">‹</button>
            <button className="souv-chev" onClick={() => setI(Math.min(TEMPLATES.length - 1, i + 1))} aria-label="Next">›</button>
          </div>
        </div>
        <div className="souv-gallery-track-wrap">
          <div ref={trackRef} className="souv-gallery-track">
            {TEMPLATES.map((c, idx) => (
              <GalleryCard key={c.id} c={c} active={idx === i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export { Gallery };
