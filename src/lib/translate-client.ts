import { getRecordingExtension } from "@/lib/audio";
import type { ApiErrorResponse, ModalTranslateResponse } from "@/lib/types";

export async function translateRecording(audio: Blob, filename?: string) {
  const formData = new FormData();
  const extension = getRecordingExtension(audio.type);

  formData.append("audio", audio, filename ?? `luganda-recording.${extension}`);
  formData.append("return_audio", "true");
  formData.append("return_text", "true");
  formData.append("voice_preset", "default_female");

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
