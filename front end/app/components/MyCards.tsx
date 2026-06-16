"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { BmcIcon } from "./BmcShared";
import { CardArt } from "./CardArt";
import { useDemoBalance, ZERO_DEMO_BALANCE } from "./DemoBalance";
import { getCreateFlowGate } from "./createFlowRules";
import type { CreateGateRequirement } from "./createFlowRules";
import { goToPricingAfterPurchase } from "./PricingReturn";
import { useDemoLibrary } from "./DemoLibrary";
import { useBlankSouvenoteGiftCount } from "./GiftAddon";
import type { DemoUser } from "./DemoUser";

type MyCardsAppProps = {
  user: DemoUser;
  full?: boolean;
};

type McsDraft = {
  id: string;
  pal: string;
  title: string;
  flow: string;
  where: string;
  step: number;
  total: number;
  days: number;
  href: string;
};

type McsCard = {
  id: string;
  pal: string;
  glyph: string;
  song?: boolean;
  gift?: boolean;
  days: number;
  title: string;
  saved: string;
};

type McsSong = {
  id: string;
  name: string;
  voice: string;
  card: string;
  days: number;
};

type McsExpiryProps = {
  days: number;
};

type McsSectionHeadProps = {
  title: string;
  count?: number | null;
  link?: string | null;
};

type McsEmptyProps = {
  icon: React.ReactNode;
  title: string;
  sub: string;
  cta?: string;
  href?: string;
  onClick?: () => void;
};

type McsDraftRowProps = {
  d: McsDraft;
  onResume?: (href: string) => void;
};

type McsCardItemProps = {
  c: McsCard;
  onMail: (card: McsCard) => void;
};

type McsSongRowProps = {
  s: McsSong;
};

declare global {
  interface Window {
    __mcsSetMode?: (value: boolean) => void;
  }
}

function McsClock() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

function McsMail() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M4 6l8 6 8-6" /></svg>;
}

function McsDownload() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5" /><path d="M5 20h14" /></svg>;
}

const MCS_DRAFTS: McsDraft[] = [];
const MCS_CARDS: McsCard[] = [];
const MCS_SONGS: McsSong[] = [];
const MCS_BARS = [12, 18, 24, 16, 30, 22, 12, 26, 20, 28, 14, 24, 10, 22, 28, 16, 24, 12, 20, 26, 14, 22, 18, 28, 11, 20, 16, 24, 20, 12, 24, 28, 14, 20, 10, 24];

function McsExpiry({ days }: McsExpiryProps) {
  const soon = days <= 7;
  return <span className={`mcs-expiry ${soon ? "is-soon" : ""}`}><McsClock /> {days}d left</span>;
}

function McsSectionHead({ title, count, link }: McsSectionHeadProps) {
  return (
    <div className="mcs-section-head">
      <div className="mcs-section-title">{title}{count != null && <span className="mcs-section-count">{count}</span>}</div>
      <div className="mcs-section-rule" />
      {link && <button type="button" className="mcs-section-link">{link}</button>}
    </div>
  );
}

function McsEmpty({ icon, title, sub, cta, href, onClick }: McsEmptyProps) {
  const ctaContent = cta ? <>{cta} <BmcIcon name="arrow" w={15} /></> : null;

  return (
    <div className="mcs-empty">
      <span className="mcs-empty-ico">{icon}</span>
      <div className="mcs-empty-title">{title}</div>
      <div className="mcs-empty-sub">{sub}</div>
      {cta && onClick ? (
        <button type="button" className="bmc-cta" onClick={onClick}>{ctaContent}</button>
      ) : cta ? (
        <Link className="bmc-cta" href={href || "#"}>{ctaContent}</Link>
      ) : null}
    </div>
  );
}

function McsDraftRow({ d, onResume }: McsDraftRowProps) {
  return (
    <div className="mcs-draft">
      <div className="mcs-draft-thumb"><CardArt palette={d.pal} glyph="" figure corners={false} /></div>
      <div className="mcs-draft-info">
        <div className="mcs-draft-title">{d.title}</div>
        <div className="mcs-draft-where">{d.flow} {"\u00b7"} picked up at <b>{d.where}</b></div>
        <div className="mcs-draft-track">
          <span className="mcs-draft-bar"><i style={{ width: (d.step / d.total * 100) + "%" }} /></span>
          <span className="mcs-draft-step">Step {d.step} / {d.total}</span>
        </div>
      </div>
      <div className="mcs-draft-acts">
        <McsExpiry days={d.days} />
        <Link
          className="bmc-cta"
          href={d.href}
          onClick={(event) => {
            if (!onResume) return;
            event.preventDefault();
            onResume(d.href);
          }}
        >
          <BmcIcon name="arrow" w={15} /> Resume
        </Link>
      </div>
    </div>
  );
}

function McsCardItem({ c, onMail }: McsCardItemProps) {
  return (
    <div className="mcs-card">
      <div className="mcs-card-art">
        <div className="mcs-card-badges">
          {c.gift ? (
            <span className="mcs-card-songdot is-gift"><BmcIcon name="spark2" w={10} /> Gift</span>
          ) : c.song ? (
            <span className="mcs-card-songdot"><BmcIcon name="note" w={10} /> QR song</span>
          ) : <span />}
          <McsExpiry days={c.days} />
        </div>
        <CardArt palette={c.pal} glyph={c.glyph} glowIdx={c.id.charCodeAt(1)} />
      </div>
      <div className="mcs-card-body">
        <div className="mcs-card-title">{c.title}</div>
        <div className="mcs-card-date">Saved {c.saved}</div>
        <div className="mcs-card-acts">
          <button type="button" className="bmc-cta" onClick={() => onMail(c)}>
            {c.gift ? <BmcIcon name="spark2" w={14} /> : <McsMail />}
            {c.gift ? "Give this Souvenote" : "Mail this card"}
          </button>
          {!c.gift && <button type="button" className="mcs-iconbtn" title="Download"><McsDownload /></button>}
        </div>
      </div>
    </div>
  );
}

function McsSongRow({ s }: McsSongRowProps) {
  const [playing, setPlaying] = React.useState(false);

  return (
    <div className={`mcs-song ${playing ? "is-playing" : ""}`}>
      <button type="button" className="mcs-song-fab" onClick={() => setPlaying((current) => !current)} aria-label={playing ? "Pause" : "Play"}>
        <BmcIcon name={playing ? "pause" : "play"} w={19} />
      </button>
      <div className="mcs-song-info">
        <div className="mcs-song-name">{s.name}</div>
        <div className="mcs-song-sub">{s.voice} {"\u00b7"} {s.card === "Unattached" ? "Not on a card yet" : `On "${s.card}"`}</div>
        <div className="mcs-song-wave">
          {MCS_BARS.map((height, index) => <i key={index} style={{ height: height + "px", animationDelay: (index * 0.03) + "s", opacity: playing ? 1 : 0.5 }} />)}
        </div>
      </div>
      <div className="mcs-song-side">
        <McsExpiry days={s.days} />
        <button type="button" className="mcs-iconbtn" title="Download"><McsDownload /></button>
      </div>
    </div>
  );
}

function MyCardsApp({ user, full = true }: MyCardsAppProps) {
  const router = useRouter();
  const [mode, setMode] = React.useState(full);
  const demoBalance = useDemoBalance(ZERO_DEMO_BALANCE);
  const demoLibrary = useDemoLibrary();
  const blankGiftCount = useBlankSouvenoteGiftCount();

  React.useEffect(() => {
    window.__mcsSetMode = (value) => setMode(value);
  }, []);

  const drafts = mode ? MCS_DRAFTS : [];
  const blankGiftCards: McsCard[] = Array.from({ length: blankGiftCount }, (_, index) => ({
    id: `blank-souvenote-gift-${index + 1}`,
    pal: "gold",
    glyph: "Gift",
    gift: true,
    days: 365,
    title: blankGiftCount > 1 ? `Blank Souvenote Gift ${index + 1}` : "Blank Souvenote Gift",
    saved: "ready to give",
  }));
  const cards = mode ? [...blankGiftCards, ...demoLibrary.cards, ...MCS_CARDS] : [];
  const songs = mode ? [...demoLibrary.songs, ...MCS_SONGS] : [];

  function canContinue(requirement: CreateGateRequirement) {
    const gate = getCreateFlowGate(demoBalance, requirement);
    if (!gate.allowed) {
      router.push(goToPricingAfterPurchase("/create"));
      return false;
    }

    return true;
  }

  function startGeneration(href: string) {
    if (canContinue("generation")) router.push(href);
  }

  function mailCard() {
    router.push("/delivery");
  }

  return (
    <>
      <Navbar loggedIn user={user} credits={demoBalance.credits} cardBank={demoBalance.cardBank} cartCount={0} />

      <div className="bmc-shell" data-screen-label="05a Saved Cards & Songs">
        <div className="bmc-head" style={{ margin: "0 0 40px", maxWidth: 820 }}>
          <div className="bmc-eyebrow" style={{ whiteSpace: "nowrap" }}>
            <span>Saved Cards &amp; Songs</span>
          </div>
          <h1 className="bmc-title">
            Everything you&apos;ve{" "}
            <span className="souv-hero-italic text-metallic-rose-gold">made</span>
          </h1>
          <p className="bmc-lede">
            Drafts, finished cards, and songs all live here for 30 days. Pick up where you left off,
            mail a card whenever you&apos;re ready, or play a song anytime before it clears.
          </p>
        </div>

        <div className="mcs-section" data-screen-label="Section · In progress">
          <McsSectionHead title="In progress" count={drafts.length || null} />
          {drafts.length ? (
            <div className="mcs-drafts">{drafts.map((draft) => <McsDraftRow key={draft.id} d={draft} onResume={startGeneration} />)}</div>
          ) : (
            <McsEmpty
              icon={<BmcIcon name="edit" w={30} />}
              title="Nothing in progress"
              sub="Start a card and we'll save your spot here. Come back within 30 days to finish and send."
            />
          )}
        </div>

        <div className="mcs-section" data-screen-label="Section · Cards">
          <McsSectionHead title="Saved cards" count={cards.length || null} link={cards.length ? "Sort by newest" : null} />
          {cards.length ? (
            <div className="mcs-cards-grid">{cards.map((card) => <McsCardItem key={card.id} c={card} onMail={mailCard} />)}</div>
          ) : (
            <McsEmpty
              icon={<BmcIcon name="image" w={30} />}
              title="No saved cards yet"
              sub="Every card you finish lands here, ready to mail as a physical keepsake or remix again."
            />
          )}
        </div>

        <div className="mcs-section" data-screen-label="Section · Songs">
          <McsSectionHead title="Songs" count={songs.length || null} />
          {songs.length ? (
            <div className="mcs-songs">{songs.map((song) => <McsSongRow key={song.id} s={song} />)}</div>
          ) : (
            <McsEmpty
              icon={<BmcIcon name="note" w={30} />}
              title="No songs yet"
              sub="Every Souvenote card can carry an optional QR-code song. Add one and it'll wait for you right here."
            />
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}

export { MyCardsApp, MCS_DRAFTS, MCS_CARDS, MCS_SONGS };
