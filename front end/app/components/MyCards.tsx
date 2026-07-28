"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { BmcIcon } from "./BmcShared";
import { CardArt } from "./CardArt";
import { CARD_DRAFTS_UPDATED_EVENT, fetchCardDraftAssets, fetchUserCardDrafts } from "../lib/api";
import type { CardDraft, CardDraftAsset } from "../lib/api";
import { rememberSelectedAsset } from "../lib/mockMvpFlow";
import type { DemoUser } from "./DemoUser";
import { useAuth } from "./AuthProvider";
import { AuthGatePrompt } from "./AuthGatePrompt";

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
  href: string;
};

type McsCard = {
  id: string;
  selectedAssetId?: string | null;
  assets?: CardDraftAsset[];
  imageUrl?: string | null;
  pal: string;
  glyph: string;
  song?: boolean;
  message?: boolean;
  gift?: boolean;
  title: string;
  saved: string;
};

type McsSong = {
  id: string;
  name: string;
  voice: string;
  card: string;
  audioUrl?: string | null;
};

type CardDraftWithAssets = {
  draft: CardDraft;
  assets: CardDraftAsset[];
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function nestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  return asRecord(source[key]);
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function assetType(asset: CardDraftAsset): string {
  return textValue(asset.assetType || asset.asset_type).toLowerCase();
}

function hasAssetType(assets: CardDraftAsset[], type: string): boolean {
  return assets.some((asset) => assetType(asset) === type);
}

function assetGenerationJobId(asset: CardDraftAsset): string {
  return textValue(asset.generationJobId || asset.generation_job_id);
}

function assetReadUrl(asset: CardDraftAsset | undefined): string | null {
  const value = textValue(asset?.readUrl);
  if (!value) return null;

  try {
    const url = new URL(value);
    const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
    return url.protocol === "https:" || (url.protocol === "http:" && isLoopback) ? url.toString() : null;
  } catch {
    return null;
  }
}

function isApprovedLibraryAsset(asset: CardDraftAsset): boolean {
  const approvedAt = textValue(asset.approvedAt || asset.approved_at);
  const moderationState = textValue(asset.moderationState || asset.moderation_state).toLowerCase();
  return Boolean(approvedAt) && ["approved", "approved_mock"].includes(moderationState);
}

function selectApprovedGenerationAssets(assets: CardDraftAsset[]): CardDraftAsset[] {
  const approvedAssets = assets.filter(isApprovedLibraryAsset);
  const selectedImage = approvedAssets.filter((asset) => assetType(asset) === "image").at(-1);
  const generationJobId = selectedImage ? assetGenerationJobId(selectedImage) : "";
  if (!selectedImage || !generationJobId) return [];

  return approvedAssets.filter((asset) => assetGenerationJobId(asset) === generationJobId);
}

function formatSavedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getDraftTitle(draft: CardDraft): string {
  const brief = asRecord(draft.creative_brief);
  const basics = nestedRecord(brief, "basics");
  const template = nestedRecord(brief, "template");
  const recipient = textValue(basics.recipient) || textValue(brief.recipient);
  const occasion = textValue(draft.occasion) || textValue(basics.occasion) || textValue(template.occasion);
  const templateName = textValue(template.name);
  return [
    templateName || occasion || "Custom Souvenote",
    recipient ? `for ${recipient}` : "",
  ].filter(Boolean).join(" ");
}

function draftFlow(draft: CardDraft): string {
  const brief = asRecord(draft.creative_brief);
  return textValue(brief.flow);
}

function hasBriefSection(brief: Record<string, unknown>, key: string): boolean {
  return Object.keys(nestedRecord(brief, key)).length > 0 || textValue(brief[key]).length > 0;
}

function personalizeResumeTarget(draftId: string, brief: Record<string, unknown>) {
  const step = hasBriefSection(brief, "photo")
    ? hasBriefSection(brief, "birthday") || hasBriefSection(brief, "recipient") || hasBriefSection(brief, "caption") || hasBriefSection(brief, "insideMessage")
      ? "caption"
      : "birthday"
    : "photo";

  return {
    href: `/create/personalize-a-template?modal=1&draftId=${encodeURIComponent(draftId)}&step=${step}`,
    where: step === "photo" ? "photo or description" : step === "birthday" ? "birthday details" : "caption and message",
    step: step === "photo" ? 1 : step === "birthday" ? 2 : 3,
    total: 3,
  };
}

function buildMyCardResumeTarget(draftId: string, brief: Record<string, unknown>) {
  const baseHref = `/create/build-my-card?draftId=${encodeURIComponent(draftId)}`;

  if (!hasBriefSection(brief, "photo")) {
    return { href: `${baseHref}#photo`, where: "photo or description", step: 1, total: 5 };
  }

  if (!hasBriefSection(brief, "basics")) {
    return { href: `${baseHref}#basics`, where: "the basics", step: 2, total: 5 };
  }

  if (!hasBriefSection(brief, "image")) {
    return { href: `${baseHref}#image`, where: "image style", step: 3, total: 5 };
  }

  if (!hasBriefSection(brief, "message")) {
    return { href: `${baseHref}#message`, where: "inside message", step: 4, total: 5 };
  }

  return { href: `${baseHref}#song`, where: "song and generation", step: 5, total: 5 };
}

function mapDraftToMcsDraft(draft: CardDraft): McsDraft {
  const flow = draftFlow(draft);
  const brief = asRecord(draft.creative_brief);
  const title = getDraftTitle(draft);
  const resume = flow === "personalize_template" ? personalizeResumeTarget(draft.id, brief) : buildMyCardResumeTarget(draft.id, brief);

  return {
    id: draft.id,
    pal: flow === "personalize_template" ? "gold" : "rose",
    title,
    flow: flow === "personalize_template" ? "Personalize a Template" : "Build My Card",
    where: resume.where,
    step: resume.step,
    total: resume.total,
    href: resume.href,
  };
}

function mapDraftToMcsCard({ draft, assets }: CardDraftWithAssets): McsCard {
  const flow = draftFlow(draft);
  const title = getDraftTitle(draft);
  const imageAsset = assets.filter((asset) => assetType(asset) === "image").at(-1);
  return {
    id: draft.id,
    selectedAssetId: imageAsset?.id || null,
    assets,
    imageUrl: assetReadUrl(imageAsset),
    pal: flow === "personalize_template" ? "gold" : "rose",
    glyph: title.slice(0, 1).toUpperCase() || "S",
    song: hasAssetType(assets, "song"),
    message: hasAssetType(assets, "message"),
    title,
    saved: formatSavedDate(draft.updated_at || draft.created_at),
  };
}

function mapDraftAssetsToSongs({ draft, assets }: CardDraftWithAssets): McsSong[] {
  const title = getDraftTitle(draft);
  return assets.filter((asset) => assetType(asset) === "song").map((asset, index) => ({
    id: asset.id || `${draft.id}-song-${index}`,
    name: `${title} QR Song`,
    voice: "Generated Souvenote QR song",
    card: title,
    audioUrl: assetReadUrl(asset),
  }));
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
          ) : c.message ? (
            <span className="mcs-card-songdot"><BmcIcon name="edit" w={10} /> Message</span>
          ) : <span />}
        </div>
        {c.imageUrl ? (
          <img className="mcs-card-art-image" src={c.imageUrl} alt={`${c.title} card artwork`} />
        ) : (
          <CardArt palette={c.pal} glyph={c.glyph} glowIdx={c.id.charCodeAt(1)} />
        )}
      </div>
      <div className="mcs-card-body">
        <div className="mcs-card-title">{c.title}</div>
        <div className="mcs-card-date">Saved {c.saved}</div>
        <div className="mcs-card-acts">
          <button type="button" className="bmc-cta" onClick={() => onMail(c)}>
            {c.gift ? <BmcIcon name="spark2" w={14} /> : <McsMail />}
            {c.gift ? "Give this Souvenote" : "Mail this card"}
          </button>
          {!c.gift && c.imageUrl ? (
            <a
              className="mcs-iconbtn"
              href={c.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              title="Open artwork"
              aria-label={`Open ${c.title} artwork`}
            >
              <McsDownload />
            </a>
          ) : !c.gift ? (
            <button type="button" className="mcs-iconbtn" title="Artwork download is unavailable in mock mode" disabled>
              <McsDownload />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function McsSongRow({ s }: McsSongRowProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [playbackError, setPlaybackError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
    setPlaybackError(null);
  }, [s.audioUrl]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !s.audioUrl) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    setPlaybackError(null);
    try {
      await audio.play();
    } catch {
      setPlaying(false);
      setPlaybackError("Song playback could not start. Refresh the page for a new private media link.");
    }
  }

  return (
    <div className={`mcs-song ${playing ? "is-playing" : ""}`}>
      <audio
        ref={audioRef}
        src={s.audioUrl || undefined}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setPlaybackError("This private song link expired. Refresh the page to listen again.");
        }}
      />
      <button
        type="button"
        className="mcs-song-fab"
        onClick={() => void togglePlayback()}
        aria-label={playing ? `Pause ${s.name}` : `Play ${s.name}`}
        disabled={!s.audioUrl}
        title={s.audioUrl ? (playing ? "Pause song" : "Play song") : "Song playback is unavailable in mock mode"}
      >
        <BmcIcon name={playing ? "pause" : "play"} w={19} />
      </button>
      <div className="mcs-song-info">
        <div className="mcs-song-name">{s.name}</div>
        <div className={`mcs-song-sub ${playbackError ? "is-error" : ""}`}>
          {playbackError || <>{s.voice} {"\u00b7"} {s.card === "Unattached" ? "Not on a card yet" : `On "${s.card}"`}</>}
        </div>
        <div className="mcs-song-wave">
          {MCS_BARS.map((height, index) => <i key={index} style={{ height: height + "px", animationDelay: (index * 0.03) + "s", opacity: playing ? 1 : 0.5 }} />)}
        </div>
      </div>
      <div className="mcs-song-side">
        {s.audioUrl ? (
          <a
            className="mcs-iconbtn"
            href={s.audioUrl}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            title="Open song"
            aria-label={`Open ${s.name}`}
          >
            <McsDownload />
          </a>
        ) : (
          <button type="button" className="mcs-iconbtn" title="Song download is unavailable in mock mode" disabled>
            <McsDownload />
          </button>
        )}
      </div>
    </div>
  );
}

function MyCardsApp({ user, full = true }: MyCardsAppProps) {
  const router = useRouter();
  const auth = useAuth();
  const [mode, setMode] = React.useState(full);
  const [authPromptOpen, setAuthPromptOpen] = React.useState(false);
  const [backendDrafts, setBackendDrafts] = React.useState<CardDraftWithAssets[]>([]);
  const [draftsStatus, setDraftsStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [draftsError, setDraftsError] = React.useState<string | null>(null);
  const isAuthenticated = auth.status === "authenticated";
  const localUserId = auth.user?.id;

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    window.__mcsSetMode = (value) => setMode(value);
    return () => {
      delete window.__mcsSetMode;
    };
  }, []);

  const loadDraftsAndAssets = React.useCallback(async () => {
    if (!isAuthenticated || !localUserId) return [];
    const draftsFromBackend = await fetchUserCardDrafts();
    const draftsWithAssets = await Promise.all(
      draftsFromBackend.map(async (draft) => ({
        draft,
        assets: await fetchCardDraftAssets(draft.id),
      })),
    );

    return draftsWithAssets;
  }, [isAuthenticated, localUserId]);

  React.useEffect(() => {
    if (!isAuthenticated || !localUserId) {
      setBackendDrafts([]);
      setDraftsStatus(auth.status === "loading" ? "loading" : "ready");
      return;
    }

    let active = true;
    setDraftsStatus("loading");

    loadDraftsAndAssets()
      .then((draftsWithAssets) => {
        if (!active) return;
        setBackendDrafts(draftsWithAssets);
        setDraftsStatus("ready");
        setDraftsError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setBackendDrafts([]);
        setDraftsStatus("error");
        setDraftsError(error instanceof Error ? error.message : "Saved cards could not be loaded from the backend.");
      });

    return () => {
      active = false;
    };
  }, [auth.status, isAuthenticated, loadDraftsAndAssets]);

  React.useEffect(() => {
    if (!isAuthenticated) return;

    const sync = () => {
      loadDraftsAndAssets()
        .then((draftsWithAssets) => {
          setBackendDrafts(draftsWithAssets);
          setDraftsStatus("ready");
          setDraftsError(null);
        })
        .catch((error: unknown) => {
          setBackendDrafts([]);
          setDraftsStatus("error");
          setDraftsError(error instanceof Error ? error.message : "Saved cards could not be loaded from the backend.");
        });
    };

    window.addEventListener(CARD_DRAFTS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(CARD_DRAFTS_UPDATED_EVENT, sync);
  }, [isAuthenticated, loadDraftsAndAssets]);

  const libraryDrafts = mode
    ? backendDrafts.map(({ draft, assets }) => ({ draft, assets: selectApprovedGenerationAssets(assets) }))
    : [];
  const draftRows = mode
    ? libraryDrafts.filter(({ assets }) => !hasAssetType(assets, "image")).map(({ draft }) => mapDraftToMcsDraft(draft))
    : [];
  const cards = mode
    ? libraryDrafts.filter(({ assets }) => hasAssetType(assets, "image")).map(mapDraftToMcsCard)
    : [];
  const songs = mode ? libraryDrafts.flatMap(mapDraftAssetsToSongs) : [];
  const hasAnyBackendDrafts = backendDrafts.length > 0;

  function startGeneration(href: string) {
    router.push(href);
  }

  function mailCard(card: McsCard) {
    if (card.selectedAssetId) {
      rememberSelectedAsset(card.id, card.selectedAssetId, card.assets || []);
    }
    router.push("/delivery");
  }

  if (!isAuthenticated) {
    return (
      <>
        <Navbar loggedIn={false} user={user} credits={{ images: 0, songs: 0 }} cardBank={0} cartCount={0} />

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
              Sign up or log in to purchase cards and credits, then every draft, card, song, and token you make will live here.
            </p>
          </div>

          <div className="mcs-section" data-screen-label="Section - Account required">
            <McsSectionHead title="Your library" />
            <div className="mcs-empty mcs-auth-lock">
              <span className="mcs-empty-ico"><BmcIcon name="lock" w={30} /></span>
              <div className="mcs-empty-title">Sign up or log in to unlock Saved Cards &amp; Songs</div>
              <div className="mcs-empty-sub">Purchase cards and credits, save drafts, and keep your generated songs attached to your account.</div>
              <div className="mcs-auth-actions">
                <Link className="bmc-cta" href="/signup?returnTo=/create/my-cards-and-songs">Sign up</Link>
                <Link className="bmc-cta-secondary" href="/login?returnTo=/create/my-cards-and-songs">Log in</Link>
                <button type="button" className="bmc-cta-secondary" onClick={() => setAuthPromptOpen(true)}>What unlocks?</button>
              </div>
            </div>
          </div>

          <div className="mcs-section" data-screen-label="Section - Cards">
            <McsSectionHead title="Saved cards" />
            <McsEmpty
              icon={<BmcIcon name="image" w={30} />}
              title="Cards save after sign-up"
              sub="Once you purchase cards or credits and generate a design, finished cards appear here ready to mail."
            />
          </div>

          <div className="mcs-section" data-screen-label="Section - Songs">
            <McsSectionHead title="Songs" />
            <McsEmpty
              icon={<BmcIcon name="note" w={30} />}
              title="Songs attach to your account"
              sub="QR-code songs are private to your account until you choose to mail or share a card."
            />
          </div>

          <AuthGatePrompt
            open={authPromptOpen}
            onClose={() => setAuthPromptOpen(false)}
            returnTo="/create/my-cards-and-songs"
            title="Save every card and token in one place"
            body="Create an account or log in to purchase card packs and credits, resume drafts, keep generated songs, and send finished cards when you're ready."
            primaryLabel="Sign up"
          />
        </div>

        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar loggedIn={isAuthenticated} user={user} credits={{ images: 0, songs: 0 }} cardBank={0} cartCount={0} />

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
            {isAuthenticated
              ? "Drafts, finished cards, and songs all live here. Pick up where you left off, mail a card whenever you're ready, or play a saved song."
              : "Sign up or log in to purchase cards and credits, then every draft, card, song, and token you make will live here."}
          </p>
        </div>

        <div className="mcs-section" data-screen-label="Section · In progress">
          <McsSectionHead title="In progress" count={draftRows.length || null} />
          {draftsStatus === "loading" ? (
            <McsEmpty
              icon={<BmcIcon name="edit" w={30} />}
              title="Loading your drafts"
              sub="Checking the local backend for cards you have created."
            />
          ) : draftsStatus === "error" ? (
            <McsEmpty
              icon={<BmcIcon name="edit" w={30} />}
              title="Saved cards unavailable"
              sub={`Start the local backend to load your saved drafts. ${draftsError || ""}`.trim()}
              cta="Create your first card"
              href="/create"
            />
          ) : draftRows.length ? (
            <div className="mcs-drafts">{draftRows.map((draft) => <McsDraftRow key={draft.id} d={draft} onResume={startGeneration} />)}</div>
          ) : (
            <McsEmpty
              icon={<BmcIcon name="edit" w={30} />}
              title="Nothing in progress"
              sub="Start a card and we'll save your spot here so you can return to finish and send."
              cta="Create your first card"
              href="/create"
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
              sub={hasAnyBackendDrafts ? "Generated cards appear here after you approve a moderation-cleared artwork selection." : "Every card you create lands here, ready to mail as a physical keepsake or remix again."}
              cta={hasAnyBackendDrafts ? undefined : "Create your first card"}
              href="/create"
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
