'use client';

import * as React from 'react';
import { BmcIcon } from './BmcShared';

export type SavedSong = {
  id: string;
  assetUrl: string;
  name: string;
  voice: string;
  card: string;
  days: number;
};

const BARS = [
  12, 18, 24, 16, 30, 22, 12, 26, 20, 28, 14, 24, 10, 22, 28, 16, 24, 12, 20, 26, 14, 22, 18, 28, 11, 20, 16, 24, 20,
  12, 24, 28, 14, 20, 10, 24,
];

function Expiry({ days }: { days: number }) {
  return (
    <span className={`mcs-expiry ${days <= 7 ? 'is-soon' : ''}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>{' '}
      {days}d left
    </span>
  );
}

export function MyCardsSongRow({ song }: { song: SavedSong }) {
  const [playing, setPlaying] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  }

  return (
    <div className={`mcs-song ${playing ? 'is-playing' : ''}`}>
      <audio
        ref={audioRef}
        src={song.assetUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        className="mcs-song-fab"
        onClick={() => void togglePlayback()}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        <BmcIcon name={playing ? 'pause' : 'play'} w={19} />
      </button>
      <div className="mcs-song-info">
        <div className="mcs-song-name">{song.name}</div>
        <div className="mcs-song-sub">
          {song.voice} {'\u00b7'} On &quot;{song.card}&quot;
        </div>
        <div className="mcs-song-wave">
          {BARS.map((height, index) => (
            <i
              key={index}
              style={{ height: height + 'px', animationDelay: index * 0.03 + 's', opacity: playing ? 1 : 0.5 }}
            />
          ))}
        </div>
      </div>
      <div className="mcs-song-side">
        <Expiry days={song.days} />
        <a className="mcs-iconbtn" title="Download approved song" href={song.assetUrl} download>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12M7 11l5 5 5-5" />
            <path d="M5 20h14" />
          </svg>
        </a>
      </div>
    </div>
  );
}
