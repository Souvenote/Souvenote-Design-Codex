"use client";

import * as React from "react";
import { BmcIcon, BmcHead, BmcFoot, FreeCost, CreditCost, BmcCheck, bmcError } from "./BmcShared";
import { AttestationGate } from "./AttestationGate";

// BmcSteps.tsx - the five intake steps (Photo, Basics, Image Flow, Inside Message, Build Song).
// Depends on shared primitives from BmcShared.

type StepNavProps = {
  onContinue: () => void;
  onBack?: () => void;
};

type PhotoPreview = {
  url: string;
  name: string;
};

type BmcPhotoStepProps = StepNavProps & {
  photoCount: number;
  setPhotoCount: (count: number) => void;
  describe: boolean;
  setDescribe: (describe: boolean) => void;
  country?: string;
};

type BmcImageStepProps = StepNavProps & {
  hasPhoto: boolean;
};

type BmcMessageStepProps = StepNavProps & {
  blueprintLabel?: string;
};

type BmcSongStepProps = {
  onBack?: () => void;
  onGenerate: () => void;
};

type Blueprint = {
  id: string;
  title: string;
  sub: string;
  note?: string;
  popular?: boolean;
  needsPhoto: boolean;
};

type VisualStyle = {
  id: string;
  name: string;
  swatch: string;
};

export type GenreGroup = {
  title: string;
  genres: [name: string, voice: string][];
};

type CSSVarStyle = React.CSSProperties & Record<`--${string}`, string | number>;

// ============================================================
// STEP 1 — PHOTO
// ============================================================
const MAX_REFS = 16;

function BmcPhotoStep({ photoCount, setPhotoCount, describe, setDescribe, onContinue, country = 'CA' }: BmcPhotoStepProps) {
  const [files, setFiles] = React.useState<PhotoPreview[]>([]);
  const [describeText, setDescribeText] = React.useState('');
  const [describeTouched, setDescribeTouched] = React.useState(false);
  const [attested, setAttested] = React.useState(false); // completed via the gate
  const [modal, setModal] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const describeInputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const filesRef = React.useRef<PhotoPreview[]>([]);
  const isCA = country === 'CA' || !country;
  const hasFiles = files.length > 0;
  const attestOk = !isCA || attested;
  const hasDescription = describeText.trim().length > 0;

  React.useEffect(() => {
    if (describe) {
      window.setTimeout(() => describeInputRef.current?.focus(), 0);
    }
  }, [describe]);

  React.useEffect(() => {
    setPhotoCount(files.length);
  }, [files.length, setPhotoCount]);
  React.useEffect(() => {
    filesRef.current = files;
  }, [files]);
  React.useEffect(() => {
    return () => {
      filesRef.current.forEach((file) => URL.revokeObjectURL(file.url));
    };
  }, []);

  // Uploading a fresh set of files invalidates a prior attestation.
  const resetAttest = () => setAttested(false);

  const addFiles = (list: FileList | File[] | null) => {
    const incoming = Array.from(list || []).filter((file) => /image\/(jpeg|png|webp)/.test(file.type));
    setFiles(curr => {
      const next = [...curr, ...incoming.map((file) => ({ url: URL.createObjectURL(file), name: file.name }))].slice(0, MAX_REFS);
      return next;
    });
    setDescribe(false);
    setDescribeText('');
    setDescribeTouched(false);
    resetAttest();
  };
  const removeAt = (i: number) => setFiles(curr => {
    const removed = curr[i];
    if (removed) URL.revokeObjectURL(removed.url);
    return curr.filter((_, idx) => idx !== i);
  });

  const tryContinue = () => {
    if (describe && !hasDescription) {
      setDescribeTouched(true);
      return;
    }
    if (hasFiles && !attestOk) { setModal(true); return; }
    onContinue();
  };

  const openDescribeSection = () => {
    setFiles((current) => {
      current.forEach((file) => URL.revokeObjectURL(file.url));
      return [];
    });
    setDescribe(true);
    setDescribeTouched(false);
  };

  return (
    <>
      <BmcHead
        num="01"
        eyebrow="Start with a photo"
        title="Bring your card to life"
        italicWord="card to life"
        accent="rose"
        italicAccent={false}
        titleStyle={{ fontFamily: "var(--font-display, 'Outfit'), ui-sans-serif, system-ui, sans-serif", fontSize: '53px', lineHeight: 1.02, fontStyle: 'normal', letterSpacing: '-0.03em' }}
        lede="Inside jokes, shared memories, or wild ideas can all become the perfect greeting. We will guide you step by step to create something completely unique, just for them."
      />

      <div className="bmc-photo-grid">
        <div
          className="bmc-photo-drop"
          onClick={() => inputRef.current && inputRef.current.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        >
          <span className="bmc-photo-drop-icon"><BmcIcon name="upload" w={32} /></span>
          <span className="bmc-photo-drop-title">{hasFiles ? 'Add more references' : 'Drop photos here'}</span>
          <span className="bmc-photo-drop-sub">JPEG, PNG, or WEBP, up to {MAX_REFS} reference images.</span>
          <span className="bmc-photo-drop-rules">
            <span>· JPEG · PNG · WEBP</span>
            <span>· {MAX_REFS} max</span>
          </span>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
                 onChange={(e) => {
                   addFiles(e.target.files);
                   e.currentTarget.value = '';
                 }}
                 style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
        </div>

        <div className={`bmc-photo-or ${describe ? 'is-active' : ''}`}>
          <span className="bmc-photo-or-eyebrow">— OR —</span>
          <span className="bmc-photo-or-title">Skip upload</span>
          <p className="bmc-photo-or-sub">Describe a memory, joke, or imaginary scene. We'll generate it from your words alone.</p>
          <button type="button" className={describe ? 'bmc-cta' : 'bmc-cta-secondary'}
                  onClick={openDescribeSection}>
            Describe My Card <BmcIcon name="sparkle" w={14} />
          </button>
        </div>
      </div>

      {describe && (
        <div className="bmc-describe-inline">
          <label className="bmc-label bmc-describe-label" htmlFor="bmc-describe-input">Describe your card</label>
          <textarea
            id="bmc-describe-input"
            ref={describeInputRef}
            className={`bmc-textarea bmc-describe-textarea ${describeTouched && !hasDescription ? 'is-error' : ''}`}
            maxLength={500}
            placeholder="Describe a memory, inside joke, or imaginary scene — the more vivid, the better. We'll build the whole card from this."
            value={describeText}
            onChange={(event) => {
              setDescribeText(event.target.value);
              if (event.target.value.trim()) setDescribeTouched(false);
            }}
          />
          <div className="bmc-describe-help">
            {describeTouched && !hasDescription ? (
              <span className="is-error">Add a few details before continuing.</span>
            ) : (
              <span>No photo needed — we generate the art from your description.</span>
            )}
            <b>{500 - describeText.length} chars left</b>
          </div>
        </div>
      )}

      {/* Live reference count + thumbnails */}
      {hasFiles && (
        <div className="bmc-ref-tray">
          <div className="bmc-ref-count">
            <b>{files.length}</b> reference image{files.length === 1 ? '' : 's'} selected
            <span className="bmc-ref-cap">· {MAX_REFS - files.length} slots left</span>
          </div>
          <div className="bmc-ref-thumbs">
            {files.map((f, i) => (
              <span key={i} className="bmc-ref-thumb" style={{ backgroundImage: `url(${f.url})` }}>
                <button type="button" className="bmc-ref-x" onClick={() => removeAt(i)} aria-label="Remove"><BmcIcon name="close" w={12} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Image-rights attestation status (location inferred — shown only where required) */}
      {hasFiles && isCA && (
        <div className={`bmc-attest-gate ${attested ? 'is-done' : ''}`}>
          <span className="bmc-attest-gate-icon"><BmcIcon name={attested ? 'check' : 'lock'} w={18} /></span>
          <div className="bmc-attest-gate-text">
            {attested ? (
              <><b>Attestation complete.</b> Consent, copyright, and terms confirmed. You&rsquo;re clear to continue.</>
            ) : (
              <><b>Image rights required.</b> Because you uploaded a likeness, review our Terms &amp; Privacy and confirm consent before continuing.</>
            )}
          </div>
          <button type="button" className="bmc-cta-secondary" onClick={() => setModal(true)}>
            {attested ? 'Review again' : 'Review & attest'} <BmcIcon name="arrow" w={14} />
          </button>
        </div>
      )}

      <BmcFoot
        costLabel={<FreeCost />}
        onNext={tryContinue}
        nextLabel="Continue"
      />

      {/* Read-to-the-bottom attestation gate */}
      <AttestationGate
        open={modal}
        onClose={() => setModal(false)}
        onAgree={() => { setAttested(true); setModal(false); onContinue(); }}
      />

      {describe && describeTouched && !hasDescription && (
        <div className="bmc-prompt-wrap" role="dialog" aria-modal="true">
          <div className="bmc-prompt-scrim" onClick={() => setDescribeTouched(false)} />
          <div className="bmc-prompt">
            <span className="bmc-prompt-icon"><BmcIcon name="sparkle" w={22} /></span>
            <h3 className="bmc-prompt-title">Describe your idea first</h3>
            <p className="bmc-prompt-body">
              Tell us the memory, inside joke, or scene you have in mind and we'll generate
              the card from your words. Add a few details before continuing.
            </p>
            <button
              type="button"
              className="bmc-cta"
              onClick={() => {
                setDescribeTouched(false);
                window.setTimeout(() => describeInputRef.current?.focus(), 0);
              }}
            >
              Got it <BmcIcon name="arrow" w={14} />
            </button>
          </div>
        </div>
      )}

    </>
  );
}

// ============================================================
// STEP 2 — BASICS
// ============================================================
const OCCASIONS: string[] = ['Birthday', 'Anniversary', 'Wedding', 'Engagement', 'Graduation', 'New Baby',
  'Thank You', 'Just Because', 'Sympathy', 'Get Well', 'Holiday', 'Custom…'];

// Each occasion carries a soft jewel-tone accent so the chip row reads as
// lively + meaningful rather than a wall of identical gold. Kept light + low-ish
// chroma so they sit in the same family as the gold/silver/rose-gold metals.
const OCCASION_ACCENTS: Record<string, string> = {
  'Birthday':     '#F1D074', // brand gold
  'Anniversary':  '#E7A39A', // rose
  'Wedding':      '#DCE2EC', // platinum
  'Engagement':   '#F2B6C6', // blush
  'Graduation':   '#84A9E8', // sapphire
  'New Baby':     '#8FD9C6', // mint
  'Thank You':    '#F2C593', // peach
  'Just Because': '#C7A9EC', // lilac
  'Sympathy':     '#A6B6DE', // periwinkle
  'Get Well':     '#97D8A2', // spring green
  'Holiday':      '#EC9090', // festive red
  'Custom…':      '#D8CDBE', // warm platinum
};

function BmcBasicsStep({ onContinue, onBack }: StepNavProps) {
  const [orientation, setOrientation] = React.useState('portrait');
  const [occasion, setOccasion] = React.useState('Birthday');
  const [custom, setCustom] = React.useState('');
  const [recipient, setRecipient] = React.useState('');
  const [phonetic, setPhonetic] = React.useState('');
  const [relationship, setRelationship] = React.useState('');
  const [sender, setSender] = React.useState('');
  const [skipped, setSkipped] = React.useState(false);
  const isCustom = occasion === 'Custom…';

  return (
    <>
      <BmcHead
        num="02"
        eyebrow="The basics"
        title="Tell us who it's for, and why"
        italicWord="and why"
        lede="Light context lets us craft a card and song that fits the moment. Names appear inside the card and in song lyrics, where natural."
      />

      <div className="bmc-stack-lg bmc-basics" style={{ '--occasion-accent': OCCASION_ACCENTS[occasion] || 'var(--gold)' } as CSSVarStyle}>
        <div className="bmc-fieldcard">
          <label className="bmc-label">Card orientation</label>
          <div className="bmc-orient-toggle">
            <div className={`bmc-orient bmc-orient-portrait ${orientation === 'portrait' ? 'is-active' : ''}`} onClick={() => setOrientation('portrait')}>
              <div className="bmc-orient-card" />
              <div className="bmc-orient-label">Portrait · 5×7</div>
            </div>
            <div className={`bmc-orient bmc-orient-landscape ${orientation === 'landscape' ? 'is-active' : ''}`} onClick={() => setOrientation('landscape')}>
              <div className="bmc-orient-card" />
              <div className="bmc-orient-label">Landscape · 7×5</div>
            </div>
          </div>
        </div>

        <div className="bmc-fieldcard">
          <label className="bmc-label">Occasion</label>
          <div className="bmc-chip-row">
            {OCCASIONS.map(o => (
              <button key={o} type="button" className={`bmc-chip bmc-chip-occasion ${o === occasion ? 'is-active' : ''}`} style={{ '--chip-accent': OCCASION_ACCENTS[o] || 'var(--gold)' } as CSSVarStyle} onClick={() => setOccasion(o)}>{o}</button>
            ))}
          </div>
          {isCustom && (
            <input className="bmc-input" style={{ marginTop: 14 }} placeholder="Name your occasion, e.g. “Half-birthday”, “First apartment”"
                   value={custom} onChange={(e) => setCustom(e.target.value)} />
          )}
        </div>

        <div className="bmc-fieldcard">
          <label className="bmc-label">Who it's for <em className="bmc-opt">· all optional</em></label>
          <div className={`bmc-grid-2 bmc-basics-names ${skipped ? 'is-dim' : ''}`}>
          <div>
            <label className="bmc-label">Recipient name <em className="bmc-opt">· what do you call them?</em></label>
            <input className="bmc-input" placeholder="We include this in your inside message and song lyrics" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </div>
          <div>
            <label className="bmc-label">Phonetic spelling <em className="bmc-opt">· optional</em></label>
            <input className="bmc-input" placeholder="Used only as a pronunciation aid for the song" value={phonetic} onChange={(e) => setPhonetic(e.target.value)} />
          </div>
          <div>
            <label className="bmc-label">Who are they to you?</label>
            <input className="bmc-input" placeholder="My mother, best friend, partner…" value={relationship} onChange={(e) => setRelationship(e.target.value)} />
          </div>
          <div>
            <label className="bmc-label">Sender name</label>
            <input className="bmc-input" placeholder="Your name" value={sender} onChange={(e) => setSender(e.target.value)} />
          </div>
          </div>
        </div>
      </div>

      <BmcFoot costLabel={<FreeCost />} onBack={onBack} onNext={onContinue} />
    </>
  );
}

// ============================================================
// STEP 3 — IMAGE FLOW
// ============================================================
const BLUEPRINTS: Blueprint[] = [
  { id: 'transform', title: 'Transform Scene and Style', sub: 'Completely reimagine a photo or build your idea from scratch.', note: 'Works with a photo or written idea', popular: true, needsPhoto: false },
  { id: 'enhance',   title: 'Enhance Style', sub: 'Keep your photo\u2019s layout but repaint it in a new artistic style.', needsPhoto: true },
  { id: 'decorate',  title: 'Decorate My Photo', sub: 'Keep your original photo and add festive borders, accents, and text.', needsPhoto: true },
];
const VISUAL_STYLES: VisualStyle[] = [
  { id: 'realistic',  name: 'Realistic',   swatch: 'linear-gradient(135deg,#7c6b58,#3a312a)' },
  { id: 'cinematic',  name: 'Cinematic',   swatch: 'linear-gradient(135deg,#5b3a1f,#180d05)' },
  { id: 'comic',      name: 'Comic',       swatch: 'linear-gradient(135deg,#e85d4e,#ffd14d)' },
  { id: 'cartoon',    name: 'Cartoon / Animated', swatch: 'linear-gradient(135deg,#7eb5e8,#f7c5e0)' },
  { id: 'artistic',   name: 'Artistic / Painted', swatch: 'linear-gradient(135deg,#c39a4e,#7a4424)' },
  { id: 'fantasy',    name: 'Fantasy / Magical', swatch: 'linear-gradient(135deg,#5b3aa0,#1a0e30)' },
  { id: 'anime',      name: 'Anime-inspired', swatch: 'linear-gradient(135deg,#ffbfa7,#a0cfff)' },
  { id: 'minimal',    name: 'Minimal / Clean', swatch: 'linear-gradient(135deg,#ece6dc,#9b938a)' },
  { id: 'vintage',    name: 'Vintage / Retro', swatch: 'linear-gradient(135deg,#c8a374,#5a3a20)' },
  { id: 'watercolor', name: 'Watercolor',  swatch: 'linear-gradient(135deg,#bce0e8,#e8b9c4)' },
  { id: 'dreamy',     name: 'Dreamy / Ethereal', swatch: 'linear-gradient(135deg,#cfb8ff,#f0c8e0)' },
  { id: 'custom',     name: 'Custom…',     swatch: 'linear-gradient(135deg,#2a2a35,#14141a)' },
];
const VIBES: string[] = ['Humorous','Heartfelt','Traditional','Modern','Cute','Inspirational','Real Talk','Deadpan','Meme Culture','Elegant','Throwbacks','Situationship','Milestone','Custom…'];
const ACCENTS: string[] = ['No accents','Flowers','Hearts','Stars/Sparkles','Balloons','Cake','Pets','Custom…'];
const BORDERS: string[] = ['No border','Watercolor floral','Gold foil','Minimalist line','Vintage frame','Modern geometric','Festive seasonal','Art deco','Custom…'];

function BmcImageStep({ onContinue, onBack, hasPhoto }: BmcImageStepProps) {
  const firstAllowed = hasPhoto ? 'transform' : 'transform';
  const [blueprint, setBlueprint] = React.useState(firstAllowed);
  const [style, setStyle] = React.useState('cinematic');
  const [vibes, setVibes] = React.useState<string[]>(['Heartfelt']);
  const [coverMode, setCoverMode] = React.useState('with');
  const [coverText, setCoverText] = React.useState('');
  const [captionAttempts, setCaptionAttempts] = React.useState(1);
  const [coverErr, setCoverErr] = React.useState(false);
  const [accents, setAccents] = React.useState<string[]>(['No accents']);
  const [border, setBorder] = React.useState('Watercolor floral');

  // Free-text "Custom…" values, revealed when the Custom… option is picked.
  const [styleCustom, setStyleCustom] = React.useState('');
  const [vibeCustom, setVibeCustom] = React.useState('');
  const [accentCustom, setAccentCustom] = React.useState('');
  const [borderCustom, setBorderCustom] = React.useState('');

  const toggleVibe = (v: string) => setVibes(curr =>
    curr.includes(v) ? curr.filter(x => x !== v) : (curr.length >= 3 ? curr : [...curr, v]));

  const toggleAccent = (a: string) => setAccents(curr => {
    // "No accents" is exclusive — picking it clears everything else.
    if (a === 'No accents') return ['No accents'];
    const rest = curr.filter(x => x !== 'No accents');
    if (rest.includes(a)) {
      const next = rest.filter(x => x !== a);
      return next.length ? next : ['No accents'];
    }
    return rest.length >= 3 ? rest : [...rest, a];
  });

  const SUGGESTED_CAPTIONS = [
    'To the moon and back',
    'Born under a brighter sky',
    'Your story, written in gold',
    'Another year, another tiny miracle',
    'Some days become forever',
  ];
  const limitCaptionWords = (value: string) => value.trim().split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
  const generateCaption = () => {
    setCoverMode('with');
    setCoverErr(false);
    setCaptionAttempts(a => {
      setCoverText(limitCaptionWords(SUGGESTED_CAPTIONS[(a - 1) % SUGGESTED_CAPTIONS.length]));
      return Math.min(5, a + 1);
    });
  };

  const tryContinue = () => {
    if (coverMode === 'with' && !coverText.trim()) {
      setCoverErr(true);
      bmcError('Enter the words you’d like printed on the front of your card, or switch to “No card caption” to continue.', 'Card caption needed');
      return;
    }
    onContinue();
  };

  return (
    <>
      <BmcHead
        num="03"
        eyebrow="Imagine the front"
        title="Choose a blueprint, then dial it in"
        italicWord="then dial it in"
        lede="Transform, enhance or decorate an existing photo just how you like."
      />

      <div className="bmc-fieldcard" style={{ marginBottom: 30 }}>
        <label className="bmc-label">Creative blueprint</label>
        <div className="bmc-blueprints" style={{ marginBottom: 0 }}>
        {BLUEPRINTS.map((b, i) => {
          const locked = b.needsPhoto && !hasPhoto;
          return (
            <button key={b.id} type="button"
              className={`bmc-blueprint ${b.id === blueprint ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`}
              onClick={() => !locked && setBlueprint(b.id)}>
              {b.popular && <span className="bmc-blueprint-badge">Most popular</span>}
              <span className="bmc-blueprint-num">{i + 1}</span>
              <div className="bmc-blueprint-title">{b.title}</div>
              <div className="bmc-blueprint-sub">{b.sub}</div>
              {locked
                ? <span className="bmc-blueprint-tag"><BmcIcon name="lock" w={12} /> Upload a photo to unlock</span>
                : b.needsPhoto
                  ? <span className="bmc-blueprint-tag" style={{ color: 'var(--rose-gold)' }}>Photo-based</span>
                  : (b.note && <span className="bmc-blueprint-tag">{b.note}</span>)}
            </button>
          );
        })}
        </div>
      </div>

      <div className="bmc-stack-lg">
        <div className="bmc-fieldcard">
          <label className="bmc-label">Visual style</label>
          <div className="bmc-styles">
            {VISUAL_STYLES.map(s => (
              <div key={s.id} className={`bmc-style ${s.id === style ? 'is-active' : ''}`} onClick={() => setStyle(s.id)}>
                <span className="bmc-style-swatch" style={{ background: s.swatch }} />
                <span className="bmc-style-label">{s.name}</span>
              </div>
            ))}
          </div>
          {style === 'custom' && (
            <input className="bmc-input bmc-custom-input" autoFocus placeholder="Describe your own visual style…"
                   value={styleCustom} onChange={(e) => setStyleCustom(e.target.value)} />
          )}
        </div>

        <div className="bmc-fieldcard">
          <label className="bmc-label">Vibe</label>
          <p className="bmc-help" style={{ margin: '-4px 0 12px' }}>Select up to three.</p>
          <div className="bmc-chip-row">
            {VIBES.map(v => (
              <button key={v} type="button" className={`bmc-chip ${v === 'Custom\u2026' ? 'bmc-chip-custom' : ''} ${vibes.includes(v) ? 'is-active' : ''}`} onClick={() => toggleVibe(v)}>
                {vibes.includes(v) && v !== 'Custom\u2026' && <BmcIcon name="check" w={13} />}{v}
              </button>
            ))}
          </div>
          {vibes.includes('Custom\u2026') && (
            <input className="bmc-input bmc-custom-input" autoFocus placeholder="Describe your own vibe…"
                   value={vibeCustom} onChange={(e) => setVibeCustom(e.target.value)} />
          )}
        </div>

        {blueprint === 'transform' && (
          <div className="bmc-fieldcard">
            <label className="bmc-label">Describe your vision for the card</label>
            <textarea className="bmc-textarea is-tall" placeholder="Describe a memory, inside joke, or imaginary story. The more vivid, the better." />
            <p className="bmc-help">Transform Scene and Style option draws its primary song lyric inspiration from this description.</p>
          </div>
        )}

        {(blueprint === 'enhance' || blueprint === 'decorate') && (
          <div className="bmc-fieldcard">
            <label className="bmc-label">Decorative accents <span className="bmc-chip-count">{accents.length} of 3</span></label>
            <p className="bmc-help" style={{ margin: '-4px 0 12px' }}>Select up to three.</p>
            <div className="bmc-chip-row">
              {ACCENTS.map(a => {
                const noneDisabled = a === 'No accents' && accents.some(x => x !== 'No accents');
                return (
                  <button key={a} type="button" disabled={noneDisabled}
                    className={`bmc-chip ${a === 'Custom\u2026' ? 'bmc-chip-custom' : ''} ${accents.includes(a) ? 'is-active' : ''} ${noneDisabled ? 'is-disabled' : ''}`}
                    onClick={() => !noneDisabled && toggleAccent(a)}>
                    {accents.includes(a) && a !== 'Custom\u2026' && <BmcIcon name="check" w={13} />}{a}
                  </button>
                );
              })}
            </div>
            {accents.includes('Custom\u2026') && (
              <input className="bmc-input bmc-custom-input" autoFocus placeholder="Describe your own accent…"
                     value={accentCustom} onChange={(e) => setAccentCustom(e.target.value)} />
            )}
          </div>
        )}

        {blueprint === 'decorate' && (
          <div className="bmc-fieldcard">
            <label className="bmc-label">Border / design treatment</label>
            <p className="bmc-help" style={{ margin: '-4px 0 12px' }}>Select one.</p>
            <div className="bmc-chip-row">
              {BORDERS.map(b => (
                <button key={b} type="button" className={`bmc-chip ${b === 'Custom\u2026' ? 'bmc-chip-custom' : ''} ${b === border ? 'is-active' : ''}`} onClick={() => setBorder(b)}>{b}</button>
              ))}
            </div>
            {border === 'Custom\u2026' && (
              <input className="bmc-input bmc-custom-input" autoFocus placeholder="Describe your own border or design treatment…"
                     value={borderCustom} onChange={(e) => setBorderCustom(e.target.value)} />
            )}
          </div>
        )}

        <div className="bmc-fieldcard">
          <label className="bmc-label">Card caption</label>
          <div className="bmc-cover-row">
            <div className="bmc-chip-row bmc-caption-actions">
              <button type="button" className={`bmc-chip ${coverMode === 'with' ? 'is-active' : ''}`} onClick={() => setCoverMode('with')}>Card caption</button>
              <button type="button" className={`bmc-chip ${coverMode === 'none' ? 'is-active' : ''}`} onClick={() => { setCoverMode('none'); setCoverErr(false); }}>No card caption</button>
              <button type="button" className="bmc-chip bmc-caption-generator" onClick={generateCaption}>
                <BmcIcon name="refresh" w={14} /> Caption Generator
              </button>
              <span className="bmc-msggen-inline-count">{captionAttempts} of 5</span>
            </div>
            <div>
              <input
                className={`bmc-input ${coverErr ? 'is-error' : ''}`}
                placeholder={coverErr ? 'Enter card caption' : 'Exact words to print on the front'}
                value={coverText}
                onChange={(e) => { setCoverText(e.target.value); if (e.target.value.trim()) setCoverErr(false); }}
                disabled={coverMode === 'none'}
                style={coverMode === 'none' ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
              />
              <p className="bmc-help">Typography and colors are chosen automatically to suit the generated image</p>
            </div>
          </div>
        </div>
      </div>

      <BmcFoot costLabel={<CreditCost n={1} />} onBack={onBack} onNext={tryContinue} />
    </>
  );
}

// ============================================================
// STEP 4 — INSIDE MESSAGE
// ============================================================
function BmcMessageStep({ onContinue, onBack, blueprintLabel = 'Transform Scene and Style' }: BmcMessageStepProps) {
  const [msg, setMsg] = React.useState('');
  const [attempts, setAttempts] = React.useState(1);
  const [error, setError] = React.useState(false);
  const SUGGESTED_MESSAGES = [
    'You always know how to make ordinary moments feel unforgettable. I hope this card brings a little of that magic back to you today.',
    'For every laugh, every memory, and every little thing that only we understand, thank you. You make life feel warmer just by being in it.',
    'I hope this finds you smiling. You are loved more than these words can hold, and I am so lucky to have you in my life.',
  ];

  const generateMessage = () => {
    setError(false);
    setAttempts(a => {
      setMsg(SUGGESTED_MESSAGES[(a - 1) % SUGGESTED_MESSAGES.length]);
      return Math.min(5, a + 1);
    });
  };
  const charsLeft = 500 - msg.length;

  return (
    <>
      <BmcHead
        num="04"
        eyebrow="What's inside"
        title="Ready to write or need inspiration?"
        italicWord="need inspiration?"
        titleStyle={{ whiteSpace: 'nowrap', fontSize: 'clamp(2rem, 4.4vw, 3rem)', lineHeight: 1.05 }}
        lede="Write the message that goes in your card. If you're having trouble, use our message generator up to five times for help."
      />

      <div className="bmc-stack-lg">
        <div className="bmc-fieldcard">
          <label className="bmc-label">Desired inside message</label>
          <textarea
            className={`bmc-textarea is-tall ${error ? 'is-error' : ''}`}
            maxLength={500}
            placeholder={error ? 'Add message' : 'Write the message as you want, or click "Message Generator" if you need help.'}
            value={msg}
            onChange={(e) => { setMsg(e.target.value); if (e.target.value.trim()) setError(false); }}
          />
          <div className="bmc-row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
            <span className="bmc-help" style={{ margin: 0 }}>1–4 short lines · printable greeting-card language.</span>
            <span className="bmc-msg-counter">
              <span><b>{charsLeft}</b> chars left</span>
            </span>
          </div>

          <div className="bmc-row" style={{ gap: 14, flexWrap: 'wrap', marginTop: 18 }}>
            <button type="button" className="bmc-cta-secondary" onClick={generateMessage}>
              <BmcIcon name="refresh" w={14} /> Message Generator
            </button>
            <span className="bmc-msggen-inline-count">{attempts} of 5</span>
          </div>
        </div>
      </div>

      <BmcFoot costLabel={<FreeCost />} onBack={onBack} onNext={onContinue} />
    </>
  );
}

// ============================================================
// STEP 5 — BUILD SONG
// ============================================================
const GENRE_GROUPS: GenreGroup[] = [
  { title: 'Pop · R&B · Soul', genres: [['1970s Motown Soul','Male'],['Upbeat Summer Pop','Female'],['Slow R&B Ballad','Male'],['Modern Pop-Funk Crossover','Female'],['Aspirational Digital R&B','Female'],['High-Energy Tokyo Synth-Pop','Female']] },
  { title: 'Rock · Alternative', genres: [['Anthemic Rock','Male'],['Classic Rock Anthem','Male'],['Early 2000s Punk-Rock','Mixed'],['Motown-Influenced Rock','Male']] },
  { title: 'Hip-Hop · Rap · Gospel', genres: [['Gospel-Rap Progression','Male & Choir'],['Boom-Bap Rap','Male'],['Modern Trap','Mixed'],['Gospel-Hip-Hop Fusion','Choir']] },
  { title: 'Jazz · Bossa Nova · World', genres: [['Romantic Bossa Nova & R&B Fusion','Male & Female'],['Smooth Jazz Ballad','Female'],['West African Afrobeats','Mixed']] },
  { title: 'Electronic · Folk · Ambient', genres: [['Wistful Liquid Drum & Bass','Female'],['Narrative Indie Folk','Male'],['Atmospheric Chill-Step','Female']] },
];

const LYRIC_SEED = `[00:00-00:08 Verse]
A pair of shoes by the door, the moon on the floor,
the sound of your laugh I keep coming back for.

[00:08-00:25 Verse]
You taught me the way that good love is supposed to feel,
patient and soft, with the kind of edges that are real.
Years roll by but the dancing stays the same,
a hand on my shoulder, your warm familiar name.

[00:25-00:41 Chorus]
To the moon and back, to the moon and back,
every road I take, you are a kind of map.
Hold a little tighter, the night is wide,
you are the song I will never put aside.

[00:41-00:45 Final]
To the moon and back — and back, and back.`;

function BmcSongStep({ onBack, onGenerate }: BmcSongStepProps) {
  const [genre, setGenre] = React.useState('Slow R&B Ballad');
  const [lyrics, setLyrics] = React.useState(LYRIC_SEED);
  const [editing, setEditing] = React.useState(false);
  const [remixes, setRemixes] = React.useState(0);

  return (
    <>
      <BmcHead
        num="05"
        eyebrow="Personalize their anthem"
        title="Set the tone, we'll make the tune"
        italicWord="we'll make the tune"
        accent="rose"
        titleStyle={{ whiteSpace: 'nowrap', fontSize: 'clamp(2rem, 4.4vw, 3rem)', lineHeight: 1.05 }}
        lede="The lyrics builder uses your earlier answers to write the song which you can edit or regenerate anytime."
      />

      <div className="bmc-stack-lg">
        <div className="bmc-card">
          <div className="bmc-card-head">
            <div className="bmc-card-title">Choose your genre</div>
            <div className="bmc-card-meta">{genre ? 'Selected · ' + genre : 'Select one'}</div>
          </div>
          {GENRE_GROUPS.map(group => (
            <div key={group.title} className="bmc-genre-group">
              <div className="bmc-genre-group-title">{group.title}</div>
              <div className="bmc-genres">
                {group.genres.map(([name, voice]) => (
                  <div key={name} className={`bmc-genre ${name === genre ? 'is-active' : ''}`} onClick={() => setGenre(name)}>
                    <div className="bmc-genre-name">{name}</div>
                    <div className="bmc-genre-voice">{voice}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="bmc-card">
          <div className="bmc-card-head">
            <div className="bmc-card-title">Lyric Builder</div>
            <div className="bmc-card-meta">{lyrics.length} / 750 · {remixes} of 5 regenerations</div>
          </div>

          {editing ? (
            <textarea className="bmc-textarea is-tall" maxLength={750} value={lyrics} onChange={(e) => setLyrics(e.target.value)} style={{ minHeight: 360 }} />
          ) : (
            <pre className="bmc-lyrics">{lyrics}</pre>
          )}

          <div className="bmc-lyrics-controls" style={{ marginTop: 16 }}>
            <button type="button" className="bmc-cta-secondary" onClick={() => setRemixes(r => Math.min(5, r + 1))}>
              <BmcIcon name="refresh" w={14} /> Regenerate
            </button>
            <button type="button" className="bmc-cta-secondary" onClick={() => setEditing(e => !e)}>
              <BmcIcon name="edit" w={14} /> {editing ? 'Done editing' : 'Edit'}
            </button>
            {!editing && <span className="bmc-help" style={{ margin: 0 }}>Lyrics are read-only until you click Edit.</span>}
          </div>
        </div>

      </div>

      <div className="bmc-foot bmc-generate-foot">
        <div className="bmc-generate-copy">
          <div className="bmc-generate-title">Ready to generate your card</div>
          <div className="bmc-generate-sub">Image + song together cost <b>2 credits</b>. The inside message is free.</div>
        </div>
        <div className="bmc-generate-foot-acts">
          {onBack && (
            <button type="button" className="bmc-cta-secondary" onClick={onBack}>
              <BmcIcon name="back" w={14} /> Back
            </button>
          )}
          <button type="button" className="bmc-cta bmc-cta-lg" onClick={onGenerate}>
            <BmcIcon name="spark2" w={18} /> Generate Your Card
          </button>
        </div>
      </div>
    </>
  );
}

export { BmcPhotoStep, BmcBasicsStep, BmcImageStep, BmcMessageStep, BmcSongStep, OCCASIONS, BLUEPRINTS, VISUAL_STYLES, VIBES, ACCENTS, BORDERS, GENRE_GROUPS, MAX_REFS };
