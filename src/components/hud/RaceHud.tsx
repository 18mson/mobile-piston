'use client';

import type { RaceSnapshot, Track } from '../../game/types';
import { formatTime } from '../../game/utils';
import TrackMinimap from '../TrackMinimap';

export default function RaceHud({
  snapshot,
  track,
  onPause,
  onCycleCamera,
  onResetCar,
  cameraMode,
  showHint,
  isOnline,
  pingMs,
}: {
  snapshot: RaceSnapshot | null;
  track: Track;
  onPause: () => void;
  onCycleCamera: () => void;
  onResetCar?: () => void;
  cameraMode?: string;
  showHint: boolean;
  isOnline?: boolean;
  pingMs?: number | null;
}) {
  if (!snapshot) return null;
  const countdown = snapshot.countdown;
  const nitro = Math.round(snapshot.nitro);
  const speedRatio = Math.min(1, snapshot.speed / 260);
  const speedKmh = Math.round(snapshot.speed);

  const gear =
    speedKmh < 5
      ? 'N'
      : speedKmh < 55
        ? '1'
        : speedKmh < 105
          ? '2'
          : speedKmh < 155
            ? '3'
            : speedKmh < 205
              ? '4'
              : '5';
  const rpmRatio =
    speedKmh < 5
      ? 0.15
      : Math.min(1, 0.30 + ((speedKmh % 52) / 52) * 0.68);
  const arcCircumference = 2 * Math.PI * 42;
  const maxArc = arcCircumference * 0.72;
  const speedArcLen = maxArc * speedRatio;
  const rpmArcLen = maxArc * rpmRatio;

  const cameraLabel =
    cameraMode === 'top'
      ? 'KAM: TOP'
      : cameraMode === 'cockpit'
        ? 'KAM: KOKPIT'
        : cameraMode === 'chase'
          ? 'KAM: CHASE'
          : 'KAM';

  const isExplore = snapshot.mode === 'explore';

  return (
    <div className="race-hud">
      {!isExplore && (
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
      )}

      <div className="hud-top-center">
        <button
          className="btn btn-icon pause-button"
          type="button"
          onClick={onPause}
          aria-label={isExplore ? 'Kembali ke menu utama (Esc)' : 'Jeda balapan'}
        >
          <span aria-hidden="true">{isExplore ? 'MENU (ESC)' : 'II'}</span>
        </button>
        <button
          className="btn btn-icon camera-button"
          type="button"
          onClick={onCycleCamera}
          aria-label={`Ganti sudut kamera. Tampilan sekarang: ${cameraLabel}`}
        >
          <span aria-hidden="true">{cameraLabel}</span>
        </button>
        {!isExplore && onResetCar && (
          <button
            className="btn btn-icon reset-button"
            type="button"
            onClick={onResetCar}
            aria-label="Kembalikan mobil ke lintasan (R)"
          >
            <span aria-hidden="true">RESET</span>
          </button>
        )}
        {showHint && (
          <p className="race-hint">
            {isExplore
              ? 'Explore Map: W/Gas, Space/Rem, Shift/Nitro, V Kamera, Esc Menu'
              : 'W/Gas, Space/Rem, Shift/Nitro, V Kamera, R Reset'}
          </p>
        )}
      </div>

      {!isExplore && (
        <div className="hud-right">
          <div className="hud-plate hud-timer">
            <span className="hud-label">
              {isOnline ? `Online${pingMs != null ? ` (${pingMs} ms)` : ''}` : 'Waktu'}
            </span>
            <strong>{formatTime(snapshot.time)}</strong>
            <span className="hud-best">
              Terbaik {snapshot.bestLapMs == null ? '--:--.--' : formatTime(snapshot.bestLapMs)}
            </span>
          </div>
        </div>
      )}

      <div className="hud-bottom-left">
        <div className="hud-map-radar">
          <TrackMinimap snapshot={snapshot} track={track} />
        </div>
        <div className="hud-speed-dial hud-speed-left" aria-hidden="true">
          <svg className="dial-svg" viewBox="0 0 100 100">
            <circle
              className="dial-track"
              cx="50"
              cy="50"
              r="42"
              strokeDasharray={`${maxArc} ${arcCircumference}`}
            />
            <circle
              className="dial-fill dial-fill-speed"
              cx="50"
              cy="50"
              r="42"
              strokeDasharray={`${speedArcLen} ${arcCircumference}`}
            />
          </svg>
          <div className="dial-readout">
            <strong className="dial-number">{speedKmh}</strong>
            <small className="dial-unit">KM/H</small>
          </div>
        </div>
      </div>

      <div className="hud-bottom-right">
        <div className="hud-speed-dial hud-speed-right">
          <svg className="dial-svg" viewBox="0 0 100 100" aria-hidden="true">
            <circle
              className="dial-track"
              cx="50"
              cy="50"
              r="42"
              strokeDasharray={`${maxArc} ${arcCircumference}`}
            />
            <circle
              className="dial-fill dial-fill-rpm"
              cx="50"
              cy="50"
              r="42"
              strokeDasharray={`${rpmArcLen} ${arcCircumference}`}
              style={{ stroke: rpmRatio > 0.85 ? '#ff4820' : rpmRatio > 0.65 ? '#ffb338' : '#38bdf8' }}
            />
          </svg>
          <div className="dial-readout">
            <span className="dial-gear">{gear}</span>
            <strong className="dial-number">{speedKmh}</strong>
            <small className="dial-unit">KM/H</small>
          </div>
        </div>

        <div className="hud-nitro-compact">
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
        </div>
      </div>

      {snapshot.wrongWay && (
        <div className="wrong-way-banner" role="alert" aria-live="assertive">
          <span className="wrong-way-title">SALAH JALAN!</span>
          <span className="wrong-way-sub">PUTAR BALIK ATAU TEKAN [RESET]</span>
        </div>
      )}

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
