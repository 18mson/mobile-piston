'use client';

import { useState } from 'react';
import type { LapCount, Track, TrackId, WeatherMode } from '../../game/types';
import { WEATHER_LABELS, WEATHER_MODES } from '../../game/weather';
import { isTrackUnlocked, trackUnlockDef } from '../../game/progression';
import styles from '../progression.module.css';
import { TRACK_ORDER, getTrack } from '../../game/track/tracks';
import { formatTime } from '../../game/utils';
import TrackPreview from '../TrackPreview';

const LAP_OPTIONS: LapCount[] = [3, 4, 5];
const ROUTE_KIND: Record<string, string> = {
  'teluk-sore': 'pesisir',
  'mata-air': 'danau',
  'lereng-kopi': 'pegunungan',
  pelabuhan: 'pelabuhan',
  'rimba-lumpur': 'hutan',
};

function WeatherIcon({ mode }: { mode: WeatherMode }) {
  if (mode === 'clear') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
      </svg>
    );
  }
  if (mode === 'rain') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden="true">
        <path d="M6.5 15h11a3.5 3.5 0 0 0 .5-6.96A5.5 5.5 0 0 0 7.3 6.7 4 4 0 0 0 6.5 15Z" />
        <path d="M8 18.5 7 21M12.5 18.5 11.5 21M17 18.5 16 21" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="square" aria-hidden="true">
      <circle cx="8" cy="7.5" r="2.8" />
      <path d="M8 2.5v1M3 7.5h1M4.5 4l.7.7M11.5 4l-.7.7" />
      <path d="M8 15.5h9.5a3 3 0 0 0 .4-5.97 4.5 4.5 0 0 0-8.6-.9A3.5 3.5 0 0 0 8 15.5Z" />
      <path d="M10.5 18.5 9.5 21M15 18.5 14 21" />
    </svg>
  );
}

export default function TrackSelectScreen({
  selectedTrackId,
  selectedLaps = 3,
  bestLapMs,
  onSelect,
  onSelectLaps,
  onBack,
  onStart,
  weather = 'clear',
  onSelectWeather,
  tireName,
  xp = 0,
  unlocks,
}: {
  selectedTrackId: TrackId;
  selectedLaps?: LapCount;
  bestLapMs: Partial<Record<string, number>>;
  onSelect: (id: TrackId) => void;
  onSelectLaps?: (laps: LapCount) => void;
  onBack: () => void;
  onStart: () => void;
  weather?: WeatherMode;
  onSelectWeather?: (mode: WeatherMode) => void;
  tireName?: string;
  xp?: number;
  unlocks?: string[];
}) {
  const [previewId, setPreviewId] = useState<TrackId | null>(null);
  const shownId: TrackId = previewId ?? selectedTrackId;
  const shown: Track = getTrack(shownId);
  const shownUnlocked = isTrackUnlocked(shownId, { xp, unlocks });
  const shownLockLevel = shownUnlocked ? null : (trackUnlockDef(shownId)?.level ?? null);
  const shownRecord = bestLapMs[shownId] ?? null;

  return (
    <section className="screen track-select-screen" data-menu-scope="active" aria-labelledby="track-select-heading">
      <div className="garage-panel">
        <div className="screen-heading-row">
          <button className="btn btn-quiet" type="button" onClick={onBack} data-nav data-gamepad-back>
            Kembali
          </button>
          <div>
            <p className="eyebrow">Langkah 2 / 2</p>
            <h2 id="track-select-heading">Pilih lintasan</h2>
          </div>
          <button
            className="btn btn-primary screen-heading-cta"
            type="button"
            disabled={shownLockLevel != null}
            title={shownLockLevel != null ? `Capai Level ${shownLockLevel} untuk membuka ${shown.name}` : undefined}
            onClick={() => {
              if (shownLockLevel != null) return;
              onStart();
            }}
            data-nav
          >
            Balapan di {shown.name}
          </button>
        </div>

        <div className="garage-layout">
          <aside className="track-detail panel" aria-label={`Detail ${shown.name}`}>
            <div className={shownLockLevel != null ? `track-detail-visual ${styles.lockedPreview}` : 'track-detail-visual'}>
              <span className="track-stage-kind" aria-hidden="true">
                {ROUTE_KIND[shownId] ?? 'sirkuit'}
              </span>
              <TrackPreview track={shown} />
            </div>

            <div className="track-detail-info">
              <div className="car-detail-heading">
                <div>
                  <span className="label">
                    {shownLockLevel == null ? `Rute ${ROUTE_KIND[shownId] ?? 'khusus'}` : 'Pratinjau (terkunci)'}
                  </span>
                  <h3>{shown.name}</h3>
                </div>
                <span className="track-detail-record">
                  {shownLockLevel != null
                    ? `Level ${shownLockLevel}`
                    : `Rekor: ${shownRecord == null ? 'Belum ada' : formatTime(shownRecord)}`}
                </span>
              </div>

              <p className="car-blurb">{shown.subtitle}</p>
              <p className="track-select-meta">
                {selectedLaps} putaran / 8 mobil / start P8{tireName ? ` / Ban ${tireName}` : ''}
              </p>

              {(onSelectLaps || onSelectWeather) && (
                <div className="track-select-options">
                  {onSelectLaps && (
                    <div className="lap-picker" role="group" aria-label="Jumlah putaran">
                      <span className="label">Putaran</span>
                      <div className="lap-pills">
                        {LAP_OPTIONS.map((laps) => (
                          <button
                            key={laps}
                            type="button"
                            className="btn btn-small lap-pill"
                            data-active={selectedLaps === laps}
                            aria-pressed={selectedLaps === laps}
                            onClick={() => onSelectLaps(laps)}
                            data-nav
                          >
                            {laps}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {onSelectWeather && (
                    <div className="lap-picker" role="group" aria-label="Cuaca balapan">
                      <span className="label">Cuaca</span>
                      <div className="lap-pills">
                        {WEATHER_MODES.map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className="btn btn-small lap-pill weather-icon-pill"
                            data-active={mode === weather}
                            aria-pressed={mode === weather}
                            aria-label={`${WEATHER_LABELS[mode].name}: ${WEATHER_LABELS[mode].blurb}`}
                            title={`${WEATHER_LABELS[mode].name}: ${WEATHER_LABELS[mode].blurb}`}
                            onClick={() => onSelectWeather(mode)}
                            data-nav
                          >
                            <WeatherIcon mode={mode} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {shownLockLevel != null && (
                <p className={styles.lockNote} role="status">
                  Terkunci. Capai Level {shownLockLevel} untuk membuka {shown.name}.
                </p>
              )}
            </div>
          </aside>

          <div className="track-select-grid" role="group" aria-label="Daftar lintasan">
            {TRACK_ORDER.map((id) => {
              const track = getTrack(id);
              const unlocked = isTrackUnlocked(id, { xp, unlocks });
              const lockLevel = unlocked ? null : (trackUnlockDef(id)?.level ?? null);
              const isSelected = id === selectedTrackId && previewId == null;
              const isPreview = id === previewId;
              return (
                <button
                  key={id}
                  type="button"
                  className={lockLevel == null ? 'track-select-card' : `track-select-card ${styles.lockedCard}`}
                  data-selected={isSelected || isPreview}
                  data-locked={lockLevel != null}
                  aria-pressed={isSelected}
                  onFocus={() => {
                    if (unlocked) {
                      setPreviewId(null);
                      if (id !== selectedTrackId) onSelect(id);
                    } else {
                      setPreviewId(id);
                    }
                  }}
                  onClick={() => {
                    if (!unlocked) {
                      setPreviewId(id);
                      return;
                    }
                    setPreviewId(null);
                    onSelect(id);
                  }}
                  data-nav
                >
                  <span className="track-select-copy">
                    <span className="track-card-head">
                      <strong>{track.name}</strong>
                      <span className="track-card-badge">
                        {lockLevel != null ? `Lv ${lockLevel}` : isSelected ? 'Terpilih' : ROUTE_KIND[id] ?? 'khusus'}
                      </span>
                    </span>
                    <span className="track-select-subtitle">{track.subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
