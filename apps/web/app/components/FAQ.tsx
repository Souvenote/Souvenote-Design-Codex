'use client';

import * as React from 'react';
import { Eyebrow } from './Ornaments';

type FaqItem = {
  q: string;
  a: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'How does the Try Risk-Free option work?',
    a: 'We place a temporary 5-day hold of $9.99 on your card, which unlocks 10 AI creation credits right away. If you love your card and send it, the $9.99 is finalized\u2014 printing and shipping included, with no extra fees. If you decide not to send, the hold is released after 5 days and you\u2019re only charged $2.00 for the credits you unlocked.',
  },
  {
    q: 'Can I buy creation credits without buying a card?',
    a: 'Yes. Every new account starts with 2 free trial credits, and you can add standalone packs whenever you like: 10 credits for $2 CAD, 80 for $10 CAD, or 250 for $25 CAD.',
  },
  {
    q: 'What does a personalized song sound like?',
    a: 'Songs are optional. If you include one, it is uniquely generated from the details you provide and added to the printed card by QR code.',
  },
  {
    q: 'How long does shipping take?',
    a: 'The MVP launches in Canada first. Delivery estimates will be confirmed at checkout after fulfillment testing is approved.',
  },
  {
    q: 'Can I save my card and finish later?',
    a: 'Yes. All designs are automatically saved in Saved Cards & Songs for 30 days. Return anytime to finish and purchase.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'Payments are not active yet. Stripe-hosted Canadian-dollar checkout will be enabled only after payment and legal review.',
  },
  {
    q: 'What happens if I don\u2019t like my card?',
    a: 'Take a screenshot of the card you\u2019re referring to and tell us why it doesn\u2019t work for you\u2014 we\u2019ll reimburse your credits so you can try again.',
  },
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
                <div className="souv-faq-pm">
                  <b />
                  <b className={isOpen ? 'hidden' : 'v'} />
                </div>
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
