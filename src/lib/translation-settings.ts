/**
 * Translation-settings registry shared between the React UI and the
 * Next.js API route. Mirrors the backend `stepaudio_registry.py`.
 */

export const MODEL_MODES = ["focused", "bidirectional"] as const;
export const DIRECTIONS  = ["lug_to_eng", "eng_to_lug"] as const;
export const VOICES      = ["female", "male"] as const;

export type ModelMode = (typeof MODEL_MODES)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type Voice     = (typeof VOICES)[number];

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
  "bidirectional|lug_to_eng",
  "bidirectional|eng_to_lug",
]);

export function isValidCombo(modelMode: ModelMode, direction: Direction) {
  return ALLOWED_COMBOS.has(`${modelMode}|${direction}`);
}

export function supportedDirections(modelMode: ModelMode): Direction[] {
  return DIRECTIONS.filter((direction) => isValidCombo(modelMode, direction));
}

export function isVoiceAvailable(availability: VoiceAvailability, voice: Voice) {
  return availability[voice] === true;
}

/**
 * When the user switches model_mode, correct an unsupported direction.
 * E.g. switching from `bidirectional` (with eng_to_lug selected) to `focused`
 * → coerce direction back to `lug_to_eng`.
 */
export function correctDirection(modelMode: ModelMode, direction: Direction): Direction {
  if (isValidCombo(modelMode, direction)) {
    return direction;
  }
  const fallback = supportedDirections(modelMode)[0];
  return fallback ?? "lug_to_eng";
}

/**
 * When voice availability changes (e.g. /health reports male unprovisioned),
 * coerce voice to an available one if the current pick is not available.
 */
export function correctVoice(availability: VoiceAvailability, voice: Voice): Voice {
  if (isVoiceAvailable(availability, voice)) {
    return voice;
  }
  const fallback = VOICES.find((option) => isVoiceAvailable(availability, option));
  return fallback ?? "female";
}

export function modelModeLabel(modelMode: ModelMode) {
  return modelMode === "focused" ? "Focused" : "Bidirectional";
}

export function modelModeDescription(modelMode: ModelMode) {
  return modelMode === "focused"
    ? "Best Luganda → English quality. Single direction only."
    : "Both directions. Adds English → Luganda; Luganda → English quality is lower than Focused.";
}

export function directionLabel(direction: Direction) {
  return direction === "lug_to_eng" ? "Luganda → English" : "English → Luganda";
}

export function directionSourceLanguage(direction: Direction) {
  return direction === "lug_to_eng" ? "Luganda" : "English";
}

export function directionTargetLanguage(direction: Direction) {
  return direction === "lug_to_eng" ? "English" : "Luganda";
}

export function voiceLabel(voice: Voice) {
  return voice === "female" ? "Female voice" : "Male voice";
}

export function settingsValidationError(
  settings: TranslationSettings,
  availability: VoiceAvailability,
): string | null {
  if (!isValidCombo(settings.modelMode, settings.direction)) {
    return `${directionLabel(settings.direction)} is not supported by the ${modelModeLabel(
      settings.modelMode,
    )} model.`;
  }
  if (!isVoiceAvailable(availability, settings.voice)) {
    return `${voiceLabel(settings.voice)} is not provisioned on this deployment yet.`;
  }
  return null;
}
