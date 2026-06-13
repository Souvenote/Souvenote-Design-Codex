"use client";

import * as React from "react";
import { createPortal } from "react-dom";

// AttestationGate.tsx - shared image-rights attestation modal for photo upload.
// Used by both Build My Card (Step 1) and Personalize a Template (Photo step).
//
// Flow the user is forced through:
//   1. Read Terms of Service - scroll to the very bottom.
//   2. Read Privacy Policy - scroll to the very bottom.
//   3. Both checkboxes unlock only after BOTH documents are read.
//   4. "Agree & continue" unlocks only after BOTH boxes are checked.
//
// Self-contained styling (attg- namespace) injected once, so it works inside
// both the bmc-* and pt-* CSS worlds. Relies only on global color/type tokens.

type LegalSection = [heading: string, body: string];
type LegalDocKey = "terms" | "privacy";
type LegalDoc = {
  label: string;
  sub: string;
  sections: LegalSection[];
};
type ReadState = Record<LegalDocKey, boolean>;

type AttestationGateProps = {
  open: boolean;
  onClose: () => void;
  onAgree?: () => void;
};

type AttgIconName = "lock" | "check" | "close" | "arrow" | "down";
type AttgIconProps = {
  name: AttgIconName;
  w?: number;
};

// ------------------------------------------------------------------
// Representative legal copy. Review with counsel before launch.
// ------------------------------------------------------------------
const ATTG_TERMS: LegalSection[] = [
  ['1. Acceptance of these Terms',
   'These Terms of Service ("Terms") govern your use of Souvenote to create, personalize, generate, and order physical and digital greeting cards and their paired songs. By uploading a photo or generating a card, you agree to these Terms in full. If you do not agree, do not upload content or generate a card.'],
  ['2. Who may use Souvenote',
   'You must be the age of majority in your province or state to create an account and place an order. You are responsible for all activity that occurs under your account, and for keeping your credentials secure.'],
  ['3. Your content and the rights you must hold',
   'You may only upload a photograph if (a) you personally took it or otherwise own the copyright in it, and (b) every identifiable person depicted has given you their explicit, informed consent to upload their image and to have their likeness processed, transformed, and reproduced by Souvenote. You must not upload images of any person who has not consented, of minors who are not your own children, or of public figures or third parties whose likeness you are not authorized to use.'],
  ['4. Acceptable use',
   'You agree not to use Souvenote to create content that is unlawful, harassing, defamatory, hateful, sexually explicit, or that depicts a real person in a false, intimate, degrading, or sexual manner. You agree not to impersonate, deceive, intimidate, or harm any person, and not to generate content intended to mislead others about a real individual. We may refuse, remove, or refuse to print any content that violates this section.'],
  ['5. Intimate Images Protection Act',
   'You acknowledge that distributing or processing an intimate image of a person without their consent may be unlawful under the Intimate Images Protection Act and equivalent legislation. You confirm that no photo you upload is an intimate image processed without the depicted person\u2019s consent, and you accept full legal responsibility for any image you provide. Souvenote cooperates with lawful requests and will act on credible reports of non-consensual intimate imagery, including removing content and suspending accounts.'],
  ['6. AI generation and likeness processing',
   'Souvenote uses automated and AI systems to re-render, stylize, and transform the photos and descriptions you provide, and to compose lyrics and music. Generated output may not perfectly reproduce a likeness and is provided for personal, gifting, and keepsake purposes. You remain responsible for how you use and share generated cards and songs.'],
  ['7. Credits, orders, and printing',
   'Generation actions consume credits as shown at the point of use. Physical card orders are produced by print and fulfillment partners. Once a card has entered production it generally cannot be changed or cancelled. Pricing, credit values, and availability may change.'],
  ['8. Data retention',
   'We retain uploaded photos, generated assets, and order records for as long as needed to provide the service, fulfill your orders, and meet legal, tax, and safety obligations, after which they are deleted or de-identified on a rolling schedule. You may request deletion of your content and account as described in the Privacy Policy, subject to records we are required to keep.'],
  ['9. Intellectual property',
   'You keep the rights you hold in the photos you upload. Subject to these Terms, Souvenote grants you a personal license to use the cards and songs you generate. The Souvenote name, interface, and underlying technology remain our property.'],
  ['10. Disclaimers and limitation of liability',
   'The service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, Souvenote is not liable for indirect, incidental, or consequential damages, and our total liability is limited to the amount you paid in the three months before the event giving rise to the claim.'],
  ['11. Changes and contact',
   'We may update these Terms from time to time; material changes will be notified in-app or by email. Questions about these Terms can be sent to legal@souvenote.com. By continuing past this screen you confirm you have read and understood these Terms in their entirety.'],
];

const ATTG_PRIVACY: LegalSection[] = [
  ['1. Overview',
   'This Privacy Policy explains what personal information Souvenote collects, how we use it, how long we keep it, and the choices you have. It applies when you create an account, upload photos, generate cards and songs, and place orders.'],
  ['2. Information we collect',
   'We collect: account information (name, email, country); content you provide (uploaded photos, descriptions, names, dates, captions, and messages); generated assets (card images, lyrics, songs); order and payment metadata; and technical data such as device, log, and approximate location inferred from your network. Approximate country is used, among other things, to determine which attestation applies to your upload.'],
  ['3. How we use your information',
   'We use your information to operate the service: to process and transform your photos, generate cards and songs, fulfill and ship orders, provide support, prevent abuse and fraud, comply with the law, and improve the product. We process uploaded likenesses only to produce the output you request.'],
  ['4. Biometric and likeness data',
   'Photos you upload may contain facial and likeness information. We process this solely to generate your requested card and do not use your uploaded faces to build facial-recognition profiles or to identify individuals across the service. You must have consent from each person depicted before uploading, as required by the Terms of Service.'],
  ['5. Data retention',
   'Uploaded photos and intermediate generation data are retained only as long as needed to produce and deliver your card, and are then deleted or de-identified on a rolling schedule. Finished cards and songs remain in your library until you delete them or close your account. Order, tax, and safety records are kept for the periods required by law. When a retention period ends, data is securely deleted or irreversibly anonymized.'],
  ['6. When we share information',
   'We share information with service providers who help us run Souvenote \u2014 cloud hosting, AI generation, payment processing, and print and shipping partners \u2014 under contracts that limit their use of your data. We may disclose information when required by law, to enforce our Terms, or to respond to credible safety reports, including reports of non-consensual intimate imagery. We do not sell your personal information.'],
  ['7. Acceptable use and safety',
   'To keep people safe, we may scan, review, and moderate uploaded and generated content for violations of our acceptable-use rules, including non-consensual intimate imagery and content that targets or harms a real person. Violations may result in content removal, order cancellation, and account suspension, and may be reported to authorities where required.'],
  ['8. Security',
   'We use technical and organizational measures to protect your information, including encryption in transit and access controls. No system is perfectly secure, but we work to limit and quickly remediate any incident.'],
  ['9. Your choices and rights',
   'Depending on where you live, you may have rights to access, correct, delete, or export your personal information, and to withdraw consent. You can delete individual cards and request account deletion in your settings, or by contacting us. We will honor valid requests subject to records we must retain by law.'],
  ['10. Children',
   'Souvenote is not directed to children, and accounts are intended for adults. Do not upload photos of children who are not your own dependents, and never upload a child\u2019s image without the consent of their parent or guardian.'],
  ['11. Contact',
   'For privacy questions or to exercise your rights, contact privacy@souvenote.com. By continuing past this screen you confirm you have read and understood this Privacy Policy in its entirety.'],
];

// ------------------------------------------------------------------
// One-time style injection
// ------------------------------------------------------------------
const ATTG_CSS = `
.attg-wrap{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px;font-family:var(--font-sans,'Outfit',sans-serif)}
.attg-scrim{position:absolute;inset:0;background:rgba(4,5,9,.78);backdrop-filter:blur(7px)}
.attg-modal{position:relative;width:min(900px,100%);max-height:92vh;display:flex;flex-direction:column;
  background:linear-gradient(180deg,#14141b 0%,#0c0c12 100%);border:1.5px solid var(--rose-gold,#C88B86);
  border-radius:20px;box-shadow:0 40px 120px rgba(0,0,0,.6),0 0 0 1px rgba(200,139,134,.18),0 0 40px -8px rgba(200,139,134,.35);overflow:hidden}
.attg-head{padding:26px 30px 18px;border-bottom:1px solid var(--divider,rgba(255,255,255,.08));position:relative;flex:0 0 auto}
.attg-eyebrow{display:flex;align-items:center;gap:8px;color:var(--gold,#d6b078);
  font-size:10.5px;font-weight:700;letter-spacing:.26em;text-transform:uppercase}
.attg-title{margin:12px 0 6px;font-family:var(--font-display,'Outfit',sans-serif);font-weight:800;
  font-size:27px;line-height:1.08;letter-spacing:-.02em;color:var(--text-primary,#f4f1ea)}
.attg-sub{margin:0;font-size:14px;line-height:1.55;color:var(--text-secondary,#b6b1a8);max-width:54ch}
.attg-close{position:absolute;top:20px;right:22px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;
  border-radius:9px;border:1px solid var(--divider,rgba(255,255,255,.1));background:transparent;color:var(--text-muted,#8b867d);cursor:pointer}
.attg-close:hover{color:var(--text-primary,#f4f1ea);border-color:rgba(255,255,255,.25)}
.attg-tabs{display:flex;align-items:stretch;gap:0;padding:16px 30px 0;flex:0 0 auto}
.attg-tab{flex:1;display:flex;align-items:center;gap:10px;padding:13px 16px;cursor:default;
  border:1px solid var(--divider,rgba(255,255,255,.1));border-bottom:none;border-radius:12px 12px 0 0;
  background:rgba(255,255,255,.015);color:var(--text-secondary,#b6b1a8);transition:.18s}
.attg-tab.is-active{background:rgba(214,176,120,.08);border-color:rgba(214,176,120,.32);color:var(--text-primary,#f4f1ea)}
.attg-tab-arrow{flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:34px;color:var(--text-muted,#6f6a61)}
.attg-tab-dot{width:22px;height:22px;flex:0 0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;
  border:1.5px solid var(--text-muted,#6f6a61);color:transparent;font-size:11px;transition:.2s}
.attg-tab.is-read .attg-tab-dot{background:var(--gold,#d6b078);border-color:var(--gold,#d6b078);color:#1a1206}
.attg-tab-label{display:flex;flex-direction:column;line-height:1.15;text-align:left}
.attg-tab-label b{font-size:13.5px;font-weight:700}
.attg-tab-label span{font-size:10.5px;letter-spacing:.04em;color:var(--text-muted,#8b867d)}
.attg-tab.is-read .attg-tab-label span{color:var(--gold,#d6b078)}
.attg-reader{flex:1 1 auto;min-height:160px;overflow-y:auto;overflow-x:hidden;padding:28px 36px 12px;border:1px solid var(--divider,rgba(255,255,255,.1));
  border-top:none;background:rgba(0,0,0,.18);scroll-behavior:smooth}
.attg-reader h4{margin:22px 0 7px;font-family:var(--font-display,'Outfit',sans-serif);font-weight:700;font-size:16.5px;color:var(--platinum-hi,#e8e3d8)}
.attg-reader h4:first-child{margin-top:0}
.attg-reader p{margin:0;font-size:15px;line-height:1.72;color:var(--text-secondary,#b6b1a8);max-width:74ch}
.attg-reader{scrollbar-width:thin;scrollbar-color:rgba(212,175,55,.62) rgba(8,8,12,.88)}
.attg-reader::-webkit-scrollbar{width:12px}
.attg-reader::-webkit-scrollbar-track{background:rgba(8,8,12,.88);border-left:1px solid rgba(212,175,55,.14)}
.attg-reader::-webkit-scrollbar-thumb{min-height:72px;border:3px solid rgba(8,8,12,.88);border-radius:999px;background:linear-gradient(180deg,rgba(241,208,116,.86),rgba(200,139,134,.78))}
.attg-reader::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,rgba(248,224,136,.96),rgba(229,184,177,.92))}
/* In-flow banner that announces each document as you reach it */
.attg-docband{display:flex;align-items:center;gap:13px;margin:0 0 22px;padding:16px 20px;border-radius:13px;
  background:linear-gradient(135deg,rgba(214,176,120,.12),rgba(224,180,173,.06));border:1px solid rgba(214,176,120,.3)}
.attg-docband-no{flex:0 0 auto;width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;
  font-family:var(--font-display,'Outfit',sans-serif);font-weight:800;font-size:16px;color:#1a1206;
  background:linear-gradient(135deg,#e9c577,#d6a85a)}
.attg-docband-txt{display:flex;flex-direction:column;line-height:1.2}
.attg-docband-txt b{font-family:var(--font-display,'Outfit',sans-serif);font-weight:800;font-size:18px;color:var(--text-primary,#f4f1ea);letter-spacing:-.01em}
.attg-docband-txt span{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#d6b078)}
/* Transition divider between the two documents */
.attg-docdivider{display:flex;align-items:center;gap:14px;margin:34px 0 30px}
.attg-docdivider::before,.attg-docdivider::after{content:'';height:1px;flex:1 1 auto;background:linear-gradient(90deg,transparent,rgba(214,176,120,.4),transparent)}
.attg-docdivider span{flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;padding:7px 15px;border-radius:999px;
  font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#d6b078);
  background:rgba(214,176,120,.1);border:1px solid rgba(214,176,120,.3)}
.attg-reader-end{margin:22px 0 6px;padding:12px 14px;border-radius:10px;text-align:center;font-size:12px;letter-spacing:.04em;
  background:rgba(214,176,120,.08);border:1px solid rgba(214,176,120,.28);color:var(--gold,#d6b078);display:flex;align-items:center;justify-content:center;gap:8px}
.attg-progress{flex:0 0 auto;height:3px;background:rgba(255,255,255,.06);position:relative;overflow:hidden}
.attg-progress i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,var(--gold,#d6b078),var(--rose-gold,#e0b4ad));transition:width .15s ease-out}
.attg-scrollhint{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:7px;padding:9px;
  font-size:11.5px;letter-spacing:.04em;color:var(--text-muted,#8b867d);background:rgba(0,0,0,.25);border:1px solid var(--divider,rgba(255,255,255,.1));border-top:none}
.attg-checks{flex:0 0 auto;padding:18px 30px;display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--divider,rgba(255,255,255,.08))}
.attg-locknote{display:flex;align-items:center;gap:9px;font-size:12px;letter-spacing:.02em;color:var(--text-muted,#8b867d)}
.attg-check{display:flex;gap:12px;align-items:flex-start;cursor:pointer;opacity:.45;transition:.2s;user-select:none}
.attg-check.is-enabled{opacity:1}
.attg-check.is-enabled:hover .attg-check-box{border-color:var(--gold,#d6b078)}
.attg-check-box{flex:0 0 auto;width:22px;height:22px;margin-top:1px;border-radius:6px;border:1.5px solid var(--text-muted,#6f6a61);
  display:flex;align-items:center;justify-content:center;color:transparent;transition:.15s}
.attg-check.is-checked .attg-check-box{background:var(--gold,#d6b078);border-color:var(--gold,#d6b078);color:#1a1206}
.attg-check.is-err .attg-check-box{border-color:#d98a7a}
.attg-check-text{font-size:13px;line-height:1.5;color:var(--text-secondary,#b6b1a8)}
.attg-foot{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 30px 22px}
.attg-foot-note{font-size:11.5px;letter-spacing:.04em;color:var(--text-muted,#8b867d)}
.attg-btn{display:inline-flex;align-items:center;gap:9px;padding:13px 22px;border-radius:11px;font-family:var(--font-sans,'Outfit',sans-serif);
  font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;border:1px solid transparent;transition:.18s}
.attg-btn-secondary{background:transparent;border-color:var(--divider,rgba(255,255,255,.16));color:var(--text-secondary,#b6b1a8)}
.attg-btn-secondary:hover{color:var(--text-primary,#f4f1ea);border-color:rgba(255,255,255,.3)}
.attg-btn-primary{background:linear-gradient(135deg,#e9c577,#d6a85a);color:#1c1305;box-shadow:0 8px 26px rgba(214,168,90,.28)}
.attg-btn-primary[disabled]{opacity:.4;pointer-events:none;box-shadow:none;filter:saturate(.6)}
.attg-icon{flex:0 0 auto}
/* Compress the header on short viewports so the reader keeps a usable height */
@media (max-height:680px){
  .attg-head{padding:18px 30px 14px}
  .attg-title{font-size:22px;margin:8px 0 5px}
  .attg-sub{font-size:13px}
  .attg-tabs{padding-top:12px}
}
`;

function AttgInjectStyles() {
  React.useEffect(() => {
    if (document.getElementById('attg-styles')) return;
    const el = document.createElement('style');
    el.id = 'attg-styles';
    el.textContent = ATTG_CSS;
    document.head.appendChild(el);
  }, []);
  return null;
}

function AttgIcon({ name, w = 16 }: AttgIconProps) {
  const p: React.SVGProps<SVGSVGElement> = { width: w, height: w, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'lock':  return <svg {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
    case 'check': return <svg {...p}><path d="M5 12.5l4 4 10-10" /></svg>;
    case 'close': return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case 'arrow': return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case 'down':  return <svg {...p}><path d="M12 5v14M6 13l6 6 6-6" /></svg>;
    default: return null;
  }
}

// ------------------------------------------------------------------
// The gate
// ------------------------------------------------------------------
function AttestationGate({ open, onClose, onAgree }: AttestationGateProps) {
  const DOCS: Record<LegalDocKey, LegalDoc> = {
    terms:   { label: 'Terms of Service', sub: 'Acceptable use & rights', sections: ATTG_TERMS },
    privacy: { label: 'Privacy Policy',   sub: 'Data use & retention',    sections: ATTG_PRIVACY },
  };
  const [activeDoc, setActiveDoc] = React.useState<LegalDocKey>('terms');
  const [read, setRead] = React.useState<ReadState>({ terms: false, privacy: false });
  const [a1, setA1] = React.useState(false);
  const [a2, setA2] = React.useState(false);
  const [showErr, setShowErr] = React.useState(false);
  const [pct, setPct] = React.useState(0);
  const readerRef = React.useRef<HTMLDivElement | null>(null);
  const privacyRef = React.useRef<HTMLDivElement | null>(null);

  const bothRead = read.terms && read.privacy;
  const bothChecked = a1 && a2;

  // Reset to the top of the combined document each time the modal opens.
  React.useEffect(() => {
    if (!open) return;
    setActiveDoc('terms'); setShowErr(false); setPct(0);
    setRead({ terms: false, privacy: false });
    const el = readerRef.current;
    if (el) {
      el.scrollTop = 0;
      // If everything fits without scrolling, both docs count as read.
      requestAnimationFrame(() => {
        if (el.scrollHeight <= el.clientHeight + 8) {
          setRead({ terms: true, privacy: true });
          setPct(100);
        }
      });
    }
  }, [open]);

  if (!open) return null;

  // One continuous scroll: Terms first, then Privacy. We mark Terms read once
  // the Privacy banner scrolls into view, and Privacy read at the very bottom.
  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    const ratio = max <= 0 ? 1 : Math.min(1, el.scrollTop / max);
    setPct(Math.round(ratio * 100));

    const divTop = privacyRef.current ? privacyRef.current.offsetTop : Infinity;
    const viewBottom = el.scrollTop + el.clientHeight;
    // Which document the reader is currently sitting in (drives the header highlight).
    setActiveDoc(el.scrollTop + el.clientHeight * 0.35 >= divTop ? 'privacy' : 'terms');
    // Terms fully read once the transition divider has come into view.
    if (viewBottom >= divTop + 8) setRead(r => r.terms ? r : { ...r, terms: true });
    // Privacy read at the bottom of the whole document.
    if (viewBottom >= el.scrollHeight - 24) setRead(r => r.privacy ? r : { ...r, privacy: true, terms: true });
  };

  const tryAgree = () => {
    if (!bothChecked) { setShowErr(true); return; }
    onAgree?.();
  };


  const ui = (
    <div className="attg-wrap" role="dialog" aria-modal="true" data-screen-label="Modal · Image-rights attestation">
      <AttgInjectStyles />
      <div className="attg-scrim" onClick={onClose} />
      <div className="attg-modal">
        <div className="attg-head">
          <div className="attg-eyebrow"><AttgIcon name="lock" w={13} /><span>Required before upload</span></div>
          <h2 className="attg-title">Review &amp; confirm before we continue.</h2>
          <p className="attg-sub">Because your upload contains a real person&rsquo;s likeness, please read both documents in full, then confirm the statements below.</p>
          <button type="button" className="attg-close" onClick={onClose} aria-label="Close"><AttgIcon name="close" w={15} /></button>
        </div>

        <div className="attg-tabs">
          {(Object.keys(DOCS) as LegalDocKey[]).map((k, i) => (
            <React.Fragment key={k}>
              {i > 0 && <span className="attg-tab-arrow"><AttgIcon name="arrow" w={16} /></span>}
              <div className={`attg-tab ${k === activeDoc ? 'is-active' : ''} ${read[k] ? 'is-read' : ''}`}>
                <span className="attg-tab-dot"><AttgIcon name="check" w={12} /></span>
                <span className="attg-tab-label">
                  <b>{DOCS[k].label}</b>
                  <span>{read[k] ? 'Read \u2713' : DOCS[k].sub}</span>
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>

        <div className="attg-reader" ref={readerRef} onScroll={onScroll}>
          <div className="attg-docband">
            <span className="attg-docband-no">1</span>
            <span className="attg-docband-txt">
              <span>Document 1 of 2</span>
              <b>{DOCS.terms.label}</b>
            </span>
          </div>
          {DOCS.terms.sections.map(([h, body], i) => (
            <React.Fragment key={'t' + i}>
              <h4>{h}</h4>
              <p>{body}</p>
            </React.Fragment>
          ))}

          <div className="attg-docdivider" ref={privacyRef}>
            <span><AttgIcon name="check" w={13} /> End of Terms &mdash; Privacy Policy next</span>
          </div>

          <div className="attg-docband">
            <span className="attg-docband-no">2</span>
            <span className="attg-docband-txt">
              <span>Document 2 of 2</span>
              <b>{DOCS.privacy.label}</b>
            </span>
          </div>
          {DOCS.privacy.sections.map(([h, body], i) => (
            <React.Fragment key={'p' + i}>
              <h4>{h}</h4>
              <p>{body}</p>
            </React.Fragment>
          ))}

          <div className="attg-reader-end"><AttgIcon name="check" w={14} /> You&rsquo;ve reached the end of both documents.</div>
        </div>

        <div className="attg-progress"><i style={{ width: pct + '%' }} /></div>

        {!bothRead && (
          <div className="attg-scrollhint">
            <AttgIcon name="down" w={13} /> {read.terms ? 'Keep scrolling to the end of the Privacy Policy to continue' : 'Keep scrolling \u2014 read both documents to the end to continue'}
          </div>
        )}

        <div className="attg-checks">
          {!bothRead ? (
            <div className="attg-locknote"><AttgIcon name="lock" w={13} /> Read both the Terms of Service and Privacy Policy to the end to unlock the confirmations below.</div>
          ) : (
            <React.Fragment>
              <label className={`attg-check is-enabled ${a1 ? 'is-checked' : ''} ${showErr && !a1 ? 'is-err' : ''}`}>
                <span className="attg-check-box"><AttgIcon name="check" w={13} /></span>
                <input type="checkbox" checked={a1}
                       onChange={(e) => setA1(e.target.checked)}
                       style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                <span className="attg-check-text">I certify that I have the explicit consent of the person depicted to upload their photo and process their likeness through this app, and that I own the copyright to the photo.</span>
              </label>
              <label className={`attg-check is-enabled ${a2 ? 'is-checked' : ''} ${showErr && !a2 ? 'is-err' : ''}`}>
                <span className="attg-check-box"><AttgIcon name="check" w={13} /></span>
                <input type="checkbox" checked={a2}
                       onChange={(e) => setA2(e.target.checked)}
                       style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                <span className="attg-check-text">I agree to the Terms of Service and Privacy Policy, including guidelines on acceptable use, data retention, and the Intimate Images Protection Act.</span>
              </label>
            </React.Fragment>
          )}
        </div>

        <div className="attg-foot">
          <span className="attg-foot-note">{bothRead ? (bothChecked ? 'Thank you \u2014 you\u2019re all set.' : 'Confirm both statements to proceed.') : 'Both documents must be read in full.'}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="attg-btn attg-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="attg-btn attg-btn-primary" onClick={tryAgree} disabled={!bothChecked}>
              Agree &amp; continue <AttgIcon name="arrow" w={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(ui, document.body);
}

export { AttestationGate };
