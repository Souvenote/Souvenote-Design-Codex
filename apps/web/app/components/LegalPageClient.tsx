import { LEGAL_DATA } from "./LegalData";
import type { LegalDataKey } from "./LegalData";
import { LegalDoc } from "./Pages";
import { StaticPageChrome } from "./StaticPageChrome";

const LEGAL_SLUG_MAP: Record<string, LegalDataKey> = {
  "privacy-policy": "privacy",
  "terms-of-service": "terms",
  "refund-policy": "refund",
  "cookie-policy": "cookie",
};

type LegalPageClientProps = {
  slug: string;
};

export function LegalPageClient({ slug }: LegalPageClientProps) {
  const normalizedSlug = LEGAL_SLUG_MAP[slug] || slug;
  const doc = normalizedSlug in LEGAL_DATA
    ? LEGAL_DATA[normalizedSlug as LegalDataKey]
    : undefined;

  if (!doc) {
    return (
      <StaticPageChrome>
        <div className="bmc-shell"><h1 className="bmc-title">Page not found</h1></div>
      </StaticPageChrome>
    );
  }
  return (
    <StaticPageChrome>
      <div className="bmc-shell"><LegalDoc {...doc} /></div>
    </StaticPageChrome>
  );
}
