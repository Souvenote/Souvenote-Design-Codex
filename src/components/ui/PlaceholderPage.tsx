import Navbar from "@/components/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";

interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  highlight?: string;
  description: string;
  cta?: { label: string; href: string };
}

/** Styled "coming soon" scaffold for routes whose full design is in progress. */
export function PlaceholderPage({ eyebrow, title, highlight, description, cta }: PlaceholderPageProps) {
  return (
    <>
      <Navbar loggedIn user={{ name: "Cameron Wilson", email: "cameron@souvenote.com", initials: "CW" }} credits={{ images: 7, songs: 3 }} />
      <main>
        <div className="souv-placeholder">
          <div className="souv-placeholder-badge">{eyebrow}</div>
          <h1 className="souv-placeholder-title">
            {title} {highlight && <span className="text-metallic-rose-gold">{highlight}</span>}
          </h1>
          <p className="souv-placeholder-sub">{description}</p>
          {cta && (
            <Button variant="gold" href={cta.href}>
              {cta.label}
            </Button>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
