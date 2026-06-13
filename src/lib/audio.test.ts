import { describe, expect, it } from "vitest";
import { base64ToBlob, getRecordingExtension } from "@/lib/audio";

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
});
