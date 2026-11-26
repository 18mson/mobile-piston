'use client';

import { useState } from 'react';
import type { CarId, CarSpec, TireId } from '../../game/types';
import { carUnlockDef, isCarUnlocked } from '../../game/progression';
import styles from '../progression.module.css';
import TirePicker from '../TirePicker';
import { CARS, CAR_COLORS, CAR_ORDER, getCarPalette } from '../../game/data/cars';
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
}: {
  xp?: number;
  unlocks?: string[];
  selectedTire?: TireId;
  onSelectTire?: (id: TireId) => void;
  selectedCarId: CarId;
  selectedColors: Partial<Record<CarId, number>>;
  onSelect: (id: CarId) => void;
  onSelectColor: (id: CarId, colorIndex: number) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  // A locked car can be previewed (to tempt the player) but never selected.
  const [previewId, setPreviewId] = useState<CarId | null>(null);
  const shownId: CarId = previewId ?? selectedCarId;
  const lockLevel = (id: CarId): number | null =>
    isCarUnlocked(id, { xp, unlocks }) ? null : (carUnlockDef(id)?.level ?? null);
  const shownLockLevel = lockLevel(shownId);

  const activeColorIndex = selectedColors[shownId] ?? 0;
  const selected: CarSpec = {
    ...CARS[shownId],
    palette: getCarPalette(shownId, activeColorIndex),
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
              <CarThumb car={selected} scale={6} />
            </div>

            <div className="car-detail-info">
              <div className="car-detail-heading">
                <div>
                  <span className="label">{shownLockLevel == null ? 'Mobil terpilih' : 'Pratinjau (terkunci)'}</span>
                  <h3>{selected.name}</h3>
                  <p className="car-kind">{selected.kind}</p>
                </div>
                <span className="car-number">#{1}</span>
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
                {onSelectTire && <TirePicker selectedTire={selectedTire} xp={xp} unlocks={unlocks} onSelect={onSelectTire} />}
              </div>

              {shownLockLevel != null && (
                <p className={styles.lockNote} role="status">
                  Terkunci. Capai Level {shownLockLevel} untuk membuka {selected.name}.
                </p>
              )}
              <p className="car-blurb">{selected.blurb}</p>
              <p className="detail-note">Drift mengisi meter nitro. Variasi warna tidak memengaruhi stat.</p>
            </div>
          </aside>

          <div className="car-grid" role="group" aria-label="Daftar mobil">
            {orderedCars.map((id) => {
              const colorIdx = selectedColors[id] ?? 0;
              const car: CarSpec = {
                ...CARS[id],
                palette: getCarPalette(id, colorIdx),
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
                  {needLevel != null && <span className={styles.lockTag}>Level {needLevel}</span>}
                  <span className="car-card-top">
                    <strong>{car.name}</strong>
                    <span>{car.kind}</span>
                  </span>
                  <StatBars car={car} compact />
                  <span className="car-card-state">
                    {needLevel != null ? `Terkunci: Level ${needLevel}` : selectedCard ? 'Mobil terpilih' : 'Pilih mobil'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
