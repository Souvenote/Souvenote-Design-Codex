'use client';

import { createPortal } from 'react-dom';

type BmcReviewConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  includeSong?: boolean;
};

export function BmcReviewConfirmModal({ open, onClose, onConfirm, includeSong = true }: BmcReviewConfirmModalProps) {
  if (!open) return null;
  const generationCost = includeSong ? 2 : 1;
  const modal = (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" data-screen-label="07 Modal · Start From Scratch">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal">
        <h2 className="bmc-modal-title">
          <span className="text-metallic-rose-gold">Are </span>
          <span className="souv-hero-italic text-metallic-rose-gold">you sure?</span>
        </h2>
        <p className="bmc-modal-sub">
          Starting from scratch will cost another{' '}
          <b className="text-metallic-gold">
            {generationCost} {generationCost === 1 ? 'credit' : 'credits'}
          </b>{' '}
          when you can edit
          {includeSong ? ' just the image or QR song' : ' the image'} for <b className="text-metallic-gold">1 credit</b>
          .
        </p>
        <div className="bmc-modal-acts">
          <button type="button" className="bmc-cta-secondary" onClick={onClose}>
            Keep editing
          </button>
          <button type="button" className="bmc-cta" onClick={onConfirm}>
            Yes, start over
          </button>
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(modal, document.body);
}
