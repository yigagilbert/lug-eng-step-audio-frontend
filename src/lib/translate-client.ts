import { getRecordingExtension } from "@/lib/audio";
import { withBasePath } from "@/lib/public-path";
import type { ApiErrorResponse, ModalTranslateResponse } from "@/lib/types";

const DEFAULT_TRANSLATE_API_PATH = "/api/translate";
const configuredTranslateApiUrl = process.env.NEXT_PUBLIC_TRANSLATE_API_URL?.trim();
const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

export async function translateRecording(audio: Blob, filename?: string) {
  const formData = new FormData();
  const extension = getRecordingExtension(audio.type);

  formData.append("audio", audio, filename ?? `luganda-recording.${extension}`);
  formData.append("return_audio", "true");
  formData.append("return_text", "true");
  formData.append("voice_preset", "default_female");

  const response = await fetch(getTranslateApiUrl(), {
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

function getTranslateApiUrl() {
  if (isStaticExport && !configuredTranslateApiUrl) {
    throw new Error(
      "Translation API is not configured for this GitHub Pages deployment. Set NEXT_PUBLIC_TRANSLATE_API_URL to a hosted /api/translate proxy.",
    );
  }

  return configuredTranslateApiUrl || withBasePath(DEFAULT_TRANSLATE_API_PATH);
}
