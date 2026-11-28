'use client';

import { CARS } from '../game/data/cars';
import type { TrackRecordEntry } from '../game/records';
import { formatTime } from '../game/utils';
import CarSideBadge from './CarSideBadge';

export default function TrackLeaderboard({
  trackName,
  entries,
  compact = false,
}: {
  trackName: string;
  entries: readonly TrackRecordEntry[];
  compact?: boolean;
}) {
  const top = entries.slice(0, 3);

  return (
    <div
      className={compact ? 'track-records-card is-compact' : 'track-records-card'}
      role="region"
      aria-label={`Catatan rekor lintasan ${trackName}`}
    >
      <div className="track-records-head">
        <span className="label">Rekor lintasan</span>
        <strong>{trackName}</strong>
      </div>
      {top.length === 0 ? (
        <p className="track-records-empty">Belum ada catatan rekor.</p>
      ) : (
        <ol className="track-records-list">
          {top.map((entry, idx) => {
            const carName = CARS[entry.carId]?.name ?? entry.carId;
            return (
              <li key={`${entry.trackId}-${entry.playerKey}`} className="track-records-row" data-rank={idx + 1}>
                <span className="track-records-rank">#{idx + 1}</span>
                <span className="track-records-player" title={entry.playerName}>
                  {entry.playerName}
                </span>
                <span className="track-records-car" title={carName}>
                  <CarSideBadge carId={entry.carId} colorIndex={entry.colorIndex} />
                </span>
                <span className="track-records-time">{formatTime(entry.bestLapMs)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
