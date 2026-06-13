export type TranslationTimingKey =
  | "load"
  | "preprocess"
  | "generate"
  | "generate_text_fallback"
  | "token2wav"
  | "total";

export type TranslationTimings = Partial<Record<TranslationTimingKey, number>> &
  Record<string, number | undefined>;

export type ModalTranslateResponse = {
  id: string;
  text: string | null;
  text_length?: number;
  audio_base64?: string | null;
  sample_rate?: number;
  input_audio_duration_seconds?: number;
  audio_duration_seconds?: number;
  audio_tokens_count?: number;
  timings?: TranslationTimings;
  warnings?: string[];
};

export type ApiErrorResponse = {
  error: string;
  details?: string;
  warnings?: string[];
};

export type TranslatorState =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "translating"
  | "playing"
  | "error";
