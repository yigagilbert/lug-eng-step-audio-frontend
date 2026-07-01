/**
 * Translation-settings registry shared between the React UI and the
 * Next.js API route. This rollback deployment is intentionally focused only.
 */

export const MODEL_MODES = ["focused"] as const;
export const DIRECTIONS = ["lug_to_eng"] as const;
export const VOICES = ["female"] as const;

export type ModelMode = (typeof MODEL_MODES)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type Voice = (typeof VOICES)[number];

export type TranslationSettings = {
  modelMode: ModelMode;
  direction: Direction;
  voice: Voice;
};

export type VoiceAvailability = Partial<Record<Voice, boolean>>;

export const DEFAULT_SETTINGS: TranslationSettings = {
  modelMode: "focused",
  direction: "lug_to_eng",
  voice: "female",
};

const ALLOWED_COMBOS: ReadonlySet<`${ModelMode}|${Direction}`> = new Set([
  "focused|lug_to_eng",
]);

export function isValidCombo(modelMode: ModelMode, direction: Direction) {
  return ALLOWED_COMBOS.has(`${modelMode}|${direction}`);
}

export function supportedDirections(modelMode: ModelMode): Direction[] {
  void modelMode;
  return ["lug_to_eng"];
}

export function isVoiceAvailable(availability: VoiceAvailability, voice: Voice) {
  return availability[voice] === true;
}

export function correctDirection(modelMode: ModelMode, direction: Direction): Direction {
  void modelMode;
  void direction;
  return "lug_to_eng";
}

export function correctVoice(availability: VoiceAvailability, voice: Voice): Voice {
  void availability;
  void voice;
  return "female";
}

export function modelModeLabel(modelMode: ModelMode) {
  void modelMode;
  return "Focused";
}

export function modelModeDescription(modelMode: ModelMode) {
  void modelMode;
  return "Stable Luganda to English speech translation.";
}

export function directionLabel(direction: Direction) {
  void direction;
  return "Luganda → English";
}

export function directionSourceLanguage(direction: Direction) {
  void direction;
  return "Luganda";
}

export function directionTargetLanguage(direction: Direction) {
  void direction;
  return "English";
}

export function voiceLabel(voice: Voice) {
  void voice;
  return "Female voice";
}

export function settingsValidationError(
  settings: TranslationSettings,
  availability: VoiceAvailability,
): string | null {
  if (!isValidCombo(settings.modelMode, settings.direction)) {
    return "This deployment only supports Luganda to English with the focused model.";
  }
  if (!isVoiceAvailable(availability, settings.voice)) {
    return "The default female voice is not provisioned on this deployment yet.";
  }
  return null;
}
