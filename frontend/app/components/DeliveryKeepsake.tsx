import { BmcIcon } from "./BmcShared";

type DlvKeepsakeProps = {
  song?: boolean;
  songIncluded?: boolean;
  onPlaySong?: () => void;
};

function DlvKeepsake({ song = false, songIncluded = true, onPlaySong }: DlvKeepsakeProps) {
  return (
    <div className="bmc-card dlv-keepsake">
      <div className="dlv-keepsake-eyebrow">
        <span className="dlv-diamond" />
        <span>Your keepsake is approved</span>
      </div>

      <div className="dlv-art">
        <span className="dlv-art-stamp" />
        <span className="dlv-art-stamp is-bl" />
        <div className="dlv-art-glyph">To the moon<br />and back</div>
        <div className="dlv-art-fig" />
      </div>

      <div className="dlv-pieces">
        <div className="dlv-piece">
          <span className="dlv-piece-ico"><BmcIcon name="image" w={17} /></span>
          <div>
            <div className="dlv-piece-name">Front card</div>
            <div className="dlv-piece-meta">5x7 portrait · Cinematic · printed</div>
          </div>
          <span className="dlv-piece-check"><BmcIcon name="check" w={18} /></span>
        </div>

        {songIncluded && (
        <div className="dlv-piece">
          <span className="dlv-piece-ico"><BmcIcon name="note" w={17} /></span>
          <div>
            <div className="dlv-piece-name">QR-code song</div>
            <div className="dlv-piece-meta">Slow R&amp;B Ballad · QR on card</div>
          </div>
          <button type="button" className="dlv-piece-fab" onClick={onPlaySong} aria-label="Preview song">
            <BmcIcon name={song ? "pause" : "play"} w={15} />
          </button>
        </div>
        )}

        <div className="dlv-piece">
          <span className="dlv-piece-ico"><BmcIcon name="message" w={17} /></span>
          <div>
            <div className="dlv-piece-name">Inside message</div>
            <div className="dlv-piece-meta">Hand-written by our studio</div>
          </div>
          <span className="dlv-piece-check"><BmcIcon name="check" w={18} /></span>
        </div>
      </div>

      <div className="dlv-hand">
        <div className="dlv-hand-label">Written inside, by hand</div>
        <div className="dlv-hand-body">{`Mom - for every quiet morning that
turned out to mean everything, thank you.
I love you to the moon and back.
- Cameron`}</div>
      </div>

      <div className="dlv-ships">
        <span className="dlv-ship-tag"><CheckMini /> Folded 5x7 card</span>
        <span className="dlv-ship-tag"><CheckMini /> Envelope included</span>
        <span className="dlv-ship-tag"><CheckMini /> Realistic handwriting</span>
        {songIncluded && <span className="dlv-ship-tag"><CheckMini /> Song QR printed inside</span>}
      </div>
    </div>
  );
}

function CheckMini() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4 4 10-10" />
    </svg>
  );
}

export { DlvKeepsake };
