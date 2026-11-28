'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { CARS, CAR_ORDER, getCarPalette } from '../../game/data/cars';
import { GLASSES, RIMS, applyCosmetics, getGlass, getRim } from '../../game/data/cosmetics';
import {
  describeRequirement,
  getUsage,
  isGlassUnlocked,
  isRimUnlocked,
  requirementProgress,
} from '../../game/garage';
import { isCarUnlocked } from '../../game/progression';
import type { CarCosmetics, CarId, CarSpec, CarUsage } from '../../game/types';
import CarThumb from '../CarThumb';
import styles from '../garageCustom.module.css';

type CustomizeTab = 'glass' | 'rim';

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export default function CustomizeGarageScreen({
  selectedCarId,
  selectedColors,
  cosmetics,
  carUsage,
  xp = 0,
  unlocks,
  returnLabel,
  onSelectCar,
  onSelectCosmetic,
  onBack,
}: {
  selectedCarId: CarId;
  selectedColors: Partial<Record<CarId, number>>;
  cosmetics: Partial<Record<CarId, CarCosmetics>>;
  carUsage: Partial<Record<CarId, CarUsage>>;
  xp?: number;
  unlocks?: string[];
  returnLabel: string;
  onSelectCar: (id: CarId) => void;
  onSelectCosmetic: (carId: CarId, slot: 'rim' | 'glass', id: string | null) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<CustomizeTab>('glass');
  const [previewGlass, setPreviewGlass] = useState<string | null>(null);
  const [previewRim, setPreviewRim] = useState<string | null>(null);

  const unlockedCars = CAR_ORDER.filter((id) => isCarUnlocked(id, { xp, unlocks }));
  const currentIdx = Math.max(0, unlockedCars.indexOf(selectedCarId));
  const carId: CarId = unlockedCars[currentIdx] ?? 'mcqueen';

  const baseColorIdx = selectedColors[carId] ?? 0;
  const equipped: CarCosmetics = cosmetics[carId] ?? {};
  const previewCosmetics: CarCosmetics = {
    glass: previewGlass ?? equipped.glass,
    rim: previewRim ?? equipped.rim,
  };
  const carSpec: CarSpec = {
    ...CARS[carId],
    palette: applyCosmetics(getCarPalette(carId, baseColorIdx), previewCosmetics),
  };
  const usage = getUsage({ carUsage }, carId);

  const cycleCar = (dir: -1 | 1) => {
    if (unlockedCars.length <= 1) return;
    const nextIdx = (currentIdx + dir + unlockedCars.length) % unlockedCars.length;
    const nextId = unlockedCars[nextIdx];
    if (!nextId) return;
    setPreviewGlass(null);
    setPreviewRim(null);
    onSelectCar(nextId);
  };

  const activePreviewId = tab === 'glass' ? previewGlass : previewRim;
  const lockedPreviewItem =
    tab === 'glass'
      ? (previewGlass ? getGlass(previewGlass) : undefined)
      : (previewRim ? getRim(previewRim) : undefined);
  const lockedReq = lockedPreviewItem ? requirementProgress(lockedPreviewItem.req, usage) : null;
  const equippedLabel =
    tab === 'glass'
      ? getGlass(equipped.glass)?.label ?? 'Bawaan'
      : getRim(equipped.rim)?.label ?? 'Bawaan';

  return (
    <section className="screen garage-screen" data-menu-scope="active" aria-labelledby="customize-heading">
      <div className={`garage-panel ${styles.customPanel}`}>
        <div className="screen-heading-row">
          <button className="btn btn-quiet" type="button" onClick={onBack} data-nav data-gamepad-back>
            {returnLabel}
          </button>
          <div>
            <p className="eyebrow">Garasi</p>
            <h2 id="customize-heading">{carSpec.name}</h2>
          </div>
          {unlockedCars.length > 1 && (
            <div className={styles.carSwitcher} role="group" aria-label="Ganti mobil">
              <button
                type="button"
                className="btn btn-quiet btn-small"
                onClick={() => cycleCar(-1)}
                aria-label="Mobil sebelumnya"
                data-nav
              >
                &#9664;
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-small"
                onClick={() => cycleCar(1)}
                aria-label="Mobil berikutnya"
                data-nav
              >
                &#9654;
              </button>
            </div>
          )}
        </div>

        <div className={styles.customLayout}>
          <div className={`panel ${styles.stageCol}`}>
            <div className={styles.stageHead}>
              <div>
                <span className="label">{carSpec.kind}</span>
                <h3>{carSpec.name}</h3>
              </div>
              <span className="car-number">#{carSpec.number ?? 1}</span>
            </div>

            <div className="car-detail-visual">
              <span className="car-stage-number" aria-hidden="true">#{carSpec.number ?? 1}</span>
              <CarThumb car={carSpec} number={carSpec.number ?? 1} scale={6} autoRotate={false} />
            </div>

            <div className={styles.usageRow} role="group" aria-label={`Statistik pemakaian ${carSpec.name}`}>
              <div className={styles.usageStat}>
                <span className="label">Balapan</span>
                <strong>{usage.races}</strong>
              </div>
              <div className={styles.usageStat}>
                <span className="label">Putaran</span>
                <strong>{usage.laps}</strong>
              </div>
              <div className={styles.usageStat}>
                <span className="label">Podium</span>
                <strong>{usage.podiums}</strong>
              </div>
            </div>
          </div>

          <div className={`panel ${styles.rightCol}`}>
            <div className={styles.tabs} role="tablist" aria-label="Kategori kustomisasi">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'glass'}
                className={styles.tabBtn}
                data-active={tab === 'glass'}
                onClick={() => {
                  setTab('glass');
                  setPreviewRim(null);
                }}
                data-nav
              >
                Jendela
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'rim'}
                className={styles.tabBtn}
                data-active={tab === 'rim'}
                onClick={() => {
                  setTab('rim');
                  setPreviewGlass(null);
                }}
                data-nav
              >
                Velg
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={false}
                disabled
                aria-disabled="true"
                className={styles.tabBtn}
                title="Aksesori segera hadir pada pembaruan berikutnya"
              >
                <span>Aksesori</span>
                <span className={styles.soonTag}>Segera hadir</span>
              </button>
            </div>

            <div className={styles.itemGrid} role="group" aria-label={tab === 'glass' ? 'Pilihan warna jendela' : 'Pilihan velg'}>
              <button
                type="button"
                className={styles.itemCard}
                data-active={tab === 'glass' ? equipped.glass == null && !previewGlass : equipped.rim == null && !previewRim}
                aria-pressed={tab === 'glass' ? equipped.glass == null : equipped.rim == null}
                aria-label={`${tab === 'glass' ? 'Kaca' : 'Velg'} Bawaan`}
                onClick={() => {
                  if (tab === 'glass') {
                    setPreviewGlass(null);
                    onSelectCosmetic(carId, 'glass', null);
                  } else {
                    setPreviewRim(null);
                    onSelectCosmetic(carId, 'rim', null);
                  }
                }}
                data-nav
              >
                <span className={styles.swatchStock} aria-hidden="true">STD</span>
                <span className={styles.itemLabel}>Bawaan</span>
                {(tab === 'glass' ? equipped.glass == null : equipped.rim == null) && (
                  <span className={styles.itemState}>Terpasang</span>
                )}
              </button>

              {tab === 'glass'
                ? GLASSES.map((glass) => {
                    const unlocked = isGlassUnlocked(carId, glass.id, { carUsage });
                    const isEquipped = equipped.glass === glass.id;
                    const isPreview = previewGlass === glass.id;
                    const reqText = describeRequirement(glass.req, carSpec.name);
                    return (
                      <button
                        key={glass.id}
                        type="button"
                        className={styles.itemCard}
                        data-active={isEquipped && !previewGlass}
                        data-preview={isPreview}
                        data-locked={!unlocked}
                        aria-pressed={isEquipped}
                        aria-label={
                          unlocked
                            ? `Kaca ${glass.label}${isEquipped ? ', terpasang' : ''}`
                            : `Kaca ${glass.label}, terkunci, syarat: ${reqText}`
                        }
                        onClick={() => {
                          if (!unlocked) {
                            setPreviewGlass(glass.id);
                            return;
                          }
                          setPreviewGlass(null);
                          onSelectCosmetic(carId, 'glass', glass.id);
                        }}
                        data-nav
                      >
                        {!unlocked && (
                          <span className={styles.lockBadge} aria-hidden="true">
                            <LockIcon />
                          </span>
                        )}
                        <span
                          className={styles.swatchGlass}
                          style={{ background: glass.color }}
                          aria-hidden="true"
                        />
                        <span className={styles.itemLabel}>{glass.label}</span>
                        {isEquipped && <span className={styles.itemState}>Terpasang</span>}
                      </button>
                    );
                  })
                : RIMS.map((rim) => {
                    const unlocked = isRimUnlocked(carId, rim.id, { carUsage });
                    const isEquipped = equipped.rim === rim.id;
                    const isPreview = previewRim === rim.id;
                    const reqText = describeRequirement(rim.req, carSpec.name);
                    const rimStyleVars = {
                      background: rim.style === 'spoke' ? '#2e3742' : rim.color,
                      '--rim-color': rim.color,
                    } as CSSProperties;
                    return (
                      <button
                        key={rim.id}
                        type="button"
                        className={styles.itemCard}
                        data-active={isEquipped && !previewRim}
                        data-preview={isPreview}
                        data-locked={!unlocked}
                        aria-pressed={isEquipped}
                        aria-label={
                          unlocked
                            ? `Velg ${rim.label}${isEquipped ? ', terpasang' : ''}`
                            : `Velg ${rim.label}, terkunci, syarat: ${reqText}`
                        }
                        onClick={() => {
                          if (!unlocked) {
                            setPreviewRim(rim.id);
                            return;
                          }
                          setPreviewRim(null);
                          onSelectCosmetic(carId, 'rim', rim.id);
                        }}
                        data-nav
                      >
                        {!unlocked && (
                          <span className={styles.lockBadge} aria-hidden="true">
                            <LockIcon />
                          </span>
                        )}
                        <span
                          className={styles.swatchRim}
                          data-style={rim.style}
                          style={rimStyleVars}
                          aria-hidden="true"
                        />
                        <span className={styles.itemLabel}>{rim.label}</span>
                        {isEquipped && <span className={styles.itemState}>Terpasang</span>}
                      </button>
                    );
                  })}
            </div>

            {activePreviewId && lockedPreviewItem && lockedReq ? (
              <div className={`${styles.statusBar} ${styles.statusLocked}`} role="status">
                <div className={styles.statusRow}>
                  <span className={styles.reqText}>
                    {describeRequirement(lockedPreviewItem.req, carSpec.name)}
                  </span>
                  <span className={styles.reqCount}>
                    {lockedReq.current}/{lockedReq.target}
                  </span>
                </div>
                <div className={styles.progressTrack} aria-hidden="true">
                  <div
                    className={styles.progressFill}
                    style={{ width: `${Math.min(100, Math.round((lockedReq.current / Math.max(1, lockedReq.target)) * 100))}%` }}
                  />
                </div>
                <div className={styles.statusRow}>
                  <span className="label">Pratinjau terkunci</span>
                  <button type="button" className="btn btn-small" disabled>
                    Pasang
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.statusBar}>
                <div className={styles.statusRow}>
                  <span className="label">
                    {tab === 'glass' ? 'Warna jendela aktif' : 'Velg aktif'}
                  </span>
                  <strong>{equippedLabel}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
