"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { BmcIcon, BmcErrorModal, bmcError } from "./BmcShared";
import { DlvKeepsake } from "./DeliveryKeepsake";
import { useDemoLibrary } from "./DemoLibrary";
import { consumeBlankSouvenoteGift, useBlankSouvenoteGiftCount } from "./GiftAddon";
import {
  DLV_EMPTY_RECIP,
  dlvCountry,
  dlvValidate,
  DlvRecipientSection,
  DlvReturnSection,
  DlvScheduleSection,
  DlvShippingSection,
} from "./DeliveryForm";
import type { DeliveryErrors, DeliveryMode, DeliveryRecipient, DeliveryWhen } from "./DeliveryForm";
import { useDemoBalance } from "./DemoBalance";
import type { DemoBalance } from "./DemoBalance";
import type { DemoCredits, DemoUser } from "./DemoUser";

type DeliveryOrder = {
  number: string;
  to: string;
  carrier: string;
  scheduled: boolean;
  arrival: string;
  cards: number;
  cardsLeft: number;
};

type DlvSentModalProps = {
  open: boolean;
  order: DeliveryOrder | null;
  onClose: () => void;
};

type DlvToastProps = {
  msg?: string | null;
  onClose: () => void;
};

type DlvBlankGiftModalProps = {
  open: boolean;
  count: number;
  name: string;
  contact: string;
  onNameChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onClose: () => void;
  onKeepLater: () => void;
  onSaveGift: () => void;
};

type DeliveryAppProps = {
  user: DemoUser;
  initialCards?: number;
  initialCredits?: DemoCredits;
};

declare global {
  interface Window {
    __dlvSetCards?: React.Dispatch<React.SetStateAction<number>>;
    __dlvOpenCheckout?: () => void;
  }
}

function DlvSentModal({ open, order, onClose }: DlvSentModalProps) {
  if (!open || !order) return null;

  return (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" data-screen-label="06 Delivery · Sent">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal co-confirm">
        <div className="co-confirm-seal"><BmcIcon name="check" w={38} /></div>
        <h2 className="bmc-modal-title" style={{ marginBottom: 6 }}>
          On its <span className="souv-hero-italic text-metallic-rose-gold">way</span>
        </h2>
        <p className="bmc-modal-sub" style={{ marginBottom: 4 }}>
          We&apos;re hand-writing your card now, and you&apos;ll get an email when it&apos;s posted.
        </p>
        <div className="co-confirm-order"><BmcIcon name="message" w={13} /> {order.number}</div>
        <div className="co-confirm-rows">
          <div className="co-confirm-row"><span className="co-confirm-row-k">To</span><span className="co-confirm-row-v">{order.to}</span></div>
          <div className="co-confirm-row"><span className="co-confirm-row-k">Mailed via</span><span className="co-confirm-row-v">{order.carrier}</span></div>
          <div className="co-confirm-row"><span className="co-confirm-row-k">{order.scheduled ? "Posts on" : "Estimated arrival"}</span><span className="co-confirm-row-v">{order.arrival}</span></div>
          <div className="co-confirm-row"><span className="co-confirm-row-k">Cards used</span><span className="co-confirm-row-v">{order.cards} {"\u00b7"} {order.cardsLeft} left</span></div>
        </div>
        <div className="bmc-modal-acts dlv-sent-acts">
          <Link href="/" className="dlv-sent-home" aria-label="Back to Souvenote">
            <BmcIcon name="back" w={16} />
            <img src="/assets/WordmarkLobster.png" alt="Souvenote" className="dlv-sent-home-logo" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function DlvToast({ msg, onClose }: DlvToastProps) {
  React.useEffect(() => {
    if (!msg) return undefined;
    const timer = window.setTimeout(onClose, 3600);
    return () => window.clearTimeout(timer);
  }, [msg, onClose]);

  if (!msg) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 28,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 300,
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "14px 22px",
      borderRadius: 9999,
      background: "var(--glass-strong)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(212,175,55,0.4)",
      boxShadow: "0 18px 40px rgba(0,0,0,0.5)",
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: 12.5,
      letterSpacing: ".04em",
      color: "var(--gold-hi)",
    }}>
      <BmcIcon name="spark2" w={15} /> {msg}
    </div>
  );
}

function DlvBlankGiftModal({
  open,
  count,
  name,
  contact,
  onNameChange,
  onContactChange,
  onClose,
  onKeepLater,
  onSaveGift,
}: DlvBlankGiftModalProps) {
  if (!open || count <= 0) return null;

  const canSave = contact.trim().length > 3;

  return (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="dlv-blank-gift-title" data-screen-label="Delivery · Blank gift reminder">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal dlv-blank-gift-modal">
        <button type="button" className="bmc-modal-close" aria-label="Close" onClick={onClose}>
          <BmcIcon name="close" w={16} />
        </button>
        <div className="dlv-blank-gift-grid">
          <div className="dlv-blank-gift-copy">
            <div className="bmc-eyebrow dlv-blank-gift-eyebrow">
              <BmcIcon name="spark2" w={14} />
              <span>Blank Souvenote Gift</span>
            </div>
            <h2 id="dlv-blank-gift-title" className="bmc-modal-title">
              You have a blank <span className="souv-hero-italic text-metallic-gold">Souvenote</span> to give.
            </h2>
            <p className="bmc-modal-sub">
              Before you send this card, choose who should receive the blank Souvenote or keep it in your account for later.
            </p>
            <div className="dlv-blank-gift-fields">
              <label className="acc-flabel">Recipient name</label>
              <input className="input-dark" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Who should receive it?" />
              <label className="acc-flabel">Email or phone</label>
              <input className="input-dark" value={contact} onChange={(event) => onContactChange(event.target.value)} placeholder="name@example.com or phone" />
            </div>
          </div>
          <aside className="acc-panel acc-gift-summary dlv-blank-gift-summary">
            <div className="acc-gift-token" aria-hidden="true">
              <span className="acc-gift-token-label">A Souvenote,<br />on you</span>
            </div>
            <div className="acc-gift-name">Blank Souvenote Gift</div>
            <div className="acc-gift-meta">
              <div className="acc-summary-row"><span className="k">Available</span><span className="v">{count} {count === 1 ? "gift" : "gifts"}</span></div>
              <div className="acc-summary-row"><span className="k">Recipient</span><span className="v">{contact.trim() ? "Ready to save" : "Choose now or later"}</span></div>
              <div className="acc-summary-row"><span className="k">Reminder</span><span className="v">Delivery step</span></div>
            </div>
          </aside>
        </div>
        <div className="bmc-modal-acts dlv-blank-gift-actions">
          <button type="button" className="bmc-cta-secondary" onClick={onKeepLater}>Keep for later</button>
          <button type="button" className="bmc-cta" onClick={onSaveGift} disabled={!canSave}>
            Save gift &amp; send card <BmcIcon name="arrow" w={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function dlvArrival(_shipping: string, when: DeliveryWhen, date: string) {
  const base = when === "schedule" && date ? new Date(date + "T12:00:00") : new Date();
  const add = 7;
  if (when !== "schedule") base.setDate(base.getDate() + add + 1);
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  if (when === "schedule" && date) return base.toLocaleDateString("en-CA", opts);
  return "~" + base.toLocaleDateString("en-CA", opts);
}

const DELIVERY_DEFAULT_CREDITS: DemoCredits = { images: 4, songs: 2 };

function DeliveryApp({ user, initialCards = 3, initialCredits = DELIVERY_DEFAULT_CREDITS }: DeliveryAppProps) {
  const router = useRouter();
  const defaultBalance: DemoBalance = React.useMemo(
    () => ({ credits: initialCredits, cardBank: initialCards }),
    [initialCards, initialCredits],
  );
  const demoBalance = useDemoBalance(defaultBalance);

  const [mode, setMode] = React.useState<DeliveryMode>("single");
  const [quantity, setQuantity] = React.useState(1);
  const [recipients, setRecipients] = React.useState<DeliveryRecipient[]>([]);
  const [draft, setDraft] = React.useState<DeliveryRecipient>({
    ...DLV_EMPTY_RECIP,
    title: "Mrs",
    firstName: "Eleanor",
    lastName: "Wilson",
    address1: "88 Beachview Crescent",
    city: "Victoria",
    state: "BC",
    postalCode: "V8N 2K1",
    country: "CA",
  });
  const [errors, setErrors] = React.useState<DeliveryErrors>({});
  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
  const [returnOn, setReturnOn] = React.useState(true);
  const [sender, setSender] = React.useState<DeliveryRecipient>({
    ...DLV_EMPTY_RECIP,
    firstName: "Cameron",
    lastName: "Wilson",
    address1: "12 Harbour Lane",
    city: "Vancouver",
    state: "BC",
    postalCode: "V6B 1A1",
    country: "CA",
  });
  const [when, setWhen] = React.useState<DeliveryWhen>("now");
  const [date, setDate] = React.useState("");
  const [shipping, setShipping] = React.useState("standard");
  const [cardBank, setCardBank] = React.useState(demoBalance.cardBank);
  const credits = demoBalance.credits;
  const [song, setSong] = React.useState(false);
  const demoLibrary = useDemoLibrary();
  const songIncluded = demoLibrary.cards[0]?.song !== false;
  const [sent, setSent] = React.useState<DeliveryOrder | null>(null);
  const blankGiftCount = useBlankSouvenoteGiftCount();
  const [giftReminderDismissed, setGiftReminderDismissed] = React.useState(false);
  const [giftModalOpen, setGiftModalOpen] = React.useState(false);
  const [giftRecipientName, setGiftRecipientName] = React.useState("");
  const [giftRecipientContact, setGiftRecipientContact] = React.useState("");

  React.useEffect(() => {
    setCardBank(demoBalance.cardBank);
  }, [demoBalance.cardBank]);

  const cardsNeeded = mode === "single" ? quantity : Math.max(recipients.length, 0);
  const enough = cardBank >= cardsNeeded && cardsNeeded > 0;
  const carrier = dlvCountry(draft.country).carrier;
  const goToPricing = React.useCallback(() => {
    router.push("/pricing");
  }, [router]);

  React.useEffect(() => {
    window.__dlvSetCards = setCardBank;
    window.__dlvOpenCheckout = goToPricing;
  }, [goToPricing]);

  function finalizeSend() {
    const left = cardBank - cardsNeeded;
    setCardBank(left);
    const primary = mode === "single" ? draft : recipients[0];
    const toName = mode === "single"
      ? [primary.title, primary.firstName, primary.lastName].filter(Boolean).join(" ")
      : `${recipients.length} recipients`;

    setSent({
      number: "SVN-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      to: toName,
      carrier,
      scheduled: when === "schedule",
      arrival: dlvArrival(shipping, when, date),
      cards: cardsNeeded,
      cardsLeft: left,
    });
  }

  function handleSend() {
    if (mode === "single") {
      const nextErrors = dlvValidate(draft);
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        window.scrollTo({ top: 0, behavior: "smooth" });
        bmcError(
          "Fill in the recipient's required address fields - name, street, city, province and postal code - before sending. We can't mail a card without a complete, deliverable address.",
          "Address needed",
        );
        return;
      }
    } else if (recipients.length === 0) {
      bmcError("Add at least one recipient address before sending. Fill in the required fields and tap Add recipient.", "Address needed");
      return;
    }

    if (!enough) {
      goToPricing();
      return;
    }

    if (blankGiftCount > 0) {
      setGiftModalOpen(true);
      return;
    }

    finalizeSend();
  }

  function keepGiftForLaterAndSend() {
    setGiftModalOpen(false);
    setGiftReminderDismissed(true);
    finalizeSend();
  }

  function saveGiftRecipientAndSend() {
    consumeBlankSouvenoteGift();
    setGiftModalOpen(false);
    setGiftReminderDismissed(true);
    finalizeSend();
  }

  return (
    <>
      <Navbar loggedIn user={user} credits={credits} cardBank={cardBank} cartCount={0} />

      <div className="bmc-shell" data-screen-label="06 Delivery">
        <div className="bmc-head" style={{ textAlign: "center", margin: "0 auto 40px", maxWidth: 780 }}>
          <div className="bmc-eyebrow" style={{ justifyContent: "center", whiteSpace: "nowrap" }}>
            <span className="bmc-eyebrow-num">07</span>
            <span>Delivery</span>
          </div>
          <h1 className="bmc-title">
            A card{" "}
            <span className="souv-hero-italic text-metallic-rose-gold">worth sending</span>
          </h1>
          <p className="bmc-lede" style={{ margin: "0 auto" }}>
            Your card is printed and folded, your message is hand-written in real ink, and any optional song is tucked
            behind a QR code inside. Tell us where it&apos;s going. Sending costs one card from your bank.
          </p>
        </div>

        {blankGiftCount > 0 && !giftReminderDismissed && (
          <div className="dlv-gift-reminder" role="status">
            <span className="dlv-gift-reminder-ico"><BmcIcon name="spark2" w={18} /></span>
            <div>
              <div className="dlv-gift-reminder-title">You have a blank Souvenote to give</div>
              <p>We&apos;ll remind you when you send this card. You have {blankGiftCount} {blankGiftCount === 1 ? "blank gift" : "blank gifts"} ready.</p>
            </div>
            <button
              type="button"
              className="dlv-gift-reminder-dismiss"
              onClick={() => setGiftReminderDismissed(true)}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="dlv-grid">
          <div className="dlv-keepsake-col">
            <DlvKeepsake song={song} songIncluded={songIncluded} onPlaySong={() => setSong((current) => !current)} />
          </div>

          <div className="dlv-form">
            <DlvRecipientSection
              mode={mode}
              setMode={setMode}
              quantity={quantity}
              setQuantity={setQuantity}
              recipients={recipients}
              setRecipients={setRecipients}
              draft={draft}
              setDraft={setDraft}
              errors={errors}
              setErrors={setErrors}
              editingIdx={editingIdx}
              setEditingIdx={setEditingIdx}
            />
            <DlvReturnSection on={returnOn} setOn={setReturnOn} sender={sender} setSender={setSender} />
            <DlvScheduleSection when={when} setWhen={setWhen} date={date} setDate={setDate} />
            <DlvShippingSection shipping={shipping} setShipping={setShipping} country={draft.country} />
          </div>
        </div>

        <div className="dlv-actionbar">
          <div className="dlv-cost">
            <span className="dlv-cost-main">
              <BmcIcon name="message" w={15} />
              {cardsNeeded > 1 ? `Sending ${cardsNeeded} cards` : "Sending 1 card"}
            </span>
            <span className={`dlv-cost-sub ${!enough ? "is-low" : ""}`}>
              {enough
                ? <>Uses {cardsNeeded} of {cardBank} in your card bank {"\u00b7"} <button type="button" className="dlv-topup-link" onClick={goToPricing}>Top up</button></>
                : <>You have {cardBank} in your card bank - top up to send {cardsNeeded > 1 ? `all ${cardsNeeded}` : ""}</>}
            </span>
          </div>
          <div className="dlv-actionbar-right">
            <Link href="/create/build-my-card#review" className="bmc-cta-secondary"><BmcIcon name="back" w={14} /> Back to review</Link>
            <button type="button" className="bmc-cta bmc-cta-lg" onClick={handleSend}>
              {enough
                ? <>{cardsNeeded > 1 ? `Send ${cardsNeeded} cards` : "Send my card"} <BmcIcon name="arrow" w={16} /></>
                : <>Top up cards <BmcIcon name="arrow" w={16} /></>}
            </button>
          </div>
        </div>
      </div>

      <Footer />

      <DlvSentModal open={!!sent} order={sent} onClose={() => setSent(null)} />
      <DlvBlankGiftModal
        open={giftModalOpen}
        count={blankGiftCount}
        name={giftRecipientName}
        contact={giftRecipientContact}
        onNameChange={setGiftRecipientName}
        onContactChange={setGiftRecipientContact}
        onClose={() => setGiftModalOpen(false)}
        onKeepLater={keepGiftForLaterAndSend}
        onSaveGift={saveGiftRecipientAndSend}
      />
      <BmcErrorModal />
    </>
  );
}

export { DeliveryApp, DlvSentModal, DlvToast };
