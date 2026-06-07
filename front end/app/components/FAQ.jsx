"use client";

import * as React from "react";
import { Eyebrow } from "./Ornaments";

// FAQ.jsx

const FAQ_ITEMS = [
  { q: 'How does the Try Risk-Free option work?',
    a: 'We place a temporary 5-day hold of $9.99 on your card, which unlocks 10 AI design and song credits right away. If you love your card and send it, the $9.99 is finalized\u2014 printing and shipping included, with no extra fees. If you decide not to send, the hold is released after 5 days and you\u2019re only charged $2.00 for the credits you unlocked.' },
  { q: 'What does a personalized song sound like?',
    a: 'Each song is uniquely generated based on details you provide. Previews are available in the carousel above. Hit play to hear examples.' },
  { q: 'How long does shipping take?',
    a: 'Cards typically arrive within 5\u20137 business days across North America. International shipping times vary by destination.' },
  { q: 'Can I save my card and finish later?',
    a: 'Yes. All designs are automatically saved in My Cards & Songs for 30 days. Return anytime to finish and purchase.' },
  { q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards, Apple Pay, and Google Pay. You can toggle prices between USD and CAD.' },
  { q: 'What happens if I don\u2019t like my card?',
    a: 'Take a screenshot of the card you\u2019re referring to and tell us why it doesn\u2019t work for you\u2014 we\u2019ll reimburse your credits so you can try again.' },
];

function FAQ() {
  const [open, setOpen] = React.useState(0);
  return (
    <section className="souv-faq">
      <div className="souv-faq-head">
        <Eyebrow>Questions</Eyebrow>
        <h2 className="souv-h1">
          <span className="souv-hero-italic text-metallic-silver">Frequently Asked</span>{' '}
          <span className="souv-hero-italic text-metallic-rose-gold">Questions</span>
        </h2>
      </div>
      <div className="souv-faq-list">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} className={`souv-faq-item ${isOpen ? 'is-open' : ''}`}>
              <button className="souv-faq-q" onClick={() => setOpen(isOpen ? -1 : i)}>
                <span>{item.q}</span>
                <div className="souv-faq-pm"><b /><b className={isOpen ? 'hidden' : 'v'} /></div>
              </button>
              <div className={`souv-faq-a ${isOpen ? 'is-open' : ''}`}>
                <p>{item.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { FAQ };
