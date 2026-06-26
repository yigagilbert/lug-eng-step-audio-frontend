import { getRecordingExtension } from "@/lib/audio";
import type { TranslationSettings } from "@/lib/translation-settings";
import type {
  ApiErrorResponse,
  ModalHealthResponse,
  ModalTranslateResponse,
} from "@/lib/types";

export async function translateRecording(
  audio: Blob,
  settings: TranslationSettings,
  filename?: string,
) {
  const formData = new FormData();
  const extension = getRecordingExtension(audio.type);

  formData.append("audio", audio, filename ?? `source-recording.${extension}`);
  formData.append("return_audio", "true");
  formData.append("return_text", "true");
  formData.append("model_mode", settings.modelMode);
  formData.append("direction",  settings.direction);
  formData.append("voice",      settings.voice);

  const response = await fetch("/api/translate", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json().catch(() => ({}))) as
    | ModalTranslateResponse
    | ApiErrorResponse;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse;
    throw new Error(
      [errorPayload.error || "Translation failed.", errorPayload.details]
        .filter(Boolean)
        .join(" "),
    );
  }

  return payload as ModalTranslateResponse;
}

export async function fetchHealth(): Promise<ModalHealthResponse | null> {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as ModalHealthResponse;
  } catch {
    return null;
  }
}
