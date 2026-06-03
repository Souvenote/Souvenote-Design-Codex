"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { OptionTiles } from "@/components/options/OptionTiles";
import { CreditPacks } from "@/components/options/CreditPacks";
import PricingModal from "@/components/PricingModal";

function PhysicalCardPricing() {
  const [cards, setCards] = useState(2);
  const total = cards * 8.99;

  return (
    <div className="souv-physical-grid">
      <article className="souv-physical-card">
        <h3>Try Risk-Free</h3>
        <div className="souv-pricing-kicker">Send 1 card <span /> Includes shipping <span /> 10 AI design and song credits</div>
        <div className="souv-risk-prices">
          <div>
            <strong>$9.99</strong>
            <em>if you love it.</em>
          </div>
          <div>
            <strong>$2.00</strong>
            <em>if you don't.</em>
          </div>
        </div>
        <div className="souv-pricing-rule"><span>How it works</span></div>
        <div className="souv-how-list">
          <div className="souv-how-item">
            <b>Unlock instantly</b>
            <p>A temporary 5-day hold of $9.99 is placed on your card to unlock your 10 design credits immediately.</p>
          </div>
          <div className="souv-how-item">
            <b>If you send the card</b>
            <p>The $9.99 hold is finalized. Your card is printed and shipped with no extra fees.</p>
          </div>
          <div className="souv-how-item">
            <b>If you don't send</b>
            <p>The hold is released after 5 days. You are only charged $2.00 for the 10 AI credits.</p>
          </div>
        </div>
        <button className="souv-pricing-cta">Choose Try Risk-Free <span>-&gt;</span></button>
      </article>

      <article className="souv-physical-card">
        <h3>Big Sender</h3>
        <div className="souv-pricing-kicker">Send multiple different cards <span /> Includes shipping <span /> 10 AI design and song credits per card</div>
        <div className="souv-tier-row">
          <div className="is-active"><em>2-10 Cards</em><strong>$8.99</strong><small>/ card</small></div>
          <div><em>11-20 Cards</em><strong>$7.99</strong><small>/ card</small></div>
          <div><em>21-30+ Cards</em><strong>$6.99</strong><small>/ card</small></div>
        </div>
        <div className="souv-card-stepper">
          <span>How many cards?</span>
          <b>${total.toFixed(2)}</b>
          <div>
            <button type="button" onClick={() => setCards((value) => Math.max(2, value - 1))}>-</button>
            <strong>{cards}</strong>
            <button type="button" onClick={() => setCards((value) => Math.min(30, value + 1))}>+</button>
          </div>
        </div>
        <div className="souv-pricing-rule"><span>How it works</span></div>
        <div className="souv-how-list is-compact">
          <div className="souv-how-item">
            <b>Share the Love</b>
            <p>Send a completed card to your loved ones, or let them create their own in the "Send a blank card" section.</p>
          </div>
          <div className="souv-how-item">
            <b>Flexible Sending Options</b>
            <p>Send the same card to everyone, or a unique card to each.</p>
          </div>
          <div className="souv-how-item">
            <b>Always saved</b>
            <p>Design now and send later. Your creations will be saved in "My Cards & Songs" for 12 months</p>
          </div>
        </div>
        <button className="souv-pricing-cta">Reserve {cards} Cards - ${total.toFixed(2)} <span>-&gt;</span></button>
      </article>
    </div>
  );
}

export default function OptionsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Navbar loggedIn user={{ name: "Cameron Wilson", email: "cameron@souvenote.com", initials: "CW" }} credits={{ images: 10, songs: 0 }} cartCount={0} />
      <main className="souv-options-main">
        <section id="create" className="souv-options-section souv-options-hero">
          <div className="souv-opt-head">
            <h1 className="souv-opt-title">
              Choose how to <span className="text-metallic-rose-gold">create your card</span>
            </h1>
            <p className="souv-lede">Every option lets you create a personalized song and link it via QR code.</p>
          </div>
          <OptionTiles />
        </section>

        <section id="cards" className="souv-options-section souv-options-pricing">
          <div className="souv-section-head">
            <div className="souv-eyebrow">Pricing - Card Packs</div>
            <h2 className="souv-options-h2">
              Physical cards,<br />
              <span className="text-metallic-rose-gold">printed and posted</span>
            </h2>
            <p className="souv-lede">Shipping is always included with your card, along with 10 AI design and song credits. Snag just one or grab a bulk pack to save.</p>
          </div>
          <PhysicalCardPricing />
        </section>

        <section id="credits" className="souv-options-section souv-options-credits">
          <div className="souv-section-head">
            <div className="souv-eyebrow">Pricing - AI Credits</div>
            <h2 className="souv-options-h2">
              Top up <span className="text-metallic-rose-gold">credits only</span>
            </h2>
            <p className="souv-lede">Bring your card to life.<br />1 credit = 1 action for song creation, design generation and image editing.</p>
          </div>
          <CreditPacks />
        </section>
      </main>
      <div className="souv-view-toggle" aria-label="Pricing view options">
        <span>View</span>
        <a href="#cards">With credits</a>
        <button type="button" onClick={() => setModalOpen(true)}>0 credits - Modal</button>
      </div>
      <PricingModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
