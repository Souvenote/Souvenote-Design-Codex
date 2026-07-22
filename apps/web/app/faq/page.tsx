import Link from 'next/link';
import { FAQ } from '../components/FAQ';
import { PageHero } from '../components/Pages';
import { OrnamentDivider } from '../components/Ornaments';
import { StaticPageChrome } from '../components/StaticPageChrome';

export default function FaqRoutePage() {
  return (
    <StaticPageChrome>
      <div className="bmc-shell pg-faq-wrap">
        <PageHero
          crumbs={['Support', 'FAQ']}
          title={
            <>
              Questions, <span className="pg-italic text-metallic-rose-gold">answered</span>
            </>
          }
          lede="Everything you need to know about creating, sending, and gifting a Souvenote."
        />
        <OrnamentDivider />
        <FAQ />
        <div className="pg-faq-contact">
          <h3>Still need help?</h3>
          <p>We read every note and reply within a day.</p>
          <Link href="/contact" className="btn-matte">
            Contact Us
          </Link>
        </div>
      </div>
    </StaticPageChrome>
  );
}
