import { clamp } from './utils';

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private tyreGain: GainNode | null = null;
  private nitroGain: GainNode | null = null;
  private muted = false;
  private unlocked = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.45, this.context.currentTime, 0.03);
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
      this.master.gain.value = this.muted ? 0 : 0.45;
      this.master.connect(this.context.destination);

      const engineBus = this.context.createGain();
      engineBus.gain.value = 0.035;
      engineBus.connect(this.master);
      this.engineGain = engineBus;
      this.engineFilter = this.context.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineFilter.Q.value = 5;
      this.engineFilter.connect(engineBus);

      this.engineOsc = this.context.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 52;
      this.engineOsc.connect(this.engineFilter);
      this.engineOsc.start();

      this.engineOsc2 = this.context.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc2.frequency.value = 78;
      const secondGain = this.context.createGain();
      secondGain.gain.value = 0.22;
      this.engineOsc2.connect(secondGain);
      secondGain.connect(this.engineFilter);
      this.engineOsc2.start();

      const noise = this.createNoiseBuffer(2);
      const tyreSource = this.context.createBufferSource();
      tyreSource.buffer = noise;
      tyreSource.loop = true;
      const tyreFilter = this.context.createBiquadFilter();
      tyreFilter.type = 'bandpass';
      tyreFilter.frequency.value = 1700;
      tyreFilter.Q.value = 1.1;
      this.tyreGain = this.context.createGain();
      this.tyreGain.gain.value = 0;
      tyreSource.connect(tyreFilter);
      tyreFilter.connect(this.tyreGain);
      this.tyreGain.connect(this.master);
      tyreSource.start();

      const nitroSource = this.context.createBufferSource();
      nitroSource.buffer = noise;
      nitroSource.loop = true;
      const nitroFilter = this.context.createBiquadFilter();
      nitroFilter.type = 'highpass';
      nitroFilter.frequency.value = 850;
      this.nitroGain = this.context.createGain();
      this.nitroGain.gain.value = 0;
      nitroSource.connect(nitroFilter);
      nitroFilter.connect(this.nitroGain);
      this.nitroGain.connect(this.master);
      nitroSource.start();

      await this.context.resume();
      this.unlocked = true;
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

  updateEngine(speed: number, maxSpeed: number, drifting: boolean, nitro: boolean, racing: boolean): void {
    if (!this.context || !this.engineOsc || !this.engineOsc2 || !this.engineFilter) return;
    const now = this.context.currentTime;
    const ratio = clamp(speed / Math.max(1, maxSpeed), 0, 1.2);
    const targetGain = racing ? 0.03 + ratio * 0.028 : 0;
    this.engineGain?.gain.setTargetAtTime(targetGain, now, 0.08);
    const base = 48 + ratio * 86 + (nitro ? 16 : 0);
    this.engineOsc.frequency.setTargetAtTime(base, now, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(base * 1.51, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(300 + ratio * 900, now, 0.08);
    this.tyreGain?.gain.setTargetAtTime(racing && drifting ? 0.055 : 0, now, 0.05);
    this.nitroGain?.gain.setTargetAtTime(racing && nitro ? 0.04 : 0, now, 0.05);
  }

  impact(strength = 1): void {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.createNoiseBuffer(0.12);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22 * clamp(strength, 0, 1), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
    source.stop(now + 0.18);
  }

  beep(frequency = 640, duration = 0.11, volume = 0.16): void {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  click(): void {
    this.beep(430, 0.055, 0.09);
  }

  dispose(): void {
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
