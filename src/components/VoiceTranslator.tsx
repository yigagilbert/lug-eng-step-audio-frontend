"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Volume2, X } from "lucide-react";
import { AvatarSpeaker } from "@/components/AvatarSpeaker";
import { CaptionDisplay } from "@/components/CaptionDisplay";
import { MicRecorder } from "@/components/MicRecorder";
import { SamplePicker } from "@/components/SamplePicker";
import { createAudioObjectUrl } from "@/lib/audio";
import { formatDuration, formatTiming } from "@/lib/format";
import type { AudioSample } from "@/lib/samples";
import { translateRecording } from "@/lib/translate-client";
import {
  DEFAULT_SETTINGS,
  directionSourceLanguage,
  directionTargetLanguage,
} from "@/lib/translation-settings";
import type { ModalTranslateResponse, TranslationTimings, TranslatorState } from "@/lib/types";

const EMPTY_TIMINGS: TranslationTimings = {};
export function VoiceTranslator() {
  const [state, setState] = useState<TranslatorState>("idle");
  const [error, setError] = useState("");
  const [translation, setTranslation] = useState<ModalTranslateResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [knownAudioDuration, setKnownAudioDuration] = useState(0);
  const [playbackCycle, setPlaybackCycle] = useState(0);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const settings = DEFAULT_SETTINGS;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceAudioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fallbackAudioDurationRef = useRef(0);

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
        return "Uploading and translating...";
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
  }, [error, hasPlayableAudio, state, targetLanguage, translatedText]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fallbackAudioDurationRef.current = translation?.audio_duration_seconds ?? 0;
  }, [translation?.audio_duration_seconds]);

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

  async function runTranslation(audio: Blob, filename?: string) {
    audioRef.current?.pause();
    setState("translating");
    setError("");
    setTranslation(null);
    setPlaybackTime(0);
    setKnownAudioDuration(0);
    replaceAudioUrl(null);

    try {
      const response = await translateRecording(audio, settings, filename);
      setTranslation(response);

      if (response.audio_base64) {
        stopSourcePreview();
        replaceAudioUrl(createAudioObjectUrl(response.audio_base64, response.sample_rate));
      } else {
        setState("idle");
      }
    } catch (caughtError) {
      stopSourcePreview();
      setState("error");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Translation failed. Please try again.",
      );
    }
  }

  function handleRecordingComplete(audio: Blob) {
    setActiveSampleId(null);
    void runTranslation(audio);
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
    setTranslation(null);
    setPlaybackTime(0);
    setKnownAudioDuration(0);
    setIsPlaying(false);
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
          <h2>Speak {sourceLanguage}, hear {targetLanguage}</h2>
        </div>
        <span className={`statePill state-${state}`}>{stateLabel(state)}</span>
      </div>

      <p className="modeSummary">Focused Luganda to English model · default female voice</p>

      <AvatarSpeaker speaking={isPlaying} />

      <CaptionDisplay
        currentTime={playbackTime}
        duration={effectiveAudioDuration}
        progressive={Boolean(audioUrl)}
        text={translatedText}
      />

      <MicRecorder
        disabled={
          state === "requesting-permission" || state === "translating" || state === "playing"
        }
        onError={handleRecorderError}
        onRecordingComplete={handleRecordingComplete}
        onStatusChange={setState}
      />

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
          disabled={!translation && !error && !audioUrl}
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
