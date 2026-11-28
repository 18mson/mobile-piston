'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import {
  ACCESSORY_SLOTS,
  accessoriesForCar,
  getAccessory,
  isAccessoryUnlocked,
  isExclusive,
} from '../../game/data/accessories';
import { CARS, CAR_COLORS, CAR_ORDER, deriveCarRole, getCarPalette } from '../../game/data/cars';
import {
  GLASSES,
  RIMS,
  applyCosmetics,
  carHasGlass,
  getGlass,
  getRim,
} from '../../game/data/cosmetics';
import {
  describeRequirement,
  getUsage,
  isGlassUnlocked,
  isRimUnlocked,
  requirementProgress,
} from '../../game/garage';
import { isCarUnlocked } from '../../game/progression';
import type { AccessorySlot, CarCosmetics, CarId, CarSpec, CarUsage } from '../../game/types';
import CarThumb from '../CarThumb';
import styles from '../garageCustom.module.css';

type CustomizeTab = 'glass' | 'rim' | 'accessories';

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
  accessories = {},
  carUsage,
  xp = 0,
  unlocks,
  returnLabel,
  onSelectCar,
  onSelectColor,
  onSelectCosmetic,
  onSelectAccessory,
  onBack,
}: {
  selectedCarId: CarId;
  selectedColors: Partial<Record<CarId, number>>;
  cosmetics: Partial<Record<CarId, CarCosmetics>>;
  accessories?: Partial<Record<CarId, Partial<Record<AccessorySlot, string>>>>;
  carUsage: Partial<Record<CarId, CarUsage>>;
  xp?: number;
  unlocks?: string[];
  returnLabel: string;
  onSelectCar: (id: CarId) => void;
  onSelectColor?: (carId: CarId, colorIndex: number) => void;
  onSelectCosmetic: (carId: CarId, slot: 'rim' | 'glass', id: string | null) => void;
  onSelectAccessory: (carId: CarId, slot: AccessorySlot, id: string | null) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<CustomizeTab>('glass');
  const [accSlot, setAccSlot] = useState<AccessorySlot>('roof');
  const [previewGlass, setPreviewGlass] = useState<string | null>(null);
  const [previewRim, setPreviewRim] = useState<string | null>(null);
  const [previewAccessory, setPreviewAccessory] = useState<string | null>(null);

  const unlockedCars = CAR_ORDER.filter((id) => isCarUnlocked(id, { xp, unlocks }));
  const currentIdx = Math.max(0, unlockedCars.indexOf(selectedCarId));
  const carId: CarId = unlockedCars[currentIdx] ?? 'mcqueen';

  const usage = getUsage({ carUsage }, carId);
  const hasGlass = carHasGlass(carId);
  const carAccessories = accessoriesForCar(carId);
  const availableSlots = ACCESSORY_SLOTS.filter((slot) =>
    carAccessories.some((item) => item.slot === slot.id),
  );
  const activeSlot: AccessorySlot = availableSlots.some((s) => s.id === accSlot)
    ? accSlot
    : (availableSlots[0]?.id ?? 'roof');
  const slotAccessories = carAccessories.filter((item) => item.slot === activeSlot);
  const unlockedAccCount = carAccessories.filter((item) =>
    isAccessoryUnlocked(carId, item.id, { carUsage }),
  ).length;

  const baseColorIdx = selectedColors[carId] ?? 0;
  const equipped: CarCosmetics = cosmetics[carId] ?? {};
  const equippedAccessories = accessories[carId] ?? {};
  const previewAccDef = previewAccessory ? getAccessory(previewAccessory) : undefined;
  const previewAccessoryMap: Partial<Record<AccessorySlot, string>> =
    previewAccDef && previewAccDef.cars[carId] != null
      ? { ...equippedAccessories, [previewAccDef.slot]: previewAccDef.id }
      : equippedAccessories;

  const previewCosmetics: CarCosmetics = {
    glass: hasGlass ? (previewGlass ?? equipped.glass) : undefined,
    rim: previewRim ?? equipped.rim,
  };
  const carSpec: CarSpec = {
    ...CARS[carId],
    palette: applyCosmetics(getCarPalette(carId, baseColorIdx), previewCosmetics, previewAccessoryMap),
  };

  const clearPreviews = () => {
    setPreviewGlass(null);
    setPreviewRim(null);
    setPreviewAccessory(null);
  };

  const cycleCar = (dir: -1 | 1) => {
    if (unlockedCars.length <= 1) return;
    const nextIdx = (currentIdx + dir + unlockedCars.length) % unlockedCars.length;
    const nextId = unlockedCars[nextIdx];
    if (!nextId) return;
    clearPreviews();
    const nextSlots = ACCESSORY_SLOTS.filter((slot) =>
      accessoriesForCar(nextId).some((item) => item.slot === slot.id),
    );
    if (nextSlots.length > 0 && !nextSlots.some((s) => s.id === activeSlot)) {
      setAccSlot(nextSlots[0].id);
    }
    onSelectCar(nextId);
  };

  const activePreviewId =
    tab === 'glass' ? previewGlass : tab === 'rim' ? previewRim : previewAccessory;
  const lockedPreviewReq =
    tab === 'glass'
      ? (previewGlass ? getGlass(previewGlass)?.req : undefined)
      : tab === 'rim'
        ? (previewRim ? getRim(previewRim)?.req : undefined)
        : (previewAccessory ? getAccessory(previewAccessory)?.cars[carId] : undefined);
  const lockedProgress = lockedPreviewReq ? requirementProgress(lockedPreviewReq, usage) : null;

  const equippedSlotDef = getAccessory(equippedAccessories[activeSlot]);
  const equippedLabel =
    tab === 'glass'
      ? (hasGlass ? (getGlass(equipped.glass)?.label ?? 'Bawaan') : 'Bawaan (tanpa kaca)')
      : tab === 'rim'
        ? (getRim(equipped.rim)?.label ?? 'Bawaan')
        : (equippedSlotDef?.label ?? 'Tanpa');

  const activeSlotLabel =
    ACCESSORY_SLOTS.find((s) => s.id === activeSlot)?.label ?? 'Aksesori';

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
              {onSelectColor ? (
                <div className={styles.stageColorPicker} role="group" aria-label={`Variasi warna ${carSpec.name}`}>
                  <span className="label">
                    {CAR_COLORS[carId][baseColorIdx]?.label ?? CAR_COLORS[carId][0].label}
                  </span>
                  <div className="color-swatches">
                    {CAR_COLORS[carId].map((option, index) => (
                      <button
                        key={option.id}
                        type="button"
                        className="color-swatch"
                        data-active={index === baseColorIdx}
                        aria-label={`Warna ${option.label}`}
                        aria-pressed={index === baseColorIdx}
                        onClick={() => onSelectColor(carId, index)}
                        style={{
                          background: `linear-gradient(135deg, ${option.palette.body} 62%, ${option.palette.stripe} 62%)`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <span className="car-number">#{carSpec.number ?? 1}</span>
              )}
            </div>

            <div className="car-detail-visual">
              <span className="car-stage-number" aria-hidden="true">#{carSpec.number ?? 1}</span>
              <span className="car-stage-role">{deriveCarRole(carSpec)}</span>
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
                  setPreviewAccessory(null);
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
                  setPreviewAccessory(null);
                }}
                data-nav
              >
                Velg
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'accessories'}
                className={styles.tabBtn}
                data-active={tab === 'accessories'}
                onClick={() => {
                  setTab('accessories');
                  setPreviewGlass(null);
                  setPreviewRim(null);
                }}
                data-nav
              >
                Aksesori {unlockedAccCount}/{carAccessories.length}
              </button>
            </div>

            {tab === 'accessories' && availableSlots.length > 0 && (
              <div className={styles.slotChips} role="group" aria-label="Slot aksesori">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    className={styles.slotChip}
                    data-active={activeSlot === slot.id}
                    aria-pressed={activeSlot === slot.id}
                    onClick={() => {
                      setAccSlot(slot.id);
                      setPreviewAccessory(null);
                    }}
                    data-nav
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            )}

            <div
              className={styles.itemGrid}
              role="group"
              aria-label={
                tab === 'glass'
                  ? 'Pilihan warna jendela'
                  : tab === 'rim'
                    ? 'Pilihan velg'
                    : `Pilihan aksesori ${activeSlotLabel}`
              }
            >
              {tab === 'accessories' ? (
                <>
                  <button
                    type="button"
                    className={styles.itemCard}
                    data-active={equippedAccessories[activeSlot] == null && !previewAccessory}
                    aria-pressed={equippedAccessories[activeSlot] == null}
                    aria-label={`Tanpa aksesori ${activeSlotLabel}`}
                    onClick={() => {
                      setPreviewAccessory(null);
                      onSelectAccessory(carId, activeSlot, null);
                    }}
                    data-nav
                  >
                    <span className={styles.swatchStock} aria-hidden="true">STD</span>
                    <span className={styles.itemLabel}>Tanpa</span>
                    {equippedAccessories[activeSlot] == null && (
                      <span className={styles.itemState}>Terpasang</span>
                    )}
                  </button>

                  {slotAccessories.map((acc) => {
                    const req = acc.cars[carId];
                    if (!req) return null;
                    const unlocked = isAccessoryUnlocked(carId, acc.id, { carUsage });
                    const isEquipped = equippedAccessories[acc.slot] === acc.id;
                    const isPreview = previewAccessory === acc.id;
                    const exclusive = isExclusive(acc);
                    const reqText = describeRequirement(req, carSpec.name);
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        className={styles.itemCard}
                        data-active={isEquipped && !previewAccessory}
                        data-preview={isPreview}
                        data-locked={!unlocked}
                        aria-pressed={isEquipped}
                        aria-label={
                          unlocked
                            ? `${acc.label} (${exclusive ? 'Khusus' : 'Umum'})${isEquipped ? ', terpasang' : ''}`
                            : `${acc.label} (${exclusive ? 'Khusus' : 'Umum'}), terkunci, syarat: ${reqText}`
                        }
                        onClick={() => {
                          if (!unlocked) {
                            setPreviewAccessory(acc.id);
                            return;
                          }
                          setPreviewAccessory(null);
                          onSelectAccessory(carId, acc.slot, acc.id);
                        }}
                        data-nav
                      >
                        {!unlocked && (
                          <span className={styles.lockBadge} aria-hidden="true">
                            <LockIcon />
                          </span>
                        )}
                        <span className={styles.itemBadge} data-exclusive={exclusive}>
                          {exclusive ? 'Khusus' : 'Umum'}
                        </span>
                        <span className={styles.itemLabel}>{acc.label}</span>
                        {isEquipped && <span className={styles.itemState}>Terpasang</span>}
                      </button>
                    );
                  })}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.itemCard}
                    data-active={tab === 'glass' ? (!hasGlass || (equipped.glass == null && !previewGlass)) : equipped.rim == null && !previewRim}
                    aria-pressed={tab === 'glass' ? (!hasGlass || equipped.glass == null) : equipped.rim == null}
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
                    {(tab === 'glass' ? (!hasGlass || equipped.glass == null) : equipped.rim == null) && (
                      <span className={styles.itemState}>Terpasang</span>
                    )}
                  </button>

                  {tab === 'glass'
                    ? (hasGlass
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
                        : null)
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
                </>
              )}
            </div>

            {activePreviewId && lockedPreviewReq && lockedProgress ? (
              <div className={`${styles.statusBar} ${styles.statusLocked}`} role="status">
                <div className={styles.statusRow}>
                  <span className={styles.reqText}>
                    {describeRequirement(lockedPreviewReq, carSpec.name)}
                  </span>
                  <span className={styles.reqCount}>
                    {lockedProgress.current}/{lockedProgress.target}
                  </span>
                </div>
                <div className={styles.progressTrack} aria-hidden="true">
                  <div
                    className={styles.progressFill}
                    style={{ width: `${Math.min(100, Math.round((lockedProgress.current / Math.max(1, lockedProgress.target)) * 100))}%` }}
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
                    {tab === 'glass'
                      ? 'Warna jendela aktif'
                      : tab === 'rim'
                        ? 'Velg aktif'
                        : `Aksesori ${activeSlotLabel}`}
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
