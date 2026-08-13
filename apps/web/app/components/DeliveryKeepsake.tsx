import { BmcIcon } from './BmcShared';

type DlvKeepsakeProps = {
  song?: boolean;
  songIncluded?: boolean;
  imageUrl?: string;
  songUrl?: string;
  messageText?: string;
  onPlaySong?: () => void;
};

function DlvKeepsake({
  song = false,
  songIncluded = true,
  imageUrl,
  songUrl,
  messageText,
  onPlaySong,
}: DlvKeepsakeProps) {
  return (
    <div className="bmc-card dlv-keepsake">
      <div className="dlv-keepsake-eyebrow">
        <span className="dlv-diamond" />
        <span>Your keepsake is approved</span>
      </div>

      <div className="dlv-art">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Approved deterministic beta mock card"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <>
            <span className="dlv-art-stamp" />
            <span className="dlv-art-stamp is-bl" />
            <div className="dlv-art-glyph">
              To the moon
              <br />
              and back
            </div>
            <div className="dlv-art-fig" />
          </>
        )}
      </div>

      <div className="dlv-pieces">
        <div className="dlv-piece">
          <span className="dlv-piece-ico">
            <BmcIcon name="image" w={17} />
          </span>
          <div>
            <div className="dlv-piece-name">Front card</div>
            <div className="dlv-piece-meta">5x7 portrait · deterministic beta preview</div>
          </div>
          <span className="dlv-piece-check">
            <BmcIcon name="check" w={18} />
          </span>
        </div>

        {songIncluded && (
          <div className="dlv-piece">
            <span className="dlv-piece-ico">
              <BmcIcon name="note" w={17} />
            </span>
            <div>
              <div className="dlv-piece-name">QR-code song</div>
              <div className="dlv-piece-meta">Slow R&amp;B Ballad · QR on card</div>
            </div>
            <button type="button" className="dlv-piece-fab" onClick={onPlaySong} aria-label="Preview song">
              <BmcIcon name={song ? 'pause' : 'play'} w={15} />
            </button>
            {songUrl ? (
              <audio controls preload="metadata" src={songUrl} style={{ width: '100%', marginTop: 8 }} />
            ) : null}
          </div>
        )}

        <div className="dlv-piece">
          <span className="dlv-piece-ico">
            <BmcIcon name="message" w={17} />
          </span>
          <div>
            <div className="dlv-piece-name">Inside message</div>
            <div className="dlv-piece-meta">Handwriting preview · not fulfilled</div>
          </div>
          <span className="dlv-piece-check">
            <BmcIcon name="check" w={18} />
          </span>
        </div>
      </div>

      <div className="dlv-hand">
        <div className="dlv-hand-label">Approved inside-message preview</div>
        <div className="dlv-hand-body">
          {messageText || 'The approved deterministic beta message will appear here.'}
        </div>
      </div>

      <div className="dlv-ships">
        <span className="dlv-ship-tag">
          <CheckMini /> Planned folded 5x7 format
        </span>
        <span className="dlv-ship-tag">
          <CheckMini /> Planned envelope
        </span>
        <span className="dlv-ship-tag">
          <CheckMini /> Handwriting simulation
        </span>
        {songIncluded && (
          <span className="dlv-ship-tag">
            <CheckMini /> Song QR printed inside
          </span>
        )}
      </div>
    </div>
  );
}

function CheckMini() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5l4 4 10-10" />
    </svg>
  );
}

export { DlvKeepsake };
