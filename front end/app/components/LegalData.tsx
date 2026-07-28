// LegalData.jsx — content for the four legal documents.
import type { ReactNode } from "react";

// Section structure, titles and table-of-contents are wired to this object.

export type LegalDataKey = "cookie" | "refund" | "terms" | "privacy";

export type LegalSection = {
  id: string;
  title: string;
  paras: string[];
  bullets?: string[];
};

export type LegalDocData = {
  crumbs: string[];
  title: ReactNode;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

const LEGAL_DATA: Record<LegalDataKey, LegalDocData> = {
  cookie: {
    crumbs: ['Legal', 'Cookie Policy'],
    title: <>Cookie <span className="pg-italic text-metallic-gold">Policy</span></>,
    lastUpdated: 'June 1, 2026',
    intro: 'This Cookie Policy explains how Souvenote uses cookies and similar technologies, the choices you have, and how to manage them.',
    sections: [
      { id: 'what-are-cookies', title: 'What are cookies?', paras: [
        'Cookies are small text files placed on your device when you visit a website. They let the site remember your actions and preferences over time, so you don\u2019t have to re-enter them each visit.',
        'We also use related technologies such as local storage and pixels. Where this policy refers to "cookies," it covers these similar technologies too.',
      ] },
      { id: 'cookies-we-use', title: 'Cookies we use', paras: ['We group the cookies we set into four categories:'],
        bullets: ['Essential: keep the site working and your session secure.', 'Preferences: remember choices like currency and language.', 'Analytics: help us understand how the site is used.', 'Marketing: used to measure and improve campaigns.'] },
      { id: 'managing-cookies', title: 'Managing your preferences', paras: [
        'You can accept or decline non-essential cookies at any time through your browser settings or our cookie controls. Essential cookies cannot be switched off, as the site will not function correctly without them.',
        'Most browsers let you block or delete cookies and notify you when one is set. Turning off cookies may affect parts of the site that rely on them.',
      ] },
      { id: 'third-party', title: 'Third-party cookies', paras: [
        'Some cookies are set by trusted partners who help us run analytics, process payments, or deliver content. These partners may collect information about your activity across sites in line with their own policies.',
      ] },
      { id: 'updates', title: 'Updates to this policy', paras: [
        'We may update this Cookie Policy as our practices or the law change. When we do, we will revise the date at the top of this page.',
      ] },
    ],
  },

  refund: {
    crumbs: ['Legal', 'Refund Policy'],
    title: <>Refund <span className="pg-italic text-metallic-gold">Policy</span></>,
    lastUpdated: 'June 1, 2026',
    intro: 'We want you to love what you create. This Refund Policy describes when and how refunds are issued.',
    sections: [
      { id: 'overview', title: 'Overview', paras: [
        'Because each Souvenote card and any optional song is generated for you, refunds depend on whether an order has entered production. This section explains the general approach; the rest of the policy covers the details.',
        'If something isn\u2019t right with your order, reach out and we\u2019ll work with you to make it right.',
      ] },
      { id: 'eligibility', title: 'Refund eligibility', paras: ['The following purchases generally qualify for a refund:'],
        bullets: ['Unprinted digital credits within a set window.', 'Orders cancelled before they enter production.', 'Items that arrive damaged or defective.'] },
      { id: 'non-refundable', title: 'Non-refundable items', paras: [
        'Personalized items that have already been printed and shipped, and credits that have been used to generate content, are generally non-refundable except where required by law.',
      ] },
      { id: 'how-to-request', title: 'How to request a refund', paras: [
        'To request a refund, contact us with your order number and a short description of the issue. For damaged or defective items, a photo helps us resolve things faster.',
        'We\u2019ll review each request individually and let you know the outcome by email.',
      ] },
      { id: 'processing-time', title: 'Processing time', paras: [
        'Approved refunds are issued to your original payment method. Depending on your bank or card provider, it may take several business days for the funds to appear.',
      ] },
    ],
  },

  terms: {
    crumbs: ['Legal', 'Terms of Service'],
    title: <>Terms of <span className="pg-italic text-metallic-gold">Service</span></>,
    lastUpdated: 'June 1, 2026',
    intro: 'These Terms of Service govern your use of Souvenote. By creating an account or using the site, you agree to them.',
    sections: [
      { id: 'acceptance', title: 'Acceptance of terms', paras: [
        'By accessing or using Souvenote, you agree to be bound by these terms and our policies referenced within them. If you do not agree, please do not use the service.',
        'If you use the service on behalf of someone else, you confirm you\u2019re authorized to accept these terms for them.',
      ] },
      { id: 'accounts', title: 'Your account', paras: [
        'You\u2019re responsible for keeping your account credentials secure and for activity that happens under your account. Let us know promptly if you suspect any unauthorized use.',
      ] },
      { id: 'content', title: 'Content and ownership', paras: [
        'You retain rights to the photos and text you upload. By using them on Souvenote, you grant us the limited permissions we need to generate, print, and deliver your cards and optional songs.',
        'The cards and optional songs you create are yours to share. Our platform, templates, and software remain our property.',
      ] },
      { id: 'acceptable-use', title: 'Acceptable use', paras: ['When using Souvenote, you agree to the following:'],
        bullets: ['Don\u2019t upload content you don\u2019t have rights to.', 'Don\u2019t use the service for unlawful purposes.', 'Don\u2019t attempt to disrupt or reverse-engineer the platform.'] },
      { id: 'payments', title: 'Payments and credits', paras: [
        'Purchases of credits and card packs are charged at checkout in the currency shown. Credits are applied to your account and used as you generate content. Pricing and what each credit covers are described at the point of purchase.',
      ] },
      { id: 'liability', title: 'Limitation of liability', paras: [
        'Souvenote is provided "as is." To the fullest extent permitted by law, we are not liable for indirect or incidental damages arising from your use of the service.',
      ] },
      { id: 'changes', title: 'Changes to these terms', paras: [
        'We may update these terms from time to time. If we make material changes, we\u2019ll update the date above and, where appropriate, notify you. Continued use after changes means you accept the updated terms.',
      ] },
    ],
  },

  privacy: {
    crumbs: ['Legal', 'Privacy Policy'],
    title: <>Privacy <span className="pg-italic text-metallic-gold">Policy</span></>,
    lastUpdated: 'June 1, 2026',
    intro: 'Your privacy matters to us. This policy explains what we collect, why, and the choices you have.',
    sections: [
      { id: 'information-we-collect', title: 'Information we collect', paras: ['We collect the following kinds of information:'],
        bullets: ['Account details you provide, like name and email.', 'Content you upload, such as photos and messages.', 'Usage and device information collected automatically.'] },
      { id: 'how-we-use', title: 'How we use your information', paras: [
        'We use your information to generate and deliver your cards and optional songs, process payments, provide support, and improve the service.',
        'We do not sell your personal information. Where we rely on partners to operate the service, we share only what\u2019s needed for them to perform their role.',
      ] },
      { id: 'sharing', title: 'How we share information', paras: [
        'We share information with service providers who help us run Souvenote\u2014such as printing, shipping, and payment partners\u2014under agreements that require them to protect it. We may also disclose information where required by law.',
      ] },
      { id: 'your-rights', title: 'Your rights and choices', paras: [
        'Depending on where you live, you may have the right to access, correct, or delete your personal information, or to object to certain processing. You can exercise these rights by contacting us.',
        'You can also manage many preferences directly in your account settings.',
      ] },
      { id: 'data-retention', title: 'Data retention', paras: [
        'Uncommitted uploads are scheduled for deletion after one day, failed or rejected creative assets after 30 days, and abandoned drafts that were never approved or ordered after 90 days of inactivity. Approved cards and songs remain available while your account is active unless you delete them.',
        'After an account-deletion request, creative content has a 30-day recovery grace period. Delivery addresses are scheduled for redaction 180 days after an order reaches a terminal state. Financial, tax, order, and fulfillment evidence may be retained for six years from the end of the last related tax year, and information used for a decision affecting you is retained for at least one year where required.',
        'A documented legal hold, dispute, fraud investigation, security incident, or active access request can pause deletion for affected records. Deletion can take up to 35 additional days to propagate through encrypted backups and noncurrent object versions.',
      ] },
      { id: 'security', title: 'Security', paras: [
        'We use technical and organizational safeguards designed to protect your information. No method of transmission or storage is completely secure, but we work to keep your data safe and to respond quickly if an issue arises.',
      ] },
      { id: 'contact', title: 'Contacting us', paras: [
        'If you have questions about this policy or how we handle your information, reach out through our Contact page and we\u2019ll be glad to help.',
      ] },
    ],
  },
};

export { LEGAL_DATA };
