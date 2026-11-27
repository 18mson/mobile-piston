import { describe, expect, it } from 'vitest';
import { pickDirectionalCandidate, type RectLike } from '../src/components/useMenuNavigation';

function rect(left: number, top: number, width = 120, height = 44): RectLike {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

describe('menu directional navigation', () => {
  const items = [
    { item: 'top-left', rect: rect(0, 0) },
    { item: 'top-right', rect: rect(160, 0) },
    { item: 'mid-left', rect: rect(0, 70) },
    { item: 'mid-right', rect: rect(160, 70) },
    { item: 'bottom-left', rect: rect(0, 140) },
  ];

  it('navigates right, left, down, and up to the closest aligned item', () => {
    expect(pickDirectionalCandidate(items, rect(0, 0), 'right')).toBe('top-right');
    expect(pickDirectionalCandidate(items, rect(160, 0), 'left')).toBe('top-left');
    expect(pickDirectionalCandidate(items, rect(0, 0), 'down')).toBe('mid-left');
    expect(pickDirectionalCandidate(items, rect(0, 140), 'up')).toBe('mid-left');
  });

  it('returns null when there is no item in the requested direction', () => {
    expect(pickDirectionalCandidate(items, rect(0, 0), 'up')).toBeNull();
    expect(pickDirectionalCandidate(items, rect(0, 0), 'left')).toBeNull();
    expect(pickDirectionalCandidate(items, rect(160, 70), 'right')).toBeNull();
  });
});
