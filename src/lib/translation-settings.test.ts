import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  correctDirection,
  correctVoice,
  directionLabel,
  directionSourceLanguage,
  directionTargetLanguage,
  isValidCombo,
  isVoiceAvailable,
  modelModeDescription,
  modelModeLabel,
  settingsValidationError,
  supportedDirections,
  voiceLabel,
} from "./translation-settings";

describe("translation settings", () => {
  it("defaults to the stable focused Luganda to English deployment", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      modelMode: "focused",
      direction: "lug_to_eng",
      voice: "female",
    });
  });

  it("allows only focused Luganda to English", () => {
    expect(isValidCombo("focused", "lug_to_eng")).toBe(true);
    expect(supportedDirections("focused")).toEqual(["lug_to_eng"]);
    expect(correctDirection("focused", "lug_to_eng")).toBe("lug_to_eng");
  });

  it("uses only the default female voice", () => {
    expect(correctVoice({ female: true }, "female")).toBe("female");
    expect(correctVoice({}, "female")).toBe("female");
    expect(isVoiceAvailable({ female: true }, "female")).toBe(true);
    expect(isVoiceAvailable({ female: false }, "female")).toBe(false);
  });

  it("has stable UI labels", () => {
    expect(modelModeLabel("focused")).toBe("Focused");
    expect(modelModeDescription("focused")).toMatch(/Luganda to English/);
    expect(directionLabel("lug_to_eng")).toBe("Luganda → English");
    expect(directionSourceLanguage("lug_to_eng")).toBe("Luganda");
    expect(directionTargetLanguage("lug_to_eng")).toBe("English");
    expect(voiceLabel("female")).toBe("Female voice");
  });

  it("reports missing voice provisioning", () => {
    expect(settingsValidationError(DEFAULT_SETTINGS, { female: true })).toBeNull();
    expect(settingsValidationError(DEFAULT_SETTINGS, { female: false })).toMatch(/female voice/);
  });
});
