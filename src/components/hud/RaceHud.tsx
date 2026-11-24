'use client';

import type { RaceSnapshot, Track } from '../../game/types';
import { formatTime } from '../../game/utils';
import TrackMinimap from '../TrackMinimap';

export default function RaceHud({
  snapshot,
  track,
  onPause,
  onCycleCamera,
  showHint,
}: {
  snapshot: RaceSnapshot | null;
  track: Track;
  onPause: () => void;
  onCycleCamera: () => void;
  showHint: boolean;
}) {
  if (!snapshot) return null;
  const countdown = snapshot.countdown;
  const nitro = Math.round(snapshot.nitro);
  const speedRatio = Math.min(1, snapshot.speed / 220);

  return (
    <div className="race-hud">
      <div className="hud-left">
        <div className="hud-plate hud-pos">
          <span className="hud-label">Posisi</span>
          <strong>
            P{snapshot.position}
            <span className="hud-total">/{snapshot.totalRacers}</span>
          </strong>
        </div>
        <div className="hud-plate hud-lap">
          <span className="hud-label">Putaran</span>
          <strong>
            {snapshot.lap}
            <span className="hud-total">/{snapshot.laps}</span>
          </strong>
        </div>
      </div>

      <div className="hud-top-center">
        <button className="btn btn-icon pause-button" type="button" onClick={onPause} aria-label="Jeda balapan">
          <span aria-hidden="true">II</span>
        </button>
        <button className="btn btn-icon camera-button" type="button" onClick={onCycleCamera} aria-label="Ganti kamera">
          <span aria-hidden="true">KAM</span>
        </button>
        {showHint && (
          <p className="race-hint">
            Gas otomatis. V atau KAM untuk kamera.
          </p>
        )}
      </div>

      <div className="hud-right">
        <div className="hud-plate hud-timer">
          <span className="hud-label">Waktu</span>
          <strong>{formatTime(snapshot.time)}</strong>
          <span className="hud-best">
            Terbaik {snapshot.bestLapMs == null ? '--:--.--' : formatTime(snapshot.bestLapMs)}
          </span>
        </div>
        <div className="hud-map">
          <TrackMinimap snapshot={snapshot} track={track} />
        </div>
      </div>

      <div className="hud-nitro">
        <div className="meter-copy">
          <span className="hud-label">Nitro</span>
          <span>{nitro}%</span>
        </div>
        <div
          className="nitro-track"
          role="meter"
          aria-label="Meter nitro"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={nitro}
        >
          <span className="nitro-fill" style={{ width: `${nitro}%` }} />
        </div>
        <div className="speed-row">
          <span className="hud-label">Laju</span>
          <span className="speed-track">
            <span style={{ width: `${speedRatio * 100}%` }} />
          </span>
        </div>
      </div>

      {countdown != null && (
        <div className="countdown-overlay" role="status" aria-live="assertive">
          <span className={countdown === 0 ? 'countdown-go' : 'countdown-number'}>
            {countdown === 0 ? 'GO!' : countdown}
          </span>
        </div>
      )}
    </div>
  );
}
