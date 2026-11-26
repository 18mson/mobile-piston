import type { WeatherMode } from './types';

/**
 * Weather is a pure function of (mode, seed, time), so it needs no hidden state: the same inputs always give the
 * same rain and the same wet road. That makes it safe to replay, test, and (later) share with other players.
 */

export interface WeatherConfig {
  mode: WeatherMode;
  seed: number;
}

export interface WeatherState {
  /** how hard it is raining right now, 0..1 */
  rain: number;
  /** how wet the road is, 0..1 (lags behind the rain: it soaks in slowly and dries slowly) */
  wetness: number;
}

export const WEATHER_MODES: WeatherMode[] = ['clear', 'rain', 'dynamic'];

export const WEATHER_LABELS: Record<WeatherMode, { name: string; blurb: string }> = {
  clear: { name: 'Cerah', blurb: 'Aspal kering sepanjang balapan.' },
  rain: { name: 'Hujan', blurb: 'Hujan deras dan jalan sudah basah sejak start.' },
  dynamic: { name: 'Dinamis', blurb: 'Dimulai kering. Hujan datang di tengah balapan, lalu mereda. Pilih ban dengan cermat.' },
};

const STEP = 0.25; // seconds per timeline sample
const HORIZON = 600; // seconds of precomputed weather
const SOAK_SECONDS = 5; // how fast a dry road gets wet
const DRY_SECONDS = 16; // how fast a wet road dries

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/** Rain intensity (0..1) for a mode at time t, before the road soaks it in. */
function rainAt(config: WeatherConfig, t: number, plan: { onset: number; ramp: number; peak: number; hold: number; ease: number; tail: number }): number {
  if (config.mode === 'clear') return 0;
  if (config.mode === 'rain') return 0.92;
  // dynamic: dry -> building rain -> peak -> easing to a drizzle
  const rampEnd = plan.onset + plan.ramp;
  const holdEnd = rampEnd + plan.hold;
  const easeEnd = holdEnd + plan.ease;
  if (t < plan.onset) return 0;
  if (t < rampEnd) return plan.peak * smooth((t - plan.onset) / plan.ramp);
  if (t < holdEnd) return plan.peak;
  if (t < easeEnd) return plan.tail + (plan.peak - plan.tail) * (1 - smooth((t - holdEnd) / plan.ease));
  return plan.tail;
}

export class WeatherTimeline {
  readonly config: WeatherConfig;
  private readonly rain: Float32Array;
  private readonly wet: Float32Array;
  /** When the rain starts to matter in a dynamic race (seconds), or null if it never rains / is raining already */
  readonly onsetSeconds: number | null;

  constructor(config: WeatherConfig) {
    this.config = config;
    const rng = mulberry32(config.seed);
    const plan = {
      onset: 14 + rng() * 18, // 14..32 s: the first laps are dry, so dry-road tyres are a real bet
      ramp: 8 + rng() * 8,
      peak: 0.7 + rng() * 0.3,
      hold: 14 + rng() * 12,
      ease: 14 + rng() * 10,
      tail: 0.1 + rng() * 0.15,
    };
    this.onsetSeconds = config.mode === 'dynamic' ? plan.onset : null;

    const count = Math.ceil(HORIZON / STEP) + 1;
    this.rain = new Float32Array(count);
    this.wet = new Float32Array(count);
    // Dynamic races start on a dry road. A "rain" race starts already soaked.
    let wetness = config.mode === 'rain' ? 0.9 : 0;
    for (let i = 0; i < count; i += 1) {
      const t = i * STEP;
      const rain = rainAt(config, t, plan);
      // the road soaks up to a wetness that follows the rain, quickly when wetting and slowly when drying
      const target = Math.min(1, rain * 1.05);
      const tau = target > wetness ? SOAK_SECONDS : DRY_SECONDS;
      wetness += (target - wetness) * (1 - Math.exp(-STEP / tau));
      this.rain[i] = rain;
      this.wet[i] = wetness;
    }
  }

  at(seconds: number): WeatherState {
    const t = Math.min(HORIZON, Math.max(0, seconds)) / STEP;
    const i = Math.min(this.rain.length - 2, Math.floor(t));
    const f = t - i;
    return {
      rain: this.rain[i] + (this.rain[i + 1] - this.rain[i]) * f,
      wetness: this.wet[i] + (this.wet[i + 1] - this.wet[i]) * f,
    };
  }
}

export function randomWeatherSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

/** Short forecast sentence for the pre-race screen. */
export function forecastText(mode: WeatherMode): string {
  return WEATHER_LABELS[mode].blurb;
}
