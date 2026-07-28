"use client";

import * as React from "react";
import Link from "next/link";

type MusicPreviewButtonProps = {
  label?: string;
};

type HeroProps = {
  accentMetal?: "gold" | "silver" | "rose";
  loggedIn?: boolean;
};

function MusicPreviewButton({ label = "Preview song" }: MusicPreviewButtonProps) {
  const [playing, setPlaying] = React.useState(false);

  return (
    <button
      type="button"
      className={`souv-music-fab ${playing ? "is-playing" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        setPlaying((current) => !current);
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

function HeroFlipCard() {
  return (
    <div className="souv-flipcard souv-flipcard-spin">
      <div className="souv-flipcard-inner">
        <div className="souv-flipcard-face souv-flipcard-front souv-flipcard-card-face">
          <img
            src="/assets/hero-souvenote-card-face.png"
            alt="Souvenote card face"
            className="souv-flipcard-art"
            width={263}
            height={367}
          />
          <MusicPreviewButton label="Preview Souvenote theme" />
        </div>
        <div className="souv-flipcard-face souv-flipcard-back souv-flipcard-art-face">
          <img
            src="/assets/hero-card-moon.jpg"
            alt="I love you to the moon and back"
            className="souv-flipcard-art"
            width={832}
            height={1248}
          />
          <MusicPreviewButton label="Preview card song" />
        </div>
      </div>
    </div>
  );
}

function Hero({ accentMetal = "gold", loggedIn = false }: HeroProps) {
  const accentClass = {
    gold: "text-metallic-gold",
    silver: "text-metallic-silver",
    rose: "text-metallic-rose-gold",
  }[accentMetal];

  return (
    <section className="souv-hero">
      <div className="souv-hero-halo souv-hero-halo-1" />
      <div className="souv-hero-halo souv-hero-halo-2" />

      <div className="souv-hero-inner">
        <div className="souv-hero-copy">
          <h1 className="souv-hero-title">
            <span className="souv-hero-italic text-metallic-silver">A card</span>{" "}
            <span
              className={`souv-hero-italic ${accentClass}`}
              style={accentMetal === "gold" ? { textShadow: "0 0 20px rgba(241,208,116,.42), 0 0 40px rgba(212,175,55,.2)" } : undefined}
            >
              worth
            </span>
            <br />
            <span className="souv-hero-italic text-metallic-rose-gold">keeping</span>
          </h1>
          <div className="souv-hero-ctas">
            <Link className="souv-btn-colorful" href={loggedIn ? "/create" : "/signup"}><span>Start for Free</span></Link>
            {!loggedIn && <Link className="souv-btn-log" href="/login">Log In</Link>}
          </div>
          <p className="souv-hero-lede">
            Generate personalized cards with optional QR-code songs. Because the card you send should be as unique as they are.
          </p>
          <p className="souv-hero-trial">Includes 2 free credits to create a complete card</p>
        </div>

        <div className="souv-hero-stack">
          <HeroFlipCard />
        </div>
      </div>
    </section>
  );
}

export { Hero, MusicPreviewButton };
export type { HeroProps, MusicPreviewButtonProps };
