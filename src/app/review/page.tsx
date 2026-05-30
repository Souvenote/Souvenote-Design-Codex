"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MusicPreviewButton } from "@/components/hero/MusicPreviewButton";
import { ReviewChecklist } from "@/components/review/ReviewChecklist";
import FormatModal from "@/components/FormatModal";
import { Button } from "@/components/ui/Button";

const CHECKS = [
  "Card image generated from your photo & prompt",
  "Custom song composed for the moment",
  "Inside message written and ready to edit",
];

export default function ReviewPage() {
  const [formatOpen, setFormatOpen] = useState(false);

  return (
    <>
      <Navbar loggedIn user={{ name: "Cameron Wilson", email: "cameron@souvenote.com", initials: "CW" }} credits={{ images: 6, songs: 2 }} />
      <main className="souv-app-main">
        <section className="souv-section">
          <div className="souv-review">
            <div className="souv-review-stage">
              <div className="souv-review-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/hero-card-moon.jpg" alt="Your generated card" />
                <MusicPreviewButton label="Preview your card song" />
              </div>
            </div>
            <div className="souv-review-copy">
              <div className="souv-eyebrow">Review &amp; approve</div>
              <h1 className="souv-review-h">
                Here&rsquo;s your <span className="souv-hero-italic text-metallic-rose-gold">keepsake.</span>
              </h1>
              <p className="souv-lede" style={{ margin: 0 }}>
                Everything generated together. Approve it all, or remix any piece before you send.
              </p>
              <ReviewChecklist items={CHECKS} />
              <div className="souv-review-actions">
                <Button variant="gold" onClick={() => setFormatOpen(true)}>
                  Approve all &amp; send
                </Button>
                <Button variant="ghost" href="/personalize">
                  Remix
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <FormatModal open={formatOpen} onClose={() => setFormatOpen(false)} />
    </>
  );
}
