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
