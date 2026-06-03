import { StampCorners } from "@/components/layout/Ornaments";
import { Badge, Button } from "@/components/ui/Button";
import { CREDIT_PACKS } from "@/data/mock-cards";

export function CreditPacks() {
  return (
    <div className="souv-packs">
      {CREDIT_PACKS.map((pack) => (
        <article key={pack.id} className={`souv-pack ${pack.featured ? "is-featured" : ""}`}>
          {pack.featured && pack.badge && (
            <span className="souv-pack-badge">
              <Badge>* {pack.badge}</Badge>
            </span>
          )}
          <StampCorners color="rgba(232,234,238,0.82)" />
          <div className="souv-pack-name">{pack.name}</div>
          <div className="souv-pack-price">{pack.price}</div>
          <div className="souv-pack-rule" />
          <div className="souv-pack-credits-label">Credits</div>
          <div className="souv-pack-credits">{pack.credits}</div>
          <p className="souv-pack-blurb">{pack.blurb}</p>
          <Button variant="rose" block className="souv-pack-cta">
            Choose {pack.name} <span aria-hidden="true">-&gt;</span>
          </Button>
        </article>
      ))}
    </div>
  );
}
