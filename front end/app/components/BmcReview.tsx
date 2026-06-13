"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BmcIcon } from "./BmcShared";
import { GENRE_GROUPS } from "./BmcSteps";
import { rememberPricingReturn } from "./PricingReturn";
import { addPricingCartItemToCart, makeSingleCardSendCartItem } from "./pricingCatalog";

// BmcReview.tsx - Build My Card Review page.
// Front Card, Song, Inside Message panels + bottom action bar + "Are you sure?" modal.
// Also: the "while you wait" invite-a-friend modal shown over Review while assets generate.

type PanelStatusProps = {
  generating: boolean;
  approved: boolean;
};

type ReviewPanelProps = PanelStatusProps & {
  onApprove: () => void;
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
};

type BmcReviewProps = {
  onStartOver?: () => void;
  onApproveAll?: () => void;
  onTopUp?: () => void;
  credits?: number;
  generating?: boolean;
  requiresCardPurchase?: boolean;
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

function BmcReviewFront({ approved, onApprove, editing, setEditing, generating }: ReviewPanelProps) {
  const [instr, setInstr] = React.useState('Make the moon a touch warmer; keep the dance pose.');
  return (
    <div className="bmc-panel">
      <div className="bmc-panel-head">
        <div className="bmc-panel-title">Front card</div>
        <PanelStatus generating={generating} approved={approved} />
      </div>

      <div className="bmc-front-art">
        <div className="bmc-front-noise" />
        <div className="bmc-front-glyph">
          To the moon<br/>and back
        </div>
        <div className="bmc-front-fig" />
      </div>
      <div className="bmc-front-caption">5×7 portrait · Transform · Cinematic · Heartfelt + Elegant</div>

      {editing && (
        <div className="bmc-edit-inst">
          <label className="bmc-label">Edit instruction</label>
          <textarea className="bmc-textarea" value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Describe what to change. Composition stays as-is." />
          <p className="bmc-help" style={{ marginTop: 8 }}>
            Image edits cost <b style={{ color: 'var(--gold-hi)', fontStyle: 'normal' }}>1 credit</b> if successful.
          </p>
        </div>
      )}

      <div className="bmc-panel-acts">
        <button type="button" className="bmc-cta" onClick={onApprove} disabled={approved || generating}>
          <BmcIcon name="check" w={14} /> {generating ? 'Generating\u2026' : approved ? 'Approved' : 'Approve Image'}
        </button>
        <button type="button" className="bmc-cta-secondary" onClick={() => setEditing(!editing)}>
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

function BmcReviewSong({ approved, onApprove, editing, setEditing, generating }: ReviewPanelProps) {
  const [playing, setPlaying] = React.useState(false);
  const [genre, setGenre] = React.useState('Slow R&B Ballad');
  const BARS = [12,18,24,16,30,22,12,26,20,32,14,26,10,22,30,16,24,11,20,28,14,24,18,30,11,22,16,26,20,12,24,30,14,20,10,26,18,30,14,22,12,24,20,28,10,16,26,18,22,14,24,18,30,22];

  return (
    <div className="bmc-panel">
      <div className="bmc-panel-head">
        <div className="bmc-panel-title">Song</div>
        <PanelStatus generating={generating} approved={approved} />
      </div>

      <div className="bmc-song-player">
        <div className="bmc-song-meta">
          <button className="bmc-song-fab" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            <BmcIcon name={playing ? 'pause' : 'play'} w={18} />
          </button>
          <div>
            <div className="bmc-song-name">Slow R&amp;B Ballad · Male</div>
            <div className="bmc-song-sub">00:00 / 00:45</div>
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
            <BmcGenreSelect value={genre} onChange={setGenre} />
          </div>
          <label className="bmc-label">Lyrics</label>
          <textarea className="bmc-textarea" defaultValue={`[00:00-00:08 Verse]\nA pair of shoes by the door…\n\n[00:25-00:41 Chorus]\nTo the moon and back, to the moon and back…`} />
          <p className="bmc-help" style={{ marginTop: 8 }}>
            Song edits cost <b style={{ color: 'var(--gold-hi)', fontStyle: 'normal', margin: '0 3px' }}>1 credit</b> if successful.
          </p>
        </div>
      )}

      <div className="bmc-panel-acts">
        <button type="button" className="bmc-cta" onClick={onApprove} disabled={approved || generating}>
          <BmcIcon name="check" w={14} /> {generating ? 'Generating\u2026' : approved ? 'Approved' : 'Approve Song'}
        </button>
        <button type="button" className="bmc-cta-secondary" onClick={() => setEditing(!editing)}>
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

function BmcConfirmModal({ open, onClose, onConfirm }: BmcConfirmModalProps) {
  if (!open) return null;
  const ui = (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" data-screen-label="07 Modal · Start From Scratch">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal">
        <h2 className="bmc-modal-title">
          <span className="text-metallic-rose-gold">Are </span>
          <span className="souv-hero-italic text-metallic-rose-gold">you sure?</span>
        </h2>
        <p className="bmc-modal-sub">
          Starting from scratch will cost another <b className="text-metallic-gold">2 credits</b> when you can edit
          just the image or song for <b className="text-metallic-gold">1 credit</b>.
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

function BmcInviteModal({ open, onClose }: ModalProps) {
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

        <div className="bmc-invite-eyebrow">
          <span className="bmc-invite-eyebrow-spin" aria-hidden="true" />
          Your card is generating
        </div>
        <h2 className="bmc-modal-title">
          Refer and <span className="souv-hero-italic text-metallic-rose-gold">earn</span>
        </h2>
        <p className="bmc-modal-sub">
          Invite a friend to Souvenote. When they join, credits land in your account
          automatically — ready for your next card or song.
        </p>

        <div className="bmc-invite-reward">
          <BmcIcon name="coin" w={15} /> For every friend you invite, earn <b>10 credits</b>
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

function BmcSendCardModal({ open, onClose, onSendOne, onBuyMore, onHome }: ModalProps & {
  onSendOne: () => void;
  onBuyMore: () => void;
  onHome: () => void;
}) {
  if (!open) return null;

  const ui = (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="bmc-send-card-title" data-screen-label="Review - Send Card Modal">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal bmc-send-card-modal is-gold">
        <button type="button" className="bmc-modal-close" onClick={onClose} aria-label="Close"><BmcIcon name="close" w={16} /></button>
        <div className="bmc-send-card-eyebrow">
          <BmcIcon name="check" w={14} />
          Your Souvenote is ready
        </div>
        <h2 id="bmc-send-card-title" className="bmc-modal-title">
          Send this card?
        </h2>
        <p className="bmc-modal-sub bmc-send-card-sub">
          You used your credits to create this card. To mail it, send this card for $6.99, purchase more than one card, or head home and come back later.
        </p>
        <div className="bmc-send-card-summary">
          <span>Physical 5x7 card</span>
          <b>$6.99 CAD</b>
          <em>Shipping is always included.</em>
        </div>
        <div className="bmc-modal-acts bmc-send-card-actions">
          <button type="button" className="bmc-cta" onClick={onSendOne}>
            Send the card for $6.99 <BmcIcon name="arrow" w={15} />
          </button>
          <button type="button" className="bmc-cta-secondary" onClick={onBuyMore}>
            Purchase more than 1 card
          </button>
          <button type="button" className="bmc-cta-quiet" onClick={onHome}>
            Take me home
          </button>
        </div>
      </div>
    </div>
  );
  if (typeof document === "undefined") return null;
  return createPortal(ui, document.body);
}

function BmcReview({ onStartOver, onApproveAll, onTopUp, credits = 6, generating = false, requiresCardPurchase = false }: BmcReviewProps) {
  const router = useRouter();
  const [imgApproved, setImgApproved] = React.useState(false);
  const [songApproved, setSongApproved] = React.useState(false);
  const [msgApproved, setMsgApproved] = React.useState(false);
  const [editing, setEditing] = React.useState<EditingState>({ image: false, song: false, message: false });
  const [confirm, setConfirm] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [sendCardOpen, setSendCardOpen] = React.useState(false);

  // Open the "while you wait" invite modal as soon as generation kicks off.
  React.useEffect(() => { if (generating) setInviteOpen(true); }, [generating]);
  // Let the dev switcher preview the invite modal on demand.
  React.useEffect(() => { window.__bmcShowInvite = () => setInviteOpen(true); }, []);

  const allApproved = imgApproved && songApproved && msgApproved;
  const startOver = onStartOver || (() => router.push('/create/build-my-card'));
  const approveAll = onApproveAll || (() => router.push('/delivery'));
  const topUp = onTopUp || (() => router.push('/pricing'));
  const outOfCredits = credits <= 0;
  const handleApproveAll = () => {
    if (generating) return;
    setImgApproved(true);
    setSongApproved(true);
    setMsgApproved(true);
    if (requiresCardPurchase) {
      setSendCardOpen(true);
      return;
    }
    approveAll();
  };

  const sendOneCard = () => {
    addPricingCartItemToCart(makeSingleCardSendCartItem());
    rememberPricingReturn('/delivery');
    router.push('/cart');
  };

  const buyMoreCards = () => {
    rememberPricingReturn('/delivery');
    router.push('/pricing#card-packs');
  };

  return (
    <div className="bmc-shell bmc-shell-review" data-screen-label="06 Review">
      <div className="bmc-head" style={{ textAlign: 'center', margin: '0 auto 36px', maxWidth: 760 }}>
        <div className="bmc-eyebrow" style={{ justifyContent: 'center' }}>
          <span className="bmc-eyebrow-num">06</span>
          <span>Approval</span>
        </div>
        <h1 className="bmc-title">
          Three pieces, one{' '}
          <span className="souv-hero-italic text-metallic-rose-gold">keepsake</span>
        </h1>
        <p className="bmc-lede" style={{ margin: '0 auto' }}>
          Front, song, and inside message, each independently editable. Approve each piece,
          then send the bundle to Delivery.
        </p>
      </div>

      <div className="bmc-review-grid">
        <BmcReviewFront
          approved={imgApproved}
          generating={generating}
          onApprove={() => setImgApproved(true)}
          editing={editing.image}
          setEditing={(v) => setEditing(s => ({ ...s, image: v }))}
        />
        <div className="bmc-review-stack">
          <BmcReviewSong
            approved={songApproved}
            generating={generating}
            onApprove={() => setSongApproved(true)}
            editing={editing.song}
            setEditing={(v) => setEditing(s => ({ ...s, song: v }))}
          />
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
              : <>{[imgApproved, songApproved, msgApproved].filter(Boolean).length} / 3 approved</>}
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
      />

      <BmcInviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <BmcSendCardModal
        open={sendCardOpen}
        onClose={() => setSendCardOpen(false)}
        onSendOne={sendOneCard}
        onBuyMore={buyMoreCards}
        onHome={() => router.push('/home')}
      />
    </div>
  );
}

export { BmcReview, BmcConfirmModal, BmcInviteModal, BmcSendCardModal, BmcReviewFront, BmcReviewSong, BmcReviewMessage };
