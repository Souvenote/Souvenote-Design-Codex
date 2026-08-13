'use client';

import * as React from 'react';
import { BmcIcon } from './BmcShared';

type BmcReviewMessageProps = {
  approved: boolean;
  onApprove: () => void;
  onRegenerate?: (creativeDirection?: string) => boolean | Promise<boolean>;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  generating: boolean;
  messageText?: string;
};

const FALLBACK_MESSAGE = `Mom — for every quiet morning that turned out to mean everything, thank you. I love you to the moon and back, every single day. — Cameron`;

function Status({ generating, approved }: { generating: boolean; approved: boolean }) {
  const className = generating ? 'is-working' : approved ? 'is-approved' : 'is-ready';
  return (
    <div className={`bmc-panel-status ${className}`}>
      {generating ? <span className="bmc-panel-status-spin" /> : <span className="bmc-panel-status-dot" />}
      {generating ? 'Generating…' : approved ? 'Approved' : 'Ready'}
    </div>
  );
}

export function BmcReviewMessage({
  approved,
  onApprove,
  onRegenerate,
  editing,
  setEditing,
  generating,
  messageText,
}: BmcReviewMessageProps) {
  const displayedMessage = messageText || FALLBACK_MESSAGE;
  const [messageDirection, setMessageDirection] = React.useState(displayedMessage);

  React.useEffect(() => setMessageDirection(displayedMessage), [displayedMessage]);

  return (
    <div className="bmc-panel">
      <div className="bmc-panel-head">
        <div className="bmc-panel-title">Inside message</div>
        <Status generating={generating} approved={approved} />
      </div>

      {editing ? (
        <>
          <label className="bmc-label">Edit message</label>
          <textarea
            className="bmc-textarea"
            value={messageDirection}
            onChange={(event) => setMessageDirection(event.target.value)}
            style={{ minHeight: 180 }}
          />
          <p className="bmc-help" style={{ marginTop: 8 }}>
            Message edits and regenerations are always{' '}
            <b style={{ color: 'var(--gold-hi)', fontStyle: 'normal', marginLeft: 3 }}>free</b>.
          </p>
          <div className="bmc-panel-acts" style={{ marginTop: 14, marginBottom: 0 }}>
            <button
              type="button"
              className="bmc-cta-secondary"
              onClick={() => void onRegenerate?.(messageDirection.trim())}
              disabled={generating || !messageDirection.trim()}
            >
              <BmcIcon name="refresh" w={14} /> Regenerate Message
            </button>
          </div>
        </>
      ) : (
        <div className="bmc-msg-single">{displayedMessage}</div>
      )}

      <div className="bmc-panel-acts">
        <button type="button" className="bmc-cta" onClick={onApprove} disabled={approved || generating}>
          <BmcIcon name="check" w={14} /> {generating ? 'Generating…' : approved ? 'Approved' : 'Approve Message'}
        </button>
        <button type="button" className="bmc-cta-secondary" onClick={() => setEditing(!editing)}>
          <BmcIcon name="edit" w={14} /> {editing ? 'Close' : 'Edit'}
        </button>
      </div>
    </div>
  );
}
