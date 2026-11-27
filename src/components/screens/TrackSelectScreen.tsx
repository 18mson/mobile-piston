'use client';

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
  const selected: Track = getTrack(selectedTrackId);

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
        </div>

        <div className="track-select-grid">
          {TRACK_ORDER.map((id) => {
            const track = getTrack(id);
            const isSelected = id === selectedTrackId;
            const record = bestLapMs[id] ?? null;
            const unlocked = isTrackUnlocked(id, { xp, unlocks });
            const lockLevel = unlocked ? null : (trackUnlockDef(id)?.level ?? null);
            return (
              <button
                key={id}
                type="button"
                className="track-select-card"
                data-selected={isSelected}
                data-locked={lockLevel != null}
                aria-pressed={isSelected}
                aria-disabled={lockLevel != null}
                onClick={() => onSelect(id)}
                data-nav
              >
                <span className="track-select-visual">
                  <TrackPreview track={track} />
                </span>
                <span className="track-select-copy">
                  <span className="label">Rute {ROUTE_KIND[id] ?? 'khusus'}</span>
                  <strong>{track.name}</strong>
                  <span className="track-select-subtitle">{track.subtitle}</span>
                  <span className="track-select-meta">{selectedLaps} putaran / 8 mobil / start P8</span>
                  <span className="track-select-record">
                    {lockLevel != null
                      ? `Terkunci - Terbuka di Level ${lockLevel}`
                      : `Rekor: ${record == null ? 'Belum ada' : formatTime(record)}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {onSelectWeather && (
          <div className="panel" role="group" aria-label="Pilih cuaca">
            <span className="label">Cuaca balapan</span>
            <div className={styles.weatherRow}>
              {WEATHER_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={styles.weatherBtn}
                  data-selected={mode === weather}
                  aria-pressed={mode === weather}
                  onClick={() => onSelectWeather(mode)}
                  data-nav
                >
                  <strong>{WEATHER_LABELS[mode].name}</strong>
                  <span>{WEATHER_LABELS[mode].blurb}</span>
                </button>
              ))}
            </div>
            {tireName && <p className="detail-note">Ban terpasang: {tireName}. Ganti ban di Garasi.</p>}
          </div>
        )}

        <div className="track-select-footer panel">
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
          <button className="btn btn-primary" type="button" onClick={onStart} data-nav>
            Balapan di {selected.name}
          </button>
        </div>
      </div>
    </section>
  );
}
