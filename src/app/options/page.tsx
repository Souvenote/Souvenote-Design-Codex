"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { Footer } from "@/components/layout/Footer";
import { OrnamentDivider } from "@/components/layout/Ornaments";
import { OptionTiles } from "@/components/options/OptionTiles";
import { CreditPacks } from "@/components/options/CreditPacks";
import PricingModal from "@/components/PricingModal";
import { Button } from "@/components/ui/Button";

export default function OptionsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Navbar loggedIn user={{ name: "Cameron Wilson", email: "cameron@souvenote.com", initials: "CW" }} credits={{ images: 0, songs: 0 }} />
      <main className="souv-app-main">
        <section className="souv-section">
          <div className="souv-opt-head">
            <h1 className="souv-opt-title">
              Choose how to <span className="text-metallic-rose-gold">create your card</span>
            </h1>
            <p className="souv-lede">Every option lets you create a personalized song and link it via QR code.</p>
          </div>
          <OptionTiles />
        </section>

        <OrnamentDivider />

        <section className="souv-section">
          <div className="souv-section-head">
            <div className="souv-eyebrow">Pricing · AI Credits</div>
            <h2 className="souv-h1">
              Top up <span className="souv-hero-italic text-metallic-rose-gold">credits only.</span>
            </h2>
            <p className="souv-lede">1 credit = 1 action for song creation, design generation and image editing.</p>
          </div>
          <CreditPacks />
          <div style={{ textAlign: "center", marginTop: 36 }}>
            <Button variant="ghost" onClick={() => setModalOpen(true)}>
              Preview the out-of-credits flow
            </Button>
          </div>
        </section>
      </main>
      <Footer />
      <PricingModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
