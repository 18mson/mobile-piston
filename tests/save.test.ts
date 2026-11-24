import { describe, expect, it } from 'vitest';
import { defaultSave, normalizeSave, SAVE_KEY } from '../src/game/save';

describe('saved progress', () => {
  it('uses a stable versioned key', () => {
    expect(SAVE_KEY).toBe('mobile-piston.save.v2');
  });

  it('returns safe defaults for missing data', () => {
    expect(normalizeSave(null)).toEqual(defaultSave());
    expect(normalizeSave('not a save')).toEqual(defaultSave());
  });

  it('keeps valid values and rejects invalid car, track, laps, and mute data', () => {
    const save = normalizeSave({
      version: 2,
      selectedCarId: 'kepik',
      selectedTrackId: 'mata-air',
      bestLapMs: { 'teluk-sore': 24123, 'mata-air': 13880, broken: -4, text: 'fast' },
      audioMuted: 'yes',
    });
    expect(save.selectedCarId).toBe('kepik');
    expect(save.selectedTrackId).toBe('mata-air');
    expect(save.bestLapMs).toEqual({ 'teluk-sore': 24123, 'mata-air': 13880 });
    expect(save.audioMuted).toBe(false);
  });

  it('falls back to the default car and track when ids are unknown', () => {
    const save = normalizeSave({
      version: 2,
      selectedCarId: 'rocket',
      selectedTrackId: 'moon',
      bestLapMs: {},
      audioMuted: true,
    });
    expect(save.selectedCarId).toBe('sirip');
    expect(save.selectedTrackId).toBe('teluk-sore');
    expect(save.audioMuted).toBe(true);
  });

  it('migrates a version 1 save without losing records', () => {
    const save = normalizeSave({
      version: 1,
      selectedCarId: 'bagas',
      bestLapMs: { 'teluk-sore': 25000 },
      audioMuted: false,
    });
    expect(save.version).toBe(2);
    expect(save.selectedTrackId).toBe('teluk-sore');
    expect(save.selectedCarId).toBe('bagas');
    expect(save.bestLapMs['teluk-sore']).toBe(25000);
  });
});
