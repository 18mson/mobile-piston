'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AccessorySlot,
  CarId,
  LapCount,
  RaceResults,
  RaceSnapshot,
  RoomStatePacket,
  SaveData,
  SavedCameraMode,
  TireId,
  TrackId,
  WeatherMode,
} from '../game/types';
import { CARS, getCarPalette } from '../game/data/cars';
import { isAccessoryAvailable } from '../game/data/accessories';
import { applyCosmetics } from '../game/data/cosmetics';
import { applyCarUsage, isAccessoryUnlocked, isGlassUnlocked, isRimUnlocked } from '../game/garage';
import { fetchTrackRecords, submitTrackRecord, type TrackRecordsMap } from '../game/records';
import { getTrack } from '../game/track/tracks';
import { defaultSave, loadSave } from '../game/save';
import {
  applyXp,
  carUnlockDef,
  computeRaceXp,
  isCarUnlocked,
  isGarageUnlocked,
  isTireUnlocked,
  isTrackUnlocked,
  tireUnlockDef,
  trackUnlockDef,
  type XpReport,
} from '../game/progression';
import { getTire, TIRES } from '../game/data/tires';
import { randomWeatherSeed } from '../game/weather';
import {
  extractUsernameFromUser,
  getSupabaseClient,
  signOutAccount,
} from '../game/auth/supabaseClient';
import { CloudSaveSync } from '../game/auth/sync';
import { GameEngine } from '../game/engine';
import { useMenuNavigation } from './useMenuNavigation';
import type { ConnectionStatus } from '../game/net/client';
import { PeerNetClient } from '../game/net/peerClient';
import {
  listPublicRooms,
  publishPublicRoom,
  removePublicRoom,
  removePublicRoomKeepalive,
  type PublicRoomInfo,
} from '../game/net/roomDirectory';
import { formatTime } from '../game/utils';
import TitleScreen from './screens/TitleScreen';
import GarageScreen from './screens/GarageScreen';
import GarageCatalogScreen from './screens/GarageCatalogScreen';
import CustomizeGarageScreen from './screens/CustomizeGarageScreen';
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
  | 'customize-grid'
  | 'customize'
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

const WORLD_ANIMALS = [
  'Cheetah',
  'Komodo',
  'Jaguar',
  'Falcon',
  'Panther',
  'Serigala',
  'Harimau',
  'Elang',
  'Lynx',
  'Puma',
  'Bison',
  'Kangguru',
  'Flamingo',
  'Tapir',
  'Badak',
  'Gagak',
  'Mamba',
  'Cobra',
  'Panda',
  'Koala',
  'Beruang',
  'Rusa',
  'Banteng',
  'Kijang',
  'Rajawali',
  'Musang',
  'Landak',
  'Tupai',
];

function randomGuestName(): string {
  const animal = WORLD_ANIMALS[Math.floor(Math.random() * WORLD_ANIMALS.length)] ?? 'Cheetah';
  return animal;
}

function getUserInitials(name: string): string {
  const clean = name.replace(/^@+/, '').trim();
  if (!clean) return 'MP';
  const parts = clean.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export default function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [screen, setScreen] = useState<Screen>('loading');
  const [save, setSave] = useState<SaveData>(() => defaultSave());
  const saveRef = useRef(save);
  const [snapshot, setSnapshot] = useState<RaceSnapshot | null>(null);
  const [results, setResults] = useState<RaceResults | null>(null);
  const [isOnlineResult, setIsOnlineResult] = useState(false);
  const [isSpectating, setIsSpectating] = useState(false);
  const [spectateLabel, setSpectateLabel] = useState('');
  const isSpectatingRef = useRef(false);
  const [xpReport, setXpReport] = useState<XpReport | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [customizeFrom, setCustomizeFrom] = useState<'title' | 'garage'>('title');
  const [authOpen, setAuthOpen] = useState(false);
  const [authUsername, setAuthUsername] = useState<string | null>(null);
  const authUsernameRef = useRef<string | null>(null);
  const authUserIdRef = useRef<string | null>(null);
  const [trackRecords, setTrackRecords] = useState<TrackRecordsMap>({});
  const [storageWarning, setStorageWarning] = useState('');
  const cloudSyncRef = useRef<CloudSaveSync | null>(null);
  if (!cloudSyncRef.current) {
    cloudSyncRef.current = new CloudSaveSync({
      onStorageError: () => {
        setStorageWarning('Penyimpanan lokal browser penuh atau diblokir. Progres lokal mungkin tidak tersimpan.');
      },
      onSyncError: (msg) => {
        setStorageWarning(msg);
      },
    });
  }
  const [isTouch, setIsTouch] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const [publicRooms, setPublicRooms] = useState<PublicRoomInfo[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const hostedRoomCodeRef = useRef<string | null>(null);
  const [mpError, setMpError] = useState('');
  const [playerName, setPlayerName] = useState('Pembalap');
  const playerNameRef = useRef('Pembalap');
  const hasCustomNameRef = useRef(false);
  const [onlineTrackId, setOnlineTrackId] = useState<TrackId>('teluk-sore');
  const onlineTrackIdRef = useRef<TrackId>('teluk-sore');
  const isOnlineResultRef = useRef(false);
  const [initialJoinCode, setInitialJoinCode] = useState('');
  const [netDebugEnabled, setNetDebugEnabled] = useState(false);
  const [netDebugStats, setNetDebugStats] = useState<ReturnType<GameEngine['getNetDebugStats']>>(null);

  const selectedColorIndex = save.selectedColors?.[save.selectedCarId] ?? 0;
  const selectedCar = {
    ...CARS[save.selectedCarId],
    palette: applyCosmetics(
      getCarPalette(save.selectedCarId, selectedColorIndex),
      save.cosmetics?.[save.selectedCarId],
      save.accessories?.[save.selectedCarId],
    ),
  };
  const garageUnlocked = isGarageUnlocked(save);
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
        setPlayerName((prev) =>
          !hasCustomNameRef.current || prev === 'Pembalap' || !prev.trim() ? username : prev,
        );
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
    const onPageHide = () => {
      void sync?.flushPending();
      if (hostedRoomCodeRef.current) {
        removePublicRoomKeepalive(hostedRoomCodeRef.current);
        hostedRoomCodeRef.current = null;
      }
      netClientRef.current?.disconnect();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    return () => {
      sub?.unsubscribe();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      if (hostedRoomCodeRef.current) {
        void removePublicRoom(hostedRoomCodeRef.current);
        hostedRoomCodeRef.current = null;
      }
      sync?.dispose();
    };
  }, []);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    authUsernameRef.current = authUsername;
  }, [authUsername]);

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  useEffect(() => {
    onlineTrackIdRef.current = onlineTrackId;
  }, [onlineTrackId]);

  useEffect(() => {
    isOnlineResultRef.current = isOnlineResult;
  }, [isOnlineResult]);

  useEffect(() => {
    if (screen === 'title' || screen === 'tracks') {
      void fetchTrackRecords().then(setTrackRecords);
    }
  }, [screen]);

  useEffect(() => {
    const loaded = loadSave();
    setSave(loaded);
    saveRef.current = loaded;
    if (!authUserIdRef.current && !hasCustomNameRef.current) {
      setPlayerName(randomGuestName());
    }
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
          // XP for the finished race (level and unlocks are derived from the total; spectators earn no XP)
          const award = isSpectatingRef.current ? { rows: [], total: 0 } : computeRaceXp(nextResults);
          let finalSave = nextSave;
          let levelUpNote = '';
          const xpApplied = award.total > 0 ? applyXp(nextSave, award) : null;
          if (xpApplied) {
            finalSave = xpApplied.save;
            if (xpApplied.report.levelAfter > xpApplied.report.levelBefore) {
              const names = xpApplied.report.unlocked.map((item) => item.label).join(', ');
              levelUpNote = ` Naik ke level ${xpApplied.report.levelAfter}.${names ? ` Terbuka: ${names}.` : ''}`;
            }
          }
          const usageResult = isSpectatingRef.current
            ? { save: finalSave, unlocked: null }
            : applyCarUsage(finalSave, nextResults);
          finalSave = usageResult.save;
          if (usageResult.unlocked) {
            const cName = CARS[usageResult.unlocked.carId].name;
            const cItems = usageResult.unlocked.items.map((item) => item.label).join(', ');
            levelUpNote += ` Terbuka untuk ${cName}: ${cItems}.`;
          }
          if (xpApplied) {
            setXpReport({ ...xpApplied.report, cosmeticUnlocks: usageResult.unlocked });
          } else {
            setXpReport(null);
          }
          commitSave(finalSave);
          const finishedPlayer = nextResults.results.find((r) => r.isPlayer);
          if (
            !isSpectatingRef.current &&
            finishedPlayer &&
            finishedPlayer.timeMs != null &&
            nextResults.playerBestLapMs != null &&
            nextResults.playerBestLapMs >= 1000
          ) {
            const recordTrackId = isOnlineResultRef.current ? onlineTrackIdRef.current : trackId;
            const recordName = authUsernameRef.current ? `@${authUsernameRef.current}` : playerNameRef.current;
            const recordColor = finalSave.selectedColors?.[finishedPlayer.carId] ?? 0;
            void submitTrackRecord({
              trackId: recordTrackId,
              playerName: recordName,
              carId: finishedPlayer.carId,
              colorIndex: recordColor,
              bestLapMs: nextResults.playerBestLapMs,
              totalTimeMs: nextResults.totalTimeMs,
              laps: nextResults.totalLaps ?? 3,
              userId: authUserIdRef.current,
            }).then(setTrackRecords);
          }
          setAnnouncement(
            `Finis di posisi ${nextResults.playerPosition}. Waktu total ${formatTime(nextResults.totalTimeMs)}.${levelUpNote}`,
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
      screen === 'title' ||
      screen === 'garage' ||
      screen === 'customize-grid' ||
      screen === 'customize' ||
      screen === 'tracks' ||
      screen === 'multiplayer';
    engineRef.current?.audioController.setMenuMusic(inMenu);
  }, [screen]);

  useEffect(() => {
    if ((screen === 'customize' || screen === 'customize-grid') && !isGarageUnlocked(save)) {
      setScreen('title');
    }
  }, [screen, save]);

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
    const requested = carId ?? saveRef.current.selectedCarId;
    const id: CarId = isCarUnlocked(requested, saveRef.current) ? requested : 'mcqueen';
    const record = saveRef.current.bestLapMs[saveRef.current.selectedTrackId] ?? null;
    const savedCam = saveRef.current.cameraMode ?? 'top';
    const colorIdx = saveRef.current.selectedColors?.[id] ?? 0;
    const totalLaps = saveRef.current.selectedLaps ?? 3;
    const palette = applyCosmetics(
      getCarPalette(id, colorIdx),
      saveRef.current.cosmetics?.[id],
      saveRef.current.accessories?.[id],
    );
    setSnapshot(null);
    setResults(null);
    setIsOnlineResult(false);
    setControlsOpen(false);
    setAnnouncement('Balapan dimulai.');
    setShowHint(true);
    setCameraMode(savedCam);
    lapRef.current = 0;
    if (hintTimer.current != null) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setShowHint(false), 8000);
    setScreen('racing');
    const wantedTire = saveRef.current.selectedTire ?? 'standard';
    const tire: TireId = isTireUnlocked(wantedTire, saveRef.current) ? wantedTire : 'standard';
    const weather = { mode: saveRef.current.selectedWeather ?? 'clear', seed: randomWeatherSeed() };
    engine.startRace(id, record, savedCam, palette, totalLaps, tire, weather);
    window.requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
  }, []);

  const startExplore = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isTouch) void enterFullscreenLandscape();
    const savedCam = saveRef.current.cameraMode ?? 'top';
    setSnapshot(null);
    setResults(null);
    setIsOnlineResult(false);
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

  const selectTrack = (id: TrackId) => {
    if (!isTrackUnlocked(id, saveRef.current)) {
      const need = trackUnlockDef(id)?.level;
      setAnnouncement(need ? `Lintasan terkunci. Capai level ${need} untuk membukanya.` : 'Lintasan terkunci.');
      return;
    }
    if (id === saveRef.current.selectedTrackId) return;
    const nextSave: SaveData = { ...saveRef.current, selectedTrackId: id };
    commitSave(nextSave);
    engineRef.current?.setTrack(getTrack(id));
    setAnnouncement(`Lintasan ${getTrack(id).name} dipilih.`);
  };

  const selectLaps = (laps: LapCount) => {
    const nextSave: SaveData = { ...saveRef.current, selectedLaps: laps };
    commitSave(nextSave);
  };

  const selectTire = (id: TireId) => {
    if (!isTireUnlocked(id, saveRef.current)) {
      const need = tireUnlockDef(id)?.level;
      setAnnouncement(need ? `Ban terkunci. Capai level ${need} untuk membukanya.` : 'Ban terkunci.');
      return;
    }
    const nextSave: SaveData = { ...saveRef.current };
    if (id === 'standard') delete nextSave.selectedTire;
    else nextSave.selectedTire = id;
    commitSave(nextSave);
    setAnnouncement(`Ban ${TIRES[id].name} dipasang.`);
  };

  const selectWeather = (mode: WeatherMode) => {
    const nextSave: SaveData = { ...saveRef.current };
    if (mode === 'clear') delete nextSave.selectedWeather;
    else nextSave.selectedWeather = mode;
    commitSave(nextSave);
  };

  const selectCar = (id: CarId) => {
    if (!isCarUnlocked(id, saveRef.current)) {
      const need = carUnlockDef(id)?.level;
      setAnnouncement(need ? `Mobil terkunci. Capai level ${need} untuk membukanya.` : 'Mobil terkunci.');
      return;
    }
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

  const selectCosmetic = (carId: CarId, slot: 'rim' | 'glass', id: string | null) => {
    if (id != null) {
      const ok =
        slot === 'rim'
          ? isRimUnlocked(carId, id, saveRef.current)
          : isGlassUnlocked(carId, id, saveRef.current);
      if (!ok) return;
    }
    const prevAll = { ...(saveRef.current.cosmetics ?? {}) };
    const prevCar = { ...(prevAll[carId] ?? {}) };
    if (id == null) {
      delete prevCar[slot];
    } else {
      prevCar[slot] = id;
    }
    if (prevCar.rim || prevCar.glass) {
      prevAll[carId] = prevCar;
    } else {
      delete prevAll[carId];
    }
    const nextSave: SaveData = { ...saveRef.current };
    if (Object.keys(prevAll).length > 0) {
      nextSave.cosmetics = prevAll;
    } else {
      delete nextSave.cosmetics;
    }
    commitSave(nextSave);
  };

  const selectAccessory = (carId: CarId, slot: AccessorySlot, id: string | null) => {
    if (id != null && (!isAccessoryAvailable(carId, id) || !isAccessoryUnlocked(carId, id, saveRef.current))) {
      return;
    }
    const prevAll = { ...(saveRef.current.accessories ?? {}) };
    const prevCar = { ...(prevAll[carId] ?? {}) };
    if (id == null) {
      delete prevCar[slot];
    } else {
      prevCar[slot] = id;
    }
    if (Object.keys(prevCar).length > 0) {
      prevAll[carId] = prevCar;
    } else {
      delete prevAll[carId];
    }
    const nextSave: SaveData = { ...saveRef.current };
    if (Object.keys(prevAll).length > 0) {
      nextSave.accessories = prevAll;
    } else {
      delete nextSave.accessories;
    }
    commitSave(nextSave);
  };

  const openCustomize = (from: 'title' | 'garage') => {
    if (!isGarageUnlocked(saveRef.current)) {
      setAnnouncement('Garasi terkunci. Capai level 3 untuk membukanya.');
      return;
    }
    setCustomizeFrom(from);
    setScreen('customize-grid');
  };

  const openCustomizeDetail = (carId: CarId) => {
    selectCar(carId);
    setScreen('customize');
  };

  const closeCustomizeDetail = () => setScreen('customize-grid');
  const closeCustomizeGrid = () => setScreen(customizeFrom);

  const toggleMute = () => {
    const nextSave: SaveData = { ...saveRef.current, audioMuted: !saveRef.current.audioMuted };
    commitSave(nextSave);
    engineRef.current?.setMuted(nextSave.audioMuted);
    engineRef.current?.audioController.click();
  };

  const handleLogout = async () => {
    const currentUserId = authUserIdRef.current;
    if (currentUserId) {
      await cloudSyncRef.current?.flushPending(currentUserId);
    }
    await signOutAccount();
    authUserIdRef.current = null;
    setAuthUsername(null);
    hasCustomNameRef.current = false;
    setPlayerName(randomGuestName());
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
    if (hostedRoomCodeRef.current) {
      void removePublicRoom(hostedRoomCodeRef.current);
      hostedRoomCodeRef.current = null;
    }
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape' || event.repeat || event.defaultPrevented) return;
      if (controlsOpen) {
        event.preventDefault();
        setControlsOpen(false);
        return;
      }
      if (authOpen) {
        event.preventDefault();
        setAuthOpen(false);
        return;
      }
      if (screen === 'garage') {
        event.preventDefault();
        setScreen('title');
      } else if (screen === 'customize') {
        event.preventDefault();
        closeCustomizeDetail();
      } else if (screen === 'customize-grid') {
        event.preventDefault();
        closeCustomizeGrid();
      } else if (screen === 'tracks') {
        event.preventDefault();
        setScreen('garage');
      } else if (screen === 'multiplayer' || screen === 'results') {
        event.preventDefault();
        goToTitle();
      } else if (screen === 'paused') {
        event.preventDefault();
        resumeRace();
      } else if (screen === 'title') {
        event.preventDefault();
        startExplore();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const returnToLobby = () => {
    engineRef.current?.quitToTitle();
    setScreen('multiplayer');
    setSnapshot(null);
    setResults(null);
    setIsOnlineResult(false);
    isSpectatingRef.current = false;
    setIsSpectating(false);
    setSpectateLabel('');
    setShowHint(false);
  };

  const openMultiplayer = useCallback(() => {
    setMpError('');
    if (!authUserIdRef.current && !hasCustomNameRef.current) {
      setPlayerName(randomGuestName());
    }
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
        const spectating = Boolean(payload.isSpectator);
        isSpectatingRef.current = spectating;
        setIsSpectating(spectating);
        setSpectateLabel(payload.participants[0]?.name ?? '');
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
          payload.totalLaps,
          spectating,
          payload.weather ? { mode: payload.weather, seed: payload.weatherSeed ?? 1 } : undefined,
        );
        window.requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
      },
      onSnapshot: (worldSnap) => {
        engineRef.current?.applyOnlineSnapshot(worldSnap);
      },
      onRaceFinished: (raceResults) => {
        setIsOnlineResult(true);
        const myId = client.playerId;
        const myRow = myId ? raceResults.results.find((r) => r.id === myId) : undefined;
        const personalizedResults: RaceResults = myRow
          ? {
            ...raceResults,
            results: raceResults.results.map((r) => ({ ...r, isPlayer: r.id === myId })),
            playerPosition: myRow.position,
            playerBestLapMs: myRow.bestLapMs,
            totalTimeMs: myRow.timeMs ?? raceResults.totalTimeMs,
          }
          : raceResults;
        engineRef.current?.finishOnlineRace(personalizedResults);
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

  const refreshPublicRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const list = await listPublicRooms();
      setPublicRooms(list);
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (screen !== 'multiplayer' || roomState) return;
    void refreshPublicRooms();
    const timer = window.setInterval(() => {
      void refreshPublicRooms();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [screen, roomState, refreshPublicRooms]);

  useEffect(() => {
    if (!roomState || !netPlayerId || roomState.hostId !== netPlayerId) {
      return;
    }
    hostedRoomCodeRef.current = roomState.roomCode;
    const hostPlayer = roomState.players.find((p) => p.isHost) ?? roomState.players[0];
    const publish = () => {
      void publishPublicRoom({
        roomCode: roomState.roomCode,
        hostName: hostPlayer?.name ?? playerName,
        trackId: roomState.trackId,
        totalLaps: roomState.totalLaps ?? 3,
        playerCount: roomState.players.length,
        maxPlayers: 8,
        status: roomState.status,
      });
    };
    publish();
    const heartbeat = window.setInterval(publish, 5_000);
    return () => window.clearInterval(heartbeat);
  }, [roomState, netPlayerId, playerName]);

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
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      netClientRef.current?.disconnect();
    };
  }, []);

  const menuNavActive =
    controlsOpen ||
    authOpen ||
    (screen !== 'racing' && screen !== 'explore' && screen !== 'online-racing' && screen !== 'loading');
  useGamepadMenu(menuNavActive);
  useMenuNavigation(menuNavActive, `${screen}:${controlsOpen ? 'c' : ''}:${authOpen ? 'a' : ''}`);

  const paused = screen === 'paused';
  const exploreScreen = screen === 'explore';
  const onlineScreen = screen === 'online-racing';
  const racingScreen = screen === 'racing' || exploreScreen || onlineScreen;
  const showTopBar =
    screen === 'title' ||
    screen === 'garage' ||
    screen === 'customize' ||
    screen === 'tracks' ||
    screen === 'multiplayer';
  const showFooter =
    screen === 'title' ||
    screen === 'garage' ||
    screen === 'customize' ||
    screen === 'tracks' ||
    screen === 'multiplayer';

  return (
    <div
      className="app-shell"
      data-screen={screen}
      data-touch={isTouch ? 'true' : 'false'}
      data-fullscreen={isFullscreen ? 'true' : 'false'}
    >
      <h1 className="sr-only">Mobile Piston</h1>

      <header className="topbar" hidden={!showTopBar}>
        <div className="topbar-left">
          <div
            className="brand-lockup"
            aria-label={authUsername ? `Masuk sebagai @${authUsername}` : `Bermain sebagai ${playerName}`}
          >
            <span className="brand-mark" aria-hidden="true">
              {getUserInitials(authUsername ?? playerName)}
            </span>
            <span className="brand-copy">
              <strong>{authUsername ? `@${authUsername}` : playerName}</strong>
              <small>{selectedTrack.name}</small>
            </span>
          </div>
          {authUsername ? (
            <button
              className="btn btn-quiet btn-small btn-icon-only"
              type="button"
              onClick={handleLogout}
              aria-label="Keluar"
              title="Keluar"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 17l5-5-5-5M21 12H9"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  fill="none"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
              </svg>
            </button>
          ) : (
            <button
              className="btn btn-small topbar-auth-btn"
              type="button"
              onClick={() => setAuthOpen(true)}
              title="Progres tersimpan di browser ini. Ketuk untuk Masuk atau Daftar."
            >
              Masuk
            </button>
          )}
        </div>
        <div className="topbar-actions">
          <button
            className="btn btn-quiet btn-small btn-icon-only"
            type="button"
            onClick={toggleMute}
            aria-label={save.audioMuted ? 'Nyalakan suara' : 'Matikan suara'}
            title={save.audioMuted ? 'Suara mati' : 'Suara nyala'}
          >
            {save.audioMuted ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11 5L6 9H2V15H6L11 19V5Z" fill="currentColor" />
                <path d="M22 9L16 15M16 9L22 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11 5L6 9H2V15H6L11 19V5Z" fill="currentColor" />
                <path d="M15.5 8.5C16.8 9.8 16.8 14.2 15.5 15.5M18.5 6C21 8.5 21 15.5 18.5 18" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="square" />
              </svg>
            )}
          </button>
          <button
            className="btn btn-quiet btn-small btn-icon-only"
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
            title={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {isFullscreen ? (
                <path d="M9 4V9H4M15 4V9H20M9 20V15H4M15 20V15H20" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="square" />
              ) : (
                <path d="M4 9V4H9M20 9V4H15M4 15V20H9M20 15V20H15" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="square" />
              )}
            </svg>
          </button>
          <button
            className="btn btn-quiet btn-small btn-icon-only"
            type="button"
            onClick={openControls}
            aria-label="Pengaturan dan kontrol"
            title="Pengaturan & Kontrol"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" fill="none" />
              <path
                d="M12 2.5v2.3M12 19.2v2.3M4.93 4.93l1.63 1.63M17.44 17.44l1.63 1.63M2.5 12h2.3M19.2 12h2.3M4.93 19.07l1.63-1.63M17.44 6.56l1.63-1.63"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="square"
              />
            </svg>
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
              trackRecords={trackRecords}
              onStart={() => setScreen('garage')}
              onMultiplayer={openMultiplayer}
              onGarage={() => openCustomize('title')}
              garageUnlocked={garageUnlocked}
              onControls={openControls}
              xp={save.xp ?? 0}
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
              publicRooms={publicRooms}
              roomsLoading={roomsLoading}
              onRefreshRooms={refreshPublicRooms}
              onChangeName={(nextName) => {
                hasCustomNameRef.current = nextName.trim().length > 0;
                setPlayerName(nextName);
                if (roomState) {
                  netClientRef.current?.updateLoadout(save.selectedCarId, selectedColorIndex, nextName);
                }
              }}
              carLockLevel={(id) => (isCarUnlocked(id, save) ? null : (carUnlockDef(id)?.level ?? null))}
              onSelectCar={(id) => {
                if (!isCarUnlocked(id, saveRef.current)) {
                  selectCar(id);
                  return;
                }
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
              onSelectLaps={(laps) => {
                selectLaps(laps);
                netClientRef.current?.setLaps(laps);
              }}
              onSelectWeather={(weather) => {
                selectWeather(weather);
                netClientRef.current?.setWeather(weather);
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
              cosmetics={save.cosmetics}
              accessories={save.accessories}
              garageUnlocked={garageUnlocked}
              onOpenCustomize={() => openCustomize('garage')}
              xp={save.xp ?? 0}
              unlocks={save.unlocks}
              selectedTire={save.selectedTire ?? 'standard'}
              onSelectTire={selectTire}
              onSelect={selectCar}
              onSelectColor={selectCarColor}
              onBack={() => setScreen('title')}
              onStart={() => setScreen('tracks')}
            />
          )}
          {screen === 'customize-grid' && (
            <GarageCatalogScreen
              selectedCarId={save.selectedCarId}
              carUsage={save.carUsage ?? {}}
              xp={save.xp ?? 0}
              unlocks={save.unlocks}
              returnLabel={customizeFrom === 'garage' ? 'Pilih mobil' : 'Kembali'}
              onOpenCar={openCustomizeDetail}
              onBack={closeCustomizeGrid}
            />
          )}
          {screen === 'customize' && (
            <CustomizeGarageScreen
              selectedCarId={save.selectedCarId}
              selectedColors={save.selectedColors ?? {}}
              cosmetics={save.cosmetics ?? {}}
              accessories={save.accessories ?? {}}
              carUsage={save.carUsage ?? {}}
              xp={save.xp ?? 0}
              unlocks={save.unlocks}
              returnLabel="Semua mobil"
              onSelectCar={selectCar}
              onSelectColor={selectCarColor}
              onSelectCosmetic={selectCosmetic}
              onSelectAccessory={selectAccessory}
              onBack={closeCustomizeDetail}
            />
          )}
          {screen === 'tracks' && (
            <TrackSelectScreen
              selectedTrackId={save.selectedTrackId}
              selectedLaps={save.selectedLaps ?? 3}
              bestLapMs={save.bestLapMs}
              onSelect={selectTrack}
              onSelectLaps={selectLaps}
              weather={save.selectedWeather ?? 'clear'}
              onSelectWeather={selectWeather}
              tireName={getTire(save.selectedTire).name}
              xp={save.xp ?? 0}
              unlocks={save.unlocks}
              trackRecords={trackRecords}
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
              {onlineScreen && isSpectating && (
                <div className="spectate-bar" role="group" aria-label="Kontrol penonton">
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => {
                      const next = engineRef.current?.cycleSpectator(-1);
                      if (next) setSpectateLabel(next.label);
                    }}
                    aria-label="Pembalap sebelumnya"
                  >
                    &lt;
                  </button>
                  <span className="spectate-label">
                    Penonton · {spectateLabel || 'Pembalap'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => {
                      const next = engineRef.current?.cycleSpectator(1);
                      if (next) setSpectateLabel(next.label);
                    }}
                    aria-label="Pembalap berikutnya"
                  >
                    &gt;
                  </button>
                </div>
              )}
              {isTouch && !isSpectating && (
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
              trackName={isOnlineResult ? getTrack(onlineTrackId).name : selectedTrack.name}
              onRestart={restartRace}
              onGarage={goToGarage}
              onMenu={goToTitle}
              onReturnToLobby={isOnlineResult ? returnToLobby : undefined}
              xpReport={xpReport}
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
