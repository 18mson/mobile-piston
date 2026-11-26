'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CARS, CAR_COLORS, CAR_ORDER, getCarPalette } from '../../game/data/cars';
import { TRACK_ORDER, getTrack } from '../../game/track/tracks';
import type { ConnectionStatus } from '../../game/net/client';
import type { CarId, LapCount, RoomStatePacket, TrackId } from '../../game/types';
import CarThumb from '../CarThumb';
import TrackPreview from '../TrackPreview';

const LAP_OPTIONS: LapCount[] = [3, 4, 5];

export default function MultiplayerLobbyScreen({
  status,
  playerId,
  pingMs,
  room,
  error,
  playerName,
  selectedCarId,
  selectedColorIndex,
  selectedTrackId,
  initialJoinCode = '',
  onChangeName,
  onSelectCar,
  carLockLevel,
  onSelectColor,
  onSelectTrack,
  onSelectLaps,
  onCreateRoom,
  onJoinRoom,
  onToggleReady,
  onStartRace,
  onLeaveRoom,
  onBack,
}: {
  status: ConnectionStatus;
  playerId: string | null;
  pingMs: number | null;
  room: RoomStatePacket | null;
  error: string;
  playerName: string;
  selectedCarId: CarId;
  selectedColorIndex: number;
  selectedTrackId: TrackId;
  initialJoinCode?: string;
  onChangeName: (name: string) => void;
  onSelectCar: (carId: CarId) => void;
  carLockLevel?: (carId: CarId) => number | null;
  onSelectColor: (colorIndex: number) => void;
  onSelectTrack: (trackId: TrackId) => void;
  onSelectLaps?: (laps: LapCount) => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onToggleReady: () => void;
  onStartRace: () => void;
  onLeaveRoom: () => void;
  onBack: () => void;
}) {
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (initialJoinCode) {
      setJoinCode(initialJoinCode.toUpperCase());
    }
  }, [initialJoinCode]);

  const inviteLink =
    room && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?join=${room.roomCode}`
      : '';

  useEffect(() => {
    if (!inviteLink) {
      setQrUrl(null);
      return;
    }
    let active = true;
    QRCode.toDataURL(inviteLink, {
      width: 120,
      margin: 1,
      color: { dark: '#0c1820', light: '#f5ebd2' },
    })
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {
        if (active) setQrUrl(null);
      });
    return () => {
      active = false;
    };
  }, [inviteLink]);

  const isConnected = status === 'connected';
  const me = room?.players.find((p) => p.id === playerId) ?? null;
  const isHost = Boolean(room && playerId && room.hostId === playerId);
  const activeColorOptions = CAR_COLORS[selectedCarId];
  const orderedCars = [...CAR_ORDER].sort((a, b) => {
    const la = carLockLevel?.(a) ?? 0;
    const lb = carLockLevel?.(b) ?? 0;
    if (la === lb) return 0;
    if (la === 0) return -1;
    if (lb === 0) return 1;
    return la - lb;
  });
  const roomLaps = room?.totalLaps ?? 3;
  const previewCar = {
    ...CARS[selectedCarId],
    palette: getCarPalette(selectedCarId, selectedColorIndex),
  };

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard
      ?.writeText(room.roomCode)
      .then(() => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 1800);
      })
      .catch(() => {});
  };

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard
      ?.writeText(inviteLink)
      .then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1800);
      })
      .catch(() => {});
  };

  const statusText =
    status === 'connected'
      ? isHost
        ? 'Host P2P Aktif'
        : `Terhubung${pingMs != null ? ` (${pingMs} ms)` : ''}`
      : status === 'connecting'
        ? 'Menghubungkan P2P...'
        : 'Siap terhubung';

  return (
    <section className="screen garage-screen" data-menu-scope="active" aria-labelledby="mp-heading">
      <div className="garage-panel">
        <div className="screen-heading-row">
          <button
            className="btn btn-quiet"
            type="button"
            onClick={room ? onLeaveRoom : onBack}
            data-nav
            data-gamepad-back
          >
            {room ? 'Keluar room' : 'Kembali'}
          </button>
          <div>
            <p className="eyebrow">Multiplayer Online (6 Mobil)</p>
            <h2 id="mp-heading">{room ? `Room ${room.roomCode}` : 'Lobby Multiplayer'}</h2>
          </div>
          <span className="mp-status-pill" data-status={status}>
            {statusText}
          </span>
        </div>

        {error && (
          <p className="mp-error" role="alert">
            {error}
          </p>
        )}

        {!room ? (
          <div className="mp-entry-grid">
            <div className="panel mp-card">
              <span className="label">Identitas & Mobil</span>
              <label className="mp-field">
                <span>Nama pembalap</span>
                <input
                  type="text"
                  maxLength={16}
                  value={playerName}
                  onChange={(e) => onChangeName(e.target.value)}
                  placeholder="Pembalap"
                />
              </label>

              <div className="mp-car-mini">
                <CarThumb car={previewCar} scale={3} />
                <div className="mp-car-pickers">
                  <div className="mp-car-pills">
                    {orderedCars.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className="btn btn-small"
                        data-active={id === selectedCarId}
                        disabled={carLockLevel?.(id) != null}
                        title={carLockLevel?.(id) != null ? `Terkunci: capai Level ${carLockLevel(id)}` : undefined}
                        onClick={() => {
                          if (carLockLevel?.(id) != null) return;
                          onSelectCar(id);
                        }}
                      >
                        {CARS[id].name}
                        {carLockLevel?.(id) != null ? ` (Lv ${carLockLevel(id)})` : ''}
                      </button>
                    ))}
                  </div>
                  <div className="color-swatches">
                    {activeColorOptions.map((opt, idx) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="color-swatch"
                        data-active={idx === selectedColorIndex}
                        aria-label={`Warna ${opt.label}`}
                        onClick={() => onSelectColor(idx)}
                        style={{
                          background: `linear-gradient(135deg, ${opt.palette.body} 62%, ${opt.palette.stripe} 62%)`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="panel mp-card">
              <span className="label">Buat atau Gabung Room</span>
              <button
                className="btn btn-primary"
                type="button"
                disabled={!isConnected}
                onClick={onCreateRoom}
              >
                Buat Room Baru
              </button>

              <div className="mp-divider">atau gabung dengan kode</div>

              <div className="mp-join-row">
                <input
                  type="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => {
                    const nextCode = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    setJoinCode(nextCode);
                    if (typeof window !== 'undefined') {
                      const url = new URL(window.location.href);
                      if (nextCode.length >= 4) {
                        url.searchParams.set('join', nextCode);
                      } else {
                        url.searchParams.delete('join');
                      }
                      window.history.replaceState({}, '', url.toString());
                    }
                  }}
                  placeholder="KODE (mis. A7K2P)"
                />
                <button
                  className="btn"
                  type="button"
                  disabled={!isConnected || joinCode.trim().length < 4}
                  onClick={() => onJoinRoom(joinCode)}
                >
                  Gabung
                </button>
              </div>
              <p className="detail-note">Sisa slot dari total 6 mobil otomatis diisi oleh Bot AI.</p>
            </div>
          </div>
        ) : (
          <div className="mp-room-grid">
            <div className="panel mp-card">
              <div className="mp-code-bar">
                <div>
                  <span className="label">Kode Room</span>
                  <strong className="mp-room-code">{room.roomCode}</strong>
                  <div className="mp-copy-actions">
                    <button className="btn btn-small" type="button" onClick={handleCopyCode}>
                      {copiedCode ? 'Kode Tersalin!' : 'Salin Kode'}
                    </button>
                    <button className="btn btn-small" type="button" onClick={handleCopyLink}>
                      {copiedLink ? 'Link Tersalin!' : 'Salin Link'}
                    </button>
                  </div>
                </div>
                {qrUrl && (
                  <div className="mp-qr-box">
                    <img
                      className="mp-qr"
                      src={qrUrl}
                      width={96}
                      height={96}
                      alt={`QR Code undangan room ${room.roomCode}`}
                    />
                    <small>Scan untuk gabung</small>
                  </div>
                )}
              </div>

              <span className="label">Pembalap ({room.players.length}/6 Manusia)</span>
              <ul className="mp-player-list">
                {Array.from({ length: 6 }).map((_, slotIdx) => {
                  const p = room.players[slotIdx];
                  if (!p) {
                    return (
                      <li key={`bot-${slotIdx}`} className="mp-player-row mp-slot-bot">
                        <span>Slot #{slotIdx + 1}</span>
                        <small>Bot AI (otomatis)</small>
                      </li>
                    );
                  }
                  const palette = getCarPalette(p.carId, p.colorIndex);
                  return (
                    <li key={p.id} className="mp-player-row" data-me={p.id === playerId}>
                      <span className="mp-player-ident">
                        <span className="mp-dot" style={{ background: palette.body }} />
                        <strong>{p.name}</strong>
                        {p.isHost && <small className="mp-badge">HOST</small>}
                      </span>
                      <span className="mp-player-meta">
                        <span>{CARS[p.carId].name}</span>
                        <small className="mp-ready-tag" data-ready={p.ready}>
                          {p.ready ? 'SIAP' : 'BELUM'}
                        </small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="panel mp-card">
              <span className="label">Pengaturan Mobil & Lintasan</span>
              <label className="mp-field">
                <span>Nama pembalap</span>
                <input
                  type="text"
                  maxLength={16}
                  value={playerName}
                  onChange={(e) => onChangeName(e.target.value)}
                  placeholder="Pembalap"
                />
              </label>
              <div className="mp-car-mini">
                <CarThumb car={previewCar} scale={3} />
                <div className="mp-car-pickers">
                  <div className="mp-car-pills">
                    {orderedCars.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className="btn btn-small"
                        data-active={id === selectedCarId}
                        disabled={carLockLevel?.(id) != null}
                        title={carLockLevel?.(id) != null ? `Terkunci: capai Level ${carLockLevel(id)}` : undefined}
                        onClick={() => {
                          if (carLockLevel?.(id) != null) return;
                          onSelectCar(id);
                        }}
                      >
                        {CARS[id].name}
                        {carLockLevel?.(id) != null ? ` (Lv ${carLockLevel(id)})` : ''}
                      </button>
                    ))}
                  </div>
                  <div className="color-swatches">
                    {activeColorOptions.map((opt, idx) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="color-swatch"
                        data-active={idx === selectedColorIndex}
                        aria-label={`Warna ${opt.label}`}
                        onClick={() => onSelectColor(idx)}
                        style={{
                          background: `linear-gradient(135deg, ${opt.palette.body} 62%, ${opt.palette.stripe} 62%)`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <span className="label">Lintasan {isHost ? '(Host)' : '(Dipilih Host)'}</span>
              <div className="mp-car-mini">
                <TrackPreview track={getTrack(room.trackId)} />
                <div className="mp-car-pills">
                  {TRACK_ORDER.map((tid) => (
                    <button
                      key={tid}
                      type="button"
                      className="btn btn-small"
                      disabled={!isHost}
                      data-active={room.trackId === tid}
                      onClick={() => onSelectTrack(tid)}
                    >
                      {getTrack(tid).name}
                    </button>
                  ))}
                </div>
              </div>

              <span className="label">Jumlah Putaran {isHost ? '(Host)' : '(Dipilih Host)'}</span>
              <div className="lap-pills">
                {LAP_OPTIONS.map((laps) => (
                  <button
                    key={laps}
                    type="button"
                    className="btn btn-small lap-pill"
                    disabled={!isHost}
                    data-active={roomLaps === laps}
                    aria-pressed={roomLaps === laps}
                    onClick={() => onSelectLaps?.(laps)}
                  >
                    {laps} Putaran
                  </button>
                ))}
              </div>

              <div className="mp-room-actions">
                {isHost ? (
                  (() => {
                    const allGuestsReady = room.players.filter((p) => !p.isHost).every((p) => p.ready);
                    return (
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={!allGuestsReady}
                        onClick={onStartRace}
                      >
                        {allGuestsReady ? 'Mulai Balapan' : 'Menunggu pemain lain siap...'}
                      </button>
                    );
                  })()
                ) : (
                  <button className="btn btn-primary" type="button" onClick={onToggleReady}>
                    {me?.ready ? 'Batal Siap' : 'Siap Balapan'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
