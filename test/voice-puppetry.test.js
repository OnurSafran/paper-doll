import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAudioFrequency, createVoicePuppetryService } from '../js/services/voice-puppetry.js';

test('classifyAudioFrequency categorizes silence, soft murmurs, open vowels, and shouting', () => {
  // Silent buffer
  const silence = new Uint8Array(256).fill(5);
  const silenceRes = classifyAudioFrequency(silence);
  assert.equal(silenceRes.isSilent, true);
  assert.equal(silenceRes.mouth, 'neutral');

  // Loud buffer -> wide_open
  const loud = new Uint8Array(256).fill(75);
  const loudRes = classifyAudioFrequency(loud);
  assert.equal(loudRes.isSilent, false);
  assert.equal(loudRes.mouth, 'wide_open');

  // Low formant dominant -> o_mouth (O / U vowel)
  const lowBuffer = new Uint8Array(256);
  // low band (first 12% = ~30 bins) high energy (~180), mid band (~85 bins) lower energy (~10)
  for (let i = 0; i < 30; i += 1) lowBuffer[i] = 180;
  for (let i = 30; i < 115; i += 1) lowBuffer[i] = 10;
  const lowRes = classifyAudioFrequency(lowBuffer);
  assert.equal(lowRes.isSilent, false);
  assert.equal(lowRes.mouth, 'o_mouth');

  // Mid speech range -> talking
  const midBuffer = new Uint8Array(256).fill(42);
  const midRes = classifyAudioFrequency(midBuffer);
  assert.equal(midRes.isSilent, false);
  assert.equal(midRes.mouth, 'talking');

  // Soft murmur -> smile
  const softBuffer = new Uint8Array(256).fill(20);
  const softRes = classifyAudioFrequency(softBuffer);
  assert.equal(softRes.isSilent, false);
  assert.equal(softRes.mouth, 'smile');
});

test('voice puppetry service manages complete audio lifecycle, stream analysis, and teardown', async () => {
  let streamStopped = false;
  let contextClosed = false;
  let rafCancelled = false;
  let rafCallback = null;
  let rafId = 100;

  const mockTrack = {
    stop: () => { streamStopped = true; }
  };
  const mockStream = {
    getTracks: () => [mockTrack]
  };

  class MockAudioContext {
    createMediaStreamSource() {
      return { connect: () => {} };
    }
    createAnalyser() {
      return {
        fftSize: 512,
        smoothingTimeConstant: 0.45,
        frequencyBinCount: 256,
        getByteFrequencyData: (arr) => arr.fill(45) // Simulated speech
      };
    }
    close() {
      contextClosed = true;
      return Promise.resolve();
    }
  }

  const visemeEvents = [];
  const activeEvents = [];

  const service = createVoicePuppetryService({
    getUserMedia: async () => mockStream,
    AudioContext: MockAudioContext,
    requestAnimationFrame: (cb) => {
      rafCallback = cb;
      return ++rafId;
    },
    cancelAnimationFrame: () => {
      rafCancelled = true;
    },
    onViseme: (v) => visemeEvents.push(v),
    onActiveChange: (a) => activeEvents.push(a)
  });

  assert.equal(service.isActive(), false);

  // Start voice service
  await service.start();
  assert.equal(service.isActive(), true);
  assert.deepEqual(activeEvents, [true]);

  // Advance one RAF loop
  if (rafCallback) rafCallback();
  assert.ok(visemeEvents.length > 0);
  assert.equal(visemeEvents.at(-1), 'talking');

  // Stop voice service
  service.stop();
  assert.equal(service.isActive(), false);
  assert.equal(streamStopped, true);
  assert.equal(contextClosed, true);
  assert.equal(rafCancelled, true);
  assert.deepEqual(activeEvents, [true, false]);
  assert.equal(visemeEvents.at(-1), 'neutral');
});

test('voice puppetry service handles permission denial and stale async resolutions safely', async () => {
  let errorFired = null;
  const activeEvents = [];

  const denyingService = createVoicePuppetryService({
    getUserMedia: async () => {
      const err = new Error('Permission denied');
      err.name = 'NotAllowedError';
      throw err;
    },
    onActiveChange: (a) => activeEvents.push(a),
    onError: (err) => { errorFired = err; }
  });

  await denyingService.start();
  assert.equal(denyingService.isActive(), false);
  assert.equal(errorFired?.name, 'NotAllowedError');
  assert.deepEqual(activeEvents, []);

  // Stale request resolution: start -> stop immediately -> getUserMedia resolves later
  let resolveStream;
  const delayedStreamPromise = new Promise((res) => { resolveStream = res; });
  let staleStreamStopped = false;
  const staleStream = {
    getTracks: () => [{ stop: () => { staleStreamStopped = true; } }]
  };

  const staleService = createVoicePuppetryService({
    getUserMedia: () => delayedStreamPromise,
    AudioContext: class {
      createMediaStreamSource() { return { connect: () => {} }; }
      createAnalyser() { return { frequencyBinCount: 256 }; }
    }
  });

  // Start then cancel before resolution
  const startPromise = staleService.start();
  staleService.stop();
  resolveStream(staleStream);
  await startPromise;

  assert.equal(staleService.isActive(), false);
  assert.equal(staleStreamStopped, true);
});
