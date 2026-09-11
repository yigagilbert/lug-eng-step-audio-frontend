import { describe, expect, it } from "vitest";
import { getTranslationProgressSnapshot } from "@/lib/translation-progress";

describe("translation progress", () => {
  it("starts with audio preparation when mic normalization is running", () => {
    const snapshot = getTranslationProgressSnapshot(0, true);

    expect(snapshot.activeStageId).toBe("prepare");
    expect(snapshot.coldStartLikely).toBe(false);
    expect(snapshot.percent).toBe(12);
  });

  it("reports secure upload early in the request", () => {
    const snapshot = getTranslationProgressSnapshot(2, false);

    expect(snapshot.activeStageId).toBe("upload");
    expect(snapshot.percent).toBeGreaterThan(24);
    expect(snapshot.percent).toBeLessThan(42);
  });

  it("shows a cold-start warning after the warm request threshold", () => {
    const snapshot = getTranslationProgressSnapshot(12, false);

    expect(snapshot.activeStageId).toBe("wake");
    expect(snapshot.coldStartLikely).toBe(true);
    expect(snapshot.headline).toMatch(/Warming/);
  });

  it("caps long-running request progress before completion", () => {
    const snapshot = getTranslationProgressSnapshot(180, false);

    expect(snapshot.activeStageId).toBe("infer");
    expect(snapshot.coldStartLikely).toBe(true);
    expect(snapshot.percent).toBeLessThanOrEqual(94);
  });
});
