import { StampCorners } from "@/components/layout/Ornaments";
import { Badge, Button } from "@/components/ui/Button";
import { CREDIT_PACKS } from "@/data/mock-cards";

/**
 * AI credit packs (Starter / Creator / Power). Credit counts render at 30px;
 * prices in gold — matching the approved design-system spec.
 */
export function CreditPacks() {
  return (
    <div className="souv-packs">
      {CREDIT_PACKS.map((pack) => (
        <article key={pack.id} className={`souv-pack ${pack.featured ? "is-featured" : ""}`}>
          {pack.featured && pack.badge && (
            <span className="souv-pack-badge">
              <Badge>★ {pack.badge}</Badge>
            </span>
          )}
          <StampCorners color="rgba(212,175,55,0.35)" />
          <div className="souv-pack-name">{pack.name}</div>
          <div className="souv-pack-price">{pack.price}</div>
          <div className="souv-pack-rule" />
          <div className="souv-pack-credits-label">Credits</div>
          <div className="souv-pack-credits">{pack.credits}</div>
          <p className="souv-pack-blurb">{pack.blurb}</p>
          <Button variant={pack.featured ? "gold" : "rose"} block className="souv-pack-cta">
            Choose {pack.name}
          </Button>
        </article>
      ))}
    </div>
  );
}
