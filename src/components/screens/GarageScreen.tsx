'use client';

import type { CarId, CarSpec } from '../../game/types';
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
}: {
  selectedCarId: CarId;
  selectedColors: Partial<Record<CarId, number>>;
  onSelect: (id: CarId) => void;
  onSelectColor: (id: CarId, colorIndex: number) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const activeColorIndex = selectedColors[selectedCarId] ?? 0;
  const selected: CarSpec = {
    ...CARS[selectedCarId],
    palette: getCarPalette(selectedCarId, activeColorIndex),
  };
  const colorOptions = CAR_COLORS[selectedCarId];

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
          <button className="btn btn-primary screen-heading-cta" type="button" onClick={onStart} data-nav>
            Pilih lintasan
          </button>
        </div>

        <div className="garage-layout">
          <aside className="car-detail panel" aria-label={`Detail ${selected.name}`}>
            <div className="car-detail-visual">
              <CarThumb car={selected} scale={6} />
            </div>

            <div className="car-detail-info">
              <div className="car-detail-heading">
                <div>
                  <span className="label">Mobil terpilih</span>
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
                        onClick={() => onSelectColor(selectedCarId, index)}
                        style={{
                          background: `linear-gradient(135deg, ${option.palette.body} 62%, ${option.palette.stripe} 62%)`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <StatBars car={selected} />
              </div>

              <p className="car-blurb">{selected.blurb}</p>
              <p className="detail-note">Drift mengisi meter nitro. Variasi warna tidak memengaruhi stat.</p>
            </div>
          </aside>

          <div className="car-grid" role="group" aria-label="Daftar mobil">
            {CAR_ORDER.map((id) => {
              const colorIdx = selectedColors[id] ?? 0;
              const car: CarSpec = {
                ...CARS[id],
                palette: getCarPalette(id, colorIdx),
              };
              const selectedCard = id === selectedCarId;
              return (
                <button
                  key={id}
                  type="button"
                  className="car-card"
                  data-selected={selectedCard}
                  aria-pressed={selectedCard}
                  onClick={() => onSelect(id)}
                  data-nav
                >
                  <span className="car-card-top">
                    <strong>{car.name}</strong>
                    <span>{car.kind}</span>
                  </span>
                  <StatBars car={car} compact />
                  <span className="car-card-state">{selectedCard ? 'Mobil terpilih' : 'Pilih mobil'}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
