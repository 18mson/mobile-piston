import { useEffect } from 'react';

export type NavDirection = 'up' | 'down' | 'left' | 'right';

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Picks the best spatial neighbor in the given direction from `currentRect`
 * among `candidates`, weighting orthogonal alignment so rows and columns feel natural.
 */
export function pickDirectionalCandidate<T>(
  items: readonly { item: T; rect: RectLike }[],
  currentRect: RectLike,
  direction: NavDirection,
): T | null {
  const cx = (currentRect.left + currentRect.right) / 2;
  const cy = (currentRect.top + currentRect.bottom) / 2;

  let bestItem: T | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const entry of items) {
    const { rect } = entry;
    const nx = (rect.left + rect.right) / 2;
    const ny = (rect.top + rect.bottom) / 2;
    const dx = nx - cx;
    const dy = ny - cy;

    let primary = 0;
    let ortho = 0;
    if (direction === 'right') {
      if (dx <= 4) continue;
      primary = dx;
      ortho = Math.abs(dy);
    } else if (direction === 'left') {
      if (dx >= -4) continue;
      primary = -dx;
      ortho = Math.abs(dy);
    } else if (direction === 'down') {
      if (dy <= 4) continue;
      primary = dy;
      ortho = Math.abs(dx);
    } else {
      if (dy >= -4) continue;
      primary = -dy;
      ortho = Math.abs(dx);
    }

    const score = primary + ortho * 2.4;
    if (score < bestScore) {
      bestScore = score;
      bestItem = entry.item;
    }
  }

  return bestItem;
}

function getActiveCandidates(): HTMLElement[] {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]:not([hidden])'));
  const topmostDialog = dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;

  const roots: HTMLElement[] = topmostDialog
    ? [topmostDialog]
    : Array.from(document.querySelectorAll<HTMLElement>('.screen-layer, .topbar:not([hidden])'));

  const selector = [
    'button:not(:disabled):not([hidden])',
    'a[href]:not([hidden])',
    'input:not(:disabled):not([hidden])',
    'select:not(:disabled):not([hidden])',
    'textarea:not(:disabled):not([hidden])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])',
  ].join(', ');

  const seen = new Set<HTMLElement>();
  const result: HTMLElement[] = [];

  for (const root of roots) {
    const nodes = root.querySelectorAll<HTMLElement>(selector);
    for (const el of nodes) {
      if (seen.has(el)) continue;
      if (el.closest('[hidden]')) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      seen.add(el);
      result.push(el);
    }
  }

  return result;
}

function pickInitialCandidate(candidates: HTMLElement[]): HTMLElement | null {
  if (candidates.length === 0) return null;
  return (
    candidates.find((el) => el.matches('[data-selected="true"]')) ??
    candidates.find((el) => el.matches('.btn-primary')) ??
    candidates[0]
  );
}

function clearNavFocus(): void {
  const prev = document.querySelectorAll<HTMLElement>('[data-nav-focus="true"]');
  for (const el of prev) {
    el.removeAttribute('data-nav-focus');
  }
}

function focusElement(el: HTMLElement | null, markNavFocus = true): void {
  if (!el) return;
  clearNavFocus();
  if (markNavFocus && !el.classList.contains('car-card') && !el.classList.contains('track-select-card')) {
    el.setAttribute('data-nav-focus', 'true');
  }
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function keyToDirection(key: string, inTextControl: boolean): NavDirection | null {
  if (key === 'ArrowUp') return 'up';
  if (key === 'ArrowDown') return 'down';
  if (!inTextControl) {
    if (key === 'ArrowLeft') return 'left';
    if (key === 'ArrowRight') return 'right';
    const lower = key.toLowerCase();
    if (lower === 'w') return 'up';
    if (lower === 's') return 'down';
    if (lower === 'a') return 'left';
    if (lower === 'd') return 'right';
  }
  return null;
}

export function useMenuNavigation(enabled: boolean, scopeKey: string): void {
  // Move focus into the newly opened screen or dialog if focus is outside it.
  useEffect(() => {
    if (!enabled) {
      clearNavFocus();
      return;
    }
    const timer = window.setTimeout(() => {
      const candidates = getActiveCandidates();
      const active = document.activeElement as HTMLElement | null;
      if (!active || !candidates.includes(active)) {
        const target = pickInitialCandidate(candidates);
        focusElement(target, false);
      }
    }, 20);
    return () => window.clearTimeout(timer);
  }, [enabled, scopeKey]);

  // Clear nav-focus highlight on pointer interaction so mouse clicks stay clean.
  useEffect(() => {
    if (!enabled) return;
    const onPointerDown = () => clearNavFocus();
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [enabled]);

  // Keyboard directional navigation + Enter confirm fallback.
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      const inTextControl = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (event.key === 'Enter') {
        if (!inTextControl && (!active || active === document.body || active.classList.contains('game-canvas'))) {
          const candidates = getActiveCandidates();
          const target = pickInitialCandidate(candidates);
          if (target) {
            event.preventDefault();
            focusElement(target);
            target.click();
          }
        }
        return;
      }

      const direction = keyToDirection(event.key, inTextControl);
      if (!direction) return;

      // Let <select> use ArrowUp/ArrowDown natively.
      if (tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (
        tag === 'INPUT' &&
        (active as HTMLInputElement).type === 'number'
      ) {
        return;
      }

      const candidates = getActiveCandidates();
      if (candidates.length === 0) return;

      event.preventDefault();

      if (!active || !candidates.includes(active)) {
        focusElement(pickInitialCandidate(candidates));
        return;
      }

      const currentRect = active.getBoundingClientRect();
      const others = candidates
        .filter((el) => el !== active)
        .map((el) => ({ item: el, rect: el.getBoundingClientRect() }));

      const next = pickDirectionalCandidate(others, currentRect, direction);
      if (next) {
        focusElement(next);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);

  // Gamepad D-pad / left-stick navigation + A button confirm when in menus.
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return;
    }

    let rafId = 0;
    let lastDir: NavDirection | null = null;
    let lastMoveAt = 0;
    let prevConfirmDown = false;

    const poll = (now: number) => {
      const pads = navigator.getGamepads();
      let dir: NavDirection | null = null;
      let confirmDown = false;

      for (const pad of pads) {
        if (!pad || !pad.connected) continue;
        const axX = pad.axes[0] ?? 0;
        const axY = pad.axes[1] ?? 0;
        if (pad.buttons[12]?.pressed || axY < -0.55) dir = 'up';
        else if (pad.buttons[13]?.pressed || axY > 0.55) dir = 'down';
        else if (pad.buttons[14]?.pressed || axX < -0.55) dir = 'left';
        else if (pad.buttons[15]?.pressed || axX > 0.55) dir = 'right';

        if (pad.buttons[0]?.pressed) confirmDown = true;
        if (dir || confirmDown) break;
      }

      if (dir) {
        const elapsed = now - lastMoveAt;
        if (dir !== lastDir || elapsed > 200) {
          const candidates = getActiveCandidates();
          const active = document.activeElement as HTMLElement | null;
          if (!active || !candidates.includes(active)) {
            focusElement(pickInitialCandidate(candidates));
          } else {
            const currentRect = active.getBoundingClientRect();
            const others = candidates
              .filter((el) => el !== active)
              .map((el) => ({ item: el, rect: el.getBoundingClientRect() }));
            const next = pickDirectionalCandidate(others, currentRect, dir);
            if (next) focusElement(next);
          }
          lastMoveAt = now;
        }
      }
      lastDir = dir;

      if (confirmDown && !prevConfirmDown) {
        const candidates = getActiveCandidates();
        const active = document.activeElement as HTMLElement | null;
        const target = active && candidates.includes(active) ? active : pickInitialCandidate(candidates);
        if (target) {
          focusElement(target);
          target.click();
        }
      }
      prevConfirmDown = confirmDown;

      rafId = window.requestAnimationFrame(poll);
    };

    rafId = window.requestAnimationFrame(poll);
    return () => window.cancelAnimationFrame(rafId);
  }, [enabled]);
}
