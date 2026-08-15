/**
 * Voice Puppetry Service
 * Single authority for microphone stream analysis, local frequency classification,
 * viseme mapping, and safe audio lifecycle teardown.
 */

import { DEFAULT_EXPRESSION } from '../domain/vocabulary.js';

/**
 * Classifies a frequency buffer into speech visemes.
 * Fundamental vowels (O/U) map to 'o_mouth', loud vocalizations to 'wide_open',
 * mid-register vowels to 'talking', soft inflections to 'smile', silence to 'neutral'.
 */
export function classifyAudioFrequency(dataArray) {
  let lowEnergy = 0;
  let midEnergy = 0;
  let totalEnergy = 0;
  const lowCutoff = Math.floor(dataArray.length * 0.12);
  const midCutoff = Math.floor(dataArray.length * 0.45);

  for (let i = 0; i < dataArray.length; i += 1) {
    const val = dataArray[i];
    totalEnergy += val;
    if (i < lowCutoff) lowEnergy += val;
    else if (i < midCutoff) midEnergy += val;
  }

  const avgVolume = totalEnergy / dataArray.length;
  const avgLow = lowEnergy / Math.max(1, lowCutoff);
  const avgMid = midEnergy / Math.max(1, midCutoff - lowCutoff);

  const silenceThreshold = 14;

  if (avgVolume <= silenceThreshold) {
    return { isSilent: true, mouth: DEFAULT_EXPRESSION, avgVolume, avgLow, avgMid };
  }

  let mouth = 'smile';
  if (avgVolume > 62) {
    mouth = 'wide_open';
  } else if (avgLow > avgMid * 1.35 && avgLow > 26) {
    mouth = 'o_mouth';
  } else if (avgVolume > 38 || avgMid > 22) {
    mouth = 'talking';
  } else {
    mouth = 'smile';
  }

  return { isSilent: false, mouth, avgVolume, avgLow, avgMid };
}

/**
 * Creates a Voice Puppetry Service instance managing the microphone,
 * AudioContext, AnalyserNode, animation frame loop, and teardown.
 */
export function createVoicePuppetryService(options = {}) {
  const getUserMedia = options.getUserMedia ?? ((constraints) => navigator.mediaDevices.getUserMedia(constraints));
  const AudioContextClass = options.AudioContext ?? (globalThis.AudioContext || globalThis.webkitAudioContext);
  const raf = options.requestAnimationFrame ?? ((cb) => requestAnimationFrame(cb));
  const cancelRaf = options.cancelAnimationFrame ?? ((id) => cancelAnimationFrame(id));
  const onViseme = options.onViseme ?? (() => {});
  const onActiveChange = options.onActiveChange ?? (() => {});
  const onError = options.onError ?? (() => {});

  let isActive = false;
  let requestId = 0;
  let audioStream = null;
  let audioContext = null;
  let audioAnalyser = null;
  let audioRaf = null;
  let currentViseme = DEFAULT_EXPRESSION;
  let silenceFrames = 0;

  function stop() {
    requestId += 1;
    if (audioRaf != null) {
      cancelRaf(audioRaf);
      audioRaf = null;
    }
    if (audioStream) {
      for (const track of audioStream.getTracks?.() || []) {
        try { track.stop(); } catch { /* best effort */ }
      }
      audioStream = null;
    }
    if (audioContext) {
      try { void audioContext.close(); } catch { /* best effort */ }
      audioContext = null;
    }
    audioAnalyser = null;
    currentViseme = DEFAULT_EXPRESSION;
    silenceFrames = 0;
    if (isActive) {
      isActive = false;
      onActiveChange(false);
      onViseme(DEFAULT_EXPRESSION);
    }
  }

  async function start() {
    if (isActive) return;
    const currentReq = ++requestId;
    let stream = null;

    try {
      if (!getUserMedia) throw new Error('getUserMedia is not supported');
      stream = await getUserMedia({ audio: true });
      if (currentReq !== requestId) {
        if (stream?.getTracks) {
          for (const track of stream.getTracks()) track.stop();
        }
        return;
      }
      audioStream = stream;

      if (!AudioContextClass) throw new Error('AudioContext is not supported');
      audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.45;
      source.connect(analyser);
      audioAnalyser = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      isActive = true;
      currentViseme = DEFAULT_EXPRESSION;
      silenceFrames = 0;
      onActiveChange(true);

      const loop = () => {
        if (!isActive || currentReq !== requestId) return;
        analyser.getByteFrequencyData(dataArray);
        const analysis = classifyAudioFrequency(dataArray);

        let targetMouth = DEFAULT_EXPRESSION;
        if (analysis.isSilent) {
          silenceFrames += 1;
          if (silenceFrames > 4) {
            targetMouth = DEFAULT_EXPRESSION;
          } else {
            targetMouth = currentViseme;
          }
        } else {
          silenceFrames = 0;
          targetMouth = analysis.mouth;
        }

        if (targetMouth !== currentViseme) {
          currentViseme = targetMouth;
          onViseme(currentViseme);
        }

        audioRaf = raf(loop);
      };

      audioRaf = raf(loop);
    } catch (err) {
      if (audioStream && audioStream === stream) stop();
      else if (stream?.getTracks) {
        for (const track of stream.getTracks()) {
          try { track.stop(); } catch { /* best effort */ }
        }
      }
      if (currentReq !== requestId) return;
      const wasActive = isActive;
      isActive = false;
      if (wasActive) onActiveChange(false);
      onError(err);
    }
  }

  function toggle() {
    if (isActive) stop();
    else void start();
  }

  return {
    isActive: () => isActive,
    start,
    stop,
    toggle
  };
}
