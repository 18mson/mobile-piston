'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CarId,
  RaceResults,
  RaceSnapshot,
  RoomStatePacket,
  SaveData,
  SavedCameraMode,
  TrackId,
} from '../game/types';
import { CARS, getCarPalette } from '../game/data/cars';
import { getTrack } from '../game/track/tracks';
import { defaultSave, loadSave } from '../game/save';
import {
  extractUsernameFromUser,
  getSupabaseClient,
  signOutAccount,
} from '../game/auth/supabaseClient';
import { CloudSaveSync } from '../game/auth/sync';
import { GameEngine } from '../game/engine';
import type { ConnectionStatus } from '../game/net/client';
import { PeerNetClient } from '../game/net/peerClient';
import { formatTime } from '../game/utils';
import TitleScreen from './screens/TitleScreen';
import GarageScreen from './screens/GarageScreen';
import TrackSelectScreen from './screens/TrackSelectScreen';
import MultiplayerLobbyScreen from './screens/MultiplayerLobbyScreen';
import PauseDialog from './screens/PauseDialog';
import ControlsDialog from './screens/ControlsDialog';
import AuthDialog from './screens/AuthDialog';
import ResultsScreen from './screens/ResultsScreen';
import RaceHud from './hud/RaceHud';
import TouchControls from './hud/TouchControls';
import { useGamepadMenu } from './useGamepadMenu';

type Screen =
  | 'loading'
  | 'title'
  | 'garage'
  | 'tracks'
  | 'multiplayer'
  | 'racing'
  | 'explore'
  | 'online-racing'
  | 'paused'
  | 'results'
  | 'error';

declare global {
  interface Window {
    __MOBILE_PISTON__?: {
      finishRace: () => boolean;
      getMode: () => string;
      getDebugState: () => Record<string, number | string>;
    };
  }
}
function BootScreen() {
  return (
    <div className="boot-screen" role="status" aria-live="polite">
      <div className="boot-mark" aria-hidden="true">
        <span>MOBILE</span>
        <strong>PISTON</strong>
      </div>
      <p className="boot-status">Menyiapkan lintasan Teluk Sore</p>
      <div className="boot-rule" aria-hidden="true" />
      <p className="boot-note">Tiga putaran, enam mobil, dua rute.</p>
    </div>
  );
}

function ErrorScreen({ message, onReload }: { message: string; onReload: () => void }) {
  return (
    <div className="error-screen" role="alert">
      <p className="eyebrow">Mesin berhenti</p>
      <h2>Game gagal dimuat</h2>
      <p>{message}</p>
      <button className="btn btn-primary" type="button" onClick={onReload} data-nav>
        Muat ulang
      </button>
    </div>
  );
}

export default function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [screen, setScreen] = useState<Screen>('loading');
  const [save, setSave] = useState<SaveData>(() => defaultSave());
  const saveRef = useRef(save);
  const [snapshot, setSnapshot] = useState<RaceSnapshot | null>(null);
  const [results, setResults] = useState<RaceResults | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authUsername, setAuthUsername] = useState<string | null>(null);
  const authUserIdRef = useRef<string | null>(null);
  const [storageWarning, setStorageWarning] = useState('');
  const cloudSyncRef = useRef<CloudSaveSync | null>(null);
  if (!cloudSyncRef.current) {
    cloudSyncRef.current = new CloudSaveSync({
      onStorageError: () => {
        setStorageWarning('Penyimpanan lokal browser penuh atau diblokir. Progres lokal mungkin tidak tersimpan.');
      },
    });
  }
  const [isTouch, setIsTouch] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [cameraMode, setCameraMode] = useState<SavedCameraMode>('top');
  const [announcement, setAnnouncement] = useState('');
  const hintTimer = useRef<number | null>(null);
  const lapRef = useRef(0);

  // Multiplayer online state
  const netClientRef = useRef<PeerNetClient | null>(null);
  const [netStatus, setNetStatus] = useState<ConnectionStatus>('disconnected');
  const [netPlayerId, setNetPlayerId] = useState<string | null>(null);
  const [netPingMs, setNetPingMs] = useState<number | null>(null);
  const [roomState, setRoomState] = useState<RoomStatePacket | null>(null);
  const [mpError, setMpError] = useState('');
  const [playerName, setPlayerName] = useState('Pembalap');
  const [onlineTrackId, setOnlineTrackId] = useState<TrackId>('teluk-sore');
  const [initialJoinCode, setInitialJoinCode] = useState('');
  const [netDebugEnabled, setNetDebugEnabled] = useState(false);
  const [netDebugStats, setNetDebugStats] = useState<ReturnType<GameEngine['getNetDebugStats']>>(null);

  const selectedColorIndex = save.selectedColors?.[save.selectedCarId] ?? 0;
  const selectedCar = {
    ...CARS[save.selectedCarId],
    palette: getCarPalette(save.selectedCarId, selectedColorIndex),
  };
  const selectedTrack = getTrack(save.selectedTrackId);
  const bestLapMs = save.bestLapMs[selectedTrack.id] ?? null;

  const commitSave = useCallback((nextSave: SaveData) => {
    setSave(nextSave);
    saveRef.current = nextSave;
    const ok = cloudSyncRef.current?.saveLocalAndSchedule(nextSave, authUserIdRef.current) ?? true;
    if (ok) {
      setStorageWarning('');
    }
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    const sync = cloudSyncRef.current;

    const applyAccountSession = async (user: Parameters<typeof extractUsernameFromUser>[0]) => {
      if (!user) return;
      const username = extractUsernameFromUser(user);
      authUserIdRef.current = user.id;
      setAuthUsername(username);
      if (username) {
        setPlayerName((prev) => (prev === 'Pembalap' || !prev.trim() ? username : prev));
      }
      if (sync) {
        const merged = await sync.syncOnLogin(user.id);
        setSave(merged);
        saveRef.current = merged;
        if (merged.cameraMode) setCameraMode(merged.cameraMode);
        engineRef.current?.setMuted(merged.audioMuted);
        engineRef.current?.setTrack(getTrack(merged.selectedTrackId));
      }
    };

    let sub: { unsubscribe: () => void } | null = null;
    if (client) {
      void client.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          void applyAccountSession(data.session.user);
        }
      });
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          void applyAccountSession(session.user);
        } else if (authUserIdRef.current !== null) {
          authUserIdRef.current = null;
          setAuthUsername(null);
        }
      });
      sub = data.subscription;
    }

    const onOnline = () => {
      void sync?.flushPending();
    };
    window.addEventListener('online', onOnline);
    return () => {
      sub?.unsubscribe();
      window.removeEventListener('online', onOnline);
      sync?.dispose();
    };
  }, []);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    const loaded = loadSave();
    setSave(loaded);
    saveRef.current = loaded;
    if (loaded.cameraMode) {
      setCameraMode(loaded.cameraMode);
    }
    const touchCapable =
      window.matchMedia('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0 ||
      'ontouchstart' in window;
    setIsTouch(touchCapable);

    const canvas = canvasRef.current;
    if (!canvas) {
      setScreen('error');
      setErrorMessage('Kanvas game tidak ditemukan.');
      return;
    }

    let engine: GameEngine;
    try {
      engine = new GameEngine(canvas, {
        onReady: () => setScreen('title'),
        onSnapshot: (next) => {
          setSnapshot(next);
          if (next.lap !== lapRef.current) {
            lapRef.current = next.lap;
            setAnnouncement(`Putaran ${next.lap} dari ${next.laps}.`);
          }
        },
        onFinished: (nextResults) => {
          setResults(nextResults);
          setScreen('results');
          setShowHint(false);
          const current = saveRef.current;
          const trackId = current.selectedTrackId;
          const nextSave: SaveData = {
            ...current,
            bestLapMs: { ...current.bestLapMs },
          };
          if (nextResults.playerBestLapMs != null) {
            const prior = nextSave.bestLapMs[trackId];
            if (prior == null || nextResults.playerBestLapMs < prior) {
              nextSave.bestLapMs[trackId] = nextResults.playerBestLapMs;
            }
          }
          commitSave(nextSave);
          setAnnouncement(
            `Finis di posisi ${nextResults.playerPosition}. Waktu total ${formatTime(nextResults.totalTimeMs)}.`,
          );
        },
        onPause: () => {
          setScreen((currentScreen) => (currentScreen === 'racing' ? 'paused' : currentScreen));
        },
        onExitExplore: () => {
          setScreen('title');
          setSnapshot(null);
          setShowHint(false);
        },
        onError: (message) => {
          setErrorMessage(message);
          setScreen('error');
        },
        onCameraChange: (mode) => {
          setCameraMode(mode);
          const nextSave: SaveData = { ...saveRef.current, cameraMode: mode };
          commitSave(nextSave);
        },
      }, getTrack(loaded.selectedTrackId));
    } catch (error) {
      setErrorMessage('WebGL tidak tersedia di browser ini. Aktifkan akselerasi grafis lalu muat ulang.');
      setScreen('error');
      return;
    }

    engineRef.current = engine;
    engine.setMuted(loaded.audioMuted);

    const unlockOnce = () => {
      void engine.audioController.unlock();
    };
    window.addEventListener('pointerdown', unlockOnce, { once: true });
    window.addEventListener('keydown', unlockOnce, { once: true });

    if (process.env.NODE_ENV !== 'production') {
      window.__MOBILE_PISTON__ = {
        finishRace: () => engine.debugFinishRace(),
        getMode: () => engine.currentMode,
        getDebugState: () => engine.debugState(),
      };
    }

    return () => {
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
      if (process.env.NODE_ENV !== 'production') delete window.__MOBILE_PISTON__;
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const inMenu =
      screen === 'title' || screen === 'garage' || screen === 'tracks' || screen === 'multiplayer';
    engineRef.current?.audioController.setMenuMusic(inMenu);
  }, [screen]);

  useEffect(() => {
    return () => {
      if (hintTimer.current != null) window.clearTimeout(hintTimer.current);
    };
  }, []);

  const enterFullscreenLandscape = useCallback(async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen may be unsupported on some mobile browsers
    }
    try {
      const orientation = window.screen?.orientation as ScreenOrientation & {
        lock?: (mode: string) => Promise<void>;
      };
      if (orientation?.lock) {
        await orientation.lock('landscape');
      }
    } catch {
      // Orientation lock may not be permitted outside fullscreen
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    } else {
      await enterFullscreenLandscape();
    }
  }, [enterFullscreenLandscape]);

  const startRace = useCallback((carId?: CarId) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isTouch) void enterFullscreenLandscape();
    const id = carId ?? saveRef.current.selectedCarId;
    const record = saveRef.current.bestLapMs[saveRef.current.selectedTrackId] ?? null;
    const savedCam = saveRef.current.cameraMode ?? 'top';
    const colorIdx = saveRef.current.selectedColors?.[id] ?? 0;
    const palette = getCarPalette(id, colorIdx);
    setSnapshot(null);
    setResults(null);
    setControlsOpen(false);
    setAnnouncement('Balapan dimulai.');
    setShowHint(true);
    setCameraMode(savedCam);
    lapRef.current = 0;
    if (hintTimer.current != null) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setShowHint(false), 8000);
    setScreen('racing');
    engine.startRace(id, record, savedCam, palette);
    window.requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
  }, []);

  const startExplore = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isTouch) void enterFullscreenLandscape();
    const savedCam = saveRef.current.cameraMode ?? 'top';
    setSnapshot(null);
    setResults(null);
    setControlsOpen(false);
    setAnnouncement('Mode Explore Map aktif. Kelilingi lintasan secara bebas.');
    setShowHint(true);
    setCameraMode(savedCam);
    if (hintTimer.current != null) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setShowHint(false), 6000);
    setScreen('explore');
    engine.startExplore(savedCam);
    window.requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    if (screen !== 'title' || controlsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape' && !event.repeat) {
        event.preventDefault();
        startExplore();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, controlsOpen, startExplore]);

  const selectTrack = (id: TrackId) => {
    if (id === saveRef.current.selectedTrackId) return;
    const nextSave: SaveData = { ...saveRef.current, selectedTrackId: id };
    commitSave(nextSave);
    engineRef.current?.setTrack(getTrack(id));
    setAnnouncement(`Lintasan ${getTrack(id).name} dipilih.`);
  };

  const selectCar = (id: CarId) => {
    const nextSave: SaveData = { ...saveRef.current, selectedCarId: id };
    commitSave(nextSave);
  };

  const selectCarColor = (id: CarId, colorIndex: number) => {
    const nextSave: SaveData = {
      ...saveRef.current,
      selectedColors: {
        ...(saveRef.current.selectedColors ?? {}),
        [id]: colorIndex,
      },
    };
    commitSave(nextSave);
  };

  const toggleMute = () => {
    const nextSave: SaveData = { ...saveRef.current, audioMuted: !saveRef.current.audioMuted };
    commitSave(nextSave);
    engineRef.current?.setMuted(nextSave.audioMuted);
    engineRef.current?.audioController.click();
  };

  const handleLogout = async () => {
    await signOutAccount();
    authUserIdRef.current = null;
    setAuthUsername(null);
    setPlayerName('Pembalap');
    const guestSave = cloudSyncRef.current?.handleLogout() ?? defaultSave();
    setSave(guestSave);
    saveRef.current = guestSave;
    if (guestSave.cameraMode) setCameraMode(guestSave.cameraMode);
    engineRef.current?.setMuted(guestSave.audioMuted);
    engineRef.current?.setTrack(getTrack(guestSave.selectedTrackId));
    setAnnouncement('Keluar dari akun. Bermain sebagai tamu.');
  };

  const openControls = () => setControlsOpen(true);

  const resumeRace = () => {
    engineRef.current?.resume();
    setScreen('racing');
    setAnnouncement('Balapan dilanjutkan.');
  };

  const restartRace = () => {
    startRace(saveRef.current.selectedCarId);
  };

  const goToGarage = () => {
    engineRef.current?.quitToTitle();
    setScreen('garage');
    setSnapshot(null);
    setResults(null);
    setShowHint(false);
  };

  const goToTitle = () => {
    netClientRef.current?.disconnect();
    setRoomState(null);
    setMpError('');
    setInitialJoinCode('');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('join')) {
        url.searchParams.delete('join');
        window.history.replaceState({}, '', url.toString());
      }
    }
    engineRef.current?.quitToTitle();
    setScreen('title');
    setSnapshot(null);
    setResults(null);
    setShowHint(false);
  };

  const openMultiplayer = useCallback(() => {
    setMpError('');
    setRoomState(null);
    setScreen('multiplayer');
    if (!netClientRef.current) {
      netClientRef.current = new PeerNetClient();
    }
    const client = netClientRef.current;
    client.setCallbacks({
      onStatusChange: (status) => setNetStatus(status),
      onWelcome: (id) => setNetPlayerId(id),
      onPing: (ping) => setNetPingMs(ping),
      onRoomState: (room) => {
        setRoomState(room);
        setOnlineTrackId(room.trackId);
        setMpError('');
      },
      onError: (message) => setMpError(message),
      onRaceStarted: (payload) => {
        const engine = engineRef.current;
        if (!engine) return;
        if (isTouch) void enterFullscreenLandscape();
        const savedCam = saveRef.current.cameraMode ?? 'top';
        const track = getTrack(payload.trackId);
        setOnlineTrackId(payload.trackId);
        setSnapshot(null);
        setResults(null);
        setControlsOpen(false);
        setShowHint(true);
        setCameraMode(savedCam);
        if (hintTimer.current != null) window.clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(() => setShowHint(false), 6000);
        setScreen('online-racing');
        engine.startOnlineRace(
          track,
          payload.participants.map((p) => ({
            id: p.id,
            label: p.name,
            carId: p.carId,
            colorIndex: p.colorIndex,
            number: p.number,
          })),
          client.playerId ?? payload.participants[0]?.id ?? 'player',
          client,
          savedCam,
        );
        window.requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
      },
      onSnapshot: (worldSnap) => {
        engineRef.current?.applyOnlineSnapshot(worldSnap);
      },
      onRaceFinished: (raceResults) => {
        engineRef.current?.finishOnlineRace(raceResults);
      },
    });
    client.connect();
  }, []);

  // Auto-open Multiplayer Lobby once on mount when opened via ?join=ROOMCODE invite link or QR code
  const didInitJoinRef = useRef(false);
  useEffect(() => {
    if (didInitJoinRef.current || typeof window === 'undefined') return;
    didInitJoinRef.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('netdebug') === '1') {
      setNetDebugEnabled(true);
    }
    const code = params.get('join')?.trim().toUpperCase();
    if (code && code.length >= 4) {
      setInitialJoinCode(code);
      openMultiplayer();
    }
  }, [openMultiplayer]);

  useEffect(() => {
    if (!netDebugEnabled || screen !== 'online-racing') {
      setNetDebugStats(null);
      return;
    }
    const timer = window.setInterval(() => {
      setNetDebugStats(engineRef.current?.getNetDebugStats() ?? null);
    }, 150);
    return () => window.clearInterval(timer);
  }, [netDebugEnabled, screen]);

  useEffect(() => {
    return () => {
      netClientRef.current?.disconnect();
    };
  }, []);

  useGamepadMenu(
    screen !== 'racing' && screen !== 'explore' && screen !== 'online-racing' && screen !== 'loading',
  );

  const paused = screen === 'paused';
  const exploreScreen = screen === 'explore';
  const onlineScreen = screen === 'online-racing';
  const racingScreen = screen === 'racing' || exploreScreen || onlineScreen;
  const showTopBar = screen === 'title' || screen === 'garage' || screen === 'tracks' || screen === 'multiplayer';
  const showFooter = screen === 'title' || screen === 'garage' || screen === 'tracks' || screen === 'multiplayer';

  return (
    <div className="app-shell" data-screen={screen} data-touch={isTouch ? 'true' : 'false'}>
      <h1 className="sr-only">Mobile Piston, balapan mobil mini di Teluk Sore</h1>

      <header className="topbar" hidden={!showTopBar}>
        <div className="brand-lockup" aria-hidden="true">
          <span className="brand-mark">MP</span>
          <span className="brand-copy">
            <strong>Mobile Piston</strong>
            <small>Teluk Sore</small>
          </span>
        </div>
        <div className="topbar-actions">
          {authUsername ? (
            <>
              <span className="account-pill" aria-label={`Masuk sebagai ${authUsername}`}>
                @{authUsername}
              </span>
              <button className="btn btn-quiet btn-small" type="button" onClick={handleLogout}>
                Keluar
              </button>
            </>
          ) : (
            <>
              <span className="account-pill account-pill-guest" title="Mode Tamu: progres disimpan di browser ini">
                Tamu (Lokal)
              </span>
              <button className="btn btn-small" type="button" onClick={() => setAuthOpen(true)}>
                Masuk / Daftar
              </button>
            </>
          )}
          <button className="btn btn-quiet btn-small" type="button" onClick={toggleMute}>
            Suara: {save.audioMuted ? 'mati' : 'nyala'}
          </button>
          <button className="btn btn-quiet btn-small" type="button" onClick={openControls}>
            Kontrol
          </button>
        </div>
      </header>

      <main className="game-main">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          width={960}
          height={540}
          tabIndex={-1}
          role="img"
          aria-label={`Balapan 3D di lintasan ${selectedTrack.name}. Gunakan tombol di layar, keyboard, atau gamepad untuk mengemudi.`}
        />

        <div className="screen-layer">
          {screen === 'loading' && <BootScreen />}
          {screen === 'error' && (
            <ErrorScreen message={errorMessage} onReload={() => window.location.reload()} />
          )}
          {screen === 'title' && (
            <TitleScreen
              track={selectedTrack}
              onStart={() => setScreen('garage')}
              onMultiplayer={openMultiplayer}
              onControls={openControls}
            />
          )}
          {screen === 'multiplayer' && (
            <MultiplayerLobbyScreen
              status={netStatus}
              playerId={netPlayerId}
              pingMs={netPingMs}
              room={roomState}
              error={mpError}
              playerName={playerName}
              selectedCarId={save.selectedCarId}
              selectedColorIndex={selectedColorIndex}
              selectedTrackId={save.selectedTrackId}
              initialJoinCode={initialJoinCode}
              onChangeName={(nextName) => {
                setPlayerName(nextName);
                if (roomState) {
                  netClientRef.current?.updateLoadout(save.selectedCarId, selectedColorIndex, nextName);
                }
              }}
              onSelectCar={(id) => {
                selectCar(id);
                const cIdx = saveRef.current.selectedColors?.[id] ?? 0;
                netClientRef.current?.updateLoadout(id, cIdx);
              }}
              onSelectColor={(colorIdx) => {
                selectCarColor(save.selectedCarId, colorIdx);
                netClientRef.current?.updateLoadout(save.selectedCarId, colorIdx);
              }}
              onSelectTrack={(tid) => {
                selectTrack(tid);
                netClientRef.current?.setTrack(tid);
              }}
              onCreateRoom={() => {
                setMpError('');
                netClientRef.current?.createRoom(
                  playerName,
                  save.selectedCarId,
                  selectedColorIndex,
                  save.selectedTrackId,
                );
              }}
              onJoinRoom={(code) => {
                const cleanCode = code.trim().toUpperCase();
                setMpError('');
                setInitialJoinCode(cleanCode);
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  if (cleanCode.length >= 4) {
                    url.searchParams.set('join', cleanCode);
                  } else {
                    url.searchParams.delete('join');
                  }
                  window.history.replaceState({}, '', url.toString());
                }
                netClientRef.current?.joinRoom(cleanCode, playerName, save.selectedCarId, selectedColorIndex);
              }}
              onToggleReady={() => {
                const me = roomState?.players.find((p) => p.id === netPlayerId);
                netClientRef.current?.setReady(!me?.ready);
              }}
              onStartRace={() => {
                netClientRef.current?.startRace();
              }}
              onLeaveRoom={goToTitle}
              onBack={goToTitle}
            />
          )}
          {screen === 'garage' && (
            <GarageScreen
              selectedCarId={save.selectedCarId}
              selectedColors={save.selectedColors ?? {}}
              onSelect={selectCar}
              onSelectColor={selectCarColor}
              onBack={() => setScreen('title')}
              onStart={() => setScreen('tracks')}
            />
          )}
          {screen === 'tracks' && (
            <TrackSelectScreen
              selectedTrackId={save.selectedTrackId}
              bestLapMs={save.bestLapMs}
              onSelect={selectTrack}
              onBack={() => setScreen('garage')}
              onStart={() => startRace()}
            />
          )}
          {racingScreen && (
            <>
              <RaceHud
                snapshot={snapshot}
                track={onlineScreen ? getTrack(onlineTrackId) : selectedTrack}
                onPause={exploreScreen || onlineScreen ? goToTitle : () => engineRef.current?.pause()}
                onCycleCamera={() => {
                  const next = engineRef.current?.cycleCamera();
                  if (next) setCameraMode(next);
                }}
                onResetCar={exploreScreen || onlineScreen ? undefined : () => engineRef.current?.resetCar()}
                onToggleFullscreen={toggleFullscreen}
                cameraMode={cameraMode}
                showHint={showHint}
                isOnline={onlineScreen}
                pingMs={netPingMs}
              />
              {onlineScreen && netDebugEnabled && netDebugStats && (
                <div
                  style={{
                    position: 'fixed',
                    left: 12,
                    bottom: isTouch ? 140 : 12,
                    zIndex: 40,
                    background: 'rgba(10, 14, 20, 0.84)',
                    color: '#e6f1ff',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    lineHeight: 1.45,
                    pointerEvents: 'none',
                  }}
                >
                  <div>NETDEBUG (?netdebug=1)</div>
                  <div>
                    posErr: {netDebugStats.posError.toFixed(2)}u (avg {netDebugStats.avgPosError.toFixed(2)}u)
                  </div>
                  <div>
                    angErr: {netDebugStats.angleError.toFixed(4)}r (avg {netDebugStats.avgAngleError.toFixed(4)}r)
                  </div>
                  <div>
                    snapGap: {netDebugStats.snapshotIntervalMs.toFixed(1)}ms | interp: {netDebugStats.interpDelayMs.toFixed(0)}ms
                  </div>
                  <div>
                    starvation: {netDebugStats.starvationFrames} | jitter&gt;2x: {netDebugStats.remoteJitterSpikes} (max {netDebugStats.maxRemoteJitterRatio.toFixed(2)}x)
                  </div>
                  <div>
                    RTT: {netDebugStats.rttMs ?? '-'}ms | pending: {netDebugStats.pendingInputs}
                  </div>
                </div>
              )}
              {isTouch && (
                <TouchControls
                  onChange={(action, pressed) => engineRef.current?.setTouchControl(action, pressed)}
                />
              )}
            </>
          )}
          {paused && (
            <>
              <RaceHud
                snapshot={snapshot}
                track={selectedTrack}
                onPause={() => undefined}
                onCycleCamera={() => undefined}
                cameraMode={cameraMode}
                showHint={false}
              />
              <PauseDialog
                open={paused}
                muted={save.audioMuted}
                onResume={resumeRace}
                onRestart={restartRace}
                onGarage={goToGarage}
                onMenu={goToTitle}
                onControls={openControls}
                onToggleMute={toggleMute}
              />
            </>
          )}
          {screen === 'results' && results && (
            <ResultsScreen
              results={results}
              trackName={selectedTrack.name}
              onRestart={restartRace}
              onGarage={goToGarage}
              onMenu={goToTitle}
            />
          )}
        </div>
      </main>

      <footer className="app-footer" hidden={!showFooter}>
        <span>Mobile Piston / {selectedTrack.name}</span>
        <span>
          {authUsername
            ? `Akun @${authUsername}: progres tersinkron ke cloud.`
            : 'Mode Tamu: progres disimpan lokal di browser ini (localStorage).'}
        </span>
      </footer>

      {controlsOpen && <ControlsDialog open={controlsOpen} onClose={() => setControlsOpen(false)} />}
      {authOpen && (
        <AuthDialog
          open={authOpen}
          onClose={() => {
            setAuthOpen(false);
            if (!authUsername) {
              setAnnouncement('Bermain sebagai tamu. Progres disimpan di browser ini.');
            }
          }}
          onSuccess={() => setAnnouncement('Berhasil masuk akun. Progres disinkronkan.')}
        />
      )}
      {storageWarning && (
        <div className="storage-warning" role="alert">
          {storageWarning}
        </div>
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
