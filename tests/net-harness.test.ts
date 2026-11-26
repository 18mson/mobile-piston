import { describe, expect, it } from 'vitest';
import { runHeadlessHarness } from '../scripts/net-harness';

describe('headless online netcode harness', () => {
  it('keeps remote interpolation smooth and local prediction accurate under latency, jitter, loss, and host slowdown', () => {
    const metrics = runHeadlessHarness();

    expect(metrics.cameraMeshMaxDiff).toBe(0);
    expect(metrics.remoteMaxRatio).toBeLessThanOrEqual(1.5);
    expect(metrics.remoteSpikes15x).toBe(0);
    expect(metrics.remoteOscillations).toBe(0);
    expect(metrics.localAvgPosErrAfterTransient).toBeLessThan(1.0);
    expect(metrics.localAvgAngleErrAfterTransient).toBeLessThan(0.02);
    expect(metrics.localMaxVisualJumpPerFrame).toBeLessThanOrEqual(2.0);
  });
});
