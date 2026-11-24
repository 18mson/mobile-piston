'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CarId, RaceResults, RaceSnapshot, SaveData, TrackId } from '../game/types';
import { CARS } from '../game/data/cars';
import { getTrack } from '../game/track/tracks';
import { defaultSave, loadSave, persistSave } from '../game/save';
import { GameEngine } from '../game/engine';
import { formatTime } from '../game/utils';
import TitleScreen from './screens/TitleScreen';
import GarageScreen from './screens/GarageScreen';
import PauseDialog from './screens/PauseDialog';
import ControlsDialog from './screens/ControlsDialog';
import ResultsScreen from './screens/ResultsScreen';
import TrackSelectScreen from './screens/TrackSelectScreen';
import RaceHud from './hud/RaceHud';
import TouchControls from './hud/TouchControls';
import { useGamepadMenu } from './useGamepadMenu';

type Screen = 'loading' | 'title' | 'garage' | 'tracks' | 'racing' | 'paused' | 'results' | 'error';

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
  const [isTouch, setIsTouch] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const hintTimer = useRef<number | null>(null);
  const lapRef = useRef(0);

  const selectedCar = CARS[save.selectedCarId];
  const selectedTrack = getTrack(save.selectedTrackId);
  const bestLapMs = save.bestLapMs[selectedTrack.id] ?? null;

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    const loaded = loadSave();
    setSave(loaded);
    saveRef.current = loaded;
    const touchCapable =
      window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
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
          setSave(nextSave);
          saveRef.current = nextSave;
          persistSave(nextSave);
          setAnnouncement(
            `Finis di posisi ${nextResults.playerPosition}. Waktu total ${formatTime(nextResults.totalTimeMs)}.`,
          );
        },
        onPause: () => {
          setScreen((currentScreen) => (currentScreen === 'racing' ? 'paused' : currentScreen));
        },
        onError: (message) => {
          setErrorMessage(message);
          setScreen('error');
        },
      }, getTrack(loaded.selectedTrackId));
    } catch (error) {
      setErrorMessage('WebGL tidak tersedia di browser ini. Aktifkan akselerasi grafis lalu muat ulang.');
      setScreen('error');
      return;
    }

    engineRef.current = engine;
    engine.setMuted(loaded.audioMuted);

    if (process.env.NODE_ENV !== 'production') {
      window.__MOBILE_PISTON__ = {
        finishRace: () => engine.debugFinishRace(),
        getMode: () => engine.currentMode,
        getDebugState: () => engine.debugState(),
      };
    }

    return () => {
      if (process.env.NODE_ENV !== 'production') delete window.__MOBILE_PISTON__;
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hintTimer.current != null) window.clearTimeout(hintTimer.current);
    };
  }, []);

  const startRace = useCallback((carId?: CarId) => {
    const engine = engineRef.current;
    if (!engine) return;
    const id = carId ?? saveRef.current.selectedCarId;
    const record = saveRef.current.bestLapMs[saveRef.current.selectedTrackId] ?? null;
    setSnapshot(null);
    setResults(null);
    setControlsOpen(false);
    setAnnouncement('Balapan dimulai. Gas otomatis.');
    setShowHint(true);
    lapRef.current = 0;
    if (hintTimer.current != null) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setShowHint(false), 8000);
    setScreen('racing');
    engine.startRace(id, record);
    window.requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
  }, []);

  const selectTrack = (id: TrackId) => {
    if (id === saveRef.current.selectedTrackId) return;
    const nextSave: SaveData = { ...saveRef.current, selectedTrackId: id };
    setSave(nextSave);
    saveRef.current = nextSave;
    persistSave(nextSave);
    engineRef.current?.setTrack(getTrack(id));
    setAnnouncement(`Lintasan ${getTrack(id).name} dipilih.`);
  };

  const selectCar = (id: CarId) => {
    const nextSave: SaveData = { ...saveRef.current, selectedCarId: id };
    setSave(nextSave);
    saveRef.current = nextSave;
    persistSave(nextSave);
  };

  const toggleMute = () => {
    const nextSave: SaveData = { ...saveRef.current, audioMuted: !saveRef.current.audioMuted };
    setSave(nextSave);
    saveRef.current = nextSave;
    persistSave(nextSave);
    engineRef.current?.setMuted(nextSave.audioMuted);
    engineRef.current?.audioController.click();
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
    engineRef.current?.quitToTitle();
    setScreen('title');
    setSnapshot(null);
    setResults(null);
    setShowHint(false);
  };

  useGamepadMenu(screen !== 'racing' && screen !== 'loading');

  const paused = screen === 'paused';
  const racingScreen = screen === 'racing';
  const showTopBar = screen === 'title' || screen === 'garage' || screen === 'tracks';
  const showFooter = screen === 'title' || screen === 'garage' || screen === 'tracks';

  return (
    <div className="app-shell" data-screen={screen}>
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
              selectedCar={selectedCar}
              track={selectedTrack}
              bestLapMs={bestLapMs}
              onStart={() => startRace()}
              onGarage={() => setScreen('garage')}
              onTracks={() => setScreen('tracks')}
              onControls={openControls}
            />
          )}
          {screen === 'garage' && (
            <GarageScreen
              selectedCarId={save.selectedCarId}
              onSelect={selectCar}
              onBack={() => setScreen('title')}
              onStart={() => startRace()}
            />
          )}
          {screen === 'tracks' && (
            <TrackSelectScreen
              selectedTrackId={save.selectedTrackId}
              bestLapMs={save.bestLapMs}
              onSelect={selectTrack}
              onBack={() => setScreen('title')}
              onStart={() => startRace()}
            />
          )}
          {racingScreen && (
            <>
              <RaceHud snapshot={snapshot} track={selectedTrack} onPause={() => engineRef.current?.pause()} onCycleCamera={() => engineRef.current?.cycleCamera()} showHint={showHint} />
              {isTouch && (
                <TouchControls
                  onChange={(action, pressed) => engineRef.current?.setTouchControl(action, pressed)}
                />
              )}
            </>
          )}
          {paused && (
            <>
              <RaceHud snapshot={snapshot} track={selectedTrack} onPause={() => undefined} onCycleCamera={() => undefined} showHint={false} />
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
        <span>Mobile Piston / Teluk Sore</span>
        <span>Keyboard, sentuh, dan gamepad. Tidak ada data yang dikirim.</span>
      </footer>

      {controlsOpen && <ControlsDialog open={controlsOpen} onClose={() => setControlsOpen(false)} />}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
