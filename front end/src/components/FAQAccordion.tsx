"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "How does the free trial work?",
    a: "You get 1 free image generation and 1 free song when you sign up. No credit card required. If you love your card, you can purchase it and we’ll print and mail it.",
  },
  {
    q: "What does a personalized song sound like?",
    a: "Each song is uniquely generated based on details you provide. Previews are available in the carousel above — hit play to hear examples.",
  },
  {
    q: "How long does shipping take?",
    a: "Cards typically arrive within 5–7 business days within Canada. International shipping times vary by destination.",
  },
  {
    q: "Can I save my card and finish later?",
    a: "Yes — all designs are automatically saved in My Cards & Songs for 30 days. Return anytime to finish and purchase.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, Apple Pay, and Google Pay. All prices are in CAD.",
  },
];

export default function FAQAccordion() {
  const [open, setOpen] = useState(0);
  return (
    <section className="souv-faq">
      <div className="souv-faq-head">
        <h2 className="souv-h1">
          <span className="souv-hero-italic text-metallic-silver">Frequently Asked</span>{" "}
          <span className="souv-hero-italic text-metallic-rose-gold">Questions</span>
        </h2>
      </div>
      <div className="souv-faq-list">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} className={`souv-faq-item ${isOpen ? "is-open" : ""}`}>
              <button className="souv-faq-q" onClick={() => setOpen(isOpen ? -1 : i)}>
                <span>{item.q}</span>
                <div className="souv-faq-pm">
                  <b />
                  <b className={isOpen ? "hidden" : "v"} />
                </div>
              </button>
              <div className={`souv-faq-a ${isOpen ? "is-open" : ""}`}>
                <p>{item.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
