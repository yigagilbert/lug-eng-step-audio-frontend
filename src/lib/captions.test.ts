import { describe, expect, it } from "vitest";
import { getRevealedWordCount, splitCaptionWords } from "@/lib/captions";

describe("caption helpers", () => {
  it("splits captions into words without empty tokens", () => {
    expect(splitCaptionWords("  Hello   from Kampala  ")).toEqual([
      "Hello",
      "from",
      "Kampala",
    ]);
  });

  it("reveals words based on playback progress", () => {
    expect(getRevealedWordCount(4, 0, 2)).toBe(1);
    expect(getRevealedWordCount(4, 1, 2)).toBe(2);
    expect(getRevealedWordCount(4, 2, 2)).toBe(4);
    expect(getRevealedWordCount(4, 0.5, 0)).toBe(4);
  });
});
