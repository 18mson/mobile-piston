'use client';

import type { LapCount, Track, TrackId } from '../../game/types';
import { TRACK_ORDER, getTrack } from '../../game/track/tracks';
import { formatTime } from '../../game/utils';
import TrackPreview from '../TrackPreview';

const LAP_OPTIONS: LapCount[] = [3, 4, 5];

export default function TrackSelectScreen({
  selectedTrackId,
  selectedLaps = 3,
  bestLapMs,
  onSelect,
  onSelectLaps,
  onBack,
  onStart,
}: {
  selectedTrackId: TrackId;
  selectedLaps?: LapCount;
  bestLapMs: Partial<Record<string, number>>;
  onSelect: (id: TrackId) => void;
  onSelectLaps?: (laps: LapCount) => void;
  onBack: () => void;
  onStart: () => void;
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
            return (
              <button
                key={id}
                type="button"
                className="track-select-card"
                data-selected={isSelected}
                aria-pressed={isSelected}
                onClick={() => onSelect(id)}
                data-nav
              >
                <span className="track-select-visual">
                  <TrackPreview track={track} />
                </span>
                <span className="track-select-copy">
                  <span className="label">Rute {track.name === 'TELUK SORE' ? 'pesisir' : 'danau'}</span>
                  <strong>{track.name}</strong>
                  <span className="track-select-subtitle">{track.subtitle}</span>
                  <span className="track-select-meta">{selectedLaps} putaran / 6 mobil / start P6</span>
                  <span className="track-select-record">
                    Rekor: {record == null ? 'Belum ada' : formatTime(record)}
                  </span>
                  <span className="track-card-state">{isSelected ? 'Lintasan terpilih' : 'Pilih lintasan'}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="track-select-footer panel">
          <div>
            <span className="label">Lintasan terpilih</span>
            <strong>{selected.name}</strong>
            <p>{selected.subtitle}</p>
          </div>
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
