import Link from "next/link";
import { PageHero } from "./components/Pages";
import { StaticPageChrome } from "./components/StaticPageChrome";

export default function NotFoundPage() {
  return (
    <StaticPageChrome>
      <div className="bmc-shell pg-not-found">
        <PageHero
          crumbs={["Souvenote", "Page not found"]}
          title={
            <>
              This page slipped{" "}
              <span className="pg-italic text-metallic-rose-gold">
                out of the envelope
              </span>
            </>
          }
          lede="The link may be incomplete, expired, or no longer available."
        />
        <div className="pg-not-found-actions">
          <Link href="/" className="btn-gold">
            Back to Souvenote
          </Link>
          <Link href="/contact" className="btn-ghost">
            Contact support
          </Link>
        </div>
      </div>
    </StaticPageChrome>
  );
}
