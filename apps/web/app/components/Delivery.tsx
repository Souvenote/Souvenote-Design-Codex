'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { BmcIcon, BmcErrorModal, bmcError } from './BmcShared';
import { DlvKeepsake } from './DeliveryKeepsake';
import { assetContentUrl, createPhysicalOrder, startPhysicalCheckout } from '../lib/api';
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
import { RetrySafeIdempotencyKeys } from '../lib/retrySafeIdempotency';
import {
  addPricingCartItemToCart,
  BIG_SENDER_TIERS,
  clampBigSenderQuantity,
  getBigSenderPricing,
  makeBigSenderCartItem,
  MAX_BIG_SENDER_CARDS,
  MIN_BIG_SENDER_CARDS,
} from './pricingCatalog';
import { DeliveryCheckoutSection } from './DeliveryCheckoutSection';
import {
  deliveryOfferStatus,
  selectDeliveryOffer,
  toCanadianPostalAddress,
  type FulfillmentVariant,
} from './deliveryCheckout';
import { useDeliveryBackendData } from './useDeliveryBackendData';

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
  const checkoutKeys = React.useRef(new RetrySafeIdempotencyKeys());
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
  const backend = useDeliveryBackendData(cardDraftId, requestedAssetId);
  const { messageText, pricingOffers, selectedImageAssetId, songAsset } = backend;
  const [fulfillmentVariant, setFulfillmentVariant] = React.useState<FulfillmentVariant>('personalized');
  const [checkoutBusy, setCheckoutBusy] = React.useState(false);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);
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
  const backendBusy = backend.loading || checkoutBusy;
  const backendError = checkoutError ?? backend.error;

  function validateDeliveryInputs() {
    if (!cardDraftId || !selectedImageAssetId) {
      const message =
        'Review a generated card first so Delivery can use the real card draft and generated image asset.';
      setCheckoutError(message);
      bmcError(message, 'Generated card needed');
      return false;
    }

    if (mode === 'multiple') {
      bmcError(
        'The deterministic Section 5 provider contract accepts one Canadian delivery address per order. Choose One recipient; multi-address batching will remain disabled until its address-array contract is implemented.',
        'Multi-address checkout unavailable',
      );
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
    }

    if (draft.country !== 'CA') {
      bmcError('Section 5 checkout is Canada-first. Enter a Canadian recipient address.', 'Canadian address needed');
      return false;
    }

    if (!returnOn) {
      bmcError(
        'Turn on Return address and enter the Canadian sender address required by fulfillment.',
        'Return address needed',
      );
      return false;
    }

    const senderErrors = dlvValidate(sender);
    if (Object.keys(senderErrors).length || sender.country !== 'CA') {
      bmcError(
        'Fill in the complete Canadian return address before checkout: name, street, city, province, and postal code.',
        'Return address needed',
      );
      return false;
    }

    if (cardsNeeded > MAX_BIG_SENDER_CARDS) {
      bmcError('Section 5 supports a maximum of 30 physical cards per checkout.', 'Quantity too high');
      return false;
    }

    if (when === 'schedule') {
      bmcError(
        'Scheduled fulfillment is not represented by the Section 5 provider contract. Choose Send now for deterministic test checkout.',
        'Scheduling unavailable',
      );
      return false;
    }

    return true;
  }

  async function handleSend() {
    if (needsCardTopUp) {
      setCardTopUpOpen(true);
      return;
    }

    if (!validateDeliveryInputs()) return;

    if (auth.status !== 'authenticated') {
      bmcError('Log in before creating an order and starting checkout.', 'Authentication required');
      return;
    }

    const selectedOffer = selectDeliveryOffer(pricingOffers, cardsNeeded);
    if (!selectedOffer) {
      bmcError('No active server-owned CAD offer matches this quantity.', 'Price unavailable');
      return;
    }
    if (fulfillmentVariant === 'blank_handoff' && (cardsNeeded !== 1 || selectedOffer.type !== 'try_risk_free')) {
      bmcError('Blank-card handoff requires a one-card Try Risk-Free checkout.', 'Blank handoff unavailable');
      return;
    }

    setCheckoutBusy(true);
    setCheckoutError(null);
    const orderInput = {
      cardDraftId: cardDraftId!,
      selectedAssetId: selectedImageAssetId!,
      offerId: selectedOffer.offerId,
      quantity: cardsNeeded,
      recipientAddress: toCanadianPostalAddress(draft),
      senderAddress: toCanadianPostalAddress(sender),
    };
    const orderSignature = JSON.stringify(orderInput);
    const orderKey = checkoutKeys.current.keyFor(orderSignature, 'physical-order');
    try {
      const order = await createPhysicalOrder(orderInput, orderKey);
      const session = await startPhysicalCheckout(order.id);
      checkoutKeys.current.complete(orderSignature, orderKey);
      const checkoutUrl = session.checkoutUrl || `/checkout/test/${session.id}`;
      router.push(fulfillmentVariant === 'blank_handoff' ? `${checkoutUrl}?variant=blank_handoff` : checkoutUrl);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Checkout could not be started.';
      setCheckoutError(message);
      bmcError(message, 'Checkout unavailable');
      setCheckoutBusy(false);
    }
  }

  function keepGiftForLaterAndSend() {
    setGiftModalOpen(false);
    setGiftReminderDismissed(true);
    void handleSend();
  }

  function saveGiftRecipientAndSend() {
    setGiftModalOpen(false);
    setGiftReminderDismissed(true);
    void handleSend();
  }

  function reserveCardsForDelivery(quantity: number) {
    addPricingCartItemToCart(makeBigSenderCartItem(quantity));
    rememberPricingReturn('/delivery');
    setCardTopUpOpen(false);
    router.push('/cart');
  }

  const primaryActionLabel = (() => {
    if (backend.loading) return 'Loading assets...';
    if (checkoutBusy) return 'Starting checkout...';
    return 'Continue to test checkout';
  })();

  const matchingOffer = selectDeliveryOffer(pricingOffers, cardsNeeded);
  const backendStatus = deliveryOfferStatus(matchingOffer, cardsNeeded);

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
            Preview the approved card and enter synthetic Canadian delivery details. Section 5 records deterministic
            local checkout and fulfillment state; it makes no external payment, print, mail, or email call.
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
            <DeliveryCheckoutSection
              cardsNeeded={cardsNeeded}
              variant={fulfillmentVariant}
              onVariantChange={setFulfillmentVariant}
            />
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
            <button
              type="button"
              className="bmc-cta bmc-cta-lg"
              onClick={() => void handleSend()}
              disabled={backendBusy}
            >
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
