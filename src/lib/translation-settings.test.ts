import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  correctDirection,
  correctVoice,
  isValidCombo,
  isVoiceAvailable,
  settingsValidationError,
  supportedDirections,
} from "@/lib/translation-settings";

describe("translation-settings registry", () => {
  describe("isValidCombo", () => {
    it("accepts focused + lug_to_eng", () => {
      expect(isValidCombo("focused", "lug_to_eng")).toBe(true);
    });

    it("rejects focused + eng_to_lug", () => {
      expect(isValidCombo("focused", "eng_to_lug")).toBe(false);
    });

    it("accepts both bidirectional directions", () => {
      expect(isValidCombo("bidirectional", "lug_to_eng")).toBe(true);
      expect(isValidCombo("bidirectional", "eng_to_lug")).toBe(true);
    });
  });

  describe("supportedDirections", () => {
    it("returns only lug_to_eng for focused", () => {
      expect(supportedDirections("focused")).toEqual(["lug_to_eng"]);
    });

    it("returns both directions for bidirectional", () => {
      expect(supportedDirections("bidirectional")).toEqual([
        "lug_to_eng",
        "eng_to_lug",
      ]);
    });
  });

  describe("correctDirection", () => {
    it("keeps a valid direction", () => {
      expect(correctDirection("bidirectional", "eng_to_lug")).toBe("eng_to_lug");
    });

    it("falls back to lug_to_eng when switching to focused with eng_to_lug", () => {
      expect(correctDirection("focused", "eng_to_lug")).toBe("lug_to_eng");
    });
  });

  describe("correctVoice", () => {
    it("keeps voice when it is available", () => {
      expect(correctVoice({ female: true, male: true }, "male")).toBe("male");
    });

    it("falls back to female when male is unavailable", () => {
      expect(correctVoice({ female: true, male: false }, "male")).toBe("female");
    });

    it("falls back to whatever voice is available when current is missing", () => {
      expect(correctVoice({ female: false, male: true }, "female")).toBe("male");
    });

    it("falls back to female when nothing is reported", () => {
      expect(correctVoice({}, "male")).toBe("female");
    });
  });

  describe("isVoiceAvailable", () => {
    it("only treats true as available", () => {
      expect(isVoiceAvailable({ female: true }, "female")).toBe(true);
      expect(isVoiceAvailable({ female: false }, "female")).toBe(false);
      expect(isVoiceAvailable({}, "male")).toBe(false);
    });
  });

  describe("settingsValidationError", () => {
    const availability = { female: true, male: true };

    it("returns null when settings are valid", () => {
      expect(
        settingsValidationError(DEFAULT_SETTINGS, availability),
      ).toBeNull();
    });

    it("flags an unsupported combo", () => {
      expect(
        settingsValidationError(
          { modelMode: "focused", direction: "eng_to_lug", voice: "female" },
          availability,
        ),
      ).toMatch(/not supported by the Focused model/);
    });

    it("flags an unprovisioned voice", () => {
      expect(
        settingsValidationError(
          { modelMode: "focused", direction: "lug_to_eng", voice: "male" },
          { female: true, male: false },
        ),
      ).toMatch(/Male voice .* not provisioned/);
    });
  });

  describe("support matrix", () => {
    const MATRIX: Array<{
      modelMode: "focused" | "bidirectional";
      direction: "lug_to_eng" | "eng_to_lug";
      expected: boolean;
    }> = [
      { modelMode: "focused",       direction: "lug_to_eng", expected: true },
      { modelMode: "focused",       direction: "eng_to_lug", expected: false },
      { modelMode: "bidirectional", direction: "lug_to_eng", expected: true },
      { modelMode: "bidirectional", direction: "eng_to_lug", expected: true },
    ];

    for (const { modelMode, direction, expected } of MATRIX) {
      it(`${modelMode} + ${direction} → ${expected}`, () => {
        expect(isValidCombo(modelMode, direction)).toBe(expected);
      });
    }
  });
});
