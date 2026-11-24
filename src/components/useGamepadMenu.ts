'use client';

import { useEffect, useRef } from 'react';

export function useGamepadMenu(active: boolean): void {
  const stateRef = useRef({
    buttons: [] as boolean[],
    lastMove: 0,
  });

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (!navigator.getGamepads) return;
      const pads = navigator.getGamepads();
      const pad = pads[0];
      if (!pad) return;
      const pressed = pad.buttons.map((button) => button.pressed);
      const previous = stateRef.current.buttons;
      const justPressed = (index: number): boolean => Boolean(pressed[index] && !previous[index]);

      const openDialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
      const scope =
        openDialogs[openDialogs.length - 1] ??
        (document.querySelector('[data-menu-scope="active"]') as HTMLElement | undefined) ??
        document.body;
      const focusables = Array.from(
        scope.querySelectorAll<HTMLElement>('[data-nav]:not([disabled])'),
      ).filter((element) => element.getClientRects().length > 0);
      if (focusables.length === 0) {
        stateRef.current.buttons = pressed;
        return;
      }

      const direction =
        justPressed(14) || justPressed(12) ? -1 : justPressed(15) || justPressed(13) ? 1 : 0;
      if (direction !== 0 && performance.now() - stateRef.current.lastMove > 110) {
        const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + direction + focusables.length) % focusables.length;
        focusables[nextIndex]?.focus();
        stateRef.current.lastMove = performance.now();
      }

      if (justPressed(0)) {
        const current = focusables.find((element) => element === document.activeElement) ?? focusables[0];
        current?.click();
      }

      if (justPressed(1)) {
        const backButton =
          (scope.querySelector('[data-gamepad-back]') as HTMLElement | null) ??
          (document.querySelector('[data-gamepad-back]') as HTMLElement | null);
        backButton?.click();
      }

      stateRef.current.buttons = pressed;
    }, 55);

    return () => window.clearInterval(timer);
  }, [active]);
}
