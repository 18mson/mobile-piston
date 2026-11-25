'use client';

import { useState } from 'react';
import { CARS, CAR_COLORS, CAR_ORDER, getCarPalette } from '../../game/data/cars';
import { TRACK_ORDER, getTrack } from '../../game/track/tracks';
import type { ConnectionStatus } from '../../game/net/client';
import type { CarId, RoomStatePacket, TrackId } from '../../game/types';
import CarThumb from '../CarThumb';

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
  onChangeName,
  onSelectCar,
  onSelectColor,
  onSelectTrack,
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
  onChangeName: (name: string) => void;
  onSelectCar: (carId: CarId) => void;
  onSelectColor: (colorIndex: number) => void;
  onSelectTrack: (trackId: TrackId) => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onToggleReady: () => void;
  onStartRace: () => void;
  onLeaveRoom: () => void;
  onBack: () => void;
}) {
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  const isConnected = status === 'connected';
  const me = room?.players.find((p) => p.id === playerId) ?? null;
  const isHost = Boolean(room && playerId && room.hostId === playerId);
  const activeColorOptions = CAR_COLORS[selectedCarId];
  const previewCar = {
    ...CARS[selectedCarId],
    palette: getCarPalette(selectedCarId, selectedColorIndex),
  };

  const handleCopy = () => {
    if (!room) return;
    navigator.clipboard?.writeText(room.roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  const statusText =
    status === 'connected'
      ? `Terhubung${pingMs != null ? ` (${pingMs} ms)` : ''}`
      : status === 'connecting'
        ? 'Menghubungkan ke server (server gratis mungkin butuh ~20 dtk untuk bangun)...'
        : 'Terputus dari server';

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
                    {CAR_ORDER.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className="btn btn-small"
                        data-active={id === selectedCarId}
                        onClick={() => onSelectCar(id)}
                      >
                        {CARS[id].name}
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
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
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
                </div>
                <button className="btn btn-small" type="button" onClick={handleCopy}>
                  {copied ? 'Tersalin!' : 'Salin Kode'}
                </button>
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
              <div className="mp-car-pills">
                {CAR_ORDER.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="btn btn-small"
                    data-active={id === selectedCarId}
                    onClick={() => onSelectCar(id)}
                  >
                    {CARS[id].name}
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

              <span className="label">Lintasan {isHost ? '(Host)' : '(Dipilih Host)'}</span>
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

              <div className="mp-room-actions">
                {isHost ? (
                  <button className="btn btn-primary" type="button" onClick={onStartRace}>
                    Mulai Balapan
                  </button>
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
