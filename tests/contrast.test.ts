import { describe, expect, it } from 'vitest';

const colors = {
  ink: '#0c1820',
  inkSoft: '#142630',
  bone: '#f5ebd2',
  boneDim: '#c9c1a9',
  orange: '#ff8f3d',
  orangeInk: '#7d3217',
};

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const raw = hex.replace('#', '');
  const r = channel(parseInt(raw.slice(0, 2), 16));
  const g = channel(parseInt(raw.slice(2, 4), 16));
  const b = channel(parseInt(raw.slice(4, 6), 16));
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function contrast(a: string, b: string): number {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

describe('UI color contrast', () => {
  const pairs: Array<[string, string, string]> = [
    ['bone on ink', colors.bone, colors.ink],
    ['bone on inkSoft', colors.bone, colors.inkSoft],
    ['muted on ink', colors.boneDim, colors.ink],
    ['muted on inkSoft', colors.boneDim, colors.inkSoft],
    ['orange on ink', colors.orange, colors.ink],
    ['orange on inkSoft', colors.orange, colors.inkSoft],
    ['ink on orange', colors.ink, colors.orange],
    ['orangeInk on bone', colors.orangeInk, colors.bone],
  ];

  it.each(pairs)('%s passes WCAG AA for normal text', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
