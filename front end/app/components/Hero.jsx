"use client";

import * as React from "react";
import Link from "next/link";

// Hero.jsx — headline + trial CTA + rotating card with music preview

function MusicPreviewButton({ label = 'Preview song' }) {
  const [playing, setPlaying] = React.useState(false);
  return (
    <button
      type="button"
      className={`souv-music-fab ${playing ? 'is-playing' : ''}`}
      onClick={(e) => { e.stopPropagation(); setPlaying(p => !p); }}
      aria-label={playing ? 'Pause song' : label}
    >
      {playing ? (
        // Pause icon
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        // Music note + play
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M9 17V5l11-2v12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="17" r="2.4" />
          <circle cx="17" cy="15" r="2.4" />
        </svg>
      )}
    </button>
  );
}

function HeroFlipCard() {
  return (
    <div className="souv-flipcard souv-flipcard-spin">
      <div className="souv-flipcard-inner">
        {/* Front: gold gradient with the Souvenote main logo */}
        <div className="souv-flipcard-face souv-flipcard-front">
          <div className="souv-flipcard-back-stack">
            <p className="souv-flipcard-tagline text-metallic-silver">Turn real memories into physical cards</p>
          </div>
          <MusicPreviewButton label="Preview Souvenote theme" />
        </div>
        {/* Back: real card artwork — moon and back */}
        <div className="souv-flipcard-face souv-flipcard-back souv-flipcard-art-face">
          <img src="/assets/hero-card-moon.jpg" alt="I love you to the moon and back" className="souv-flipcard-art" />
          <MusicPreviewButton label="Preview card song" />
        </div>
      </div>
    </div>
  );
}

function Hero({ accentMetal = 'gold', loggedIn = false }) {
  const accentClass = {
    gold:   'text-metallic-gold',
    silver: 'text-metallic-silver',
    rose:   'text-metallic-rose-gold',
  }[accentMetal];

  return (
    <section className="souv-hero">
      <div className="souv-hero-halo souv-hero-halo-1" />
      <div className="souv-hero-halo souv-hero-halo-2" />

      <div className="souv-hero-inner">
        <div className="souv-hero-copy">
          <h1 className="souv-hero-title">
            <span className="souv-hero-italic text-metallic-silver">A card</span>{' '}
            <span className={`souv-hero-italic ${accentClass}`} style={accentMetal === 'gold' ? { textShadow: '0 0 20px rgba(241,208,116,.42), 0 0 40px rgba(212,175,55,.2)' } : undefined}>worth</span>
            <br />
            <span className="souv-hero-italic text-metallic-rose-gold">keeping</span>
          </h1>
          <div className="souv-hero-ctas">
            <Link className="souv-btn-colorful" href={loggedIn ? "/create" : "/signup"}><span>Start for Free</span></Link>
            {!loggedIn && <Link className="souv-btn-log" href="/login">Log In</Link>}
          </div>
          <p className="souv-hero-lede">
            Generate personalized cards and custom songs. Because the card you send should be as unique as they are.
          </p>
          <p className="souv-hero-trial">Includes 1 free image generation and 1 free song</p>
        </div>

        <div className="souv-hero-stack">
          <HeroFlipCard />
        </div>
      </div>
    </section>
  );
}

export { Hero, MusicPreviewButton };
