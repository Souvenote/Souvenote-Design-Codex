'use client';

import type { FulfillmentVariant } from './deliveryCheckout';

type DeliveryCheckoutSectionProps = {
  cardsNeeded: number;
  variant: FulfillmentVariant;
  onVariantChange: (variant: FulfillmentVariant) => void;
};

export function DeliveryCheckoutSection({ cardsNeeded, variant, onVariantChange }: DeliveryCheckoutSectionProps) {
  return (
    <div className="bmc-card dlv-section">
      <div className="dlv-section-title">
        <span className="dlv-section-num">5</span> Fulfillment variant
      </div>
      <div className="bmc-chip-row" style={{ marginTop: 18 }}>
        <button
          type="button"
          className={`bmc-chip ${variant === 'personalized' ? 'is-active' : ''}`}
          onClick={() => onVariantChange('personalized')}
        >
          Personalized card
        </button>
        <button
          type="button"
          className={`bmc-chip ${variant === 'blank_handoff' ? 'is-active' : ''}`}
          disabled={cardsNeeded !== 1}
          onClick={() => onVariantChange('blank_handoff')}
        >
          Blank-card handoff
        </button>
      </div>
      <p className="bmc-help" style={{ margin: '14px 0 0' }}>
        Blank-card handoff consumes the one-card entitlement and remains a local/test-only feature until the final
        Scribeless blank payload is approved.
      </p>
    </div>
  );
}
