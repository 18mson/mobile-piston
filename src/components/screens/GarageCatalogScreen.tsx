'use client';

import { accessoriesForCar, isAccessoryUnlocked } from '../../game/data/accessories';
import { CARS, CAR_ORDER, deriveCarRole } from '../../game/data/cars';
import { carUnlockDef, isCarUnlocked } from '../../game/progression';
import type { CarId, CarUsage } from '../../game/types';
import CarThumb from '../CarThumb';
import styles from '../garageCustom.module.css';

export default function GarageCatalogScreen({
  selectedCarId,
  carUsage,
  xp = 0,
  unlocks,
  returnLabel,
  onOpenCar,
  onBack,
}: {
  selectedCarId: CarId;
  carUsage: Partial<Record<CarId, CarUsage>>;
  xp?: number;
  unlocks?: string[];
  returnLabel: string;
  onOpenCar: (id: CarId) => void;
  onBack: () => void;
}) {
  const lockLevel = (id: CarId): number | null =>
    isCarUnlocked(id, { xp, unlocks }) ? null : (carUnlockDef(id)?.level ?? null);

  const orderedCars = [...CAR_ORDER].sort((a, b) => {
    const la = lockLevel(a) ?? 0;
    const lb = lockLevel(b) ?? 0;
    if (la === lb) return 0;
    if (la === 0) return -1;
    if (lb === 0) return 1;
    return la - lb;
  });

  const unlockedCount = orderedCars.filter((id) => lockLevel(id) == null).length;

  return (
    <section className="screen garage-screen" data-menu-scope="active" aria-labelledby="garage-catalog-heading">
      <div className={`garage-panel ${styles.customPanel}`}>
        <div className="screen-heading-row">
          <button className="btn btn-quiet" type="button" onClick={onBack} data-nav data-gamepad-back>
            {returnLabel}
          </button>
          <div>
            <p className="eyebrow">Pilih mobil untuk kustomisasi</p>
            <h2 id="garage-catalog-heading">Garasi</h2>
          </div>
          <span className={styles.catalogCount}>
            {unlockedCount}/{orderedCars.length} Mobil
          </span>
        </div>

        <div className={styles.catalogGrid} role="group" aria-label="Semua mobil di Garasi">
          {orderedCars.map((id) => {
            const needLevel = lockLevel(id);
            const unlocked = needLevel == null;
            const base = CARS[id];
            const roleLabel = deriveCarRole(base);
            const carAccs = accessoriesForCar(id);
            const unlockedAcc = carAccs.filter((item) => isAccessoryUnlocked(id, item.id, { carUsage })).length;
            const isSelected = id === selectedCarId;

            return (
              <button
                key={id}
                type="button"
                className={styles.catalogCard}
                data-active={unlocked && isSelected}
                data-locked={!unlocked}
                aria-label={
                  unlocked
                    ? `Kustomisasi ${base.name}, ${roleLabel}, ${unlockedAcc} dari ${carAccs.length} aksesori terbuka`
                    : `${base.name}, terkunci, buka di Level ${needLevel}`
                }
                title={unlocked ? `Buka kustomisasi ${base.name}` : `Capai Level ${needLevel} untuk membuka ${base.name}`}
                onClick={() => {
                  if (!unlocked) return;
                  onOpenCar(id);
                }}
                data-nav
              >
                <div className={styles.catalogCardTop}>
                  <span className="car-number">#{base.number ?? 1}</span>
                  <span className={styles.catalogRole} data-locked={!unlocked}>
                    {unlocked ? roleLabel : `Level ${needLevel}`}
                  </span>
                </div>

                <div className={styles.catalogThumbWrap}>
                  <CarThumb car={base} number={base.number ?? 1} scale={3} staticView />
                </div>

                <div className={styles.catalogMeta}>
                  <strong>{base.name}</strong>
                  <span>{base.kind}</span>
                </div>

                <div className={styles.catalogFooter}>
                  {unlocked ? (
                    <span>Aksesori {unlockedAcc}/{carAccs.length}</span>
                  ) : (
                    <span>Terkunci</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
