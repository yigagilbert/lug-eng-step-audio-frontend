"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Volume2, X } from "lucide-react";
import { AvatarSpeaker } from "@/components/AvatarSpeaker";
import { CaptionDisplay } from "@/components/CaptionDisplay";
import { DirectionNotice } from "@/components/DirectionNotice";
import { MicRecorder } from "@/components/MicRecorder";
import { SamplePicker } from "@/components/SamplePicker";
import { TranslationProgress } from "@/components/TranslationProgress";
import { createAudioObjectUrl, normalizeRecordingToWav } from "@/lib/audio";
import { formatDuration, formatTiming } from "@/lib/format";
import type { AudioSample } from "@/lib/samples";
import { fetchHealth, translateRecording } from "@/lib/translate-client";
import {
  DEFAULT_SETTINGS,
  directionSourceLanguage,
  directionTargetLanguage,
} from "@/lib/translation-settings";
import type {
  ModalHealthResponse,
  ModalTranslateResponse,
  ServiceReadiness,
  TranslationTimings,
  TranslatorState,
} from "@/lib/types";

const EMPTY_TIMINGS: TranslationTimings = {};
const HEALTH_WARMING_THRESHOLD_MS = 4_000;

type TranslationRunOptions = {
  normalizeRecording?: boolean;
};

type RecordingReview = {
  url: string;
  details: string;
  warning?: string;
};

type RecordingReviewSource = Omit<RecordingReview, "url"> & {
  blob: Blob;
};

export function VoiceTranslator() {
  const [state, setState] = useState<TranslatorState>("idle");
  const [error, setError] = useState("");
  const [translation, setTranslation] = useState<ModalTranslateResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingReview, setRecordingReview] = useState<RecordingReview | null>(null);
  const [isPreparingRecording, setIsPreparingRecording] = useState(false);
  const [serviceReadiness, setServiceReadiness] = useState<ServiceReadiness>("checking");
  const [translationElapsedSeconds, setTranslationElapsedSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [knownAudioDuration, setKnownAudioDuration] = useState(0);
  const [playbackCycle, setPlaybackCycle] = useState(0);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const settings = DEFAULT_SETTINGS;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceAudioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const recordingReviewUrlRef = useRef<string | null>(null);
  const fallbackAudioDurationRef = useRef(0);
  const translationStartedAtRef = useRef<number | null>(null);

  const translatedText = translation?.text?.trim() ?? "";
  const timings = translation?.timings ?? EMPTY_TIMINGS;
  const warnings = translation?.warnings ?? [];
  const effectiveAudioDuration =
    knownAudioDuration || translation?.audio_duration_seconds || 0;
  const hasPlayableAudio = Boolean(audioUrl);
  const isBusy =
    state === "requesting-permission" || state === "recording" || state === "translating";

  const sourceLanguage = directionSourceLanguage(settings.direction);
  const targetLanguage = directionTargetLanguage(settings.direction);

  const statusText = useMemo(() => {
    switch (state) {
      case "requesting-permission":
        return "Waiting for microphone permission...";
      case "recording":
        return "Listening. Press again to stop.";
      case "translating":
        if (isPreparingRecording) {
          return "Preparing a clean 16 kHz recording for the model...";
        }
        if (translationElapsedSeconds >= 45) {
          return "Still working. Keep this tab open while the model finishes.";
        }
        if (translationElapsedSeconds >= 8) {
          return "The translation service may be waking from idle.";
        }
        return "Uploading and starting translation...";
      case "playing":
        return `Playing ${targetLanguage} translation.`;
      case "error":
        return error || "Something went wrong.";
      default:
        if (translatedText) {
          return hasPlayableAudio
            ? "Translation ready."
            : "Translation text ready. No audio was returned.";
        }
        return "Ready when you are.";
    }
  }, [
    error,
    hasPlayableAudio,
    isPreparingRecording,
    state,
    targetLanguage,
    translatedText,
    translationElapsedSeconds,
  ]);

  useEffect(() => {
    let isActive = true;
    const warmingTimer = window.setTimeout(() => {
      if (isActive) {
        setServiceReadiness("warming");
      }
    }, HEALTH_WARMING_THRESHOLD_MS);

    void fetchHealth().then((health) => {
      if (!isActive) {
        return;
      }

      window.clearTimeout(warmingTimer);
      setServiceReadiness(getReadinessFromHealth(health));
    });

    return () => {
      isActive = false;
      window.clearTimeout(warmingTimer);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      if (recordingReviewUrlRef.current) {
        URL.revokeObjectURL(recordingReviewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fallbackAudioDurationRef.current = translation?.audio_duration_seconds ?? 0;
  }, [translation?.audio_duration_seconds]);

  useEffect(() => {
    if (state !== "translating" || translationStartedAtRef.current === null) {
      return;
    }

    const updateElapsed = () => {
      const startedAt = translationStartedAtRef.current;
      if (startedAt !== null) {
        setTranslationElapsedSeconds((Date.now() - startedAt) / 1000);
      }
    };

    updateElapsed();
    const interval = window.setInterval(updateElapsed, 500);
    return () => window.clearInterval(interval);
  }, [state]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) {
      return;
    }

    const handlePlay = () => {
      setIsPlaying(true);
      setState("playing");
      setPlaybackCycle((cycle) => cycle + 1);
    };
    const handlePause = () => {
      if (!audio.ended) {
        setIsPlaying(false);
      }
    };
    const handleEnded = () => {
      const finalDuration = Number.isFinite(audio.duration)
        ? audio.duration
        : fallbackAudioDurationRef.current;
      setPlaybackTime(finalDuration);
      setIsPlaying(false);
      setState("idle");
    };
    const handleError = () => {
      setIsPlaying(false);
      setState("error");
      setError("The translated audio could not be played, but the caption is available.");
    };
    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setKnownAudioDuration(audio.duration);
      }
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.src = audioUrl;
    audio.currentTime = 0;
    setPlaybackTime(0);

    void audio.play().catch(() => {
      setIsPlaying(false);
      setState("error");
      setError("Translation is ready, but autoplay was blocked. Press replay to hear it.");
    });

    return () => {
      audio.pause();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        setPlaybackTime(audio.currentTime);
        if (Number.isFinite(audio.duration)) {
          setKnownAudioDuration(audio.duration);
        }
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [isPlaying, playbackCycle]);

  async function runTranslation(
    audio: Blob,
    filename?: string,
    options: TranslationRunOptions = {},
  ) {
    audioRef.current?.pause();
    setState("translating");
    setError("");
    setTranslation(null);
    setPlaybackTime(0);
    setKnownAudioDuration(0);
    replaceAudioUrl(null);
    translationStartedAtRef.current = Date.now();
    setTranslationElapsedSeconds(0);
    setIsPreparingRecording(Boolean(options.normalizeRecording));
    if (serviceReadiness !== "ready") {
      setServiceReadiness("warming");
    }

    let uploadAudio = audio;
    let uploadFilename = filename;

    if (!options.normalizeRecording) {
      replaceRecordingReview(null);
    }

    try {
      if (options.normalizeRecording) {
        try {
          const normalizedRecording = await normalizeRecordingToWav(audio);
          uploadAudio = normalizedRecording.blob;
          uploadFilename = "source-recording-16khz.wav";
          replaceRecordingReview({
            blob: normalizedRecording.blob,
            details:
              `Sent ${formatDuration(normalizedRecording.durationSeconds)} as ` +
              `${normalizedRecording.sampleRate / 1000} kHz mono WAV ` +
              `(${formatBytes(normalizedRecording.blob.size)}), captured from ` +
              `${formatMimeType(normalizedRecording.sourceMimeType)}.`,
          });
        } catch {
          replaceRecordingReview({
            blob: audio,
            details:
              `Sent original ${formatMimeType(audio.type || "browser audio")} recording ` +
              `(${formatBytes(audio.size)}).`,
            warning:
              "Browser-side audio cleanup was unavailable, so the original recording was sent.",
          });
        } finally {
          setIsPreparingRecording(false);
        }
      }

      const response = await translateRecording(uploadAudio, settings, uploadFilename);
      setServiceReadiness("ready");
      setTranslation(response);

      if (response.audio_base64) {
        stopSourcePreview();
        replaceAudioUrl(createAudioObjectUrl(response.audio_base64, response.sample_rate));
      } else {
        setState("idle");
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Translation failed. Please try again.";
      setIsPreparingRecording(false);
      stopSourcePreview();
      if (isConfigurationError(message)) {
        setServiceReadiness("unavailable");
      }
      setState("error");
      setError(message);
    }
  }

  function handleRecordingComplete(audio: Blob) {
    setActiveSampleId(null);
    void runTranslation(audio, undefined, { normalizeRecording: true });
  }

  async function handleSampleSelect(sample: AudioSample) {
    if (isBusy) {
      return;
    }

    setActiveSampleId(sample.id);

    let blob: Blob;
    try {
      const response = await fetch(sample.src);
      if (!response.ok) {
        throw new Error(`Sample request failed (${response.status}).`);
      }
      blob = await response.blob();
    } catch {
      setActiveSampleId(null);
      setState("error");
      setError("Could not load the sample clip. Please try again.");
      return;
    }

    startSourcePreview(sample.src);
    await runTranslation(blob, sample.filename);
  }

  function startSourcePreview(src: string) {
    const audio = sourceAudioRef.current;
    if (!audio) {
      return;
    }
    audio.src = src;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Source preview is best-effort; ignore autoplay rejections.
    });
  }

  function stopSourcePreview() {
    const audio = sourceAudioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
    }
  }

  function replaceAudioUrl(nextUrl: string | null) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    objectUrlRef.current = nextUrl;
    setAudioUrl(nextUrl);
  }

  function replaceRecordingReview(nextRecording: RecordingReviewSource | null) {
    if (recordingReviewUrlRef.current) {
      URL.revokeObjectURL(recordingReviewUrlRef.current);
      recordingReviewUrlRef.current = null;
    }

    if (!nextRecording) {
      setRecordingReview(null);
      return;
    }

    const url = URL.createObjectURL(nextRecording.blob);
    recordingReviewUrlRef.current = url;
    setRecordingReview({
      url,
      details: nextRecording.details,
      warning: nextRecording.warning,
    });
  }

  async function handleReplay() {
    const audio = audioRef.current;
    if (!audio || !audioUrl) {
      return;
    }

    setError("");
    setPlaybackTime(0);
    audio.currentTime = 0;
    try {
      await audio.play();
    } catch {
      setState("error");
      setError("The browser blocked playback. Try pressing replay again.");
    }
  }

  function handleReset() {
    audioRef.current?.pause();
    stopSourcePreview();
    replaceAudioUrl(null);
    replaceRecordingReview(null);
    setTranslation(null);
    setPlaybackTime(0);
    setKnownAudioDuration(0);
    setTranslationElapsedSeconds(0);
    setIsPlaying(false);
    setIsPreparingRecording(false);
    translationStartedAtRef.current = null;
    setActiveSampleId(null);
    setState("idle");
    setError("");
  }

  function handleRecorderError(message: string) {
    setError(message);
    setState("error");
  }

  return (
    <section className="translatorSurface" aria-label="Voice translation workspace">
      <audio ref={audioRef} preload="auto" />
      <audio ref={sourceAudioRef} preload="none" />

      <div className="translatorTopline">
        <div>
          <p className="eyebrow">Live Session</p>
          <h2>{sourceLanguage} speech to {targetLanguage}</h2>
        </div>
        <span className={`statePill state-${state}`}>{stateLabel(state)}</span>
      </div>

      <DirectionNotice
        readiness={serviceReadiness}
        sourceLanguage={sourceLanguage}
        targetLanguage={targetLanguage}
      />

      <AvatarSpeaker speaking={isPlaying} />

      <CaptionDisplay
        currentTime={playbackTime}
        duration={effectiveAudioDuration}
        progressive={Boolean(audioUrl)}
        text={translatedText}
      />

      {state === "translating" ? (
        <TranslationProgress
          elapsedSeconds={translationElapsedSeconds}
          isPreparingRecording={isPreparingRecording}
        />
      ) : null}

      <MicRecorder
        disabled={
          state === "requesting-permission" || state === "translating" || state === "playing"
        }
        onError={handleRecorderError}
        onRecordingComplete={handleRecordingComplete}
        onStatusChange={setState}
      />

      {recordingReview ? (
        <details className="recordingReview">
          <summary>Review recorded audio sent to translation</summary>
          <div className="recordingReviewBody">
            <audio
              aria-label="Recorded audio sent to translation"
              controls
              preload="metadata"
              src={recordingReview.url}
            />
            <p>{recordingReview.details}</p>
            {recordingReview.warning ? (
              <p className="recordingReviewWarning">{recordingReview.warning}</p>
            ) : null}
          </div>
        </details>
      ) : null}

      <SamplePicker
        activeSampleId={activeSampleId}
        disabled={isBusy}
        onSelect={handleSampleSelect}
      />

      <div className="statusLine" role={state === "error" ? "alert" : "status"}>
        {statusText}
      </div>

      <div className="controlRow" aria-label="Playback and session controls">
        <button
          className="iconButton"
          type="button"
          aria-label="Replay translated speech"
          disabled={!hasPlayableAudio || isBusy}
          onClick={handleReplay}
        >
          <Volume2 aria-hidden="true" size={20} />
        </button>
        <button
          className="iconButton"
          type="button"
          aria-label="Reset session"
          disabled={!translation && !error && !audioUrl && !recordingReview}
          onClick={handleReset}
        >
          <RotateCcw aria-hidden="true" size={19} />
        </button>
        {state === "error" ? (
          <button className="textButton" type="button" onClick={handleReset}>
            <X aria-hidden="true" size={17} />
            Clear
          </button>
        ) : null}
      </div>

      {warnings.length > 0 ? (
        <div className="diagnostics" role="status">
          <strong>Diagnostics</strong>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {translation ? (
        <details className="detailsPanel">
          <summary>Latency and response details</summary>
          <dl>
            <div>
              <dt>Request ID</dt>
              <dd>{translation.id || "n/a"}</dd>
            </div>
            <div>
              <dt>Model / direction / voice</dt>
              <dd>
                {translation.model_mode ?? settings.modelMode} /{" "}
                {translation.direction ?? settings.direction} /{" "}
                {translation.voice ?? settings.voice}
              </dd>
            </div>
            <div>
              <dt>Input duration</dt>
              <dd>{formatDuration(translation.input_audio_duration_seconds ?? 0)}</dd>
            </div>
            <div>
              <dt>Speech duration</dt>
              <dd>{formatDuration(effectiveAudioDuration)}</dd>
            </div>
            <div>
              <dt>Total latency</dt>
              <dd>{formatTiming(timings.total)}</dd>
            </div>
            <div>
              <dt>Generate</dt>
              <dd>{formatTiming(timings.generate)}</dd>
            </div>
            <div>
              <dt>Token to WAV</dt>
              <dd>{formatTiming(timings.token2wav)}</dd>
            </div>
          </dl>
        </details>
      ) : null}
    </section>
  );
}

function stateLabel(state: TranslatorState) {
  switch (state) {
    case "requesting-permission":
      return "Permission";
    case "recording":
      return "Recording";
    case "translating":
      return "Translating";
    case "playing":
      return "Playing";
    case "error":
      return "Needs attention";
    default:
      return "Idle";
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatMimeType(mimeType: string) {
  if (!mimeType || mimeType === "unknown") {
    return "browser audio";
  }

  return mimeType.split(";")[0];
}

function getReadinessFromHealth(health: ModalHealthResponse | null): ServiceReadiness {
  if (!health) {
    return "unavailable";
  }

  if (health.status === "booting") {
    return "warming";
  }

  if (health.ok === true || health.model_loaded === true || health.vllm_ready === true) {
    return "ready";
  }

  return health.status === "error" ? "unavailable" : "warming";
}

function isConfigurationError(message: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("not configured") ||
    normalizedMessage.includes("not the step-audio2") ||
    normalizedMessage.includes("authorization") ||
    normalizedMessage.includes("api key")
  );
}
