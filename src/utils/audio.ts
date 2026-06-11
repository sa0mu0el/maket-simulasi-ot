export class PltaAudioEngine {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = false;

  // Water Sound Generator Nodes
  private waterNoiseSource: AudioBufferSourceNode | null = null;
  private waterFilter: BiquadFilterNode | null = null;
  private waterGain: GainNode | null = null;

  // Generator Hum Nodes
  private humOscillator: OscillatorNode | null = null;
  private humGain: GainNode | null = null;

  // Electrical Spark Buzz Nodes
  private electricityOscillator: OscillatorNode | null = null;
  private electricityGain: GainNode | null = null;

  constructor() {}

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (enabled) {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } else {
      this.mute();
    }
  }

  private init() {
    if (this.ctx) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // --- 1. SETUP WATER Sound Node (White Noise + Lowpass modulation) ---
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.waterNoiseSource = this.ctx.createBufferSource();
      this.waterNoiseSource.buffer = noiseBuffer;
      this.waterNoiseSource.loop = true;

      this.waterFilter = this.ctx.createBiquadFilter();
      this.waterFilter.type = 'lowpass';
      this.waterFilter.frequency.value = 250;
      this.waterFilter.Q.value = 1.0;

      this.waterGain = this.ctx.createGain();
      this.waterGain.gain.value = 0;

      this.waterNoiseSource.connect(this.waterFilter);
      this.waterFilter.connect(this.waterGain);
      this.waterGain.connect(this.ctx.destination);
      this.waterNoiseSource.start(0);

      // --- 2. SETUP GENERATOR HUM (Low frequency Triangle wave) ---
      this.humOscillator = this.ctx.createOscillator();
      this.humOscillator.type = 'triangle';
      this.humOscillator.frequency.value = 50; // default 50Hz grid

      this.humGain = this.ctx.createGain();
      this.humGain.gain.value = 0;

      this.humOscillator.connect(this.humGain);
      this.humGain.connect(this.ctx.destination);
      this.humOscillator.start(0);

      // --- 3. SETUP DIGITAL ELECTRIC BUZZ (High-frequency Sawtooth wave with filtering) ---
      this.electricityOscillator = this.ctx.createOscillator();
      this.electricityOscillator.type = 'sawtooth';
      this.electricityOscillator.frequency.value = 120; // 120Hz electricity harmonic sound

      const elecFilter = this.ctx.createBiquadFilter();
      elecFilter.type = 'bandpass';
      elecFilter.frequency.value = 800;
      elecFilter.Q.value = 2.0;

      this.electricityGain = this.ctx.createGain();
      this.electricityGain.gain.value = 0;

      this.electricityOscillator.connect(elecFilter);
      elecFilter.connect(this.electricityGain);
      this.electricityGain.connect(this.ctx.destination);
      this.electricityOscillator.start(0);

    } catch (e) {
      console.warn('Click-to-start Web Audio initialization failed or blocked by context', e);
    }
  }

  public update(debit: number, isGateOpen: boolean) {
    if (!this.isEnabled) return;
    this.init(); // lazy init in case activation happened later

    if (!this.ctx) return;

    // Calculate goals based on water debit (0 to 100) and if gate is wide open
    const activeDebit = isGateOpen ? debit : 0;
    const fraction = activeDebit / 100; // 0.0 to 1.0

    const now = this.ctx.currentTime;

    if (this.waterGain && this.waterFilter) {
      // Dynamic loudness of roaring water
      const waterVolume = fraction * 0.25; // max 25% volume for comfort
      const cutoffFreq = 150 + fraction * 450; // 150Hz to 600Hz low-pass frequency

      this.waterGain.gain.setTargetAtTime(waterVolume, now, 0.1);
      this.waterFilter.frequency.setTargetAtTime(cutoffFreq, now, 0.15);
    }

    if (this.humGain && this.humOscillator) {
      // Generator hum increases in pitch (from 40Hz to 95Hz) and volume as turbine spins faster
      const humVolume = fraction * 0.15; // max 15% volume
      const humPitch = 40 + fraction * 55; // 40Hz to 95Hz

      this.humGain.gain.setTargetAtTime(humVolume, now, 0.15);
      this.humOscillator.frequency.setTargetAtTime(humPitch, now, 0.2);
    }

    if (this.electricityGain && this.electricityOscillator) {
      // Rhythmic electricity line crackling that raises with load/debit
      const elecVolume = fraction > 0.1 ? (0.01 + Math.sin(now * 30) * 0.005) * fraction : 0;
      this.electricityGain.gain.setTargetAtTime(elecVolume, now, 0.05);
    }
  }

  private mute() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.waterGain) this.waterGain.gain.setTargetAtTime(0, now, 0.05);
    if (this.humGain) this.humGain.gain.setTargetAtTime(0, now, 0.05);
    if (this.electricityGain) this.electricityGain.gain.setTargetAtTime(0, now, 0.05);
  }

  public stop() {
    try {
      this.mute();
      if (this.ctx) {
        this.ctx.close();
        this.ctx = null;
      }
    } catch (e) {
      console.log('Error stopping audio engine:', e);
    }
  }
}
