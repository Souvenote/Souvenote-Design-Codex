"use client";

import * as React from "react";
import Link from "next/link";
import { fetchPublicSouvenote } from "../lib/api";
import type { PublicSouvenote } from "../lib/api";
import { PageChrome } from "./PageChrome";

type PublicSouvenotePlayerProps = {
  token: string;
};

export function PublicSouvenotePlayer({ token }: PublicSouvenotePlayerProps) {
  const [souvenote, setSouvenote] = React.useState<PublicSouvenote | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setSouvenote(null);
    setError(null);
    fetchPublicSouvenote(token)
      .then((result) => {
        if (active) setSouvenote(result);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "This Souvenote could not be opened.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="listen-page">
      <PageChrome variant="pages" />
      <header className="listen-header">
        <Link href="/" className="listen-brand" aria-label="Souvenote home">Souvenote</Link>
        <span className="listen-keepsake-label">A keepsake made for you</span>
      </header>

      <main className="listen-shell">
        {!souvenote && !error ? (
          <section className="listen-state" aria-live="polite">
            <span className="listen-loader" aria-hidden="true" />
            <h1>Opening your Souvenote</h1>
            <p>Unwrapping the artwork and song…</p>
          </section>
        ) : null}

        {error ? (
          <section className="listen-state listen-error" role="alert">
            <span className="listen-mark" aria-hidden="true">!</span>
            <h1>This keepsake isn&apos;t available</h1>
            <p>{error}</p>
            <p className="listen-help">Check the full QR code is visible and scan it again.</p>
          </section>
        ) : null}

        {souvenote ? (
          <article className="listen-card">
            <div className="listen-art-wrap">
              <img className="listen-art" src={souvenote.imageUrl} alt="Your Souvenote card artwork" />
              <span className="listen-art-glow" aria-hidden="true" />
            </div>
            <div className="listen-content">
              <p className="listen-eyebrow">{souvenote.occasion || "A song made just for you"}</p>
              <h1>Your card has a soundtrack.</h1>
              <p className="listen-intro">Press play whenever you want to return to this moment.</p>
              <audio className="listen-audio" controls preload="metadata" src={souvenote.songUrl}>
                Your browser does not support audio playback.
              </audio>
              {souvenote.insideMessage ? (
                <blockquote className="listen-message">{souvenote.insideMessage}</blockquote>
              ) : null}
              <p className="listen-private">Private link · short-lived media access · not indexed</p>
            </div>
          </article>
        ) : null}
      </main>
    </div>
  );
}
