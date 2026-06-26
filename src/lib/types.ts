import type { Direction, ModelMode, Voice, VoiceAvailability } from "@/lib/translation-settings";

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
  // Echoed-back selections so the UI can verify it received what it asked for.
  model_mode?: ModelMode;
  direction?: Direction;
  voice?: Voice;
};

export type ApiErrorResponse = {
  error: string;
  details?: string;
  warnings?: string[];
  // Present on 400 from the Modal /v1/translate route.
  model_mode?: ModelMode;
  direction?: Direction;
  voice?: Voice;
  available?: {
    voices?: VoiceAvailability;
    adapters?: string[];
  };
};

export type ModalHealthResponse = {
  status: "ok" | "booting";
  vllm_ready: boolean;
  model: string;
  adapters: string[];
  voices: VoiceAvailability;
};

export type TranslatorState =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "translating"
  | "playing"
  | "error";
