import { describe, expect, it } from 'vitest';
import { mergeRecordLists, type TrackRecordEntry } from '../src/game/records';

function rec(overrides: Partial<TrackRecordEntry>): TrackRecordEntry {
  return {
    trackId: 'teluk-sore',
    playerKey: 'u:1',
    playerName: '@vansyson',
    carId: 'mcqueen',
    colorIndex: 0,
    bestLapMs: 18_500,
    totalTimeMs: 56_000,
    laps: 3,
    recordedAt: '2026-11-28T00:00:00.000Z',
    ...overrides,
  };
}

describe('track records leaderboard', () => {
  it('keeps only the fastest lap per player per track and sorts ascending', () => {
    const merged = mergeRecordLists([
      [
        rec({ playerKey: 'u:1', playerName: '@vansyson', carId: 'mcqueen', bestLapMs: 18_500 }),
        rec({ playerKey: 'u:2', playerName: '@rival', carId: 'storm', colorIndex: 2, bestLapMs: 16_200 }),
      ],
      [
        // Slower run for @vansyson should NOT overwrite faster run
        rec({ playerKey: 'u:1', playerName: '@vansyson', carId: 'luigi', bestLapMs: 21_000 }),
        // Faster run on another track keeps separate entry
        rec({ trackId: 'rimba-lumpur', playerKey: 'u:1', playerName: '@vansyson', carId: 'cruz', bestLapMs: 39_100 }),
      ],
    ]);

    expect(merged['teluk-sore']?.map((e) => [e.playerName, e.carId, e.bestLapMs])).toEqual([
      ['@rival', 'storm', 16_200],
      ['@vansyson', 'mcqueen', 18_500],
    ]);
    expect(merged['rimba-lumpur']?.[0]?.carId).toBe('cruz');
    expect(merged['rimba-lumpur']?.[0]?.bestLapMs).toBe(39_100);
  });
});
