'use client';

import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type TouchAction = 'left' | 'right' | 'brake' | 'nitro';

const ACTIONS: { action: TouchAction; label: string; short: string; className: string; aria: string }[] = [
  { action: 'left', label: 'Kiri', short: 'KIRI', className: 'touch-steer touch-left', aria: 'Belok kiri' },
  { action: 'right', label: 'Kanan', short: 'KANAN', className: 'touch-steer touch-right', aria: 'Belok kanan' },
  { action: 'brake', label: 'Rem', short: 'REM', className: 'touch-brake', aria: 'Rem dan mundur' },
  { action: 'nitro', label: 'Nitro', short: 'NITRO', className: 'touch-nitro', aria: 'Nitro' },
];

export default function TouchControls({
  onChange,
}: {
  onChange: (action: TouchAction, pressed: boolean) => void;
}) {
  const [active, setActive] = useState<Record<TouchAction, boolean>>({
    left: false,
    right: false,
    brake: false,
    nitro: false,
  });

  const setPressed = (action: TouchAction, pressed: boolean) => {
    setActive((current) => (current[action] === pressed ? current : { ...current, [action]: pressed }));
    onChange(action, pressed);
  };

  const handleDown = (event: ReactPointerEvent<HTMLButtonElement>, action: TouchAction) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPressed(action, true);
  };

  const handleUp = (event: ReactPointerEvent<HTMLButtonElement>, action: TouchAction) => {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPressed(action, false);
  };

  return (
    <div className="touch-controls" role="group" aria-label="Kontrol sentuh balapan">
      <div className="touch-cluster touch-cluster-left">
        {ACTIONS.filter((item) => item.action === 'left' || item.action === 'right').map((item) => (
          <button
            key={item.action}
            type="button"
            className={`touch-button ${item.className}`}
            aria-label={item.aria}
            data-active={active[item.action]}
            onPointerDown={(event) => handleDown(event, item.action)}
            onPointerUp={(event) => handleUp(event, item.action)}
            onPointerCancel={(event) => handleUp(event, item.action)}
            onLostPointerCapture={() => setPressed(item.action, false)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span>{item.short}</span>
          </button>
        ))}
      </div>
      <div className="touch-cluster touch-cluster-right">
        {ACTIONS.filter((item) => item.action === 'brake' || item.action === 'nitro').map((item) => (
          <button
            key={item.action}
            type="button"
            className={`touch-button ${item.className}`}
            aria-label={item.aria}
            data-active={active[item.action]}
            onPointerDown={(event) => handleDown(event, item.action)}
            onPointerUp={(event) => handleUp(event, item.action)}
            onPointerCancel={(event) => handleUp(event, item.action)}
            onLostPointerCapture={() => setPressed(item.action, false)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span>{item.short}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
