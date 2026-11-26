import { clamp } from './utils';

export type ImpactKind = 'wall' | 'car';

export interface DrivingAudioState {
  speed: number;
  maxSpeed: number;
  /** 0..1, how far sideways the car is travelling relative to its nose */
  slip: number;
  drifting: boolean;
  offroad: boolean;
  /** true on the frames right after the car picked up a boost pad */
  padHit: boolean;
  racing: boolean;
}

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private tyreGain: GainNode | null = null;
  private tyreFilter: BiquadFilterNode | null = null;
  private dirtGain: GainNode | null = null;
  private dirtFilter: BiquadFilterNode | null = null;
  private rumbleGain: GainNode | null = null;
  private nitroGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private wetHissGain: GainNode | null = null;
  private softNoise: AudioBuffer | null = null;
  private whiteNoise: AudioBuffer | null = null;
  private muted = false;
  private unlocked = false;

  // edge detection for one-shot sounds
  private wasDrifting = false;
  private wasOffroad = false;
  private wasPadHit = false;
  private lastChirpAt = -10;
  private lastThumpAt = -10;

  // menu background music
  private menuMusicTimer: number | null = null;
  private menuMusicDesired = false;
  private menuStep = 0;

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.62, this.context.currentTime, 0.03);
    }
  }

  async unlock(): Promise<void> {
    if (this.unlocked) {
      if (this.context?.state === 'suspended') await this.context.resume();
      return;
    }
    if (typeof window === 'undefined') return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.62;
      this.master.connect(this.context.destination);

      const engineBus = this.context.createGain();
      engineBus.gain.value = 0.055;
      engineBus.connect(this.master);
      this.engineGain = engineBus;
      this.engineFilter = this.context.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineFilter.Q.value = 2.8;
      this.engineFilter.connect(engineBus);

      this.engineOsc = this.context.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 52;
      this.engineOsc.connect(this.engineFilter);
      this.engineOsc.start();

      this.engineOsc2 = this.context.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.value = 78;
      const secondGain = this.context.createGain();
      secondGain.gain.value = 0.34;
      this.engineOsc2.connect(secondGain);
      secondGain.connect(this.engineFilter);
      this.engineOsc2.start();

      const soft = this.createNoiseBuffer(2);
      this.softNoise = soft;
      this.whiteNoise = this.createWhiteBuffer(1.5);

      // Tyre squeal: band-passed noise whose pitch and level follow the slide
      const tyreSource = this.context.createBufferSource();
      tyreSource.buffer = soft;
      tyreSource.loop = true;
      this.tyreFilter = this.context.createBiquadFilter();
      this.tyreFilter.type = 'bandpass';
      this.tyreFilter.frequency.value = 1600;
      this.tyreFilter.Q.value = 1.0;
      this.tyreGain = this.context.createGain();
      this.tyreGain.gain.value = 0;
      tyreSource.connect(this.tyreFilter);
      this.tyreFilter.connect(this.tyreGain);
      this.tyreGain.connect(this.master);
      tyreSource.start();

      // Dirt / gravel: soft filtered noise (no harsh LFO clicks)
      const dirtSource = this.context.createBufferSource();
      dirtSource.buffer = soft;
      dirtSource.loop = true;
      this.dirtFilter = this.context.createBiquadFilter();
      this.dirtFilter.type = 'bandpass';
      this.dirtFilter.frequency.value = 520;
      this.dirtFilter.Q.value = 0.55;
      this.dirtGain = this.context.createGain();
      this.dirtGain.gain.value = 0;
      dirtSource.connect(this.dirtFilter);
      this.dirtFilter.connect(this.dirtGain);
      this.dirtGain.connect(this.master);
      dirtSource.start();

      // Low ground rumble under the gravel
      const rumbleSource = this.context.createBufferSource();
      rumbleSource.buffer = soft;
      rumbleSource.loop = true;
      const rumbleFilter = this.context.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 120;
      this.rumbleGain = this.context.createGain();
      this.rumbleGain.gain.value = 0;
      rumbleSource.connect(rumbleFilter);
      rumbleFilter.connect(this.rumbleGain);
      this.rumbleGain.connect(this.master);
      rumbleSource.start();

      // Rain on the roof/ground: broad hiss; wet-road tyre hiss: brighter noise that scales with speed
      const rainSource = this.context.createBufferSource();
      rainSource.buffer = this.whiteNoise;
      rainSource.loop = true;
      const rainFilter = this.context.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.value = 3400;
      rainFilter.Q.value = 0.45;
      this.rainGain = this.context.createGain();
      this.rainGain.gain.value = 0;
      rainSource.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.master);
      rainSource.start();

      const hissSource = this.context.createBufferSource();
      hissSource.buffer = this.whiteNoise;
      hissSource.loop = true;
      const hissFilter = this.context.createBiquadFilter();
      hissFilter.type = 'highpass';
      hissFilter.frequency.value = 2600;
      this.wetHissGain = this.context.createGain();
      this.wetHissGain.gain.value = 0;
      hissSource.connect(hissFilter);
      hissFilter.connect(this.wetHissGain);
      this.wetHissGain.connect(this.master);
      hissSource.start();

      const nitroSource = this.context.createBufferSource();
      nitroSource.buffer = soft;
      nitroSource.loop = true;
      const nitroFilter = this.context.createBiquadFilter();
      nitroFilter.type = 'bandpass';
      nitroFilter.frequency.value = 1200;
      nitroFilter.Q.value = 0.9;
      this.nitroGain = this.context.createGain();
      this.nitroGain.gain.value = 0;
      nitroSource.connect(nitroFilter);
      nitroFilter.connect(this.nitroGain);
      this.nitroGain.connect(this.master);
      nitroSource.start();

      await this.context.resume();
      this.unlocked = true;
      if (this.menuMusicDesired) {
        this.startMenuLoop();
      }
    } catch {
      this.context = null;
    }
  }

  private createNoiseBuffer(seconds: number): AudioBuffer {
    const context = this.context as AudioContext;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 1.6;
    }
    return buffer;
  }

  private createWhiteBuffer(seconds: number): AudioBuffer {
    const context = this.context as AudioContext;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** Engine, nitro and (when not racing) silence for every looping surface sound. */
  updateEngine(speed: number, maxSpeed: number, _drifting: boolean, nitro: boolean, racing: boolean): void {
    if (!this.context || !this.engineOsc || !this.engineOsc2 || !this.engineFilter) return;
    const now = this.context.currentTime;
    const ratio = clamp(speed / Math.max(1, maxSpeed), 0, 1.2);
    const targetGain = racing ? 0.055 + ratio * 0.048 : 0;
    this.engineGain?.gain.setTargetAtTime(targetGain, now, 0.08);
    const base = 48 + ratio * 86 + (nitro ? 16 : 0);
    this.engineOsc.frequency.setTargetAtTime(base, now, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(base * 1.51, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(280 + ratio * 920, now, 0.08);
    this.nitroGain?.gain.setTargetAtTime(racing && nitro ? 0.055 : 0, now, 0.05);

    if (!racing) {
      this.tyreGain?.gain.setTargetAtTime(0, now, 0.05);
      this.dirtGain?.gain.setTargetAtTime(0, now, 0.05);
      this.rumbleGain?.gain.setTargetAtTime(0, now, 0.05);
      this.rainGain?.gain.setTargetAtTime(0, now, 0.2);
      this.wetHissGain?.gain.setTargetAtTime(0, now, 0.1);
      this.wasDrifting = false;
      this.wasOffroad = false;
    }
  }

  /** Surface and slide sounds. Call every frame while racing, after updateEngine. */
  updateDriving(state: DrivingAudioState): void {
    if (!this.context || !this.tyreGain || !this.tyreFilter || !this.dirtGain || !this.dirtFilter || !this.rumbleGain) return;
    const now = this.context.currentTime;
    if (!state.racing) {
      this.wasDrifting = false;
      this.wasOffroad = false;
      this.wasPadHit = false;
      return;
    }
    const speedRatio = clamp(state.speed / Math.max(1, state.maxSpeed), 0, 1.2);

    // tyre squeal: softer rubber scrub whose pitch and level follow the slide
    const sliding = state.drifting && !state.offroad && state.speed > 36;
    const slip = clamp(state.slip, 0, 1);
    const tyreLevel = sliding ? 0.024 + slip * 0.05 + speedRatio * 0.012 : 0;
    this.tyreGain.gain.setTargetAtTime(tyreLevel, now, 0.05);
    this.tyreFilter.frequency.setTargetAtTime(1200 + slip * 1350 + speedRatio * 300, now, 0.06);
    this.tyreFilter.Q.setTargetAtTime(0.9 + slip * 1.1, now, 0.08);
    if (sliding && !this.wasDrifting && now - this.lastChirpAt > 0.35) {
      this.chirp(0.4 + slip * 0.6);
      this.lastChirpAt = now;
    }
    this.wasDrifting = sliding;

    // dirt / gravel: soft warm rumble & gentle grit (never harsh or overpowering)
    const dirtLevel = state.offroad && state.speed > 20 ? clamp(state.speed / 170, 0, 1) : 0;
    this.dirtGain.gain.setTargetAtTime(dirtLevel > 0 ? 0.012 + dirtLevel * 0.03 : 0, now, 0.08);
    this.dirtFilter.frequency.setTargetAtTime(480 + dirtLevel * 450, now, 0.08);
    this.rumbleGain.gain.setTargetAtTime(dirtLevel > 0 ? 0.018 + dirtLevel * 0.042 : 0, now, 0.08);
    if (state.offroad !== this.wasOffroad && state.speed > 55 && now - this.lastThumpAt > 0.25) {
      this.thump(clamp(state.speed / 200, 0.25, 0.75));
      this.lastThumpAt = now;
    }
    this.wasOffroad = state.offroad;

    // boost pad pick-up
    if (state.padHit && !this.wasPadHit) this.boost();
    this.wasPadHit = state.padHit;
  }

  /** Rain ambience, wet-road tyre hiss. Call every frame; pass zeros for no weather. */
  updateWeather(rain: number, wetness: number, speedRatio: number, racing: boolean): void {
    if (!this.context || !this.rainGain || !this.wetHissGain) return;
    const now = this.context.currentTime;
    const r = racing ? clamp(rain, 0, 1) : 0;
    const w = racing ? clamp(wetness, 0, 1) : 0;
    this.rainGain.gain.setTargetAtTime(r > 0.03 ? 0.012 + r * 0.05 : 0, now, 0.25);
    this.wetHissGain.gain.setTargetAtTime(w > 0.15 ? w * clamp(speedRatio, 0, 1.1) * 0.05 : 0, now, 0.12);
  }

  /** Distant rolling thunder, for heavy rain. */
  thunder(): void {
    if (!this.context || !this.master || !this.whiteNoise) return;
    const ctx = this.context;
    const now = ctx.currentTime + 0.05;
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + 2.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.12);
    gain.gain.setTargetAtTime(0.0001, now + 0.4, 0.7);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now, Math.random() * 0.4);
    src.stop(now + 2.6);
  }

  /** Short rising tyre chirp when a slide starts. */
  private chirp(strength: number): void {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(820, now);
    osc.frequency.exponentialRampToValueAtTime(1500 + 400 * strength, now + 0.12);
    filter.type = 'bandpass';
    filter.frequency.value = 1700;
    filter.Q.value = 3;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045 * strength + 0.01, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Soft bump when tyres leave / re-enter the asphalt. */
  private thump(strength: number): void {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.13);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.065 * strength, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Boost pad: a quick upward whoosh. */
  boost(): void {
    if (!this.context || !this.master || !this.whiteNoise) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.6;
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(3600, now + 0.32);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now, Math.random() * 0.8);
    src.stop(now + 0.4);

    const tone = ctx.createOscillator();
    const toneGain = ctx.createGain();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(260, now);
    tone.frequency.exponentialRampToValueAtTime(780, now + 0.26);
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.06, now + 0.05);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    tone.connect(toneGain);
    toneGain.connect(this.master);
    tone.start(now);
    tone.stop(now + 0.32);
  }

  /**
   * Collision, layered: a low body thump, a warm filtered crunch, and (for hard hits) a short soft ring.
   * Frequencies and levels are balanced to sit naturally with the engine audio.
   */
  impact(strength = 1, kind: ImpactKind = 'wall'): void {
    if (!this.context || !this.master || !this.softNoise) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const s = clamp(strength, 0.05, 1);
    const pitch = 0.92 + Math.random() * 0.16;
    const isCar = kind === 'car';

    // 1. body thump (warm low-end, smooth attack)
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime((isCar ? 145 : 115) * pitch, now);
    thump.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.linearRampToValueAtTime(0.05 + 0.12 * s, now + 0.008);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    thump.connect(thumpGain);
    thumpGain.connect(this.master);
    thump.start(now);
    thump.stop(now + 0.26);

    // 2. crunch (warm soft noise burst, matched to vehicle mid-range)
    const crunch = ctx.createBufferSource();
    crunch.buffer = this.softNoise;
    const crunchFilter = ctx.createBiquadFilter();
    crunchFilter.type = 'bandpass';
    crunchFilter.frequency.value = (isCar ? 640 : 540) * pitch;
    crunchFilter.Q.value = 0.7;
    const crunchGain = ctx.createGain();
    crunchGain.gain.setValueAtTime(0.0001, now);
    crunchGain.gain.linearRampToValueAtTime(0.03 + 0.09 * s, now + 0.01);
    crunchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06 + 0.12 * s);
    crunch.connect(crunchFilter);
    crunchFilter.connect(crunchGain);
    crunchGain.connect(this.master);
    crunch.start(now, Math.random() * 0.8);
    crunch.stop(now + 0.22);

    // 3. soft metal ring on hard hits
    if (s > 0.45) {
      const ringBase = (isCar ? 420 : 280) * pitch;
      for (const ratio of [1, 1.5]) {
        const ring = ctx.createOscillator();
        const ringGain = ctx.createGain();
        ring.type = 'sine';
        ring.frequency.value = ringBase * ratio;
        ringGain.gain.setValueAtTime(0.0001, now);
        ringGain.gain.linearRampToValueAtTime(0.02 * s, now + 0.01);
        ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        ring.connect(ringGain);
        ringGain.connect(this.master);
        ring.start(now);
        ring.stop(now + 0.24);
      }
    }

    // 4. warm low-mid scrape tail when sliding along a barrier (no harsh 2.6kHz hiss)
    if (!isCar) {
      const scrape = ctx.createBufferSource();
      scrape.buffer = this.softNoise;
      const scrapeFilter = ctx.createBiquadFilter();
      scrapeFilter.type = 'bandpass';
      scrapeFilter.frequency.value = 720 * pitch;
      scrapeFilter.Q.value = 0.8;
      const scrapeGain = ctx.createGain();
      scrapeGain.gain.setValueAtTime(0.0001, now + 0.02);
      scrapeGain.gain.linearRampToValueAtTime(0.024 * s + 0.005, now + 0.06);
      scrapeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
      scrape.connect(scrapeFilter);
      scrapeFilter.connect(scrapeGain);
      scrapeGain.connect(this.master);
      scrape.start(now, Math.random() * 0.8);
      scrape.stop(now + 0.28);
    }
  }

  /** Smooth warm chime + soft air whoosh when resetting car back onto track. */
  reset(): void {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    const now = ctx.currentTime;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    filter.connect(this.master);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.14);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.065, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain);
    gain.connect(filter);
    osc.start(now);
    osc.stop(now + 0.24);

    if (this.whiteNoise) {
      const whoosh = ctx.createBufferSource();
      whoosh.buffer = this.whiteNoise;
      const wf = ctx.createBiquadFilter();
      wf.type = 'bandpass';
      wf.frequency.setValueAtTime(600, now);
      wf.frequency.exponentialRampToValueAtTime(1400, now + 0.16);
      wf.Q.value = 1.2;
      const wg = ctx.createGain();
      wg.gain.setValueAtTime(0.0001, now);
      wg.gain.linearRampToValueAtTime(0.035, now + 0.03);
      wg.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      whoosh.connect(wf);
      wf.connect(wg);
      wg.connect(this.master);
      whoosh.start(now, Math.random() * 0.6);
      whoosh.stop(now + 0.22);
    }
  }

  beep(frequency = 640, duration = 0.11, volume = 0.1): void {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    filter.type = 'lowpass';
    filter.frequency.value = 1900;
    const peak = Math.min(0.11, volume * 0.72);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  click(): void {
    this.beep(480, 0.055, 0.065);
  }

  setMenuMusic(active: boolean): void {
    this.menuMusicDesired = active;
    if (active) {
      if (this.unlocked && this.context) {
        this.startMenuLoop();
      }
    } else {
      this.stopMenuLoop();
    }
  }

  private startMenuLoop(): void {
    if (this.menuMusicTimer != null || typeof window === 'undefined') return;
    // Upbeat 120 BPM retro arcade groove (bass + soft synth arpeggio)
    const bassNotes = [130.81, 130.81, 196.0, 196.0, 110.0, 110.0, 87.31, 98.0];
    const leadNotes = [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 523.25, 392.0];
    this.menuMusicTimer = window.setInterval(() => {
      if (!this.menuMusicDesired || !this.context || !this.master || this.muted) return;
      if (this.context.state !== 'running') return;
      const now = this.context.currentTime;
      const idx = this.menuStep % bassNotes.length;
      this.menuStep += 1;

      const bass = this.context.createOscillator();
      const bassGain = this.context.createGain();
      bass.type = 'triangle';
      bass.frequency.value = bassNotes[idx];
      bassGain.gain.setValueAtTime(0.065, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      bass.connect(bassGain);
      bassGain.connect(this.master);
      bass.start(now);
      bass.stop(now + 0.22);

      if (this.menuStep % 2 === 1) {
        const lead = this.context.createOscillator();
        const leadFilter = this.context.createBiquadFilter();
        const leadGain = this.context.createGain();
        lead.type = 'sine';
        lead.frequency.value = leadNotes[idx];
        leadFilter.type = 'lowpass';
        leadFilter.frequency.value = 1400;
        leadGain.gain.setValueAtTime(0.04, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        lead.connect(leadFilter);
        leadFilter.connect(leadGain);
        leadGain.connect(this.master);
        lead.start(now);
        lead.stop(now + 0.23);
      }
    }, 250);
  }

  private stopMenuLoop(): void {
    if (this.menuMusicTimer != null && typeof window !== 'undefined') {
      window.clearInterval(this.menuMusicTimer);
      this.menuMusicTimer = null;
    }
  }

  dispose(): void {
    this.stopMenuLoop();
    try {
      this.engineOsc?.stop();
      this.engineOsc2?.stop();
      this.context?.close();
    } catch {
      // Audio cleanup is best-effort.
    }
    this.context = null;
  }
}
