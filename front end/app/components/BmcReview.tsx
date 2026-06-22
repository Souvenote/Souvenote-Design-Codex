"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BmcIcon } from "./BmcShared";
import { GENRE_GROUPS } from "./BmcSteps";

// BmcReview.tsx - Build My Card Review page.
// Front Card, Song, Inside Message panels + bottom action bar + "Are you sure?" modal.
// Also: the "while you wait" invite-a-friend modal shown over Review while assets generate.

type PanelStatusProps = {
  generating: boolean;
  approved: boolean;
};

type ReviewPanelProps = PanelStatusProps & {
  onApprove: () => void;
  onInvalidate?: () => void;
  onRegenerate?: () => boolean | Promise<boolean>;
  editing: boolean;
  setEditing: (editing: boolean) => void;
};

type BmcGenreSelectProps = {
  value: string;
  onChange: (value: string) => void;
};

type GenreGroup = {
  title: string;
  genres: [string, string][];
};

type InviteStatus = "form" | "sending" | "error";

type ModalProps = {
  open: boolean;
  onClose: () => void;
};

type BmcConfirmModalProps = ModalProps & {
  onConfirm: () => void;
  includeSong?: boolean;
};

type BmcInviteModalProps = ModalProps & {
  includeSong?: boolean;
};

type BmcReviewProps = {
  onStartOver?: () => void;
  onApproveAll?: () => void;
  onTopUp?: () => void;
  onRegenerateAsset?: () => boolean | Promise<boolean>;
  credits?: number;
  generating?: boolean;
  includeSong?: boolean;
};

type EditingState = {
  image: boolean;
  song: boolean;
  message: boolean;
};

declare global {
  interface Window {
    __bmcShowInvite?: () => void;
  }
}

function PanelStatus({ generating, approved }: PanelStatusProps) {
  const cls = generating ? 'is-working' : approved ? 'is-approved' : 'is-ready';
  const label = generating ? 'Generating\u2026' : approved ? 'Approved' : 'Ready';
  return (
    <div className={`bmc-panel-status ${cls}`}>
      {generating ? <span className="bmc-panel-status-spin" /> : <span className="bmc-panel-status-dot" />}
      {label}
    </div>
  );
}

const INITIAL_IMAGE_EDIT = 'Make the moon a touch warmer; keep the dance pose.';
const INITIAL_SONG_GENRE = 'Slow R&B Ballad';
const INITIAL_SONG_LYRICS = `[00:00-00:08 Verse]
A pair of shoes by the door...

[00:25-00:41 Chorus]
To the moon and back, to the moon and back...`;

function BmcReviewFront({ approved, onApprove, onInvalidate, onRegenerate, editing, setEditing, generating }: ReviewPanelProps) {
  const [instr, setInstr] = React.useState(INITIAL_IMAGE_EDIT);
  const [regenerating, setRegenerating] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const editMade = instr.trim() !== INITIAL_IMAGE_EDIT.trim();
  const panelGenerating = generating || regenerating;

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function regenerate() {
    if (!editMade || panelGenerating) return;
    setRegenerating(true);
    const spent = await (onRegenerate?.() ?? true);
    if (!spent) {
      setRegenerating(false);
      return;
    }
    timer.current = setTimeout(() => {
      setRegenerating(false);
      setEditing(false);
    }, 2200);
  }

  function updateInstruction(next: string) {
    setInstr(next);
    if (approved && next.trim() !== INITIAL_IMAGE_EDIT.trim()) onInvalidate?.();
  }

  return (
    <div className="bmc-panel">
      <div className="bmc-panel-head">
        <div className="bmc-panel-title">Front card</div>
        <PanelStatus generating={panelGenerating} approved={approved} />
      </div>

      <div className="bmc-front-art">
        <div className="bmc-front-noise" />
        <div className="bmc-front-glyph">
          To the moon<br/>and back
        </div>
        <div className="bmc-front-fig" />
      </div>
      <div className="bmc-front-caption">5x7 portrait - Transform - Cinematic - Heartfelt + Elegant</div>

      {editing && (
        <div className="bmc-edit-inst">
          <label className="bmc-label">Edit instruction</label>
          <textarea className="bmc-textarea" value={instr} onChange={(e) => updateInstruction(e.target.value)} placeholder="Describe what to change. Composition stays as-is." />
          <p className="bmc-help" style={{ marginTop: 8 }}>
            Image edits cost <b style={{ color: 'var(--gold-hi)', fontStyle: 'normal' }}>1 credit</b> if successful.
          </p>
          {editMade && (
            <div className="bmc-panel-acts bmc-regenerate-acts">
              <button type="button" className="bmc-cta-secondary" onClick={regenerate} disabled={panelGenerating}>
                <BmcIcon name="refresh" w={14} /> {regenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bmc-panel-acts">
        <button type="button" className="bmc-cta" onClick={onApprove} disabled={approved || panelGenerating}>
          <BmcIcon name="check" w={14} /> {panelGenerating ? 'Generating\u2026' : approved ? 'Approved' : 'Approve Image'}
        </button>
        <button type="button" className="bmc-cta-secondary" onClick={() => setEditing(!editing)} disabled={panelGenerating}>
          <BmcIcon name="edit" w={14} /> {editing ? 'Close' : 'Edit'}
        </button>
      </div>
    </div>
  );
}

function BmcGenreSelect({ value, onChange }: BmcGenreSelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const groups = GENRE_GROUPS as GenreGroup[];
  return (
    <div className="bmc-gsel" ref={ref}>
      <button type="button" className={`bmc-gsel-trigger ${open ? 'is-open' : ''}`} onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span>{value}</span>
        <BmcIcon name="chevron" w={16} />
      </button>
      {open && (
        <div className="bmc-gsel-panel" role="listbox">
          {groups.map(group => (
            <div key={group.title} className="bmc-gsel-group">
              <div className="bmc-gsel-group-title">{group.title}</div>
              {group.genres.map(([name, voice]) => (
                <button
                  type="button"
                  key={name}
                  role="option"
                  aria-selected={name === value}
                  className={`bmc-gsel-opt ${name === value ? 'is-active' : ''}`}
                  onClick={() => { onChange(name); setOpen(false); }}>
                  <span className="bmc-gsel-opt-name">{name}</span>
                  <span className="bmc-gsel-opt-voice">{voice}</span>
                  {name === value && <BmcIcon name="check" w={14} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BmcReviewSong({ approved, onApprove, onInvalidate, onRegenerate, editing, setEditing, generating }: ReviewPanelProps) {
  const [playing, setPlaying] = React.useState(false);
  const [genre, setGenre] = React.useState(INITIAL_SONG_GENRE);
  const [lyrics, setLyrics] = React.useState(INITIAL_SONG_LYRICS);
  const [regenerating, setRegenerating] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const editMade = genre !== INITIAL_SONG_GENRE || lyrics.trim() !== INITIAL_SONG_LYRICS.trim();
  const panelGenerating = generating || regenerating;
  const BARS = [12,18,24,16,30,22,12,26,20,32,14,26,10,22,30,16,24,11,20,28,14,24,18,30,11,22,16,26,20,12,24,30,14,20,10,26,18,30,14,22,12,24,20,28,10,16,26,18,22,14,24,18,30,22];

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function regenerate() {
    if (!editMade || panelGenerating) return;
    setRegenerating(true);
    const spent = await (onRegenerate?.() ?? true);
    if (!spent) {
      setRegenerating(false);
      return;
    }
    timer.current = setTimeout(() => {
      setRegenerating(false);
      setEditing(false);
    }, 2400);
  }

  function updateGenre(next: string) {
    setGenre(next);
    if (approved && next !== INITIAL_SONG_GENRE) onInvalidate?.();
  }

  function updateLyrics(next: string) {
    setLyrics(next);
    if (approved && next.trim() !== INITIAL_SONG_LYRICS.trim()) onInvalidate?.();
  }

  return (
    <div className="bmc-panel">
      <div className="bmc-panel-head">
        <div className="bmc-panel-title">QR Song</div>
        <PanelStatus generating={panelGenerating} approved={approved} />
      </div>

      <div className="bmc-song-player">
        <div className="bmc-song-meta">
          <button className="bmc-song-fab" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            <BmcIcon name={playing ? 'pause' : 'play'} w={18} />
          </button>
          <div>
            <div className="bmc-song-name">Slow R&amp;B Ballad · Male</div>
            <div className="bmc-song-sub">00:00 / 00:45 · QR code inside card</div>
          </div>
        </div>
        <div className="bmc-song-wave">
          {BARS.map((h, i) => <i key={i} style={{ height: h + 'px' }} />)}
        </div>
        <div className="bmc-song-times">
          <span>0:00</span><span>0:08</span><span>0:25</span><span>0:41</span><span>0:45</span>
        </div>
      </div>

      {editing && (
        <div className="bmc-edit-inst" style={{ marginTop: 14 }}>
          <label className="bmc-label">Genre</label>
          <div style={{ marginBottom: 12 }}>
            <BmcGenreSelect value={genre} onChange={updateGenre} />
          </div>
          <label className="bmc-label">Lyrics</label>
          <textarea className="bmc-textarea" value={lyrics} onChange={(e) => updateLyrics(e.target.value)} />
          <p className="bmc-help" style={{ marginTop: 8 }}>
            QR song edits cost <b style={{ color: 'var(--gold-hi)', fontStyle: 'normal', margin: '0 3px' }}>1 credit</b> if successful.
          </p>
          {editMade && (
            <div className="bmc-panel-acts bmc-regenerate-acts">
              <button type="button" className="bmc-cta-secondary" onClick={regenerate} disabled={panelGenerating}>
                <BmcIcon name="refresh" w={14} /> {regenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bmc-panel-acts">
        <button type="button" className="bmc-cta" onClick={onApprove} disabled={approved || panelGenerating}>
          <BmcIcon name="check" w={14} /> {panelGenerating ? 'Generating\u2026' : approved ? 'Approved' : 'Approve QR Song'}
        </button>
        <button type="button" className="bmc-cta-secondary" onClick={() => setEditing(!editing)} disabled={panelGenerating}>
          <BmcIcon name="edit" w={14} /> {editing ? 'Close' : 'Edit'}
        </button>
      </div>
    </div>
  );
}

const INSIDE_MESSAGE = `Mom — for every quiet morning that turned out to mean everything, thank you. I love you to the moon and back, every single day. — Cameron`;

function BmcReviewMessage({ approved, onApprove, editing, setEditing, generating }: ReviewPanelProps) {
  return (
    <div className="bmc-panel">
      <div className="bmc-panel-head">
        <div className="bmc-panel-title">Inside message</div>
        <PanelStatus generating={generating} approved={approved} />
      </div>

      {editing ? (
        <>
          <label className="bmc-label">Edit message</label>
          <textarea className="bmc-textarea" defaultValue={INSIDE_MESSAGE} style={{ minHeight: 180 }} />
          <p className="bmc-help" style={{ marginTop: 8 }}>
            Message edits and regenerations are always <b style={{ color: 'var(--gold-hi)', fontStyle: 'normal', marginLeft: '3px' }}>free</b>.
          </p>
          <div className="bmc-panel-acts" style={{ marginTop: 14, marginBottom: 0 }}>
            <button type="button" className="bmc-cta-secondary">
              <BmcIcon name="refresh" w={14} /> Regenerate Message
            </button>
          </div>
        </>
      ) : (
        <div className="bmc-msg-single">{INSIDE_MESSAGE}</div>
      )}

      <div className="bmc-panel-acts">
        <button type="button" className="bmc-cta" onClick={onApprove} disabled={approved || generating}>
          <BmcIcon name="check" w={14} /> {generating ? 'Generating\u2026' : approved ? 'Approved' : 'Approve Message'}
        </button>
        <button type="button" className="bmc-cta-secondary" onClick={() => setEditing(!editing)}>
          <BmcIcon name="edit" w={14} /> {editing ? 'Close' : 'Edit'}
        </button>
      </div>
    </div>
  );
}

function BmcConfirmModal({ open, onClose, onConfirm, includeSong = true }: BmcConfirmModalProps) {
  if (!open) return null;
  const generationCost = includeSong ? 2 : 1;
  const ui = (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" data-screen-label="07 Modal · Start From Scratch">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal">
        <h2 className="bmc-modal-title">
          <span className="text-metallic-rose-gold">Are </span>
          <span className="souv-hero-italic text-metallic-rose-gold">you sure?</span>
        </h2>
        <p className="bmc-modal-sub">
          Starting from scratch will cost another <b className="text-metallic-gold">{generationCost} {generationCost === 1 ? 'credit' : 'credits'}</b> when you can edit
          {includeSong ? ' just the image or QR song' : ' the image'} for <b className="text-metallic-gold">1 credit</b>.
        </p>
        <div className="bmc-modal-acts">
          <button type="button" className="bmc-cta-secondary" onClick={onClose}>Keep editing</button>
          <button type="button" className="bmc-cta" onClick={onConfirm}>Yes, start over</button>
        </div>
      </div>
    </div>
  );
  if (typeof document === "undefined") return null;
  return createPortal(ui, document.body);
}

function BmcInviteModal({ open, onClose, includeSong = true }: BmcInviteModalProps) {
  const [status, setStatus] = React.useState<InviteStatus>('form');
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState<string[]>([]);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (open) { setStatus('form'); setEmail(''); setSent([]); }
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [open]);

  if (!open) return null;

  const clearError = () => { if (status === 'error') setStatus('form'); };
  const send = () => {
    if (status === 'sending') return;
    // No email → surface the error state.
    if (!email.trim()) { setStatus('error'); return; }
    const invited = email.trim();
    setStatus('sending');
    timer.current = setTimeout(() => {
      // Invite sent: record it and reveal a fresh blank field for the next friend.
      setSent(s => [...s, invited]);
      setEmail('');
      setStatus('form');
    }, 1400);
  };

  const sending = status === 'sending';

  const ui = (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" data-screen-label="Modal · Invite A Friend">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal bmc-invite is-gold">
        <button type="button" className="bmc-modal-close" onClick={onClose} aria-label="Close"><BmcIcon name="close" w={16} /></button>

        <div className="bmc-invite-progress" aria-live="polite">
          <span className="bmc-invite-loader" aria-hidden="true" />
          <div className="bmc-invite-progress-copy">
            <div className="bmc-invite-eyebrow">Generating your assets</div>
          </div>
        </div>
        <h2 className="bmc-modal-title">
          <span className="bmc-invite-title-brandline">
            <span className="bmc-invite-wordmark">
              <img src="/assets/WordmarkLobster.png" alt="Souvenote" />
            </span>
            <span className="bmc-invite-title-script">is</span>
          </span>
          <span className="bmc-invite-title-script bmc-invite-title-nowrap">generating your assets.</span>
        </h2>

        <div className="bmc-invite-assets" aria-label="Assets being generated">
          <span aria-label="Card" title="Card"><BmcIcon name="image" w={23} /></span>
          {includeSong && <span aria-label="Song" title="Song"><BmcIcon name="note" w={23} /></span>}
          <span aria-label="Message" title="Message"><BmcIcon name="message" w={23} /></span>
        </div>

        <p className="bmc-invite-while">
          While you wait, invite a friend to Souvenote and earn credits for your next card.
        </p>

        <div className="bmc-invite-reward">
          <BmcIcon name="coin" w={15} /> For each friend who signs up, earn <b>10 free credits</b>.
        </div>

        {sent.length > 0 && (
          <div className="bmc-invite-sent">
            {sent.map((addr, i) => (
              <div className="bmc-invite-sent-row" key={i}>
                <span className="bmc-invite-sent-tick"><BmcIcon name="check" w={12} /></span>
                <span className="bmc-invite-sent-addr">{addr}</span>
                <span className="bmc-invite-sent-tag">Invite sent</span>
              </div>
            ))}
            <p className="bmc-invite-sent-note">When they sign up, your credits are added automatically.</p>
          </div>
        )}

        <div className="bmc-invite-fields">
          <input
            className="bmc-input" type="email" inputMode="email"
            placeholder="Friend’s email address"
            value={email} disabled={sending} autoFocus
            onChange={(e) => { setEmail(e.target.value); clearError(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          />
          {status === 'error' && (
            <div className="bmc-invite-error" role="alert">Could not send invite. Try again.</div>
          )}
        </div>

        <button type="button" className="bmc-cta bmc-invite-cta" onClick={send} disabled={sending}>
          {sending
            ? <><span className="bmc-invite-btn-spin" aria-hidden="true" /> Sending…</>
            : <><BmcIcon name="spark2" w={16} /> Send Invite &amp; Earn Credits</>}
        </button>
        <button type="button" className="bmc-text-link bmc-invite-later" onClick={onClose}>
          {sent.length > 0 ? 'Done' : 'Maybe Later'}
        </button>
      </div>
    </div>
  );
  if (typeof document === "undefined") return null;
  return createPortal(ui, document.body);
}

function BmcReview({ onStartOver, onApproveAll, onTopUp, onRegenerateAsset, credits = 0, generating = false, includeSong = true }: BmcReviewProps) {
  const router = useRouter();
  const [imgApproved, setImgApproved] = React.useState(false);
  const [songApproved, setSongApproved] = React.useState(false);
  const [msgApproved, setMsgApproved] = React.useState(false);
  const [editing, setEditing] = React.useState<EditingState>({ image: false, song: false, message: false });
  const [confirm, setConfirm] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  // Open the "while you wait" invite modal as soon as generation kicks off.
  React.useEffect(() => { if (generating) setInviteOpen(true); }, [generating]);
  // Let the dev switcher preview the invite modal on demand.
  React.useEffect(() => { window.__bmcShowInvite = () => setInviteOpen(true); }, []);

  const approvedCount = [imgApproved, msgApproved, includeSong && songApproved].filter(Boolean).length;
  const requiredApprovalCount = includeSong ? 3 : 2;
  const allApproved = imgApproved && msgApproved && (!includeSong || songApproved);
  const startOver = onStartOver || (() => router.push('/create/build-my-card'));
  const approveAll = onApproveAll || (() => router.push('/delivery'));
  const topUp = onTopUp || (() => router.push('/pricing'));
  const outOfCredits = credits <= 0;
  const spendRegenerationCredit = async () => {
    if (credits <= 0) {
      topUp();
      return false;
    }
    return await (onRegenerateAsset?.() ?? true);
  };
  const handleApproveAll = () => {
    if (generating) return;
    setImgApproved(true);
    if (includeSong) setSongApproved(true);
    setMsgApproved(true);
    approveAll();
  };

  return (
    <div className="bmc-shell bmc-shell-review" data-screen-label="06 Review">
      <div className="bmc-head" style={{ textAlign: 'center', margin: '0 auto 36px', maxWidth: 760 }}>
        <div className="bmc-eyebrow" style={{ justifyContent: 'center' }}>
          <span className="bmc-eyebrow-num">06</span>
          <span>Approval</span>
        </div>
        <h1 className="bmc-title bmc-title-script">
          {includeSong ? 'Three pieces' : 'Two pieces'},{' '}
          <span className="souv-hero-italic text-metallic-rose-gold">one keepsake</span>
        </h1>
        <p className="bmc-lede" style={{ margin: '0 auto' }}>
          {includeSong
            ? 'Front, QR song, and inside message, each independently editable. Approve each piece, then send the bundle to Delivery.'
            : 'Front and inside message, each independently editable. Approve both pieces, then send the card to Delivery.'}
        </p>
      </div>

      <div className="bmc-review-grid">
        <BmcReviewFront
          approved={imgApproved}
          generating={generating}
          onApprove={() => setImgApproved(true)}
          onInvalidate={() => setImgApproved(false)}
          onRegenerate={async () => {
            const spent = await spendRegenerationCredit();
            if (spent) setImgApproved(false);
            return spent;
          }}
          editing={editing.image}
          setEditing={(v) => setEditing(s => ({ ...s, image: v }))}
        />
        <div className="bmc-review-stack">
          {includeSong && (
            <BmcReviewSong
              approved={songApproved}
              generating={generating}
              onApprove={() => setSongApproved(true)}
              onInvalidate={() => setSongApproved(false)}
              onRegenerate={async () => {
                const spent = await spendRegenerationCredit();
                if (spent) setSongApproved(false);
                return spent;
              }}
              editing={editing.song}
              setEditing={(v) => setEditing(s => ({ ...s, song: v }))}
            />
          )}
          <BmcReviewMessage
            approved={msgApproved}
            generating={generating}
            onApprove={() => setMsgApproved(true)}
            editing={editing.message}
            setEditing={(v) => setEditing(s => ({ ...s, message: v }))}
          />
        </div>
      </div>

      <div className="bmc-review-actions">
        <div className="bmc-review-left">
          <button type="button" className="bmc-cta-secondary" onClick={() => setConfirm(true)}>
            <BmcIcon name="refresh" w={14} /> Start From Scratch
          </button>
          <button type="button" className={outOfCredits ? 'bmc-cta bmc-cta-topup' : 'bmc-cta-quiet'} onClick={topUp}>
            {outOfCredits ? 'Out of credits — Top Up' : 'Top Up Credits'} <BmcIcon name="arrow" w={14} />
          </button>
        </div>
        <div className="bmc-review-right">
          <span className="bmc-foot-cost" style={{ marginRight: 4 }}>
            {allApproved
              ? <span style={{ color: 'var(--gold-hi)' }}>All set · ready to deliver</span>
              : <>{approvedCount} / {requiredApprovalCount} approved</>}
          </span>
          <button type="button" className="bmc-cta" onClick={handleApproveAll} disabled={generating}>
            Approve All <BmcIcon name="arrow" w={16} />
          </button>
        </div>
      </div>

      <BmcConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); startOver(); }}
        includeSong={includeSong}
      />

      <BmcInviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} includeSong={includeSong} />
    </div>
  );
}

export { BmcReview, BmcConfirmModal, BmcInviteModal, BmcReviewFront, BmcReviewSong, BmcReviewMessage };
