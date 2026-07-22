'use client';

import * as React from 'react';
import Link from 'next/link';
import { CardArt } from './CardArt';
import { AuthGatePrompt } from './AuthGatePrompt';
import { useAuth } from './AuthProvider';
import { makeBigSenderCartItem, makeTryRiskFreeCartItem } from './pricingCatalog';

type CartItem = {
  id: string;
  type: string;
  name: string;
  meta?: string;
  sub?: string;
  qty: number;
  price: number;
  unitNote?: string;
  palette?: string;
  glyph?: string;
  glowIdx?: number;
  lockedQuantity?: boolean;
  cardCount?: number;
  creditsPerCard?: unknown;
  replaceGroup?: string;
  cards?: unknown;
  tokens?: unknown;
};

type CartThumbProps = {
  item: CartItem;
};

type CartItemKind = 'card' | 'pack' | 'credits' | 'item';

type CartItemPresentation = {
  kind: CartItemKind;
  label: string;
  icon: CartIconName;
};

type CartIconName =
  'minus' | 'plus' | 'close' | 'trash' | 'lock' | 'arrow' | 'cart' | 'tag' | 'truck' | 'card' | 'cards' | 'coin';

type CartIcoProps = {
  name: CartIconName;
  w?: number;
};

type CartLineProps = {
  item: CartItem;
  onQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
};

const CART_SEED: CartItem[] = [];
const CART_KEY = 'souv_cart';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function normalizeCartItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return CART_SEED;
  const next: CartItem[] = [];

  raw.forEach((item, index) => {
    if (!isRecord(item)) return;

    const source = item as Partial<CartItem>;
    const sourceId = String(source.id || '').toLowerCase();
    const sourceType = String(source.type || '').toLowerCase();
    if (sourceType === 'gift' || sourceId.includes('blank-souvenote')) return;
    const isBigSender = source.id === 'pack-bigsender' || source.replaceGroup === 'pack-bigsender';
    const isTryRiskFree = source.id === 'pack-try-risk-free' || source.replaceGroup === 'pack-try-risk-free';
    const normalized: CartItem = isBigSender
      ? makeBigSenderCartItem(source.cardCount || parseInt(String(source.meta || ''), 10) || source.qty || 1)
      : isTryRiskFree
        ? makeTryRiskFreeCartItem({
            creditsPerCard: Number(source.creditsPerCard) || undefined,
          })
        : {
            ...source,
            id: source.id || `cart-item-${index}`,
            type: source.type || 'cart',
            name: source.name || 'Cart item',
            qty: Math.max(1, Math.floor(Number(source.qty) || 1)),
            price: Number(source.price) || 0,
          };

    const existing = next.find((candidate) => candidate.id === normalized.id);
    if (existing) {
      if (normalized.id === 'pack-bigsender' || normalized.id === 'pack-try-risk-free') {
        Object.assign(existing, normalized);
      } else {
        existing.qty += normalized.qty;
      }
    } else {
      next.push(normalized);
    }
  });

  return next;
}

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return CART_SEED;

  try {
    return normalizeCartItems(JSON.parse(window.localStorage.getItem(CART_KEY) || 'null') || CART_SEED);
  } catch {
    return CART_SEED;
  }
}

function cartMoney(n: number) {
  return '$' + n.toFixed(2);
}

function getCartItemPresentation(item: CartItem): CartItemPresentation {
  const type = String(item.type || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();

  if (type === 'credits' || name.includes('credit') || item.tokens != null) {
    return { kind: 'credits', label: 'Creation credits', icon: 'coin' };
  }

  if (type === 'card') {
    return { kind: 'card', label: 'Saved card', icon: 'card' };
  }

  if (type === 'pack' || item.cardCount != null || item.cards != null) {
    return { kind: 'pack', label: 'Card pack', icon: 'cards' };
  }

  return { kind: 'item', label: 'Cart item', icon: 'cart' };
}

function CartThumb({ item }: CartThumbProps) {
  const presentation = getCartItemPresentation(item);

  if (presentation.kind === 'card') {
    return (
      <div className="cart-thumb cart-thumb-card cart-thumb-kind-card">
        <CardArt palette={item.palette} glyph={item.glyph} glowIdx={item.glowIdx} corners figure />
        <span className="cart-thumb-badge" aria-label={presentation.label}>
          <CartIco name={presentation.icon} w={14} />
        </span>
      </div>
    );
  }

  if (presentation.kind === 'pack') {
    return (
      <div className="cart-thumb cart-thumb-pack cart-thumb-kind-pack">
        <span className="cart-pack-card c3" />
        <span className="cart-pack-card c2" />
        <span className="cart-pack-card c1" />
        <span className="cart-thumb-badge" aria-label={presentation.label}>
          <CartIco name={presentation.icon} w={14} />
        </span>
      </div>
    );
  }

  return (
    <div className={`cart-thumb cart-thumb-token cart-thumb-kind-${presentation.kind}`}>
      <div className="cart-token">
        <CartIco name={presentation.icon} w={28} />
      </div>
      <span className="cart-thumb-badge" aria-label={presentation.label}>
        <CartIco name={presentation.icon} w={14} />
      </span>
    </div>
  );
}

function CartIco({ name, w = 16 }: CartIcoProps) {
  const path = {
    minus: <path d="M5 12h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    trash: (
      <>
        <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    cart: (
      <>
        <path d="M3 5h2.4l2.3 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 1.96-1.6L21 9H6" />
        <circle cx="10" cy="21" r="1.2" />
        <circle cx="17" cy="21" r="1.2" />
      </>
    ),
    tag: (
      <>
        <path d="M3 11.5V4a1 1 0 0 1 1-1h7.5L21 12.5 12.5 21 3 11.5z" />
        <circle cx="7.5" cy="7.5" r="1.3" />
      </>
    ),
    truck: (
      <>
        <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" />
        <circle cx="7" cy="18" r="1.6" />
        <circle cx="17" cy="18" r="1.6" />
      </>
    ),
    card: (
      <>
        <rect x="5" y="3.5" width="14" height="17" rx="2" />
        <path d="M8.5 7.5h7M8.5 11h7M8.5 14.5h4" />
      </>
    ),
    cards: (
      <>
        <rect x="7" y="4" width="12" height="16" rx="2" />
        <path d="M5 7.5h-.5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2H13" />
        <path d="M10 8h6M10 11.5h6M10 15h3.5" />
      </>
    ),
    coin: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v9M8.75 10.25c0-1.5 1.45-2.35 3.25-2.35s3.25.85 3.25 2.35c0 3-6.5 1.35-6.5 4.15 0 1.45 1.45 2.2 3.25 2.2s3.25-.75 3.25-2.2" />
      </>
    ),
  }[name];

  return (
    <svg
      viewBox="0 0 24 24"
      width={w}
      height={w}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

function CartLine({ item, onQty, onRemove }: CartLineProps) {
  const presentation = getCartItemPresentation(item);
  const lockedQuantity = item.lockedQuantity;
  const lockedLabel = item.cardCount
    ? `${item.cardCount} ${item.cardCount === 1 ? 'card' : 'cards'}`
    : `${item.qty} ${item.qty === 1 ? 'item' : 'items'}`;

  return (
    <div className="cart-line">
      <CartThumb item={item} />
      <div className="cart-line-main">
        <div className={`cart-line-kind cart-line-kind-${presentation.kind}`}>
          <CartIco name={presentation.icon} w={13} />
          <span>{presentation.label}</span>
        </div>
        <div className="cart-line-name">{item.name}</div>
        <div className="cart-line-meta">{item.meta}</div>
        {item.sub && <div className="cart-line-sub">{item.sub}</div>}
        <button type="button" className="cart-line-remove" onClick={() => onRemove(item.id)}>
          <CartIco name="trash" w={14} /> Remove
        </button>
      </div>
      <div className="cart-line-right">
        {lockedQuantity ? (
          <div className="cart-qty cart-qty-locked" aria-label={`${lockedLabel} selected`}>
            <span className="cart-qty-num">{item.cardCount || item.qty}</span>
            <span className="cart-qty-label">{item.cardCount === 1 ? 'card' : 'cards'}</span>
          </div>
        ) : (
          <div className="cart-qty" role="group" aria-label={`Quantity of ${item.name}`}>
            <button
              type="button"
              className="cart-qty-btn"
              onClick={() => onQty(item.id, -1)}
              disabled={item.qty <= 1}
              aria-label="Decrease quantity"
            >
              <CartIco name="minus" w={15} />
            </button>
            <span className="cart-qty-num">{item.qty}</span>
            <button
              type="button"
              className="cart-qty-btn"
              onClick={() => onQty(item.id, 1)}
              aria-label="Increase quantity"
            >
              <CartIco name="plus" w={15} />
            </button>
          </div>
        )}
        <div className="cart-line-price">{cartMoney(item.price * item.qty)}</div>
        <div className="cart-line-unit">
          {cartMoney(item.price)} {'\u00b7'} {item.unitNote}
        </div>
      </div>
    </div>
  );
}

function CartEmpty() {
  return (
    <div className="cart-empty">
      <div className="cart-empty-ico">
        <CartIco name="cart" w={34} />
      </div>
      <h2 className="cart-empty-h">Your cart is empty</h2>
      <p className="cart-empty-p">
        Nothing waiting to send just yet. Start a card or browse a template, and it&apos;ll land here.
      </p>
      <div className="cart-empty-cta">
        <Link href="/create/personalize-a-template" className="bmc-cta">
          Browse templates <CartIco name="arrow" w={15} />
        </Link>
        <Link href="/create/build-my-card" className="bmc-cta-secondary">
          Build my card
        </Link>
      </div>
    </div>
  );
}

function CartPaid() {
  const order = 'SV-' + Math.floor(100000 + Math.random() * 899999);

  return (
    <div className="cart-empty cart-paid">
      <div className="cart-empty-ico cart-paid-ico">
        <CartIco name="lock" w={30} />
      </div>
      <h2 className="cart-empty-h">Payment confirmed</h2>
      <p className="cart-empty-p">
        Thank you - your order <b style={{ color: 'var(--gold-hi)' }}>{order}</b> is in. A receipt is on its way to your
        inbox, and your cards, packs, and credits are now on your account.
      </p>
      <div className="cart-empty-cta">
        <Link href="/create/my-cards-and-songs" className="bmc-cta">
          Go to Saved Cards &amp; Songs <CartIco name="arrow" w={15} />
        </Link>
        <Link href="/create/personalize-a-template" className="bmc-cta-secondary">
          Keep browsing
        </Link>
      </div>
    </div>
  );
}

function CartPage() {
  const auth = useAuth();
  const [items, setItems] = React.useState<CartItem[]>(CART_SEED);
  const [hydrated, setHydrated] = React.useState(false);
  const [promo, setPromo] = React.useState('');
  const [promoApplied, setPromoApplied] = React.useState(false);
  const [authPromptOpen, setAuthPromptOpen] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  const isAuthenticated = auth.status === 'authenticated' && Boolean(auth.user?.id);

  React.useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(normalizeCartItems(items)));
    } catch {}
  }, [items, hydrated]);

  function onQty(id: string, delta: number) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item)),
    );
  }

  function onRemove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function applyPromo() {
    if (promo.trim().toUpperCase() === 'SOUVENOTE10') setPromoApplied(true);
  }

  function handleCheckoutClick() {
    if (!isAuthenticated) {
      setAuthPromptOpen(true);
      return;
    }

    window.alert('Checkout is coming soon. No payment or order has been created.');
  }

  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = promoApplied ? +(subtotal * 0.1).toFixed(2) : 0;
  const taxable = subtotal - discount;
  const tax = +(taxable * 0.05).toFixed(2);
  const total = +(taxable + tax).toFixed(2);

  return (
    <>
      <div className="bmc-shell" data-screen-label="Cart">
        <div className="bmc-head" style={{ marginBottom: 30, maxWidth: '100%' }}>
          <div className="bmc-eyebrow">
            <span>Account</span>
            <span className="dot" />
            Cart
          </div>
          <h1 className="bmc-title" style={{ margin: '6px 0 0' }}>
            Your <span className="souv-hero-italic text-metallic-gold">cart</span>
          </h1>
          {!confirmed && items.length > 0 && (
            <p className="bmc-lede" style={{ margin: '10px 0 0' }}>
              {count} {count === 1 ? 'item' : 'items'} ready to check out - cards, packs, and credits all in one go.
            </p>
          )}
        </div>

        {confirmed ? (
          <CartPaid />
        ) : items.length === 0 ? (
          <CartEmpty />
        ) : (
          <div className="cart-grid">
            <div className="cart-items">
              <div className="cart-items-head">
                <span>Item</span>
                <span>Qty {'\u00b7'} Price</span>
              </div>
              {items.map((item) => (
                <CartLine key={item.id} item={item} onQty={onQty} onRemove={onRemove} />
              ))}
              <Link href="/pricing" className="cart-continue">
                {'\u2190 Add more cards'}
              </Link>
            </div>

            <aside className="cart-summary-wrap">
              <div className="acc-panel cart-summary">
                <div className="acc-panel-title">Order summary</div>

                <div className="cart-sum-lines">
                  <div className="cart-sum-row">
                    <span className="k">Subtotal</span>
                    <span className="v">{cartMoney(subtotal)}</span>
                  </div>
                  <div className="cart-sum-row">
                    <span className="k">
                      <CartIco name="truck" w={14} /> Shipping
                    </span>
                    <span className="v is-included">Included</span>
                  </div>
                  {promoApplied && (
                    <div className="cart-sum-row">
                      <span className="k">Promo {'\u00b7'} SOUVENOTE10</span>
                      <span className="v is-discount">
                        {'\u2212'}
                        {cartMoney(discount)}
                      </span>
                    </div>
                  )}
                  <div className="cart-sum-row">
                    <span className="k">GST (5%)</span>
                    <span className="v">{cartMoney(tax)}</span>
                  </div>
                </div>

                <div className="cart-promo">
                  {promoApplied ? (
                    <div className="cart-promo-ok">
                      <CartIco name="tag" w={13} /> Code <b>SOUVENOTE10</b> applied {'\u00b7'} 10% off
                    </div>
                  ) : (
                    <div className="cart-promo-row">
                      <input
                        className="input-dark"
                        value={promo}
                        onChange={(event) => setPromo(event.target.value.toUpperCase())}
                        placeholder="Promo code"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') applyPromo();
                        }}
                      />
                      <button type="button" className="btn-matte cart-promo-apply" onClick={applyPromo}>
                        Apply
                      </button>
                    </div>
                  )}
                </div>

                <div className="cart-total">
                  <span className="cart-total-label">Total</span>
                  <span className="cart-total-val">
                    <span className="text-metallic-gold">{cartMoney(total)}</span>
                    <span className="cur">CAD</span>
                  </span>
                </div>

                <button type="button" className="bmc-cta cart-checkout" onClick={handleCheckoutClick}>
                  Proceed to checkout <CartIco name="arrow" w={15} />
                </button>
                <div className="cart-secure">
                  <CartIco name="lock" w={13} /> Secure checkout {'\u00b7'} payments by <b>Stripe</b>
                </div>
              </div>

              <p className="cart-foot">Shipping is always included.</p>
            </aside>
          </div>
        )}
      </div>
      <AuthGatePrompt
        open={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        returnTo="/cart"
        title="Log in before checkout"
        body="Sign up or log in to purchase cards and credits so everything is added to your account, not a temporary demo profile."
        primaryLabel="Sign up"
        secondaryLabel="Log in"
      />
    </>
  );
}

export { CartPage };
