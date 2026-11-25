'use client';

import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type TouchAction = 'left' | 'right' | 'brake' | 'nitro';

const ACTIONS: { action: TouchAction; className: string; aria: string }[] = [
  { action: 'left', className: 'touch-steer touch-left', aria: 'Belok kiri' },
  { action: 'right', className: 'touch-steer touch-right', aria: 'Belok kanan' },
  { action: 'brake', className: 'touch-brake', aria: 'Rem dan mundur' },
  { action: 'nitro', className: 'touch-nitro', aria: 'Nitro' },
];

function TouchArrowIcon({ action }: { action: TouchAction }) {
  if (action === 'left') {
    return (
      <svg className="touch-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 4L6 12L16 20V4Z" fill="currentColor" />
      </svg>
    );
  }
  if (action === 'right') {
    return (
      <svg className="touch-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 4L18 12L8 20V4Z" fill="currentColor" />
      </svg>
    );
  }
  if (action === 'brake') {
    return (
      <svg className="touch-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7L12 17L20 7H4Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className="touch-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 17L12 7L20 17H4Z" fill="currentColor" />
    </svg>
  );
}

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
            <TouchArrowIcon action={item.action} />
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
            <TouchArrowIcon action={item.action} />
          </button>
        ))}
      </div>
    </div>
  );
}
