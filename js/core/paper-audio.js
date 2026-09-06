/**
 * Procedural Papercraft Audio Synthesizer
 * Generates tactile paper rustles, postal stamp thuds, cat purrs, and chimes
 * using Web Audio API without requiring any external audio files.
 * Strictly respects soundEnabled user setting.
 */

let audioCtx = null;
let cachedNoiseBuffer = null;
let cachedNoiseCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Reusable white noise buffer to prevent allocation churn.
 */
function getSharedNoiseBuffer(ctx) {
  if (cachedNoiseBuffer && cachedNoiseCtx === ctx) {
    return cachedNoiseBuffer;
  }
  const sampleRate = ctx.sampleRate || 44100;
  const bufferSize = sampleRate * 1; // 1 second reusable buffer
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoiseBuffer = buffer;
  cachedNoiseCtx = ctx;
  return buffer;
}

export function createPaperAudio(getSoundEnabled = () => false) {
  function canPlay() {
    try {
      return Boolean(getSoundEnabled());
    } catch {
      return false;
    }
  }

  /**
   * Unfolding paper map rustle.
   */
  function playPaperRustle() {
    if (!canPlay()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = getSharedNoiseBuffer(ctx);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + 0.3);
      filter.Q.setValueAtTime(1.8, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.35);
    } catch {}
  }

  /**
   * Postal ink stamp thud when unlocking or collecting a souvenir stamp.
   */
  function playStampThud() {
    if (!canPlay()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. Low wooden body thud
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      oscGain.gain.setValueAtTime(0.28, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);

      // 2. Paper strike tap
      const noise = ctx.createBufferSource();
      noise.buffer = getSharedNoiseBuffer(ctx);

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1800, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.15, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.08);
    } catch {}
  }

  /**
   * Soft kitten purr (Bakery easter egg).
   */
  function playPurr() {
    if (!canPlay()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(98, now);
      osc2.frequency.setValueAtTime(102, now); // 4Hz rhythmic beat

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
    } catch {}
  }

  /**
   * Whimsical bell chime for easter egg discovery or realm unlock.
   */
  function playChime() {
    if (!canPlay()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [880, 1174, 1568]; // A5, D6, G6 harmonic chord
      freqs.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.05);

        gain.gain.setValueAtTime(0.001, now + index * 0.05);
        gain.gain.linearRampToValueAtTime(0.12, now + index * 0.05 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.05 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + index * 0.05);
        osc.stop(now + index * 0.05 + 0.4);
      });
    } catch {}
  }

  /**
   * Crisp storybook paper page turn when traveling.
   */
  function playPageTurn() {
    if (!canPlay()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = getSharedNoiseBuffer(ctx);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(2800, now + 0.18);
      filter.frequency.exponentialRampToValueAtTime(900, now + 0.38);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.39);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.4);
    } catch {}
  }

  /**
   * Gentle papercraft pop for micro-interactions (bottles, paint, pinwheels, balloons).
   */
  function playPop() {
    if (!canPlay()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.06);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {}
  }

  return {
    playPaperRustle,
    playStampThud,
    playPurr,
    playChime,
    playPageTurn,
    playPop
  };
}
