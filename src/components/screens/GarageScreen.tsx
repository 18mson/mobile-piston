'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CarCosmetics, CarId, CarSpec, TireId } from '../../game/types';
import { carUnlockDef, isCarUnlocked } from '../../game/progression';
import styles from '../progression.module.css';
import TirePicker from '../TirePicker';
import { CARS, CAR_COLORS, CAR_ORDER, getCarPalette } from '../../game/data/cars';
import { applyCosmetics } from '../../game/data/cosmetics';
import CarThumb from '../CarThumb';
import StatBars from '../StatBars';

export default function GarageScreen({
  selectedCarId,
  selectedColors,
  onSelect,
  onSelectColor,
  onBack,
  onStart,
  xp = 0,
  unlocks,
  selectedTire = 'standard',
  onSelectTire,
  cosmetics,
  garageUnlocked = false,
  onOpenCustomize,
}: {
  xp?: number;
  unlocks?: string[];
  selectedTire?: TireId;
  onSelectTire?: (id: TireId) => void;
  selectedCarId: CarId;
  selectedColors: Partial<Record<CarId, number>>;
  cosmetics?: Partial<Record<CarId, CarCosmetics>>;
  garageUnlocked?: boolean;
  onOpenCustomize?: () => void;
  onSelect: (id: CarId) => void;
  onSelectColor: (id: CarId, colorIndex: number) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  // A locked car can be previewed (to tempt the player) but never selected.
  const [previewId, setPreviewId] = useState<CarId | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncScrollState = useCallback(() => {
    const el = gridRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    syncScrollState();
    const el = gridRef.current;
    if (!el) return;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncScrollState) : null;
    ro?.observe(el);
    window.addEventListener('resize', syncScrollState);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', syncScrollState);
    };
  }, [syncScrollState]);

  const scrollCars = (dir: -1 | 1) => {
    const el = gridRef.current;
    if (!el) return;
    const step = Math.max(220, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const hasOverflow = canScrollLeft || canScrollRight;
  const shownId: CarId = previewId ?? selectedCarId;
  const lockLevel = (id: CarId): number | null =>
    isCarUnlocked(id, { xp, unlocks }) ? null : (carUnlockDef(id)?.level ?? null);
  const shownLockLevel = lockLevel(shownId);

  const activeColorIndex = selectedColors[shownId] ?? 0;
  const selected: CarSpec = {
    ...CARS[shownId],
    palette: applyCosmetics(getCarPalette(shownId, activeColorIndex), cosmetics?.[shownId]),
  };
  const colorOptions = CAR_COLORS[shownId];
  const orderedCars = [...CAR_ORDER].sort((a, b) => {
    const la = lockLevel(a) ?? 0;
    const lb = lockLevel(b) ?? 0;
    if (la === lb) return 0;
    if (la === 0) return -1;
    if (lb === 0) return 1;
    return la - lb;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      const inCarCard = Boolean(active?.classList.contains('car-card'));
      const inTopOrPicker = Boolean(
        active?.closest('.screen-heading-row, .color-swatches, .tire-picker'),
      );

      if (event.key === 'Enter' && !inTopOrPicker && shownLockLevel == null) {
        event.preventDefault();
        onStart();
        return;
      }

      if ((inCarCard || !inTopOrPicker) && (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key.toLowerCase() === 'a' || event.key.toLowerCase() === 'd')) {
        const dir = event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a' ? -1 : 1;
        const idx = orderedCars.indexOf(shownId);
        if (idx === -1) return;
        const nextIdx = (idx + dir + orderedCars.length) % orderedCars.length;
        const nextId = orderedCars[nextIdx];
        if (!nextId) return;
        event.preventDefault();
        const need = lockLevel(nextId);
        if (need != null) {
          setPreviewId(nextId);
        } else {
          setPreviewId(null);
          onSelect(nextId);
        }
        const prevFocused = document.querySelectorAll<HTMLElement>('[data-nav-focus="true"]');
        for (const el of prevFocused) {
          el.removeAttribute('data-nav-focus');
        }
        const cards = gridRef.current?.querySelectorAll<HTMLButtonElement>('.car-card');
        const nextCard = cards?.[nextIdx];
        if (nextCard) {
          nextCard.focus({ preventScroll: true });
          nextCard.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  });

  return (
    <section className="screen garage-screen" data-menu-scope="active" aria-labelledby="garage-heading">
      <div className="garage-panel">
        <div className="screen-heading-row">
          <button className="btn btn-quiet" type="button" onClick={onBack} data-nav data-gamepad-back>
            Kembali
          </button>
          <div>
            <p className="eyebrow">Langkah 1 / 2</p>
            <h2 id="garage-heading">Pilih mobil</h2>
          </div>
          {onOpenCustomize && (
            <button
              className="btn"
              type="button"
              disabled={!garageUnlocked || previewId != null}
              title={
                !garageUnlocked
                  ? 'Garasi terbuka di Level 3'
                  : previewId != null
                    ? 'Pilih mobil yang sudah terbuka dulu'
                    : 'Kustomisasi jendela dan velg mobil ini'
              }
              aria-label={
                !garageUnlocked
                  ? 'Garasi terkunci, capai Level 3'
                  : previewId != null
                    ? 'Garasi nonaktif: pilih mobil yang sudah terbuka dulu'
                    : `Buka Garasi untuk ${selected.name}`
              }
              onClick={onOpenCustomize}
              data-nav
            >
              {garageUnlocked ? 'Garasi' : 'Garasi · Level 3'}
            </button>
          )}
          <button
            className="btn btn-primary screen-heading-cta"
            type="button"
            disabled={shownLockLevel != null}
            title={shownLockLevel != null ? `Capai Level ${shownLockLevel} untuk memakai ${selected.name}` : undefined}
            onClick={() => {
              if (shownLockLevel != null) return;
              onStart();
            }}
            data-nav
          >
            Pilih lintasan
          </button>
        </div>

        <div className="garage-layout">
          <aside className="car-detail panel" aria-label={`Detail ${selected.name}`}>
            <div className={shownLockLevel != null ? `car-detail-visual ${styles.lockedPreview}` : 'car-detail-visual'}>
              <span className="car-stage-number" aria-hidden="true">#{selected.number ?? 1}</span>
              <CarThumb car={selected} number={selected.number ?? 1} scale={6} />
              {shownLockLevel != null && (
                <p className={styles.lockStageBadge} role="status">
                  Terkunci. Capai Level {shownLockLevel} untuk membuka {selected.name}.
                </p>
              )}
            </div>

            <div className="car-detail-info">
              <div className="car-detail-heading">
                <div>
                  <span className="label">{shownLockLevel == null ? 'Mobil terpilih' : 'Pratinjau (terkunci)'}</span>
                  <h3>{selected.name}</h3>
                  <p className="car-kind">{selected.kind}</p>
                </div>
                <span className="car-number">#{selected.number ?? 1}</span>
              </div>

              <div className="car-detail-specs">
                <div className="color-picker" role="group" aria-label={`Variasi warna ${selected.name}`}>
                  <span className="label">Warna ({colorOptions[activeColorIndex]?.label ?? colorOptions[0].label})</span>
                  <div className="color-swatches">
                    {colorOptions.map((option, index) => (
                      <button
                        key={option.id}
                        type="button"
                        className="color-swatch"
                        data-active={index === activeColorIndex}
                        aria-label={`Warna ${option.label}`}
                        aria-pressed={index === activeColorIndex}
                        disabled={shownLockLevel != null}
                        onClick={() => onSelectColor(shownId, index)}
                        style={{
                          background: `linear-gradient(135deg, ${option.palette.body} 62%, ${option.palette.stripe} 62%)`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <StatBars car={selected} />
              </div>

              {onSelectTire && <TirePicker selectedTire={selectedTire} xp={xp} unlocks={unlocks} onSelect={onSelectTire} />}

              <p className="car-blurb">{selected.blurb}</p>
            </div>
          </aside>

          <div className="car-carousel">
            {hasOverflow && (
              <button
                type="button"
                className="car-carousel-btn car-carousel-prev"
                aria-label="Geser daftar mobil ke kiri"
                disabled={!canScrollLeft}
                onClick={() => scrollCars(-1)}
              >
                <span aria-hidden="true">&#9664;</span>
              </button>
            )}
            <div
              ref={gridRef}
              className="car-grid"
              role="group"
              aria-label="Daftar mobil"
              onScroll={syncScrollState}
            >
              {orderedCars.map((id) => {
                const colorIdx = selectedColors[id] ?? 0;
                const car: CarSpec = {
                  ...CARS[id],
                  palette: applyCosmetics(getCarPalette(id, colorIdx), cosmetics?.[id]),
                };
                const selectedCard = id === selectedCarId && previewId == null;
                const needLevel = lockLevel(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={needLevel == null ? 'car-card' : `car-card ${styles.lockedCard}`}
                    data-selected={selectedCard}
                    data-locked={needLevel != null}
                    aria-pressed={selectedCard}
                    onClick={() => {
                      if (needLevel != null) {
                        setPreviewId(id);
                        return;
                      }
                      setPreviewId(null);
                      onSelect(id);
                    }}
                    data-nav
                  >
                    <span className="car-card-visual">
                      <CarThumb car={car} number={car.number ?? 1} scale={3} staticView />
                    </span>
                    <span className="car-card-top">
                      <strong>{car.name}</strong>
                      <span>#{car.number ?? 1}</span>
                    </span>
                    <span className="car-card-state">
                      {needLevel != null ? `Level ${needLevel}` : selectedCard ? 'Terpilih' : car.kind}
                    </span>
                  </button>
                );
              })}
            </div>
            {hasOverflow && (
              <button
                type="button"
                className="car-carousel-btn car-carousel-next"
                aria-label="Geser daftar mobil ke kanan"
                disabled={!canScrollRight}
                onClick={() => scrollCars(1)}
              >
                <span aria-hidden="true">&#9654;</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
