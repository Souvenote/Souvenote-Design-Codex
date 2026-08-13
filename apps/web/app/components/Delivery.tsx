'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { BmcIcon, BmcErrorModal, bmcError } from './BmcShared';
import { DlvKeepsake } from './DeliveryKeepsake';
import { assetContentUrl, fetchCardDraftAssets, fetchCardDraftById } from '../lib/api';
import type { CardDraftAsset } from '../lib/api';
import {
  DLV_EMPTY_RECIP,
  dlvValidate,
  DlvRecipientSection,
  DlvReturnSection,
  DlvScheduleSection,
  DlvShippingSection,
} from './DeliveryForm';
import type { DeliveryErrors, DeliveryMode, DeliveryRecipient, DeliveryWhen } from './DeliveryForm';
import type { DemoCredits, DemoUser } from './DemoUser';
import { useAuth } from './AuthProvider';
import { rememberPricingReturn } from './PricingReturn';
import {
  addPricingCartItemToCart,
  BIG_SENDER_TIERS,
  clampBigSenderQuantity,
  getBigSenderPricing,
  makeBigSenderCartItem,
  MAX_BIG_SENDER_CARDS,
  MIN_BIG_SENDER_CARDS,
} from './pricingCatalog';

type BackendAction = 'idle' | 'loading_assets';

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

type DlvCardTopUpModalProps = {
  open: boolean;
  onClose: () => void;
  onReserve: (quantity: number) => void;
};

type DeliveryAppProps = {
  user?: DemoUser;
  initialCards?: number;
  initialCredits?: DemoCredits;
};

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
    <div
      className="bmc-modal-wrap"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlv-blank-gift-title"
      data-screen-label="Delivery · Blank gift reminder"
    >
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
              Before you send this card, choose who should receive the blank Souvenote or keep it in your account for
              later.
            </p>
            <div className="dlv-blank-gift-fields">
              <label className="acc-flabel">Recipient name</label>
              <input
                className="input-dark"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Who should receive it?"
              />
              <label className="acc-flabel">Email or phone</label>
              <input
                className="input-dark"
                value={contact}
                onChange={(event) => onContactChange(event.target.value)}
                placeholder="name@example.com or phone"
              />
            </div>
          </div>
          <aside className="acc-panel acc-gift-summary dlv-blank-gift-summary">
            <div className="acc-gift-token" aria-hidden="true">
              <span className="acc-gift-token-label">
                A Souvenote,
                <br />
                on you
              </span>
            </div>
            <div className="acc-gift-name">Blank Souvenote Gift</div>
            <div className="acc-gift-meta">
              <div className="acc-summary-row">
                <span className="k">Available</span>
                <span className="v">
                  {count} {count === 1 ? 'gift' : 'gifts'}
                </span>
              </div>
              <div className="acc-summary-row">
                <span className="k">Recipient</span>
                <span className="v">{contact.trim() ? 'Ready to save' : 'Choose now or later'}</span>
              </div>
              <div className="acc-summary-row">
                <span className="k">Reminder</span>
                <span className="v">Delivery step</span>
              </div>
            </div>
          </aside>
        </div>
        <div className="bmc-modal-acts dlv-blank-gift-actions">
          <button type="button" className="bmc-cta-secondary" onClick={onKeepLater}>
            Keep for later
          </button>
          <button type="button" className="bmc-cta" onClick={onSaveGift} disabled={!canSave}>
            Save gift &amp; send card <BmcIcon name="arrow" w={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function DlvCardTopUpModal({ open, onClose, onReserve }: DlvCardTopUpModalProps) {
  const [qty, setQty] = React.useState(MIN_BIG_SENDER_CARDS);

  if (!open) return null;

  function setQtyClamped(nextRaw: number | string) {
    setQty(clampBigSenderQuantity(nextRaw));
  }

  const pricing = getBigSenderPricing(qty);
  const creationCredits = qty * 10;

  return (
    <div
      className="bmc-modal-wrap"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlv-card-topup-title"
      data-screen-label="Delivery - Card balance top-up modal"
    >
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal dlv-card-topup-modal is-gold">
        <button type="button" className="bmc-modal-close" onClick={onClose} aria-label="Close">
          <BmcIcon name="close" w={16} />
        </button>
        <div className="bmc-eyebrow dlv-card-topup-eyebrow">
          <span>Card balance required</span>
        </div>
        <h2 id="dlv-card-topup-title" className="bmc-modal-title dlv-card-topup-title">
          Top up your card balance to send this{' '}
          <span className="dlv-card-topup-wordmark">
            <img src="/assets/WordmarkLobster.png" alt="Souvenote" />
          </span>
        </h2>
        <ul className="dlv-card-topup-sub" aria-label="Card balance benefits">
          <li className="dlv-card-topup-subline">Choose between Bulk, multi or single sends at delivery</li>
          <li className="dlv-card-topup-subline">Each card comes with 10 creation credits</li>
        </ul>

        <div className="dlv-card-topup-pack" aria-label="Choose card quantity">
          <div className="dlv-card-topup-tiers" role="list" aria-label="Volume tiers">
            {BIG_SENDER_TIERS.map((tier) => {
              const active = qty >= tier.min && qty <= tier.max;
              return (
                <button
                  key={tier.label}
                  type="button"
                  role="listitem"
                  className={`dlv-card-topup-tier ${active ? 'is-active' : ''}`}
                  onClick={() => setQtyClamped(tier.min)}
                >
                  <span>{tier.label}</span>
                  <b>${tier.pricePerCard.toFixed(2)}</b>
                  <em>/ card</em>
                </button>
              );
            })}
          </div>

          <div className="dlv-card-topup-stepper">
            <span>How many cards?</span>
            <div className="dlv-card-topup-value">
              <strong>${pricing.totalText}</strong>
              <em>{creationCredits} credits</em>
            </div>
            <div className="dlv-card-topup-controls">
              <button
                type="button"
                aria-label="Decrease"
                onClick={() => setQtyClamped(qty - 1)}
                disabled={qty <= MIN_BIG_SENDER_CARDS}
              >
                -
              </button>
              <input
                aria-label="Card quantity"
                type="number"
                min={MIN_BIG_SENDER_CARDS}
                max={MAX_BIG_SENDER_CARDS}
                value={qty}
                onChange={(event) => setQtyClamped(event.target.value)}
              />
              <button
                type="button"
                aria-label="Increase"
                onClick={() => setQtyClamped(qty + 1)}
                disabled={qty >= MAX_BIG_SENDER_CARDS}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="bmc-modal-acts dlv-card-topup-actions">
          <button type="button" className="bmc-cta" onClick={() => onReserve(qty)}>
            Reserve {qty} {qty === 1 ? 'card' : 'cards'} - ${pricing.totalText} <BmcIcon name="arrow" w={15} />
          </button>
        </div>
        <p className="dlv-card-topup-fineprint">
          Your creations will be saved in "Saved Cards &amp; Songs" for 30 days upon generation.
        </p>
      </div>
    </div>
  );
}

const DELIVERY_DEFAULT_CREDITS: DemoCredits = { images: 0, songs: 0 };

function DeliveryApp({ user, initialCards = 0, initialCredits = DELIVERY_DEFAULT_CREDITS }: DeliveryAppProps) {
  void initialCards;
  void initialCredits;
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const displayUser = auth.displayUser ?? user;

  const [mode, setMode] = React.useState<DeliveryMode>('single');
  const [quantity, setQuantity] = React.useState(1);
  const [recipients, setRecipients] = React.useState<DeliveryRecipient[]>([]);
  const [draft, setDraft] = React.useState<DeliveryRecipient>({
    ...DLV_EMPTY_RECIP,
    country: 'CA',
  });
  const [errors, setErrors] = React.useState<DeliveryErrors>({});
  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
  const [returnOn, setReturnOn] = React.useState(true);
  const [sender, setSender] = React.useState<DeliveryRecipient>({
    ...DLV_EMPTY_RECIP,
    country: 'CA',
  });
  const [when, setWhen] = React.useState<DeliveryWhen>('now');
  const [date, setDate] = React.useState('');
  const [shipping, setShipping] = React.useState('standard');
  const [song, setSong] = React.useState(false);
  const cardDraftId = searchParams.get('draftId');
  const requestedAssetId = searchParams.get('assetId');
  const [generatedAssets, setGeneratedAssets] = React.useState<CardDraftAsset[]>([]);
  const [selectedImageAssetId, setSelectedImageAssetId] = React.useState<string | null>(requestedAssetId);
  const [messageText, setMessageText] = React.useState('');
  const [backendAction, setBackendAction] = React.useState<BackendAction>('idle');
  const [backendError, setBackendError] = React.useState<string | null>(null);
  const assetType = (asset: CardDraftAsset) => String(asset.assetType || asset.asset_type);
  const songAsset = generatedAssets.find((asset) => assetType(asset) === 'song') || null;
  const messageAsset = generatedAssets.find((asset) => assetType(asset) === 'message') || null;
  const songIncluded = Boolean(songAsset);
  const blankGiftCount: number = 0;
  const [giftReminderDismissed, setGiftReminderDismissed] = React.useState(false);
  const [giftModalOpen, setGiftModalOpen] = React.useState(false);
  const [cardTopUpOpen, setCardTopUpOpen] = React.useState(false);
  const [giftRecipientName, setGiftRecipientName] = React.useState('');
  const [giftRecipientContact, setGiftRecipientContact] = React.useState('');

  const cardsNeeded = mode === 'single' ? quantity : Math.max(recipients.length, 0);
  const hasBackendOrderInputs = Boolean(cardDraftId && selectedImageAssetId);
  const enough = hasBackendOrderInputs && cardsNeeded > 0;
  const needsCardTopUp = false;
  const backendBusy = backendAction !== 'idle';
  React.useEffect(() => {
    if (!cardDraftId) {
      setGeneratedAssets([]);
      setSelectedImageAssetId(null);
      setBackendError('Open Delivery from an approved card in Review or Saved Cards & Songs.');
      return;
    }

    let active = true;
    setBackendAction('loading_assets');
    setBackendError(null);

    setGeneratedAssets([]);
    setSelectedImageAssetId(null);

    Promise.all([fetchCardDraftById(cardDraftId), fetchCardDraftAssets(cardDraftId)])
      .then(([cardDraft, assets]) => {
        if (!active) return;
        if (cardDraft.status !== 'approved') {
          throw new Error('This card has not been approved. Go back to Review and approve the selected outputs first.');
        }

        const approvedIds = new Set(
          [cardDraft.approvedImageAssetId, cardDraft.approvedSongAssetId, cardDraft.approvedMessageAssetId].filter(
            (assetId): assetId is string => Boolean(assetId),
          ),
        );
        const approvedAssets = assets.filter((asset) => approvedIds.has(asset.id));
        const approvedImage = approvedAssets.find(
          (asset) => asset.id === cardDraft.approvedImageAssetId && assetType(asset) === 'image',
        );
        const approvedMessage = approvedAssets.find(
          (asset) => asset.id === cardDraft.approvedMessageAssetId && assetType(asset) === 'message',
        );

        if (!approvedImage || !approvedMessage) {
          throw new Error('The approved card outputs are unavailable. Go back to Review and try approval again.');
        }
        if (requestedAssetId && requestedAssetId !== approvedImage.id) {
          throw new Error('The requested image is not the approved image for this card.');
        }

        setGeneratedAssets(approvedAssets);
        setSelectedImageAssetId(approvedImage.id);
      })
      .catch((error) => {
        if (!active) return;
        setBackendError(
          error instanceof Error ? error.message : 'Generated assets could not be loaded from the backend.',
        );
      })
      .finally(() => {
        if (active) setBackendAction('idle');
      });

    return () => {
      active = false;
    };
  }, [cardDraftId, requestedAssetId]);

  React.useEffect(() => {
    if (!messageAsset?.id) {
      setMessageText('');
      return;
    }
    let active = true;
    fetch(assetContentUrl(messageAsset.id), { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => (response.ok ? response.text() : ''))
      .then((text) => {
        if (active) setMessageText(text.trim());
      })
      .catch(() => {
        if (active) setMessageText('');
      });
    return () => {
      active = false;
    };
  }, [messageAsset?.id]);

  function validateDeliveryInputs() {
    if (!cardDraftId || !selectedImageAssetId) {
      const message =
        'Review a generated card first so Delivery can use the real card draft and generated image asset.';
      setBackendError(message);
      bmcError(message, 'Generated card needed');
      return false;
    }

    if (mode === 'single') {
      const nextErrors = dlvValidate(draft);
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        bmcError(
          "Fill in the recipient's required address fields - name, street, city, province and postal code - before sending. We can't mail a card without a complete, deliverable address.",
          'Address needed',
        );
        return false;
      }
    } else if (recipients.length === 0) {
      bmcError(
        'Add at least one recipient address before sending. Fill in the required fields and tap Add recipient.',
        'Address needed',
      );
      return false;
    }

    return true;
  }

  function showCheckoutPlaceholder() {
    const message = 'Checkout is coming soon. No payment, order, credit, or fulfillment action was performed.';
    setBackendError(message);
    bmcError(message, 'Coming soon');
  }

  function handlePrimaryAction() {
    handleSend();
  }

  function handleSend() {
    if (needsCardTopUp) {
      setCardTopUpOpen(true);
      return;
    }

    if (!validateDeliveryInputs()) return;

    if (blankGiftCount > 0) {
      setGiftModalOpen(true);
      return;
    }

    showCheckoutPlaceholder();
  }

  function keepGiftForLaterAndSend() {
    setGiftModalOpen(false);
    setGiftReminderDismissed(true);
    showCheckoutPlaceholder();
  }

  function saveGiftRecipientAndSend() {
    setGiftModalOpen(false);
    setGiftReminderDismissed(true);
    showCheckoutPlaceholder();
  }

  function reserveCardsForDelivery(quantity: number) {
    addPricingCartItemToCart(makeBigSenderCartItem(quantity));
    rememberPricingReturn('/delivery');
    setCardTopUpOpen(false);
    router.push('/cart');
  }

  const primaryActionLabel = (() => {
    if (backendAction === 'loading_assets') return 'Loading assets...';
    if (backendAction !== 'idle') return 'Checking card...';
    return 'Checkout coming soon';
  })();

  const backendStatus = 'Checkout coming soon';

  return (
    <>
      <Navbar
        loggedIn={auth.status === 'authenticated'}
        user={displayUser}
        credits={{ images: 0, songs: 0 }}
        cardBank={0}
        cartCount={0}
      />

      <div className="bmc-shell" data-screen-label="06 Delivery">
        <div className="bmc-head" style={{ textAlign: 'center', margin: '0 auto 40px', maxWidth: 780 }}>
          <div className="bmc-eyebrow" style={{ justifyContent: 'center', whiteSpace: 'nowrap' }}>
            <span className="bmc-eyebrow-num">07</span>
            <span>Delivery</span>
          </div>
          <h1 className="bmc-title">
            A card <span className="souv-hero-italic text-metallic-rose-gold">worth sending</span>
          </h1>
          <p className="bmc-lede" style={{ margin: '0 auto' }}>
            Preview the approved card and enter synthetic delivery details for testing. Nothing has been printed,
            mailed, ordered, or charged; checkout and fulfillment are disabled in this beta.
          </p>
        </div>

        {blankGiftCount > 0 && !giftReminderDismissed && (
          <div className="dlv-gift-reminder" role="status">
            <span className="dlv-gift-reminder-ico">
              <BmcIcon name="spark2" w={18} />
            </span>
            <div>
              <div className="dlv-gift-reminder-title">You have a blank Souvenote to give</div>
              <p>
                We&apos;ll remind you when you send this card. You have {blankGiftCount}{' '}
                {blankGiftCount === 1 ? 'blank gift' : 'blank gifts'} ready.
              </p>
            </div>
            <button type="button" className="dlv-gift-reminder-dismiss" onClick={() => setGiftReminderDismissed(true)}>
              Dismiss
            </button>
          </div>
        )}

        <div className="dlv-grid">
          <div className="dlv-keepsake-col">
            <DlvKeepsake
              song={song}
              songIncluded={songIncluded}
              imageUrl={selectedImageAssetId ? assetContentUrl(selectedImageAssetId) : undefined}
              songUrl={songAsset?.id ? assetContentUrl(songAsset.id) : undefined}
              messageText={messageText}
              onPlaySong={() => setSong((current) => !current)}
            />
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
              {backendStatus}
            </span>
            <span className={`dlv-cost-sub ${!enough ? 'is-low' : ''}`}>
              {backendError ? (
                backendError
              ) : enough ? (
                <>
                  Draft {cardDraftId?.slice(0, 8)} {'\u00b7'} image asset {selectedImageAssetId?.slice(0, 8)}
                </>
              ) : (
                <>Go back to Review so Delivery can use a generated backend image asset.</>
              )}
            </span>
          </div>
          <div className="dlv-actionbar-right">
            <Link
              href={
                cardDraftId
                  ? `/create/build-my-card?draftId=${encodeURIComponent(cardDraftId)}#review`
                  : '/create/build-my-card#review'
              }
              className="bmc-cta-secondary"
            >
              <BmcIcon name="back" w={14} /> Back to review
            </Link>
            <button type="button" className="bmc-cta bmc-cta-lg" onClick={handlePrimaryAction} disabled={backendBusy}>
              {primaryActionLabel} <BmcIcon name="arrow" w={16} />
            </button>
          </div>
        </div>
      </div>

      <Footer />

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
      <DlvCardTopUpModal
        open={cardTopUpOpen}
        onClose={() => setCardTopUpOpen(false)}
        onReserve={reserveCardsForDelivery}
      />
      <BmcErrorModal />
    </>
  );
}

export { DeliveryApp };
