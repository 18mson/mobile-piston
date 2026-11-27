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
      selectedCarId: 'chick',
      selectedTrackId: 'mata-air',
      bestLapMs: { 'teluk-sore': 24123, 'mata-air': 13880, broken: -4, text: 'fast' },
      audioMuted: 'yes',
      xp: 300,
    });
    expect(save.selectedCarId).toBe('chick');
    expect(save.selectedTrackId).toBe('mata-air');
    expect(save.bestLapMs).toEqual({ 'teluk-sore': 24123, 'mata-air': 13880 });
    expect(save.audioMuted).toBe(false);
    expect(save.xp).toBe(300);

    // Locked car without enough XP falls back to default car
    const locked = normalizeSave({ version: 2, selectedCarId: 'chick', xp: 0 });
    expect(locked.selectedCarId).toBe('mcqueen');
  });

  it('falls back to the default car and track when ids are unknown', () => {
    const save = normalizeSave({
      version: 2,
      selectedCarId: 'rocket',
      selectedTrackId: 'moon',
      bestLapMs: {},
      audioMuted: true,
    });
    expect(save.selectedCarId).toBe('mcqueen');
    expect(save.selectedTrackId).toBe('teluk-sore');
    expect(save.audioMuted).toBe(true);
  });

  it('migrates a version 1 save and legacy car IDs without losing records', () => {
    const save = normalizeSave({
      version: 1,
      selectedCarId: 'bagas',
      bestLapMs: { 'teluk-sore': 25000 },
      unlocks: ['car:kepik'],
      xp: 2000,
      audioMuted: false,
    });
    expect(save.version).toBe(2);
    expect(save.selectedTrackId).toBe('teluk-sore');
    expect(save.selectedCarId).toBe('doc');
    expect(save.unlocks).toEqual(['car:chick']);
    expect(save.bestLapMs['teluk-sore']).toBe(25000);
  });
});
