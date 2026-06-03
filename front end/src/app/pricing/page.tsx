import Navbar from "@/components/Navbar";
import { Footer } from "@/components/layout/Footer";
import { OrnamentDivider, StampCorners } from "@/components/layout/Ornaments";
import { CreditPacks } from "@/components/options/CreditPacks";
import { Badge, Button } from "@/components/ui/Button";

const CARD_PACKS = [
  {
    id: "risk-free",
    name: "Try Risk-Free",
    price: "$9.99",
    unit: "Shipping included · 1 card",
    blurb: "Pay only $2.00 for AI credits if you choose not to send. Hold released after seven days.",
    featured: false,
  },
  {
    id: "big-sender",
    name: "Big Sender",
    price: "Sliding scale",
    unit: "2–30 cards · Shipping & 10 credits per card",
    blurb: "Buy multiple different cards at a deep discount — perfect for the whole family to design their own.",
    featured: true,
    badge: "Best value",
  },
  {
    id: "share-love",
    name: "Share the Love",
    price: "$7.49",
    unit: "Per card · Min. 3 cards",
    blurb: "Send the same heartfelt card to everyone you love, with shipping and credits always included.",
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <>
      <Navbar loggedIn user={{ name: "Cameron Wilson", email: "cameron@souvenote.com", initials: "CW" }} credits={{ images: 7, songs: 3 }} />
      <main className="souv-app-main">
        <section className="souv-section">
          <div className="souv-section-head">
            <div className="souv-eyebrow">Pricing · Card Packs</div>
            <h2 className="souv-h1">
              Cards &amp; credits, <span className="souv-hero-italic text-metallic-rose-gold">no surprises.</span>
            </h2>
            <p className="souv-lede">
              Shipping is always included with your card, along with 10 AI design and song credits. Snag just one or grab a bulk pack to save.
            </p>
          </div>
          <div className="souv-packs">
            {CARD_PACKS.map((pack) => (
              <article key={pack.id} className={`souv-pack ${pack.featured ? "is-featured" : ""}`}>
                {pack.featured && pack.badge && (
                  <span className="souv-pack-badge">
                    <Badge>★ {pack.badge}</Badge>
                  </span>
                )}
                <StampCorners color="rgba(212,175,55,0.35)" />
                <div className="souv-pack-name">{pack.name}</div>
                <div className="souv-pack-price">{pack.price}</div>
                <div className="souv-pack-credits-label" style={{ marginTop: 8 }}>{pack.unit}</div>
                <div className="souv-pack-rule" />
                <p className="souv-pack-blurb">{pack.blurb}</p>
                <Button variant={pack.featured ? "gold" : "rose"} block className="souv-pack-cta">
                  Choose {pack.name}
                </Button>
              </article>
            ))}
          </div>
        </section>

        <OrnamentDivider />

        <section className="souv-section">
          <div className="souv-section-head">
            <div className="souv-eyebrow">Pricing · AI Credits</div>
            <h2 className="souv-h1">
              Top up <span className="souv-hero-italic text-metallic-rose-gold">credits only.</span>
            </h2>
            <p className="souv-lede">Bring your card to life. 1 credit = 1 action for song creation, design generation and image editing.</p>
          </div>
          <CreditPacks />
        </section>
      </main>
      <Footer />
    </>
  );
}
