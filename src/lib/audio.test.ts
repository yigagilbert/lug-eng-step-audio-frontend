import { describe, expect, it } from "vitest";
import {
  NORMALIZED_RECORDING_SAMPLE_RATE,
  base64ToBlob,
  encodePcm16Wav,
  getRecordingExtension,
  normalizeSpeechSamples,
} from "@/lib/audio";

describe("audio helpers", () => {
  it("decodes base64 audio payloads into blobs", async () => {
    const blob = base64ToBlob("aGVsbG8=", "audio/wav");

    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(5);
    await expect(blob.text()).resolves.toBe("hello");
  });

  it("maps browser recorder MIME types to sensible extensions", () => {
    expect(getRecordingExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(getRecordingExtension("audio/mp4")).toBe("m4a");
    expect(getRecordingExtension("audio/mpeg")).toBe("mp3");
    expect(getRecordingExtension("audio/wav")).toBe("wav");
    expect(getRecordingExtension("")).toBe("webm");
  });

  it("encodes mono 16-bit PCM WAV blobs", async () => {
    const wav = encodePcm16Wav(
      new Float32Array([0, -1, 1]),
      NORMALIZED_RECORDING_SAMPLE_RATE,
    );
    const buffer = await wav.arrayBuffer();
    const view = new DataView(buffer);
    const ascii = (offset: number, length: number) =>
      String.fromCharCode(...new Uint8Array(buffer, offset, length));

    expect(wav.type).toBe("audio/wav");
    expect(ascii(0, 4)).toBe("RIFF");
    expect(ascii(8, 4)).toBe("WAVE");
    expect(ascii(12, 4)).toBe("fmt ");
    expect(ascii(36, 4)).toBe("data");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(NORMALIZED_RECORDING_SAMPLE_RATE);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(32767);
  });

  it("centers and boosts quiet speech samples conservatively", () => {
    const normalized = normalizeSpeechSamples(new Float32Array([0.22, 0.24, 0.20, 0.26]));
    const values = Array.from(normalized);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const peak = Math.max(...values.map((value) => Math.abs(value)));

    expect(Math.abs(mean)).toBeLessThan(0.0001);
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(0.921);
  });

  it("attenuates loud speech samples before PCM encoding", () => {
    const normalized = normalizeSpeechSamples(new Float32Array([-1, 1, -0.9, 0.9]));
    const peak = Math.max(...Array.from(normalized).map((value) => Math.abs(value)));

    expect(peak).toBeLessThanOrEqual(0.921);
  });
});
