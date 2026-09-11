export const TRANSLATION_PROGRESS_STAGES = [
  { id: "prepare", label: "Prepare audio" },
  { id: "upload", label: "Secure upload" },
  { id: "wake", label: "Wake model" },
  { id: "infer", label: "Translate speech" },
  { id: "playback", label: "Play English" },
] as const;

export type TranslationProgressStageId = (typeof TRANSLATION_PROGRESS_STAGES)[number]["id"];

export type TranslationProgressSnapshot = {
  activeStageId: TranslationProgressStageId;
  headline: string;
  detail: string;
  percent: number;
  coldStartLikely: boolean;
};

export function getTranslationProgressSnapshot(
  elapsedSeconds: number,
  isPreparingRecording: boolean,
): TranslationProgressSnapshot {
  const elapsed = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);

  if (isPreparingRecording) {
    return {
      activeStageId: "prepare",
      headline: "Preparing model-ready audio",
      detail: "Cleaning the recording and converting it to 16 kHz mono WAV.",
      percent: 12,
      coldStartLikely: false,
    };
  }

  if (elapsed < 3) {
    return {
      activeStageId: "upload",
      headline: "Sending audio securely",
      detail: "Uploading through the Vercel proxy while keeping the Modal key server-side.",
      percent: 24 + (elapsed / 3) * 16,
      coldStartLikely: false,
    };
  }

  if (elapsed < 8) {
    return {
      activeStageId: "wake",
      headline: "Starting translation",
      detail: "The request is with the translation service.",
      percent: 42 + ((elapsed - 3) / 5) * 12,
      coldStartLikely: false,
    };
  }

  if (elapsed < 45) {
    return {
      activeStageId: "wake",
      headline: "Warming the translation model",
      detail: "First request after idle can wake the Modal container and load Step-Audio2.",
      percent: 56 + ((elapsed - 8) / 37) * 22,
      coldStartLikely: true,
    };
  }

  return {
    activeStageId: "infer",
    headline: "Still working on the translation",
    detail: "Keep this tab open. Cold starts can take longer, then the result will play automatically.",
    percent: Math.min(94, 80 + Math.log10(elapsed - 43) * 7),
    coldStartLikely: true,
  };
}
