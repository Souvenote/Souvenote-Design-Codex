import Link from "next/link";
import { OrnamentDivider } from "./Ornaments";

type SocialLink = {
  label: string;
  path: string;
};

type FooterColumn = {
  title: string;
  items: FooterLinkLabel[];
};

type FooterLinkLabel = keyof typeof PAGE_HREFS;

const SOCIAL: SocialLink[] = [
  { label: "Instagram", path: "M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5zm4.25 3a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm5.75-.88a1.13 1.13 0 1 1-2.25 0 1.13 1.13 0 0 1 2.25 0z" },
  { label: "TikTok", path: "M16.6 5.82A4.28 4.28 0 0 1 13.8 3h-3v12.4a2.6 2.6 0 0 1-2.6 2.6 2.6 2.6 0 0 1-2.6-2.6A2.6 2.6 0 0 1 8.2 12.8c.28 0 .56.04.82.12V9.84A5.59 5.59 0 0 0 8.2 9.6 5.6 5.6 0 0 0 2.6 15.2a5.6 5.6 0 0 0 5.6 5.6 5.6 5.6 0 0 0 5.6-5.6V9.74a7.28 7.28 0 0 0 4.2 1.34V8.08a4.28 4.28 0 0 1-1.4-2.26z" },
  { label: "Snapchat", path: "M12 2c3.4 0 5.5 2.4 5.5 5.6 0 1.1-.1 2-.1 2.7.1.1.4.3.8.3.5 0 1.3-.3 1.8-.4l.3 1c-.5.5-2 1-2.6 1.2-.1.6 1.2 2.6 3.3 3.4l-.3 1c-1.5.5-2.5.4-2.9 1.1-.3.6.4 1.4-1.1 1.7-.7.1-1.3-.1-1.9.1-.5.2-1.1 1.1-2 1.5-1.1.6-1.7.6-2.8 0-.9-.4-1.5-1.3-2-1.5-.6-.2-1.2 0-1.9-.1-1.5-.3-.8-1.1-1.1-1.7-.4-.7-1.4-.6-2.9-1.1l-.3-1c2.1-.8 3.4-2.8 3.3-3.4-.6-.2-2.1-.7-2.6-1.2l.3-1c.5.1 1.3.4 1.8.4.4 0 .7-.2.8-.3 0-.7-.1-1.6-.1-2.7C6.5 4.4 8.6 2 12 2z" },
  { label: "Pinterest", path: "M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9.2-.8 1.1-5 1.1-5s-.3-.6-.3-1.4c0-1.3.8-2.3 1.7-2.3.8 0 1.2.6 1.2 1.3 0 .8-.5 2-.8 3.1-.2.9.5 1.7 1.4 1.7 1.7 0 2.9-2.2 2.9-4.8 0-2-1.3-3.4-3.8-3.4-2.7 0-4.5 2-4.5 4.3 0 .8.2 1.4.6 1.9.2.2.2.3.1.6 0 .2-.2.6-.2.8-.1.3-.3.4-.6.3-1.4-.6-2-2.1-2-3.8 0-2.8 2.4-6.2 7-6.2 3.7 0 6.2 2.7 6.2 5.6 0 3.8-2.1 6.6-5.2 6.6-1 0-2-.5-2.3-1.2l-.6 2.5c-.3 1-.9 2-1.2 2.6A10 10 0 1 0 12 2z" },
  { label: "Facebook", path: "M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.5V9.7c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5H15c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" },
  { label: "LinkedIn", path: "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4v11H3v-11zM10 9.5h3.8v1.5h.1a4.16 4.16 0 0 1 3.75-2.06c4 0 4.75 2.64 4.75 6.08V20.5h-4v-4.86c0-1.16-.02-2.65-1.62-2.65-1.62 0-1.87 1.27-1.87 2.57V20.5H10v-11z" },
];

const PAGE_HREFS = {
  "Build My Card": "/create/build-my-card",
  "Personalize a Template": "/create/personalize-a-template",
  "Saved Cards & Songs": "/create/my-cards-and-songs",
  "Community Cards": null,
  Profile: "/account/profile",
  "Gift a Souvenote": "/gift",
  "Refer a Friend": "/refer",
  "Account Settings": "/account/settings",
  About: null,
  Contact: "/contact",
  FAQ: "/faq",
  "Terms of Service": "/legal/terms-of-service",
  "Privacy Policy": "/legal/privacy-policy",
  "Cookie Policy": "/legal/cookie-policy",
  "Refund Policy": "/legal/refund-policy",
} as const satisfies Record<string, string | null>;

const FOOTER_COLS: FooterColumn[] = [
  { title: "Create", items: ["Build My Card", "Personalize a Template", "Saved Cards & Songs", "Community Cards"] },
  { title: "Account", items: ["Profile", "Gift a Souvenote", "Refer a Friend", "Account Settings"] },
  { title: "Company", items: ["About", "Contact", "FAQ", "Terms of Service", "Privacy Policy", "Cookie Policy", "Refund Policy"] },
];

function Footer() {
  return (
    <footer className="souv-footer">
      <OrnamentDivider />
      <div className="souv-footer-inner">
        <div className="souv-footer-brand">
          <span className="souv-footer-wordmark-wrap">
            <img
              src="/assets/WordmarkLobster.png"
              alt="Souvenote"
              className="souv-footer-wordmark-img"
              width={1445}
              height={334}
            />
          </span>
          <p className="souv-footer-lede">Because the card you send should be as unique as they are.</p>
          <div className="souv-footer-social">
            {SOCIAL.map((social) => (
              <span
                key={social.label}
                className="souv-footer-social-btn is-disabled"
                role="img"
                aria-label={`${social.label} coming soon`}
                title={`${social.label} coming soon`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor"><path d={social.path} /></svg>
              </span>
            ))}
          </div>
        </div>
        <div className="souv-footer-cols">
          {FOOTER_COLS.map((col) => (
            <div key={col.title} className={`souv-footer-col ${col.title === "Company" ? "souv-footer-col-2up" : ""}`}>
              <div className="souv-footer-col-title">{col.title}</div>
              <ul>
                {col.items.map((item) => {
                  const href = PAGE_HREFS[item];
                  return (
                    <li key={item}>
                      {href === null ? (
                        <span className="souv-footer-link is-disabled" aria-disabled="true">{item}</span>
                      ) : (
                        <Link href={href} className="souv-footer-link">{item}</Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="souv-footer-base">
        <span>{"\u00a9 2026 Souvenote \u00b7 The phygital greeting card company"}</span>
      </div>
    </footer>
  );
}

export { Footer };
