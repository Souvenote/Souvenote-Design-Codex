'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BmcReview } from './BmcReview';
import { BmcErrorModal, bmcError } from './BmcShared';
import { OrnamentDivider } from './Ornaments';
import { AttestationGate } from './AttestationGate';
import {
  createCardDraft,
  fetchCardDraftAssets,
  fetchCardDraftById,
  mockUpload,
  refreshCardDraftBackendState,
  startGeneration,
  updateCardDraft,
} from '../lib/api';
import type { CardDraftAsset } from '../lib/api';
import { publishCreditBalance } from '../lib/creditBalance';
import {
  rememberGeneratedAssets,
  rememberSelectedAsset,
  resetMockMvpOrderState,
  writeMockMvpFlowState,
} from '../lib/mockMvpFlow';
import type { CreditBalanceStatus } from '../lib/creditBalance';
import { getTotalCredits, type AccountBalance } from './createFlowRules';
import { CARD_WITH_QR_SONG_CREDITS, MIN_GENERATION_CREDITS } from './createFlowRules';
import { goToPricingAfterPurchase } from './PricingReturn';
import { AuthGatePrompt } from './AuthGatePrompt';

// Personalize.tsx - Page 3: Personalize a Template (marketplace + modal + chatbot).

type PtIconName =
  | 'arrow'
  | 'back'
  | 'search'
  | 'sparkle'
  | 'upload'
  | 'close'
  | 'check'
  | 'send'
  | 'chevL'
  | 'chevR'
  | 'min'
  | 'shield';

type PtIconProps = {
  name: PtIconName;
  w?: number;
};

type TemplateArt = {
  bg: string;
  eyebrow?: string;
  glyph?: React.ReactNode;
  foot?: string;
};

type Template = {
  id: string;
  name: string;
  tag?: string;
  sub?: string;
  occasion: string;
  popular?: boolean;
  art: TemplateArt;
  _pad?: boolean;
};

type OccasionOption = {
  id: string;
  label: string;
  count: number;
};

type PtTemplateCardProps = {
  tmpl: Template;
  onPersonalize?: (template: Template) => void;
  compact?: boolean;
};

type PtSectionRailProps = {
  items: Template[];
  onPersonalize: (template: Template) => void;
};

type PtOccasionsProps = {
  occasion: string;
  setOccasion: (occasion: string) => void;
};

type PtMarketplaceProps = {
  onPersonalize: (template: Template) => void;
};

type ModalStepId = 'photo' | 'birthday' | 'caption';

type ModalStep = {
  id: ModalStepId;
  label: string;
};

type PhotoPreview = {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
};

type PtPersonalizeModalProps = {
  tmpl: Template | null;
  open: boolean;
  onClose: (draftInput?: PersonalizeDraftInput) => void | Promise<void>;
  onCreate?: (includeSong: boolean, draftInput: PersonalizeDraftInput) => void | Promise<void>;
  initialStep?: ModalStepId;
  initialDraftInput?: PersonalizeDraftInput | null;
  generating?: boolean;
  requireAuthToContinue?: boolean;
  onAuthRequired?: () => void;
};

type ChatPreset = 'Caption' | 'Personal Message' | 'Vibe Check' | 'Custom';

type ChatMessage = {
  role: 'bot' | 'user';
  text: React.ReactNode;
};

type PtChatProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

type PersonalizeView = 'marketplace' | 'review';

type PersonalizeAppProps = {
  openModal?: boolean;
  resumeDraftId?: string | null;
  initialModalStep?: ModalStepId;
  accountBalance?: AccountBalance;
  creditStatus?: CreditBalanceStatus;
  refreshCredits?: () => Promise<unknown> | unknown;
  requireAuthToContinue?: boolean;
};

type PersonalizeDraftInput = {
  occasion?: string;
  relationship?: string;
  creativeBrief: Record<string, unknown>;
};

type ReferenceImageUpload = {
  filename: string;
  mimeType: string;
  size: number;
};

const CURRENT_CARD_DRAFT_ID_KEY = 'souv_current_card_draft_id';

function buildTemplateDraftInput(tmpl: Template): PersonalizeDraftInput {
  return {
    occasion: tmpl.occasion,
    creativeBrief: {
      flow: 'personalize_template',
      template: {
        id: tmpl.id,
        name: tmpl.name,
        occasion: tmpl.occasion,
        tag: tmpl.tag,
      },
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function nestedRecord(source: Record<string, unknown> | undefined, key: string): Record<string, unknown> {
  return asRecord(source?.[key]);
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function referenceImageValue(value: unknown): PhotoPreview[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const record = asRecord(item);
    const name = textValue(record.filename) || textValue(record.name);
    if (!name) return [];

    return [
      {
        name,
        url: '/assets/LogoMark.png',
        mimeType: textValue(record.mimeType) || undefined,
        size: numberValue(record.size, 0) || undefined,
      },
    ];
  });
}

function getReferenceImageUploads(input: PersonalizeDraftInput): ReferenceImageUpload[] {
  const photo = nestedRecord(input.creativeBrief, 'photo');
  const referenceImages = photo.referenceImages;
  if (!Array.isArray(referenceImages)) return [];

  return referenceImages.flatMap((item) => {
    const record = asRecord(item);
    const filename = textValue(record.filename) || textValue(record.name);
    const mimeType = textValue(record.mimeType);
    const size = numberValue(record.size);

    if (!filename || !mimeType.includes('/') || size <= 0) return [];
    return [{ filename, mimeType, size }];
  });
}

function referenceUploadSignature(cardDraftId: string, uploads: ReferenceImageUpload[]) {
  return `${cardDraftId}:${JSON.stringify(uploads)}`;
}

// ============================================================
// ICONS
// ============================================================
function PtIcon({ name, w = 18 }: PtIconProps) {
  const props: React.SVGProps<SVGSVGElement> = {
    width: w,
    height: w,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  switch (name) {
    case 'arrow':
      return (
        <svg {...props}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case 'back':
      return (
        <svg {...props}>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      );
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4.5-4.5" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg {...props}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        </svg>
      );
    case 'upload':
      return (
        <svg {...props}>
          <path d="M12 4v12M6 10l6-6 6 6" />
          <path d="M4 18v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      );
    case 'close':
      return (
        <svg {...props}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path d="M5 12.5l4 4 10-10" />
        </svg>
      );
    case 'send':
      return (
        <svg {...props}>
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
        </svg>
      );
    case 'chevL':
      return (
        <svg {...props}>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      );
    case 'chevR':
      return (
        <svg {...props}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case 'min':
      return (
        <svg {...props}>
          <path d="M5 12h14" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...props}>
          <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" />
          <path d="M8.5 12l2.5 2.5 5-5" />
        </svg>
      );
    default:
      return null;
  }
}

// ============================================================
// TEMPLATE CATALOG
// ============================================================
const TEMPLATES: Template[] = [
  // FEATURED row (most popular)
  {
    id: 'on-this-day',
    name: 'On This Day',
    tag: 'Birthday',
    sub: 'A snapshot of the world the day they were born.',
    occasion: 'Birthday',
    popular: true,
    art: {
      bg: 'radial-gradient(70% 60% at 50% 30%, #18223a 0%, #0a0f1d 70%, #050810 100%)',
      eyebrow: 'ON THIS DAY · MAR 4 1992',
      glyph: (
        <>
          The world spun.
          <br />
          <em style={{ color: '#e0c478' }}>You arrived.</em>
        </>
      ),
      foot: '— Their unrepeatable date —',
    },
  },
  {
    id: 'horoscope',
    name: 'Horoscope',
    tag: 'Birthday · Astrology',
    sub: 'Their sign, their stars, a card calibrated to both.',
    occasion: 'Birthday',
    popular: true,
    art: {
      bg: 'radial-gradient(60% 80% at 50% 20%, #2a1a40 0%, #110628 70%, #050208 100%)',
      eyebrow: '♓ PISCES · FEB 19 – MAR 20',
      glyph: (
        <>
          Deep&nbsp;water,
          <br />
          <em style={{ color: '#e8b8ff' }}>steady tide.</em>
        </>
      ),
      foot: '— Mutable · Yin · Neptune —',
    },
  },
  {
    id: 'comic-card',
    name: 'Comic Card',
    tag: 'Just Because',
    sub: 'Cartoon-panel hero pose, bold onomatopoeia, sentimental punchline.',
    occasion: 'Just Because',
    popular: true,
    art: {
      bg: 'radial-gradient(50% 60% at 30% 30%, #c93c54 0%, #6b0e1f 65%, #2a040a 100%)',
      eyebrow: '★ ★ ★ ISSUE #032 ★ ★ ★',
      glyph: (
        <>
          POW!
          <br />
          <em style={{ color: '#ffe27a', fontSize: 18 }}>(it's your birthday)</em>
        </>
      ),
      foot: '— A halftone hero —',
    },
  },
  {
    id: 'book-cover',
    name: 'Book / Movie Cover',
    tag: 'Anniversary · Wedding',
    sub: 'Make them the title character of their own story.',
    occasion: 'Anniversary',
    popular: true,
    art: {
      bg: 'radial-gradient(40% 60% at 50% 70%, #c89665 0%, #6f3a18 60%, #1c0d05 100%)',
      eyebrow: 'A NOVEL · FIRST EDITION',
      glyph: (
        <>
          Together,
          <br />
          <em style={{ color: '#fbd9b0' }}>by us.</em>
        </>
      ),
      foot: '— Chapter one of many —',
    },
  },
  {
    id: 'mental-health',
    name: 'Mental Health',
    tag: 'Just Because · Get Well',
    sub: 'Warm reassurance, soft palette, a card that says the quiet thing.',
    occasion: 'Get Well',
    popular: true,
    art: {
      bg: 'radial-gradient(70% 70% at 50% 50%, #f4c4a8 0%, #c87a92 55%, #5e2440 100%)',
      eyebrow: 'A CARD THAT SAYS IT',
      glyph: (
        <>
          You're allowed
          <br />
          <em style={{ color: '#fff0c8' }}>to feel it all.</em>
        </>
      ),
      foot: '— A quiet word, well-meant —',
    },
  },
  {
    id: 'courtroom',
    name: 'Courtroom Case',
    tag: 'Just Because · Roast',
    sub: 'Mock trial — exhibits A through D, kind verdict at the bottom.',
    occasion: 'Just Because',
    popular: true,
    art: {
      bg: 'radial-gradient(50% 70% at 50% 30%, #2f2b1d 0%, #14110a 70%, #060503 100%)',
      eyebrow: 'CASE 24-CV-1102',
      glyph: (
        <>
          The People
          <br />
          <em style={{ color: '#e0c478' }}>v. Cameron.</em>
        </>
      ),
      foot: '— Verdict: loved —',
    },
  },

  // Additional occasion templates
  {
    id: 'gold-foil',
    name: 'Gold Foil Letterpress',
    tag: 'Anniversary',
    sub: 'Heritage stationer — pressed gold serif, hairline rules, no nonsense.',
    occasion: 'Anniversary',
    art: {
      bg: 'radial-gradient(70% 50% at 50% 30%, #2a200e 0%, #161008 60%, #050402 100%)',
      eyebrow: '— EST. TODAY —',
      glyph: (
        <em style={{ color: '#f4d870', fontStyle: 'italic' }}>
          Ten&nbsp;years,
          <br />
          and counting.
        </em>
      ),
      foot: '— Anniv. Edition —',
    },
  },
  {
    id: 'pressed-flowers',
    name: 'Pressed Flowers',
    tag: 'Wedding',
    sub: 'A botanical print pressed across the front — your photo in the center.',
    occasion: 'Wedding',
    art: {
      bg: 'radial-gradient(70% 70% at 50% 50%, #e7c7a8 0%, #b08470 55%, #4d2820 100%)',
      eyebrow: 'IN BLOOM',
      glyph: (
        <em style={{ color: '#fff0d0' }}>
          Today,
          <br />
          and always.
        </em>
      ),
      foot: '— A botanical print —',
    },
  },
  {
    id: 'letterpress-thanks',
    name: 'Letterpress Thanks',
    tag: 'Thank You',
    sub: 'Three words, weighted ink, hand-set serif.',
    occasion: 'Thank You',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 50%, #f0e8d8 0%, #c8b89a 55%, #6e5e44 100%)',
      eyebrow: '·  TYPESET  ·',
      glyph: (
        <span style={{ color: '#1e1a10' }}>
          Thank,
          <br />
          <em>you.</em>
        </span>
      ),
      foot: '— Letterpress —',
    },
  },
  {
    id: 'holiday-seasonal',
    name: 'Holiday Seasonal',
    tag: 'Holiday',
    sub: 'Greenery, mulled-wine palette, gold ribbons. Auto-pick by month.',
    occasion: 'Holiday',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 30%, #1f4538 0%, #0b1a16 60%, #030504 100%)',
      eyebrow: '— SEASONS GREET —',
      glyph: (
        <em style={{ color: '#f4d870' }}>
          Warm hands,
          <br />
          warm hearts.
        </em>
      ),
      foot: '— Holiday edition —',
    },
  },
  {
    id: 'baby-arrival',
    name: 'Baby Arrival',
    tag: 'New Baby',
    sub: 'Soft pastel sky, hand-lettered name, weight + date stamped at the foot.',
    occasion: 'New Baby',
    art: {
      bg: 'radial-gradient(80% 80% at 50% 30%, #fff0e0 0%, #f0c8b0 50%, #c08a9a 100%)',
      eyebrow: 'WELCOME, LITTLE ONE',
      glyph: (
        <em style={{ color: '#5a2840' }}>
          Hello,
          <br />
          brand new.
        </em>
      ),
      foot: '— 7 lb 4 oz · Mar 04 —',
    },
  },
  {
    id: 'graduation',
    name: 'Graduation Plaque',
    tag: 'Graduation',
    sub: 'Engraved-plate feel — name in serif, year in numerals, ribbons.',
    occasion: 'Graduation',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 40%, #2c2618 0%, #14110a 70%, #050402 100%)',
      eyebrow: 'CLASS OF — — — —',
      glyph: (
        <em style={{ color: '#f4d870' }}>
          And so it
          <br />
          begins.
        </em>
      ),
      foot: '— Graduation Plate —',
    },
  },

  // Popular seasonal & relationship occasions
  {
    id: 'christmas',
    name: 'Merry & Bright',
    tag: 'Christmas',
    sub: 'Evergreen, candlelight, and gold ribbon — your photo nestled in the wreath.',
    occasion: 'Christmas',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 30%, #1f4a32 0%, #0a1f15 60%, #040805 100%)',
      eyebrow: '— MERRY & BRIGHT —',
      glyph: (
        <>
          Joy,
          <br />
          <em style={{ color: '#f4d870' }}>multiplied.</em>
        </>
      ),
      foot: '— Dec 25 —',
    },
  },
  {
    id: 'valentine',
    name: 'Be Mine',
    tag: "Valentine's Day",
    sub: 'Deep crimson, a single foil heart, room for the one line that matters.',
    occasion: "Valentine's Day",
    art: {
      bg: 'radial-gradient(55% 65% at 50% 40%, #c0304e 0%, #6a0f24 60%, #240409 100%)',
      eyebrow: 'SEALED WITH A —',
      glyph: (
        <>
          Still you,
          <br />
          <em style={{ color: '#ffd0d8' }}>still us.</em>
        </>
      ),
      foot: '— Feb 14 —',
    },
  },
  {
    id: 'mothers-day',
    name: 'For Mom',
    tag: "Mother's Day",
    sub: 'Soft floral wash, hand-lettered thanks — warm without the cliché.',
    occasion: "Mother's Day",
    art: {
      bg: 'radial-gradient(70% 70% at 50% 40%, #f6cdb6 0%, #d98aa0 55%, #6e2e48 100%)',
      eyebrow: 'FOR HER',
      glyph: (
        <em style={{ color: '#fff2e0' }}>
          Thank you,
          <br />
          Mom.
        </em>
      ),
      foot: '— With love —',
    },
  },
  {
    id: 'fathers-day',
    name: 'For Dad',
    tag: "Father's Day",
    sub: 'Slate and amber, understated serif — the card he\u2019d actually keep.',
    occasion: "Father's Day",
    art: {
      bg: 'radial-gradient(60% 70% at 50% 35%, #2a3340 0%, #131922 65%, #050709 100%)',
      eyebrow: 'FOR HIM',
      glyph: (
        <>
          Thanks,
          <br />
          <em style={{ color: '#e0b46a' }}>Dad.</em>
        </>
      ),
      foot: '— The original —',
    },
  },
  {
    id: 'congrats',
    name: 'Well Done',
    tag: 'Congratulations',
    sub: 'Champagne gold, a burst of confetti foil — for any win worth marking.',
    occasion: 'Congratulations',
    art: {
      bg: 'radial-gradient(60% 60% at 50% 35%, #d9b85a 0%, #8a6516 60%, #2a1d05 100%)',
      eyebrow: '· WELL DONE ·',
      glyph: (
        <span style={{ color: '#2a1d05' }}>
          You did
          <br />
          <em>the thing.</em>
        </span>
      ),
      foot: '— Raise a glass —',
    },
  },

  // ── Catalog categories ──────────────────────────────────
  // Anniversary
  {
    id: 'animated-memories',
    name: 'Animated Memories',
    tag: 'Anniversary · Just Because',
    sub: 'Your photos stitched into a short looping reel — motion, not a still.',
    occasion: 'Anniversary',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 35%, #3a2c1c 0%, #1a130b 65%, #070504 100%)',
      eyebrow: 'REEL 01 · PLAY',
      glyph: (
        <>
          Moments,
          <br />
          <em style={{ color: '#e6c07a' }}>in motion.</em>
        </>
      ),
      foot: '— A living memory —',
    },
  },
  {
    id: 'chapter-cards',
    name: 'Chapter Cards',
    tag: 'Anniversary',
    sub: 'Their life as a book — open on the chapter you share together.',
    occasion: 'Anniversary',
    art: {
      bg: 'radial-gradient(50% 60% at 50% 60%, #b08a55 0%, #5e3a18 60%, #1a0d05 100%)',
      eyebrow: 'CHAPTER XII',
      glyph: (
        <>
          The story
          <br />
          <em style={{ color: '#fbdcb0' }}>continues.</em>
        </>
      ),
      foot: '— Turn the page —',
    },
  },
  {
    id: 'time-capsule',
    name: 'Time Capsule',
    tag: 'Anniversary',
    sub: 'Sealed today, opened years from now — a note to the future them.',
    occasion: 'Anniversary',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 40%, #1e3a3a 0%, #0c1a1a 65%, #040808 100%)',
      eyebrow: 'SEALED · OPEN 2046',
      glyph: (
        <>
          For the
          <br />
          <em style={{ color: '#8fe0d0' }}>future you.</em>
        </>
      ),
      foot: '— Do not open early —',
    },
  },

  // Congratulations
  {
    id: 'congrats-milestones',
    name: 'Congrats Milestones',
    tag: 'Congratulations',
    sub: 'New job, new home, big win — a card sized to the moment.',
    occasion: 'Congratulations',
    art: {
      bg: 'radial-gradient(55% 60% at 50% 30%, #e0c25e 0%, #8a6516 60%, #2a1d05 100%)',
      eyebrow: '· MILESTONE ·',
      glyph: (
        <span style={{ color: '#2a1d05' }}>
          Another
          <br />
          <em>marker passed.</em>
        </span>
      ),
      foot: '— Onward —',
    },
  },
  {
    id: 'goal-filler',
    name: 'Goal Filler',
    tag: 'Congratulations',
    sub: 'A progress bar to one hundred percent — they finally hit the goal.',
    occasion: 'Congratulations',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 40%, #1f4a32 0%, #0a1f15 65%, #040805 100%)',
      eyebrow: 'GOAL · 100%',
      glyph: (
        <>
          You
          <br />
          <em style={{ color: '#8ce0a0' }}>got there.</em>
        </>
      ),
      foot: '— Bar filled —',
    },
  },

  // Valentine's Day
  {
    id: 'couples-cards',
    name: 'Couples Cards',
    tag: "Valentine's Day · Anniversary",
    sub: 'Two photos, one frame — a matched set made for the pair of you.',
    occasion: "Valentine's Day",
    art: {
      bg: 'radial-gradient(55% 65% at 50% 40%, #c8506a 0%, #6a1024 60%, #240409 100%)',
      eyebrow: 'THE TWO OF US',
      glyph: (
        <>
          You
          <br />
          <em style={{ color: '#ffd0d8' }}>&amp; me.</em>
        </>
      ),
      foot: '— A matched set —',
    },
  },

  // Holiday
  {
    id: 'dark-holidays',
    name: 'Dark Holidays',
    tag: 'Holiday',
    sub: 'Halloween and the moodier dates — ink-black with a wicked grin.',
    occasion: 'Holiday',
    art: {
      bg: 'radial-gradient(55% 65% at 50% 35%, #3a2208 0%, #160c02 65%, #050301 100%)',
      eyebrow: '— ALL HALLOWS —',
      glyph: (
        <>
          Spooky,
          <br />
          <em style={{ color: '#f0902a' }}>sincerely.</em>
        </>
      ),
      foot: '— After dark —',
    },
  },

  // Birthday
  {
    id: 'fairy-tale-kids',
    name: 'Fairy Tale for Kids',
    tag: 'Birthday · Kids',
    sub: 'Storybook illustration with them as the hero of the tale.',
    occasion: 'Birthday',
    art: {
      bg: 'radial-gradient(70% 70% at 50% 35%, #cdb6f0 0%, #7a5ec0 55%, #2e1e5e 100%)',
      eyebrow: 'ONCE UPON A TIME',
      glyph: (
        <>
          Happily
          <br />
          <em style={{ color: '#fff0c8' }}>ever after.</em>
        </>
      ),
      foot: '— A tale for you —',
    },
  },
  {
    id: 'wheres-waldo',
    name: "Where's Waldo",
    tag: 'Birthday · Kids',
    sub: 'A bustling seek-and-find scene with them hidden in the crowd.',
    occasion: 'Birthday',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 40%, #b53040 0%, #6a1018 60%, #2a060a 100%)',
      eyebrow: 'CAN YOU FIND THEM?',
      glyph: (
        <>
          Look
          <br />
          <em style={{ color: '#ffe27a' }}>closely…</em>
        </>
      ),
      foot: '— Hidden in plain sight —',
    },
  },

  // Thank You
  {
    id: 'recipe-cards',
    name: 'Recipe Cards',
    tag: 'Thank You',
    sub: 'A family recipe, hand-set on a kitchen card — passed along with love.',
    occasion: 'Thank You',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 45%, #f0e6d2 0%, #c8b496 55%, #6e5a40 100%)',
      eyebrow: 'FROM THE KITCHEN',
      glyph: (
        <span style={{ color: '#3a2c18' }}>
          Made
          <br />
          <em>with love.</em>
        </span>
      ),
      foot: '— Serves: everyone —',
    },
  },

  // Just Because
  {
    id: 'editorial-cartoon',
    name: 'Editorial Cartoon',
    tag: 'Just Because · Roast',
    sub: 'A gently satirical op-ed cartoon starring the guest of honor.',
    occasion: 'Just Because',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 40%, #2a2620 0%, #131009 70%, #050402 100%)',
      eyebrow: 'THE DAILY · OP-ED',
      glyph: (
        <>
          Drawn,
          <br />
          <em style={{ color: '#e0c478' }}>with love.</em>
        </>
      ),
      foot: '— Editorial page —',
    },
  },
  {
    id: 'fortune-cards',
    name: 'Fortune Cards',
    tag: 'Just Because',
    sub: 'Mystic palette, a card that "reads" their fortune — kindly rigged.',
    occasion: 'Just Because',
    art: {
      bg: 'radial-gradient(55% 70% at 50% 30%, #2a1a48 0%, #110628 70%, #050208 100%)',
      eyebrow: '✦ YOUR FORTUNE ✦',
      glyph: (
        <>
          Good things,
          <br />
          <em style={{ color: '#d8b8ff' }}>incoming.</em>
        </>
      ),
      foot: '— Shuffle &amp; cut —',
    },
  },
  {
    id: 'missing-you',
    name: "I'll Be Missing You",
    tag: 'Just Because · Thinking of You',
    sub: 'For distance and goodbyes — warm, wistful, never heavy.',
    occasion: 'Just Because',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 40%, #28384e 0%, #121c28 65%, #050709 100%)',
      eyebrow: 'UNTIL NEXT TIME',
      glyph: (
        <>
          I'll be
          <br />
          <em style={{ color: '#a8c8e8' }}>missing you.</em>
        </>
      ),
      foot: '— Miles, not hearts —',
    },
  },
  {
    id: 'invitations',
    name: 'Invitations',
    tag: 'Just Because · Events',
    sub: 'Save-the-date elegance — your event, your faces, RSVP inside.',
    occasion: 'Just Because',
    art: {
      bg: 'radial-gradient(60% 60% at 50% 35%, #2a220e 0%, #161008 65%, #050402 100%)',
      eyebrow: "YOU'RE INVITED",
      glyph: (
        <em style={{ color: '#f4d870', fontStyle: 'italic' }}>
          Save
          <br />
          the date.
        </em>
      ),
      foot: '— RSVP inside —',
    },
  },
  {
    id: 'lyric-cards',
    name: 'Lyric Cards',
    tag: 'Just Because · Music',
    sub: 'Their song, set like a record sleeve — the line that means the most.',
    occasion: 'Just Because',
    art: {
      bg: 'radial-gradient(55% 65% at 50% 40%, #2a2418 0%, #14110a 70%, #050402 100%)',
      eyebrow: '♫ TRACK 01 ♫',
      glyph: (
        <>
          Our
          <br />
          <em style={{ color: '#e0c478' }}>song.</em>
        </>
      ),
      foot: '— Side A —',
    },
  },
  {
    id: 'mystery-donations',
    name: 'Mystery Donations',
    tag: 'Just Because',
    sub: 'A gift made in their name to a cause they love — quietly anonymous.',
    occasion: 'Just Because',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 40%, #1f4035 0%, #0b1a16 65%, #040705 100%)',
      eyebrow: 'A GIFT, ANONYMOUS',
      glyph: (
        <>
          Given
          <br />
          <em style={{ color: '#8ce0b0' }}>in your name.</em>
        </>
      ),
      foot: '— No name attached —',
    },
  },
  {
    id: 'poems-generator',
    name: 'Poems Generator',
    tag: 'Just Because',
    sub: 'A short verse composed for them and set in elegant type.',
    occasion: 'Just Because',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 45%, #efe6d4 0%, #c4b290 55%, #6a5840 100%)',
      eyebrow: '— VERSE FOR YOU —',
      glyph: (
        <span style={{ color: '#3a2c18' }}>
          A few
          <br />
          <em>chosen words.</em>
        </span>
      ),
      foot: '— Composed today —',
    },
  },
  {
    id: 'stamp-lookalike',
    name: 'Stamp Look-Alike',
    tag: 'Just Because',
    sub: 'Their portrait engraved as a vintage postage stamp, perforated edge and all.',
    occasion: 'Just Because',
    art: {
      bg: 'radial-gradient(60% 65% at 50% 40%, #3a2030 0%, #1a0e16 65%, #060305 100%)',
      eyebrow: 'POSTAGE · PAID',
      glyph: (
        <>
          First
          <br />
          <em style={{ color: '#f0b8c8' }}>class.</em>
        </>
      ),
      foot: '— Perforated edge —',
    },
  },
  {
    id: 'subscription-cards',
    name: 'Subscription Cards',
    tag: 'Just Because',
    sub: 'The gift that returns — a card announcing a recurring little treat.',
    occasion: 'Just Because',
    art: {
      bg: 'radial-gradient(60% 65% at 50% 35%, #25303f 0%, #121922 65%, #050709 100%)',
      eyebrow: 'MEMBER SINCE TODAY',
      glyph: (
        <>
          The gift
          <br />
          <em style={{ color: '#e0b46a' }}>that returns.</em>
        </>
      ),
      foot: '— Renews monthly —',
    },
  },
  {
    id: 'outline',
    name: 'Outline',
    tag: 'Just Because',
    sub: 'Their photo redrawn as clean single-line art — minimal, modern, framable.',
    occasion: 'Just Because',
    art: {
      bg: 'radial-gradient(60% 70% at 50% 40%, #14141a 0%, #0a0a0e 70%, #050507 100%)',
      eyebrow: '— ONE CONTINUOUS LINE —',
      glyph: (
        <>
          Just the
          <br />
          <em style={{ color: '#e8eaee' }}>essential you.</em>
        </>
      ),
      foot: '— Line art portrait —',
    },
  },
];

const FEATURED_IDS = [
  'on-this-day',
  'horoscope',
  'comic-card',
  'book-cover',
  'mental-health',
  'courtroom',
  'couples-cards',
  'fortune-cards',
  'fairy-tale-kids',
  'outline',
];

const OCCASIONS: OccasionOption[] = [
  { id: 'all', label: 'All', count: TEMPLATES.length },
  { id: 'Birthday', label: 'Birthday', count: TEMPLATES.filter((t) => t.occasion === 'Birthday').length },
  { id: 'Christmas', label: 'Christmas', count: TEMPLATES.filter((t) => t.occasion === 'Christmas').length },
  {
    id: "Valentine's Day",
    label: "Valentine's Day",
    count: TEMPLATES.filter((t) => t.occasion === "Valentine's Day").length,
  },
  { id: "Mother's Day", label: "Mother's Day", count: TEMPLATES.filter((t) => t.occasion === "Mother's Day").length },
  { id: 'Anniversary', label: 'Anniversary', count: TEMPLATES.filter((t) => t.occasion === 'Anniversary').length },
  { id: 'Wedding', label: 'Wedding', count: TEMPLATES.filter((t) => t.occasion === 'Wedding').length },
  { id: "Father's Day", label: "Father's Day", count: TEMPLATES.filter((t) => t.occasion === "Father's Day").length },
  { id: 'Thank You', label: 'Thank You', count: TEMPLATES.filter((t) => t.occasion === 'Thank You').length },
  { id: 'Graduation', label: 'Graduation', count: TEMPLATES.filter((t) => t.occasion === 'Graduation').length },
  { id: 'New Baby', label: 'New Baby', count: TEMPLATES.filter((t) => t.occasion === 'New Baby').length },
  {
    id: 'Congratulations',
    label: 'Congratulations',
    count: TEMPLATES.filter((t) => t.occasion === 'Congratulations').length,
  },
  { id: 'Holiday', label: 'Holiday', count: TEMPLATES.filter((t) => t.occasion === 'Holiday').length },
  { id: 'Get Well', label: 'Get Well', count: TEMPLATES.filter((t) => t.occasion === 'Get Well').length },
  { id: 'Just Because', label: 'Just Because', count: TEMPLATES.filter((t) => t.occasion === 'Just Because').length },
];

const OCCASION_TAGLINES: Record<string, string> = {
  Birthday: 'For another trip around the sun',
  Christmas: 'Merry, bright, and personally yours',
  "Valentine's Day": 'For the one you keep choosing',
  "Mother's Day": 'For the woman who did it all',
  Anniversary: 'Years worth marking',
  Wedding: 'For the ones saying "I do"',
  "Father's Day": 'For the original role model',
  'Thank You': 'Gratitude, made tangible',
  Graduation: 'And so it begins',
  'New Baby': 'Hello, brand new',
  Congratulations: 'For every win worth marking',
  Holiday: 'Seasons worth celebrating',
  'Get Well': 'A little warmth, sent over',
  'Just Because': 'No occasion required',
};

// Pad each occasion section up to at least 4 cards with style variants.
const PAD_STYLES = ['Classic', 'Modern', 'Minimalist', 'Whimsical', 'Vintage', 'Bold Type'];
function padOccasion(items: Template[], occId: string): Template[] {
  const out = items.slice();
  let i = 0;
  while (out.length < 6) {
    out.push({
      id: `${occId}-pad-${i}`,
      name: PAD_STYLES[i % PAD_STYLES.length],
      occasion: occId,
      _pad: true,
      art: { bg: 'linear-gradient(160deg, #34343d 0%, #2a2a31 60%, #232329 100%)' },
    });
    i++;
  }
  return out;
}

// ============================================================
// TEMPLATE CARD
// ============================================================
function PtTemplateCard({ tmpl, onPersonalize, compact }: PtTemplateCardProps) {
  return (
    <div className="pt-card">
      <div className="pt-card-name">{tmpl.name}</div>
      <div className="pt-card-art">
        <span className="pt-card-art-ratio">5&times;7</span>
      </div>
      <button type="button" className="pt-card-cta" onClick={() => onPersonalize && onPersonalize(tmpl)}>
        Personalize <PtIcon name="arrow" w={13} />
      </button>
    </div>
  );
}

// ============================================================
// SECTION RAIL — 4 cards in view, arrow-scrolled left/right
// ============================================================
// Smooth-scroll helper (manual rAF tween — robust where native smooth-scroll is disabled)
function smoothScrollBy(el: HTMLElement | null, delta: number, dur = 420) {
  if (!el) return;
  const scrollEl = el;
  const start = scrollEl.scrollLeft;
  const target = Math.max(0, Math.min(start + delta, scrollEl.scrollWidth - scrollEl.clientWidth));
  const t0 = performance.now();
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  function step(now: number) {
    const t = Math.min(1, (now - t0) / dur);
    scrollEl.scrollLeft = start + (target - start) * ease(t);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function PtSectionRail({ items, onPersonalize }: PtSectionRailProps) {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const scroll = (e: React.MouseEvent<HTMLButtonElement>, dir: number) => {
    const rail = e.currentTarget.closest('.pt-rail');
    const el = (rail && rail.querySelector<HTMLElement>('.pt-grid--rail')) || railRef.current;
    if (el) {
      const card = el.querySelector<HTMLElement>('.pt-card');
      const cw = card ? card.getBoundingClientRect().width + 22 : 0;
      // advance by the number of fully-visible cards (full "page") so cards fully replace
      const perView = cw ? Math.max(1, Math.round(el.clientWidth / cw)) : 1;
      const step = cw ? cw * perView : el.clientWidth * 0.9;
      smoothScrollBy(el, dir * step);
    }
  };
  const scrollable = items.length > 4;
  return (
    <div className={`pt-rail ${scrollable ? 'is-scrollable' : ''}`}>
      <button
        type="button"
        className="pt-rail-arrow pt-rail-arrow--l"
        aria-label="Scroll left"
        onClick={(e) => scroll(e, -1)}
      >
        <PtIcon name="chevL" w={16} />
      </button>
      <div className="pt-grid pt-grid--rail" ref={railRef}>
        {items.map((t) => (
          <PtTemplateCard key={t.id} tmpl={t} onPersonalize={onPersonalize} />
        ))}
      </div>
      <button
        type="button"
        className="pt-rail-arrow pt-rail-arrow--r"
        aria-label="Scroll right"
        onClick={(e) => scroll(e, 1)}
      >
        <PtIcon name="chevR" w={16} />
      </button>
    </div>
  );
}

// ============================================================
// OCCASION FILTER RAIL (full-width, arrow-scrolled)
// ============================================================
function PtOccasions({ occasion, setOccasion }: PtOccasionsProps) {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const scroll = (e: React.MouseEvent<HTMLButtonElement>, dir: number) => {
    const row = e.currentTarget.closest('.pt-occasions-row');
    const el = (row && row.querySelector<HTMLElement>('.pt-occasions')) || railRef.current;
    if (el) smoothScrollBy(el, dir * Math.max(280, el.clientWidth * 0.7));
  };
  return (
    <div className="pt-occasions-row">
      <button type="button" className="pt-occ-arrow" aria-label="Scroll occasions left" onClick={(e) => scroll(e, -1)}>
        <PtIcon name="chevL" w={16} />
      </button>
      <div className="pt-occasions" ref={railRef}>
        {OCCASIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`pt-occasion ${o.id === occasion ? 'is-active' : ''}`}
            onClick={() => setOccasion(o.id)}
          >
            {o.label}
            <span className="pt-occasion-count">{o.count}</span>
          </button>
        ))}
      </div>
      <button type="button" className="pt-occ-arrow" aria-label="Scroll occasions right" onClick={(e) => scroll(e, 1)}>
        <PtIcon name="chevR" w={16} />
      </button>
    </div>
  );
}

// ============================================================
// MARKETPLACE
// ============================================================
function PtMarketplace({ onPersonalize }: PtMarketplaceProps) {
  const [occasion, setOccasion] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const filtered = TEMPLATES.filter((t) => {
    if (occasion !== 'all' && t.occasion !== occasion) return false;
    if (search && !`${t.name} ${t.tag} ${t.sub}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const featured = TEMPLATES.filter((t) => FEATURED_IDS.includes(t.id));

  return (
    <div className="pt-shell">
      <div className="pt-head">
        <div className="pt-head-copy">
          <div className="pt-eyebrow">
            <span>Templates Marketplace</span>
          </div>
          <h1 className="pt-title">
            Personalize a <span className="souv-hero-italic text-metallic-rose-gold">template</span>
          </h1>
          <p className="pt-lede">
            Our designs, your personal touch. Choose a template, swap the photos and text, and we'll generate the
            perfect card instantly.
          </p>
        </div>

        <div className="pt-headcard" aria-hidden="true">
          <div className="pt-headcard-spin">
            <div className="pt-headcard-face pt-headcard-front">
              <img src="/assets/pt-comic-cover.jpg" alt="" />
            </div>
            <div className="pt-headcard-face pt-headcard-back">
              <img src="/assets/pt-comic-back.jpg" alt="" />
            </div>
          </div>
        </div>
      </div>

      <OrnamentDivider />

      <div className="pt-controls">
        <div className="pt-search-row">
          <div className="pt-search">
            <span className="pt-search-icon">
              <PtIcon name="search" w={18} />
            </span>
            <input
              className="pt-search-input"
              placeholder="Search cards…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <PtOccasions occasion={occasion} setOccasion={setOccasion} />
      </div>

      {occasion === 'all' && !search && (
        <div className="pt-featured">
          <div className="pt-toppicks-head">
            <h2 className="pt-toppicks" data-text="Our Top Picks">
              Our Top Picks
            </h2>
          </div>
          <PtSectionRail items={featured} onPersonalize={onPersonalize} />
        </div>
      )}

      {occasion === 'all' && !search ? (
        <div className="pt-occ-sections">
          {OCCASIONS.filter((o) => o.id !== 'all').map((o) => {
            const real = TEMPLATES.filter((t) => t.occasion === o.id);
            if (!real.length) return null;
            const items = padOccasion(real, o.id);
            return (
              <section key={o.id} className="pt-occ-section">
                <div className="pt-section-head">
                  <div>
                    <div className="pt-section-title-num">{o.label.toUpperCase()}</div>
                    <div className="pt-section-title">
                      <span>{OCCASION_TAGLINES[o.id] || o.label}</span>
                    </div>
                  </div>
                  <button type="button" className="pt-section-meta pt-section-seeall" onClick={() => setOccasion(o.id)}>
                    See all {items.length} →
                  </button>
                </div>
                <PtSectionRail items={items} onPersonalize={onPersonalize} />
              </section>
            );
          })}
        </div>
      ) : (
        <>
          <div className="pt-section-head">
            <div>
              <div className="pt-section-title-num">{occasion === 'all' ? 'Search results' : occasion}</div>
              <div className="pt-section-title">
                <span>
                  {filtered.length} template{filtered.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            {occasion !== 'all' && (
              <button type="button" className="pt-section-meta pt-section-seeall" onClick={() => setOccasion('all')}>
                ← All occasions
              </button>
            )}
          </div>
          <div className="pt-grid">
            {(occasion !== 'all' ? padOccasion(filtered, occasion) : filtered).map((t) => (
              <PtTemplateCard key={t.id} tmpl={t} onPersonalize={onPersonalize} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// PERSONALIZATION MODAL
// ============================================================
const MODAL_STEPS: ModalStep[] = [
  { id: 'photo', label: 'Photo · Upload' },
  { id: 'birthday', label: 'Birthday · Optional' },
  { id: 'caption', label: 'Caption & Message' },
];

function PtPersonalizeModal({
  tmpl,
  open,
  onClose,
  onCreate,
  initialStep = 'photo',
  initialDraftInput = null,
  generating = false,
  requireAuthToContinue = false,
  onAuthRequired,
}: PtPersonalizeModalProps) {
  const initialBrief = asRecord(initialDraftInput?.creativeBrief);
  const initialPhoto = nestedRecord(initialBrief, 'photo');
  const [step, setStep] = React.useState<ModalStepId>(initialStep);
  const initialReferenceImageNames = stringArrayValue(initialPhoto.referenceImageNames);
  const initialReferenceImages = referenceImageValue(initialPhoto.referenceImages);
  const [photoPreviews, setPhotoPreviews] = React.useState<PhotoPreview[]>(
    textValue(initialPhoto.mode) === 'upload'
      ? initialReferenceImages.length
        ? initialReferenceImages
        : initialReferenceImageNames.map((name) => ({ name, url: '/assets/LogoMark.png' }))
      : [],
  );
  const [attested, setAttested] = React.useState(booleanValue(initialPhoto.attested));
  const [gateOpen, setGateOpen] = React.useState(false);
  const [describe, setDescribe] = React.useState(textValue(initialPhoto.mode) === 'description');
  const [describeText, setDescribeText] = React.useState(textValue(initialPhoto.description));
  const [captionText, setCaptionText] = React.useState(textValue(initialBrief.caption) || 'To the moon and back');
  const [captionAttempts, setCaptionAttempts] = React.useState(1);
  const [insideMsg, setInsideMsg] = React.useState(textValue(initialBrief.insideMessage));
  const [msgAttempts, setMsgAttempts] = React.useState(1);
  const [msgError, setMsgError] = React.useState(false);
  const [describeError, setDescribeError] = React.useState(false);
  const [includeSong, setIncludeSong] = React.useState(booleanValue(initialBrief.includeSong, true));
  const [birthday, setBirthday] = React.useState(textValue(initialBrief.birthday));
  const [recipient, setRecipient] = React.useState(textValue(initialBrief.recipient));
  const [phonetic, setPhonetic] = React.useState(textValue(initialBrief.phonetic));
  const idx = MODAL_STEPS.findIndex((s) => s.id === step);
  const last = idx === MODAL_STEPS.length - 1;
  const generationCost = includeSong ? CARD_WITH_QR_SONG_CREDITS : MIN_GENERATION_CREDITS;
  const hasPhoto = photoPreviews.length > 0;

  React.useEffect(() => {
    setStep(initialStep);
  }, [open, initialStep]);
  React.useEffect(() => {
    return () => {
      photoPreviews.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, [photoPreviews]);

  if (!open || !tmpl) return null;

  const needsAttest = step === 'photo' && hasPhoto && !attested;
  const needsDescribe = step === 'photo' && describe && !describeText.trim();
  const goNext = () => {
    if (needsDescribe) {
      setDescribeError(true);
      return;
    }
    if (needsAttest) {
      setGateOpen(true);
      return;
    }
    if (requireAuthToContinue && step === 'photo') {
      onAuthRequired?.();
      return;
    }
    if (idx < MODAL_STEPS.length - 1) setStep(MODAL_STEPS[idx + 1].id);
  };
  const goBack = () => {
    if (idx > 0) setStep(MODAL_STEPS[idx - 1].id);
  };
  const addPersonalizeFiles = (list: FileList | File[] | null) => {
    const file = Array.from(list || []).find((incoming) => incoming.type.startsWith('image/'));
    if (!file) return;
    setPhotoPreviews((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.url));
      return [
        {
          url: URL.createObjectURL(file),
          name: file.name,
          mimeType: file.type,
          size: file.size,
        },
      ];
    });
    setDescribe(false);
    setAttested(false);
  };
  const removePersonalizePhoto = () => {
    setPhotoPreviews((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.url));
      return [];
    });
    setAttested(false);
  };

  const SUGGESTED_MESSAGES = [
    'Mom — for every quiet morning that turned out to mean everything, thank you. I love you to the moon and back. — Cameron',
    'To the one who taught me what warmth looks like: happy birthday, Mom. Every good thing I know, I learned from you.',
    'Another year, and still my favorite person. Thank you for the love that never once ran out. Love always, Cameron.',
  ];
  const SUGGESTED_CAPTIONS = [
    'To the moon and back',
    'Born under a brighter sky',
    'Your story, written in gold',
    'Another year, another tiny miracle',
    'Some days become forever',
  ];
  const limitCaptionWords = (value: string) => value.trim().split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
  const generateCaption = () => {
    setCaptionAttempts((a) => {
      setCaptionText(limitCaptionWords(SUGGESTED_CAPTIONS[(a - 1) % SUGGESTED_CAPTIONS.length]));
      return Math.min(5, a + 1);
    });
  };
  const generateMessage = () => {
    setMsgError(false);
    setMsgAttempts((a) => {
      const n = Math.min(5, a + 1);
      setInsideMsg(SUGGESTED_MESSAGES[(n - 1) % SUGGESTED_MESSAGES.length]);
      return n;
    });
  };
  const remixMessage = () => {
    generateMessage();
  };

  const buildDraftInput = (): PersonalizeDraftInput => ({
    occasion: tmpl.occasion,
    creativeBrief: {
      flow: 'personalize_template',
      template: {
        id: tmpl.id,
        name: tmpl.name,
        occasion: tmpl.occasion,
        tag: tmpl.tag,
      },
      photo: {
        mode: describe ? 'description' : hasPhoto ? 'upload' : 'unset',
        description: describe ? describeText.trim() || undefined : undefined,
        referenceImageCount: photoPreviews.length,
        referenceImageNames: photoPreviews.map((photo) => photo.name),
        referenceImages: photoPreviews.map((photo) => ({
          filename: photo.name,
          mimeType: photo.mimeType,
          size: photo.size,
        })),
        attested,
      },
      birthday: birthday || undefined,
      recipient: recipient.trim() || undefined,
      phonetic: phonetic.trim() || undefined,
      caption: captionText.trim() || undefined,
      insideMessage: insideMsg.trim() || undefined,
      includeSong,
    },
  });

  const closeAndSave = () => {
    void onClose(buildDraftInput());
  };

  return (
    <div className="pt-modal-wrap" role="dialog" aria-modal="true" data-screen-label="03b Personalize Modal">
      <div className="pt-modal-scrim" onClick={closeAndSave} />
      <div className="pt-modal">
        <div className="pt-modal-head">
          <div className="pt-modal-tmpl">
            <div
              className="pt-modal-tmpl-thumb"
              style={{ background: (tmpl.art && tmpl.art.bg) || 'linear-gradient(160deg,#34343d,#232329)' }}
            >
              <img src="/assets/LogoMark.png" alt="Souvenote" className="pt-modal-tmpl-mark" />
            </div>
            <div className="pt-modal-tmpl-meta">
              <div className="pt-modal-tmpl-sub">PERSONALIZING</div>
              <div className="pt-modal-tmpl-name">{tmpl.name}</div>
            </div>
          </div>
          <button className="pt-modal-close" onClick={closeAndSave} aria-label="Close">
            <PtIcon name="close" w={14} />
          </button>
        </div>

        <div className="pt-modal-rail">
          {MODAL_STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              {i > 0 && <span className="pt-modal-step-sep" />}
              <div className={`pt-modal-step ${i === idx ? 'is-active' : ''} ${i < idx ? 'is-done' : ''}`}>
                <span className="pt-modal-step-dot">{i < idx ? <PtIcon name="check" w={12} /> : i + 1}</span>
                <span>{s.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        <div className="pt-modal-body">
          {step === 'photo' && (
            <>
              <div className="pt-modal-step-head">
                <h2 className="pt-modal-step-title">
                  Upload a photo, <span className="souv-hero-italic text-metallic-rose-gold">or describe it</span>
                </h2>
                <p className="pt-modal-step-sub">
                  Add a photo and we'll reimagine the people in{' '}
                  <em className="text-metallic-gold" style={{ fontStyle: 'italic' }}>
                    {tmpl.name}'s
                  </em>{' '}
                  style. Or skip the upload and describe the card you want; we'll imagine it from your words.
                </p>
              </div>

              <div className="pt-photo-grid">
                <label
                  className={`pt-upload ${!describe && hasPhoto ? 'is-active' : ''}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    addPersonalizeFiles(event.dataTransfer.files);
                  }}
                >
                  <span className="pt-upload-icon">
                    <PtIcon name="upload" w={28} />
                  </span>
                  <span className="pt-upload-title">{hasPhoto ? 'Photo ready' : 'Drop a photo here'}</span>
                  <span className="pt-upload-sub">Or click to browse. JPG · PNG · HEIC · WEBP</span>
                  <span className="pt-upload-rules">
                    <span>· 10 MB max</span>
                    <span>· faces stay recognizable</span>
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                    onChange={(event) => {
                      addPersonalizeFiles(event.target.files);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>

                <div className={`pt-photo-or ${describe ? 'is-active' : ''}`}>
                  <span className="pt-photo-or-eyebrow">— OR —</span>
                  <span className="pt-photo-or-title">Skip upload</span>
                  <p className="pt-photo-or-sub">
                    Describe a memory, joke, or imaginary scene. We'll generate the card from your words alone.
                  </p>
                  <button
                    type="button"
                    className={describe ? 'pt-cta' : 'pt-cta-secondary'}
                    onClick={() => {
                      setDescribe(true);
                      removePersonalizePhoto();
                    }}
                  >
                    Describe My Card <PtIcon name="sparkle" w={14} />
                  </button>
                </div>
              </div>

              {!describe && hasPhoto && (
                <div className="pt-ref-tray">
                  <div className="pt-ref-count">
                    <b>{photoPreviews.length}</b> photo selected
                    <span className="pt-ref-cap">{'\u00b7'} preview loaded below</span>
                  </div>
                  <div className="pt-ref-thumbs">
                    {photoPreviews.map((photo) => (
                      <span key={photo.url} className="pt-ref-thumb" style={{ backgroundImage: `url(${photo.url})` }}>
                        <span className="pt-ref-name">{photo.name}</span>
                        <button
                          type="button"
                          className="pt-ref-x"
                          onClick={removePersonalizePhoto}
                          aria-label="Remove uploaded photo"
                        >
                          <PtIcon name="close" w={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {describe && (
                <div className="pt-field" style={{ marginTop: 22 }}>
                  <label className="pt-label">Describe your card</label>
                  <textarea
                    className="pt-input pt-textarea"
                    maxLength={500}
                    autoFocus
                    placeholder="Describe a memory, inside joke, or imaginary scene — the more vivid, the better. We'll build the whole card from this."
                    value={describeText}
                    onChange={(e) => {
                      setDescribeText(e.target.value);
                      if (e.target.value.trim()) setDescribeError(false);
                    }}
                  />
                  <p className="pt-help">
                    No photo needed — we generate the art from your description.{' '}
                    <b style={{ color: 'var(--gold-hi)' }}>{500 - describeText.length}</b> chars left.
                  </p>
                </div>
              )}

              {!describe && hasPhoto && (
                <div className={`pt-attest ${attested ? 'is-done' : ''}`}>
                  <span className="pt-attest-icon">
                    <PtIcon name={attested ? 'check' : 'shield'} w={18} />
                  </span>
                  <div className="pt-attest-text">
                    {attested ? (
                      <>
                        <b>Image rights confirmed.</b> Consent, copyright, and terms attested. You&rsquo;re clear to
                        continue.
                      </>
                    ) : (
                      <>
                        <b>Image rights required.</b> Read our Terms of Service and Privacy Policy in full, then confirm
                        consent and copyright before we generate.
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="pt-cta-secondary"
                    style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}
                    onClick={() => setGateOpen(true)}
                  >
                    {attested ? 'Review again' : 'Review & attest'}
                  </button>
                </div>
              )}
            </>
          )}

          {step === 'birthday' && (
            <>
              <div className="pt-modal-step-head">
                <h2 className="pt-modal-step-title">
                  Add their <span className="text-metallic-rose-gold">birthday</span>
                </h2>
                <p className="pt-modal-step-sub">
                  {tmpl.name === 'Horoscope'
                    ? 'Recommended for this template so we can estimate their sign. You can skip it if you do not know it.'
                    : tmpl.name === 'On This Day'
                      ? 'Recommended for this template so we can pull details from that day. You can skip it if you do not know it.'
                      : 'Optional context that helps us anchor the card to the right moment in time.'}
                </p>
              </div>

              <div className="pt-field">
                <label className="pt-label">
                  Their birthday <em className="pt-label-opt">· optional</em>
                </label>
                <input
                  className="pt-input"
                  type="date"
                  value={birthday}
                  onChange={(event) => setBirthday(event.target.value)}
                />
                <p className="pt-help">Optional. We never share the date; it stays on this card.</p>
              </div>
            </>
          )}

          {step === 'caption' && (
            <>
              <div className="pt-modal-step-head">
                <h2 className="pt-modal-step-title">
                  Caption and <span className="souv-hero-italic text-metallic-rose-gold">message</span>
                </h2>
                <p className="pt-modal-step-sub">
                  Edit the caption, write your inside message, or use our writing generators for inspiration.
                </p>
              </div>

              <div className="pt-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="pt-label">Card caption</label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button type="button" className="pt-caption-gen" onClick={generateCaption}>
                      <PtIcon name="sparkle" w={13} /> Caption Generator
                    </button>
                    <span className="pt-msggen-count">{captionAttempts} of 5</span>
                  </div>
                </div>
                <input
                  className="pt-input"
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Front-of-card text"
                />
                <p className="pt-help">
                  Enter your general idea in the card caption space and use the caption generator for suggestions up to
                  eight words.
                </p>
              </div>

              <div className="pt-field-row">
                <div className="pt-field" style={{ marginBottom: 0 }}>
                  <label className="pt-label">
                    Recipient name <em className="pt-label-opt">· optional</em>
                  </label>
                  <input
                    className="pt-input"
                    placeholder="Who's it for?"
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                  />
                </div>
                <div className="pt-field" style={{ marginBottom: 0 }}>
                  <label className="pt-label">
                    Phonetic spelling <em className="pt-label-opt">· optional</em>
                  </label>
                  <input
                    className="pt-input"
                    placeholder="e.g. KAH-rin"
                    value={phonetic}
                    onChange={(event) => setPhonetic(event.target.value)}
                  />
                </div>
              </div>

              <div className="pt-msg-divider" />

              <div className="pt-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="pt-label">
                    Inside message <em className="pt-label-opt">· optional</em>
                  </label>
                  <span className="pt-msg-counter">
                    <span>
                      <b>{500 - insideMsg.length}</b> chars left
                    </span>
                  </span>
                </div>
                <textarea
                  className={`pt-input pt-textarea ${msgError ? 'is-error' : ''}`}
                  maxLength={500}
                  placeholder={
                    msgError
                      ? 'Add a message first'
                      : 'Write the note that prints inside the card — or try your best and use our "Message Generator" button for help.'
                  }
                  value={insideMsg}
                  onChange={(e) => {
                    setInsideMsg(e.target.value);
                    if (e.target.value.trim()) setMsgError(false);
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 14,
                    flexWrap: 'wrap',
                    marginTop: 12,
                  }}
                >
                  <button type="button" className="pt-caption-gen" onClick={remixMessage}>
                    <PtIcon name="sparkle" w={13} /> Message Generator
                  </button>
                  <span className="pt-msggen-count">{msgAttempts} of 5</span>
                </div>
              </div>

              <div className="pt-msg-divider" />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 40,
                  marginTop: 28,
                  paddingTop: 28,
                  borderTop: '1px solid rgba(232,234,238,0.10)',
                }}
              >
                <div className="pt-field" style={{ margin: 0 }}>
                  <label className="pt-label" style={{ fontSize: 15, letterSpacing: '.05em', marginBottom: 16 }}>
                    You're all set, let's generate.
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      fontFamily: 'var(--font-sans)',
                      fontSize: 14.5,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <PtIcon name="check" w={14} /> Front card image
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <PtIcon name="check" w={14} /> A personalized inside message
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <PtIcon name="check" w={14} /> {includeSong ? 'A 45-second QR-code song' : 'No QR song selected'}
                    </span>
                  </div>
                  <label className={`pt-song-toggle ${includeSong ? 'is-checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={includeSong}
                      onChange={(event) => setIncludeSong(event.target.checked)}
                    />
                    <span className="pt-song-toggle-box">
                      <PtIcon name="check" w={12} />
                    </span>
                    <span>
                      <b>Include song by QR code</b>
                      <em>Add a custom QR-code song behind a scannable code inside the printed card.</em>
                    </span>
                  </label>
                </div>
                <div className="pt-field" style={{ margin: 0 }}>
                  <label className="pt-label" style={{ marginBottom: 16 }}>
                    Credits
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      fontFamily: 'var(--font-sans)',
                      fontSize: 14.5,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span>
                      <b style={{ fontFamily: 'var(--font-num)', color: 'var(--gold-hi)' }}>1</b> · front card image
                    </span>
                    {includeSong && (
                      <span>
                        <b style={{ fontFamily: 'var(--font-num)', color: 'var(--gold-hi)' }}>1</b> · QR song generation
                      </span>
                    )}
                    <span>
                      <b style={{ fontFamily: 'var(--font-num)', color: 'var(--gold-hi)' }}>0</b> · inside message
                      (free)
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="pt-modal-foot">
          <div className="pt-modal-cost">
            {last ? (
              <>
                Will deduct <b>{generationCost}</b> {generationCost === 1 ? 'credit' : 'credits'} on generate
              </>
            ) : (
              <>
                Free step <span>·</span> 0 credits
              </>
            )}
          </div>
          <div className="pt-modal-foot-acts">
            {idx > 0 ? (
              <button type="button" className="pt-cta-secondary" onClick={goBack}>
                <PtIcon name="back" w={13} /> Back
              </button>
            ) : (
              <button type="button" className="pt-link" onClick={closeAndSave}>
                ← Back to marketplace
              </button>
            )}
            {!last ? (
              <button type="button" className="pt-cta" onClick={goNext}>
                Continue <PtIcon name="arrow" w={14} />
              </button>
            ) : (
              <button
                type="button"
                className="pt-cta"
                onClick={() => onCreate && onCreate(includeSong, buildDraftInput())}
                disabled={generating}
              >
                {generating ? 'Starting...' : 'Create my Card'} <PtIcon name="arrow" w={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <AttestationGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        onAgree={() => {
          setAttested(true);
          setGateOpen(false);
          setStep(MODAL_STEPS[idx + 1] ? MODAL_STEPS[idx + 1].id : step);
        }}
      />

      {describeError && (
        <div className="pt-prompt-wrap" role="dialog" aria-modal="true">
          <div className="pt-prompt-scrim" onClick={() => setDescribeError(false)} />
          <div className="pt-prompt">
            <span className="pt-prompt-icon">
              <PtIcon name="sparkle" w={22} />
            </span>
            <h3 className="pt-prompt-title">Describe your idea first</h3>
            <p className="pt-prompt-body">
              Tell us the memory, inside joke, or scene you have in mind and we'll generate the card from your words.
              Add a few details before continuing.
            </p>
            <button
              type="button"
              className="pt-cta"
              onClick={() => {
                setDescribeError(false);
                const ta = document.querySelector<HTMLTextAreaElement>('.pt-modal .pt-textarea');
                if (ta) ta.focus();
              }}
            >
              Got it <PtIcon name="arrow" w={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CHATBOT — Amazon Nova Lite (persistent right-side)
// ============================================================
const CHAT_PRESETS: ChatPreset[] = ['Caption', 'Personal Message', 'Vibe Check', 'Custom'];
const CHAT_INITIAL: ChatMessage[] = [
  {
    role: 'bot',
    text: (
      <>
        Hi, I'm <b>Nova</b>, your card assistant. Need help with a caption or a personal message?
      </>
    ),
  },
  { role: 'user', text: 'Caption for a 60th birthday for my mom, warm but not sappy.' },
  {
    role: 'bot',
    text: (
      <>
        Try: <em>"Sixty looks good on you, Mom."</em> or{' '}
        <em>"Sixty trips around the sun, all of them better because you're in them."</em>
      </>
    ),
  },
];

function PtChat({ open, setOpen }: PtChatProps) {
  const [preset, setPreset] = React.useState<ChatPreset>('Caption');
  const [draft, setDraft] = React.useState('');

  if (!open) {
    return (
      <button
        type="button"
        className="pt-chat"
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', width: 'auto' }}
        onClick={() => setOpen(true)}
      >
        <span className="pt-chat-title-dot" />
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: 'var(--gold-hi)',
          }}
        >
          Ask Nova
        </span>
      </button>
    );
  }

  return (
    <aside className="pt-chat" aria-label="Caption assistant">
      <div className="pt-chat-head">
        <div className="pt-chat-title">
          <span className="pt-chat-title-dot" />
          <span>Nova</span>
          <span className="pt-chat-title-sub">· Bedrock Nova Lite</span>
        </div>
        <button type="button" className="pt-chat-min" onClick={() => setOpen(false)} aria-label="Minimize">
          <PtIcon name="min" w={14} />
        </button>
      </div>
      <div className="pt-chat-presets">
        {CHAT_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={`pt-chat-preset ${p === preset ? 'is-active' : ''}`}
            onClick={() => setPreset(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="pt-chat-body">
        {CHAT_INITIAL.map((m, i) => (
          <div key={i} className={`pt-chat-msg ${m.role === 'user' ? 'is-user' : 'is-bot'}`}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="pt-chat-foot">
        <input
          className="pt-chat-input"
          placeholder={`Ask for a ${preset.toLowerCase()}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="button" className="pt-chat-send" aria-label="Send">
          <PtIcon name="send" w={16} />
        </button>
      </div>
    </aside>
  );
}

// ============================================================
// TOP-LEVEL APP
// ============================================================
const PERSONALIZE_DEFAULT_BALANCE: AccountBalance = { credits: { images: 0, songs: 0 }, cardBank: 0 };

function PersonalizeApp({
  openModal = false,
  resumeDraftId = null,
  initialModalStep = 'photo',
  accountBalance = PERSONALIZE_DEFAULT_BALANCE,
  creditStatus = 'idle',
  refreshCredits,
  requireAuthToContinue = false,
}: PersonalizeAppProps) {
  const router = useRouter();
  const [chosen, setChosen] = React.useState<Template | null>(openModal ? TEMPLATES[0] : null);
  const [modalOpen, setModalOpen] = React.useState(openModal);
  const [chatOpen, setChatOpen] = React.useState(true);
  const [view, setView] = React.useState<PersonalizeView>('marketplace');
  const [reviewGen, setReviewGen] = React.useState(false);
  const [reviewIncludeSong, setReviewIncludeSong] = React.useState(true);
  const [generationPending, setGenerationPending] = React.useState(false);
  const [uploadPending, setUploadPending] = React.useState(false);
  const [reviewAssets, setReviewAssets] = React.useState<CardDraftAsset[]>([]);
  const [reviewAssetsStatus, setReviewAssetsStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [reviewAssetsError, setReviewAssetsError] = React.useState<string | null>(null);
  const [currentDraftId, setCurrentDraftId] = React.useState<string | null>(null);
  const [resumeDraftInput, setResumeDraftInput] = React.useState<PersonalizeDraftInput | null>(null);
  const [authPromptOpen, setAuthPromptOpen] = React.useState(false);
  const currentDraftIdRef = React.useRef<string | null>(null);
  const draftSavePromiseRef = React.useRef<Promise<string> | null>(null);
  const draftSaveVersionRef = React.useRef(0);
  const uploadedReferenceSignatureRef = React.useRef<string>('');
  const totalCredits = getTotalCredits(accountBalance);

  const rememberDraftId = React.useCallback((draftId: string | null) => {
    currentDraftIdRef.current = draftId;
    setCurrentDraftId(draftId);

    try {
      if (draftId) {
        window.localStorage.setItem(CURRENT_CARD_DRAFT_ID_KEY, draftId);
        writeMockMvpFlowState({ cardDraftId: draftId });
      } else {
        window.localStorage.removeItem(CURRENT_CARD_DRAFT_ID_KEY);
        resetMockMvpOrderState(null);
      }
    } catch {
      // Local draft id persistence is best-effort until auth-backed state exists.
    }
  }, []);

  const applyReviewAssets = React.useCallback((cardDraftId: string, assets: CardDraftAsset[]) => {
    setReviewAssets(assets);
    setReviewAssetsStatus('ready');
    setReviewAssetsError(null);
    rememberGeneratedAssets(cardDraftId, assets);
  }, []);

  const refreshReviewAssets = React.useCallback(
    async (cardDraftId: string) => {
      setReviewAssetsStatus('loading');
      setReviewAssetsError(null);

      try {
        const assets = await fetchCardDraftAssets(cardDraftId);
        applyReviewAssets(cardDraftId, assets);
        return assets;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generated assets could not be loaded.';
        setReviewAssets([]);
        setReviewAssetsStatus('error');
        setReviewAssetsError(message);
        throw error;
      }
    },
    [applyReviewAssets],
  );

  const uploadReferenceImages = React.useCallback(async (cardDraftId: string, draftInput: PersonalizeDraftInput) => {
    const uploads = getReferenceImageUploads(draftInput);
    if (!uploads.length) return;

    const signature = referenceUploadSignature(cardDraftId, uploads);
    if (uploadedReferenceSignatureRef.current === signature) return;

    setUploadPending(true);
    try {
      await Promise.all(
        uploads.map((upload) =>
          mockUpload({
            cardDraftId,
            filename: upload.filename,
            mimeType: upload.mimeType,
            size: upload.size,
          }),
        ),
      );
      uploadedReferenceSignatureRef.current = signature;
      await refreshCardDraftBackendState(cardDraftId);
    } finally {
      setUploadPending(false);
    }
  }, []);

  const ensureDraftSaved = React.useCallback(
    async (draftInput: PersonalizeDraftInput, includeSong = true) => {
      if (currentDraftIdRef.current) {
        await updateCardDraft(currentDraftIdRef.current, {
          occasion: draftInput.occasion,
          relationship: draftInput.relationship,
          creativeBrief: {
            ...draftInput.creativeBrief,
            includeSong,
          },
        });
        return currentDraftIdRef.current;
      }
      if (draftSavePromiseRef.current) return draftSavePromiseRef.current;

      const saveVersion = draftSaveVersionRef.current;
      const savePromise = createCardDraft({
        occasion: draftInput.occasion,
        relationship: draftInput.relationship,
        creativeBrief: {
          ...draftInput.creativeBrief,
          includeSong,
        },
      })
        .then(async (cardDraft) => {
          if (saveVersion === draftSaveVersionRef.current) {
            rememberDraftId(cardDraft.id);
            resetMockMvpOrderState(cardDraft.id);
          }
          await refreshCardDraftBackendState(cardDraft.id);
          return cardDraft.id;
        })
        .finally(() => {
          if (draftSavePromiseRef.current === savePromise) {
            draftSavePromiseRef.current = null;
          }
        });

      draftSavePromiseRef.current = savePromise;
      return savePromise;
    },
    [rememberDraftId],
  );

  const beginTemplateDraft = React.useCallback(
    (template: Template) => {
      draftSaveVersionRef.current += 1;
      draftSavePromiseRef.current = null;
      setResumeDraftInput(null);
      setReviewAssets([]);
      setReviewAssetsStatus('idle');
      setReviewAssetsError(null);
      uploadedReferenceSignatureRef.current = '';
      rememberDraftId(null);
      setChosen(template);
      setModalOpen(true);

      if (requireAuthToContinue) return;

      ensureDraftSaved(buildTemplateDraftInput(template)).catch(() => {
        // The create action will surface backend save errors if the user continues.
      });
    },
    [ensureDraftSaved, rememberDraftId, requireAuthToContinue],
  );

  React.useEffect(() => {
    if (!openModal) return;

    if (resumeDraftId) {
      let cancelled = false;
      fetchCardDraftById(resumeDraftId)
        .then((draft) => {
          if (cancelled) return;
          const brief = asRecord(draft.creative_brief);
          const template = nestedRecord(brief, 'template');
          const templateId = textValue(template.id);
          setResumeDraftInput({
            occasion: textValue(draft.occasion) || textValue(template.occasion) || undefined,
            relationship: textValue(draft.relationship) || undefined,
            creativeBrief: brief,
          });
          rememberDraftId(draft.id);
          setChosen(TEMPLATES.find((candidate) => candidate.id === templateId) || TEMPLATES[0]);
          setModalOpen(true);
        })
        .catch((error) => {
          if (!cancelled) {
            bmcError(
              error instanceof Error ? error.message : 'That draft could not be loaded. Please try again.',
              'Draft could not be loaded',
            );
          }
        });

      return () => {
        cancelled = true;
      };
    }

    if (openModal) {
      beginTemplateDraft(TEMPLATES[0]);
    }
  }, [beginTemplateDraft, openModal, rememberDraftId, resumeDraftId]);

  const onPersonalize = (t: Template) => {
    beginTemplateDraft(t);
  };
  const onClose = async (draftInput?: PersonalizeDraftInput) => {
    if (draftInput && currentDraftIdRef.current) {
      try {
        await updateCardDraft(currentDraftIdRef.current, {
          occasion: draftInput.occasion,
          relationship: draftInput.relationship,
          creativeBrief: draftInput.creativeBrief,
        });
        await refreshCardDraftBackendState(currentDraftIdRef.current);
      } catch {
        // Closing the modal should not trap the user; generation will surface save errors.
      }
    }
    setModalOpen(false);
  };
  const openPricingForCredits = () => {
    router.push(goToPricingAfterPurchase('/create/personalize-a-template'));
  };
  // Create my Card → close modal, jump to the Review page (which auto-opens the invite modal while generating).
  const onCreate = async (includeSong = true, draftInput: PersonalizeDraftInput = { creativeBrief: {} }) => {
    if (generationPending || uploadPending) return;
    if (requireAuthToContinue) {
      setAuthPromptOpen(true);
      return;
    }
    const generationCost = includeSong ? CARD_WITH_QR_SONG_CREDITS : MIN_GENERATION_CREDITS;

    if (creditStatus === 'loading') {
      bmcError('We are still checking your credit balance. Try again in a moment.', 'Checking credits');
      return;
    }

    if (creditStatus === 'error') {
      bmcError(
        'We could not reach your backend credit balance. Start the local backend and try again.',
        'Credits unavailable',
      );
      await refreshCredits?.();
      return;
    }

    if (totalCredits < generationCost) {
      bmcError(
        `You need ${generationCost} ${generationCost === 1 ? 'credit' : 'credits'} to generate this card. Your current backend balance is ${totalCredits}.`,
        'Not enough credits',
      );
      return;
    }

    setGenerationPending(true);
    setReviewAssetsStatus('loading');
    setReviewAssetsError(null);

    try {
      const cardDraftId = await ensureDraftSaved(draftInput, includeSong);
      await uploadReferenceImages(cardDraftId, draftInput);

      const response = await startGeneration({
        cardDraftId,
        idempotencyKey: `frontend-generation-${Date.now()}`,
      });
      const backendState = await refreshCardDraftBackendState(cardDraftId);
      applyReviewAssets(cardDraftId, backendState.assets);

      if (response.balance) {
        publishCreditBalance(response.balance);
      } else {
        await refreshCredits?.();
      }

      setReviewIncludeSong(includeSong);
      setModalOpen(false);
      setView('review');
      setReviewGen(true);
      window.scrollTo(0, 0);
      // Assets finish rendering after a few seconds — then the panels become approvable.
      setTimeout(() => setReviewGen(false), 5200);
    } catch (error) {
      setReviewGen(false);
      setReviewAssetsStatus('error');
      setReviewAssetsError(error instanceof Error ? error.message : 'Generation could not start.');
      bmcError(
        error instanceof Error ? error.message : 'Generation could not start. Please try again.',
        'Generation could not start',
      );
      await refreshCredits?.();
    } finally {
      setGenerationPending(false);
    }
  };
  const backToMarketplace = () => {
    rememberDraftId(null);
    setReviewGen(false);
    setReviewAssets([]);
    setReviewAssetsStatus('idle');
    setReviewAssetsError(null);
    setView('marketplace');
    window.scrollTo(0, 0);
  };
  React.useEffect(() => {
    if (view !== 'review' || !currentDraftId) return;

    refreshReviewAssets(currentDraftId).catch(() => {
      // The review screen shows the friendly error state.
    });
  }, [currentDraftId, refreshReviewAssets, view]);

  const spendRegenerationCredit = async () => {
    bmcError(
      'One-credit image and song regeneration is coming in the approved creation-workflow section. No credit was charged.',
      'Regeneration coming soon',
    );
    return false;
  };

  if (view === 'review') {
    return (
      <div className="bmc-page" style={{ minHeight: '100vh' }}>
        <BmcReview
          generating={reviewGen}
          includeSong={reviewIncludeSong}
          credits={totalCredits}
          cardDraftId={currentDraftId}
          assets={reviewAssets}
          assetsStatus={reviewAssetsStatus}
          assetsError={reviewAssetsError}
          onStartOver={backToMarketplace}
          onApproveAll={(selectedAssetId) => {
            if (!currentDraftId || !selectedAssetId) {
              bmcError(
                'Generated image assets are not ready yet. Try again after the review assets finish loading.',
                'Review assets unavailable',
              );
              return;
            }

            rememberSelectedAsset(currentDraftId, selectedAssetId, reviewAssets);
            router.push('/delivery');
          }}
          onTopUp={openPricingForCredits}
          onRegenerateAsset={spendRegenerationCredit}
        />
        <BmcErrorModal />
      </div>
    );
  }

  return (
    <div className="pt-page">
      <PtMarketplace onPersonalize={onPersonalize} />
      <PtPersonalizeModal
        key={`${currentDraftId || chosen?.id || 'new'}-${initialModalStep}`}
        tmpl={chosen}
        open={modalOpen}
        onClose={onClose}
        onCreate={onCreate}
        initialStep={openModal ? initialModalStep : 'photo'}
        initialDraftInput={resumeDraftInput}
        generating={generationPending || uploadPending}
        requireAuthToContinue={requireAuthToContinue}
        onAuthRequired={() => setAuthPromptOpen(true)}
      />
      <AuthGatePrompt
        open={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        returnTo="/create/personalize-a-template"
        title="Create an account to save this card"
        body="You can browse styles and start the first step, but saving drafts, purchasing cards, and spending generation credits require a Souvenote account."
        primaryLabel="Sign up and continue"
      />
      <BmcErrorModal />
    </div>
  );
}

export { PersonalizeApp, PtTemplateCard, PtMarketplace, PtPersonalizeModal, PtChat, TEMPLATES };
