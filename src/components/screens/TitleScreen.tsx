'use client';

import type { Track } from '../../game/types';
import type { TrackRecordsMap } from '../../game/records';
import ProgressBadge from '../ProgressBadge';
import TrackLeaderboard from '../TrackLeaderboard';

export default function TitleScreen({
  track,
  trackRecords,
  onStart,
  onMultiplayer,
  onGarage,
  garageUnlocked = false,
  xp = 0,
}: {
  track?: Track;
  trackRecords?: TrackRecordsMap;
  xp?: number;
  onStart: () => void;
  onMultiplayer: () => void;
  onGarage?: () => void;
  garageUnlocked?: boolean;
  onControls?: () => void;
}) {
  return (
    <section className="screen title-screen" data-menu-scope="active" aria-labelledby="main-menu-heading">
      <h2 id="main-menu-heading" className="sr-only">
        Menu utama Mobile Piston
      </h2>

      <div className="title-panel">
        <div className="title-copy">
          <div className="wordmark-wrap">
            <p className="wordmark" aria-hidden="true">
              <span className="wordmark-mobile">Mobile</span>
              <span className="wordmark-piston">Piston</span>
            </p>
            <svg className="wordmark-emblem" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <g transform="rotate(28 32 32)">
                <rect x="18" y="8" width="28" height="22" rx="3" fill="url(#pistonChrome)" stroke="#9cecff" strokeWidth="1.5" />
                <path d="M18 14h28M18 19h28" stroke="#182636" strokeWidth="2" />
                <circle cx="32" cy="24" r="4" fill="#101c2a" stroke="#cfd8e3" strokeWidth="1.5" />
                <path d="M29 27h6l2 24h-10l2-24Z" fill="url(#pistonChrome)" stroke="#89a2b8" strokeWidth="1.2" />
                <circle cx="32" cy="53" r="6" fill="none" stroke="url(#pistonChrome)" strokeWidth="3.5" />
              </g>
              <defs>
                <linearGradient id="pistonChrome" x1="18" y1="8" x2="46" y2="56" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#b9c7d6" />
                  <stop offset="100%" stopColor="#58697a" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="title-bottom-row">
          <ProgressBadge xp={xp} />

          <div className="title-cta-stack">
            <div className="title-actions">
              <button className="btn btn-primary" type="button" onClick={onStart} data-nav>
                Mulai balapan
              </button>
              <button className="btn btn-cyan" type="button" onClick={onMultiplayer} data-nav>
                Multiplayer (WiFi / Online)
              </button>
              <button
                className="btn btn-cyan"
                type="button"
                disabled={!garageUnlocked}
                onClick={onGarage}
                aria-label={garageUnlocked ? 'Garasi kustomisasi mobil' : 'Garasi terkunci, capai Level 3'}
                title={garageUnlocked ? 'Kustomisasi jendela dan velg mobil' : 'Terbuka di Level 3'}
                data-nav
              >
                {garageUnlocked ? 'Garasi' : 'Garasi · Level 3'}
              </button>
            </div>
            <div className="title-notes">
              <p>Tekan Esc untuk mode Explore Map.</p>
              <p className="portrait-note">Putar ponsel ke lanskap untuk lintasan yang lebih lebar.</p>
            </div>
          </div>
        </div>
      </div>

      {track && (
        <div className="title-records-wrap">
          <TrackLeaderboard trackName={track.name} entries={trackRecords?.[track.id] ?? []} />
        </div>
      )}
    </section>
  );
}
