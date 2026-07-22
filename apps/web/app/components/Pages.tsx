'use client';

import * as React from 'react';
import Link from 'next/link';
import { OrnamentDivider } from './Ornaments';
import type { LegalDocData } from './LegalData';

type PageHeroProps = {
  crumbs?: string[];
  title: React.ReactNode;
  meta?: React.ReactNode;
  lede?: string | null;
};

type ContactCard = {
  ico: React.ReactNode;
  title: string;
  body: React.ReactNode;
};

function PageHero({ crumbs = [], title, meta = null, lede = null }: PageHeroProps) {
  return (
    <header className="pg-hero">
      <div className="pg-kicker">
        {crumbs.map((crumb, index) => (
          <React.Fragment key={crumb}>
            {index > 0 && <span className="sep" />}
            <span className={index === crumbs.length - 1 ? '' : 'muted'}>{crumb}</span>
          </React.Fragment>
        ))}
      </div>
      <h1 className="pg-title">{title}</h1>
      {meta && <div className="pg-meta">{meta}</div>}
      {lede && <p className="pg-lede">{lede}</p>}
    </header>
  );
}

function LegalDoc({ crumbs, title, lastUpdated, intro, sections }: LegalDocData) {
  const [active, setActive] = React.useState(sections[0]?.id ?? '');

  React.useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-110px 0px -65% 0px', threshold: 0 },
    );

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) obs.observe(el);
    });

    return () => obs.disconnect();
  }, [sections]);

  function jump(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: 'smooth' });
  }

  return (
    <>
      <PageHero
        crumbs={crumbs}
        title={title}
        meta={
          <>
            Last updated {'\u00b7'} <b>{lastUpdated}</b>
          </>
        }
      />

      <OrnamentDivider />

      <div className="pg-legal">
        <nav className="pg-toc" aria-label="On this page">
          <div className="pg-toc-label">On this page</div>
          <ul>
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={active === section.id ? 'is-active' : ''}
                  onClick={(event) => jump(event, section.id)}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="pg-doc">
          {intro && <p className="pg-doc-intro">{intro}</p>}
          {sections.map((section, index) => (
            <section className="pg-section" id={section.id} key={section.id}>
              <div className="pg-section-num">{String(index + 1).padStart(2, '0')}</div>
              <h2>{section.title}</h2>
              {section.paras.map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex}>{paragraph}</p>
              ))}
              {section.bullets && (
                <ul className="pg-bullets">
                  {section.bullets.map((bullet, bulletIndex) => (
                    <li key={bulletIndex}>{bullet}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className="pg-doc-cta">
            <div>
              <div className="pg-doc-cta-title">Questions about this policy?</div>
              <p className="pg-doc-cta-sub">Our team is happy to walk you through anything here.</p>
            </div>
            <Link href="/contact" className="btn-ghost" style={{ textDecoration: 'none' }}>
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function IconMail() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.8A8 8 0 1 1 21 12z" />
    </svg>
  );
}

function ContactPage() {
  const [sent, setSent] = React.useState(false);
  const cards: ContactCard[] = [
    {
      ico: <IconMail />,
      title: 'Email Us',
      body: (
        <>
          Reach the team directly at <a href="mailto:hello@souvenote.com">hello@souvenote.com</a>.
        </>
      ),
    },
    { ico: <IconClock />, title: 'Response Time', body: 'We aim to reply within 1\u20132 business days.' },
    { ico: <IconChat />, title: 'Help & Socials', body: 'Find us on Instagram, TikTok and more.' },
  ];

  return (
    <>
      <PageHero
        crumbs={['Support', 'Contact Us']}
        title={
          <>
            Get in <span className="pg-italic text-metallic-rose-gold">touch</span>
          </>
        }
        lede="Have a question about a card, a song, or an order? Send us a note and we'll get back to you."
      />

      <OrnamentDivider />

      <div className="pg-contact">
        <aside className="pg-contact-aside">
          {cards.map((card) => (
            <div className="pg-contact-card" key={card.title}>
              <div className="pg-contact-ico">{card.ico}</div>
              <div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            </div>
          ))}
        </aside>

        <form
          className="pg-form"
          onSubmit={(event) => {
            event.preventDefault();
            setSent(true);
          }}
        >
          <div className="pg-form-title">Send us a message</div>
          <p className="pg-form-sub">We read every note and reply within a day.</p>

          <div className="pg-field pg-row">
            <div>
              <span className="pg-field-label">First name</span>
              <input className="input-dark" type="text" placeholder="Jane" />
            </div>
            <div>
              <span className="pg-field-label">Last name</span>
              <input className="input-dark" type="text" placeholder="Doe" />
            </div>
          </div>
          <div className="pg-field">
            <span className="pg-field-label">Email</span>
            <input className="input-dark" type="email" placeholder="jane@example.com" />
          </div>
          <div className="pg-field">
            <span className="pg-field-label">Subject</span>
            <input className="input-dark" type="text" placeholder="What's this about?" />
          </div>
          <div className="pg-field">
            <span className="pg-field-label">Message</span>
            <textarea className="input-dark" placeholder="Tell us how we can help..." />
          </div>
          <button type="submit" className="btn-matte">
            {sent ? 'Message sent \u2713' : 'Send Message'}
          </button>
          <div className="pg-form-fineprint">By sending, you agree to our Privacy Policy.</div>
        </form>
      </div>
    </>
  );
}

export { PageHero, LegalDoc, ContactPage };
export type { PageHeroProps };
