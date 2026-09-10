export const NORMALIZED_RECORDING_SAMPLE_RATE = 16_000;

const WAV_HEADER_BYTES = 44;
const PCM_BYTES_PER_SAMPLE = 2;
const PCM_FORMAT = 1;
const PCM_BITS_PER_SAMPLE = 16;
const MONO_CHANNEL_COUNT = 1;
const TARGET_PEAK = 0.92;
const MAX_GAIN = 8;
const SILENCE_PEAK = 0.005;

export type NormalizedRecording = {
  blob: Blob;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  sourceMimeType: string;
};

export function base64ToBlob(base64: string, mimeType = "audio/wav") {
  const normalized = base64.includes(",") ? base64.split(",").pop() ?? "" : base64;
  const binary = globalThis.atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

export function createAudioObjectUrl(base64: string, sampleRate?: number) {
  const mimeType = sampleRate ? `audio/wav;rate=${sampleRate}` : "audio/wav";
  return URL.createObjectURL(base64ToBlob(base64, mimeType));
}

export async function normalizeRecordingToWav(
  recording: Blob,
  targetSampleRate = NORMALIZED_RECORDING_SAMPLE_RATE,
): Promise<NormalizedRecording> {
  const AudioContextConstructor = getAudioContextConstructor();
  const OfflineAudioContextConstructor = getOfflineAudioContextConstructor();

  if (!AudioContextConstructor || !OfflineAudioContextConstructor) {
    throw new Error("Browser audio normalization is not supported.");
  }

  const arrayBuffer = await recording.arrayBuffer();
  const decodeContext = new AudioContextConstructor();

  let decodedAudio: AudioBuffer;
  try {
    decodedAudio = await decodeContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    void decodeContext.close().catch(() => undefined);
  }

  const frameCount = Math.max(1, Math.ceil(decodedAudio.duration * targetSampleRate));
  const renderContext = new OfflineAudioContextConstructor(
    MONO_CHANNEL_COUNT,
    frameCount,
    targetSampleRate,
  );
  const source = renderContext.createBufferSource();
  source.buffer = decodedAudio;
  source.connect(renderContext.destination);
  source.start(0);

  const renderedAudio = await renderContext.startRendering();
  const normalizedSamples = normalizeSpeechSamples(renderedAudio.getChannelData(0));
  const wavBlob = encodePcm16Wav(normalizedSamples, targetSampleRate);

  return {
    blob: wavBlob,
    durationSeconds: renderedAudio.duration,
    sampleRate: targetSampleRate,
    channels: MONO_CHANNEL_COUNT,
    sourceMimeType: recording.type || "unknown",
  };
}

export function encodePcm16Wav(samples: Float32Array, sampleRate: number) {
  const dataBytes = samples.length * PCM_BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, PCM_FORMAT, true);
  view.setUint16(22, MONO_CHANNEL_COUNT, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * MONO_CHANNEL_COUNT * PCM_BYTES_PER_SAMPLE, true);
  view.setUint16(32, MONO_CHANNEL_COUNT * PCM_BYTES_PER_SAMPLE, true);
  view.setUint16(34, PCM_BITS_PER_SAMPLE, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = WAV_HEADER_BYTES;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    const pcmSample = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff);
    view.setInt16(offset, pcmSample, true);
    offset += PCM_BYTES_PER_SAMPLE;
  }

  return new Blob([new Uint8Array(buffer)], { type: "audio/wav" });
}

export function normalizeSpeechSamples(samples: Float32Array) {
  if (samples.length === 0) {
    return samples;
  }

  const centeredSamples = removeDcOffset(samples);
  const peak = getPeakAmplitude(centeredSamples);

  if (peak < SILENCE_PEAK) {
    return centeredSamples;
  }

  const gain =
    peak > TARGET_PEAK ? TARGET_PEAK / peak : Math.min(TARGET_PEAK / peak, MAX_GAIN);

  if (Math.abs(gain - 1) < 0.001) {
    return centeredSamples;
  }

  const normalizedSamples = new Float32Array(centeredSamples.length);

  for (let index = 0; index < centeredSamples.length; index += 1) {
    normalizedSamples[index] = centeredSamples[index] * gain;
  }

  return normalizedSamples;
}

export function getRecordingExtension(mimeType: string) {
  if (mimeType.includes("webm")) {
    return "webm";
  }
  if (mimeType.includes("mp4")) {
    return "m4a";
  }
  if (mimeType.includes("mpeg")) {
    return "mp3";
  }
  if (mimeType.includes("wav")) {
    return "wav";
  }
  if (mimeType.includes("ogg")) {
    return "ogg";
  }
  return "webm";
}

function removeDcOffset(samples: Float32Array) {
  let sum = 0;

  for (let index = 0; index < samples.length; index += 1) {
    sum += samples[index];
  }

  const mean = sum / samples.length;
  if (Math.abs(mean) < 0.0001) {
    return new Float32Array(samples);
  }

  const centeredSamples = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    centeredSamples[index] = samples[index] - mean;
  }

  return centeredSamples;
}

function getPeakAmplitude(samples: Float32Array) {
  let peak = 0;

  for (let index = 0; index < samples.length; index += 1) {
    peak = Math.max(peak, Math.abs(samples[index]));
  }

  return peak;
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function getAudioContextConstructor() {
  return (
    globalThis.AudioContext ??
    (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

function getOfflineAudioContextConstructor() {
  return (
    globalThis.OfflineAudioContext ??
    (globalThis as typeof globalThis & {
      webkitOfflineAudioContext?: typeof OfflineAudioContext;
    }).webkitOfflineAudioContext
  );
}
