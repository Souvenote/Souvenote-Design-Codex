import Link from "next/link";
import { OrnamentDivider } from "@/components/layout/Ornaments";

const SOCIAL = [
  { label: "Instagram", path: "M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5zm4.25 3a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm5.75-.88a1.13 1.13 0 1 1-2.25 0 1.13 1.13 0 0 1 2.25 0z" },
  { label: "TikTok", path: "M16.6 5.82A4.28 4.28 0 0 1 13.8 3h-3v12.4a2.6 2.6 0 0 1-2.6 2.6 2.6 2.6 0 0 1-2.6-2.6A2.6 2.6 0 0 1 8.2 12.8c.28 0 .56.04.82.12V9.84A5.59 5.59 0 0 0 8.2 9.6 5.6 5.6 0 0 0 2.6 15.2a5.6 5.6 0 0 0 5.6 5.6 5.6 5.6 0 0 0 5.6-5.6V9.74a7.28 7.28 0 0 0 4.2 1.34V8.08a4.28 4.28 0 0 1-1.4-2.26z" },
  { label: "YouTube", path: "M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.84.55 9.38.55 9.38.55s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" },
  { label: "X", path: "M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.63 7.58H.49l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.41z" },
];

const FOOTER_COLS = [
  { title: "Create", items: [["Build My Card", "/create"], ["Personalize a Template", "/personalize"], ["Community Cards", "/cards"], ["Songs & Images", "/options"]] },
  { title: "Explore", items: [["Gifts", "/options"], ["Business", "/options"], ["Pricing", "/pricing"], ["Gallery", "/"]] },
  { title: "Account", items: [["Library", "/library"], ["My Cards & Songs", "/library"], ["Sign In", "/login"], ["Sign Up", "/signup"]] },
  { title: "Company", items: [["About", "/"], ["Contact", "/"], ["Terms of Service", "/"], ["Privacy Policy", "/"]] },
];

export function Footer() {
  return (
    <footer className="souv-footer">
      <OrnamentDivider />
      <div className="souv-footer-inner">
        <div className="souv-footer-brand">
          <div className="souv-footer-wordmark">Souvenote</div>
          <p className="souv-footer-lede">
            Cards worth keeping. Songs worth humming. Made together, sent in your name.
          </p>
          <div className="souv-footer-social">
            {SOCIAL.map((s) => (
              <a key={s.label} className="souv-footer-social-btn" aria-label={s.label} href="#">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d={s.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>
        <div className="souv-footer-cols">
          {FOOTER_COLS.map((col) => (
            <div key={col.title} className="souv-footer-col">
              <div className="souv-footer-col-title">{col.title}</div>
              <ul>
                {col.items.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="souv-footer-link">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="souv-footer-base">
        <span>© 2026 Souvenote · Made with care in Canada · Prices in CAD</span>
      </div>
    </footer>
  );
}
