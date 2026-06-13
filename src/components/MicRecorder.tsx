"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { formatDuration } from "@/lib/format";
import type { TranslatorState } from "@/lib/types";

type MicRecorderProps = {
  disabled: boolean;
  maxDurationSeconds?: number;
  onRecordingComplete: (audio: Blob) => void;
  onError: (message: string) => void;
  onStatusChange: (state: TranslatorState) => void;
};

const MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/wav",
];

export function MicRecorder({
  disabled,
  maxDurationSeconds = 30,
  onRecordingComplete,
  onError,
  onStatusChange,
}: MicRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);
  const maxTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopTimers();
      cleanupStream();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    };
  }, []);

  const handleClick = async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    if (disabled) {
      return;
    }

    await startRecording();
  };

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError("This browser does not support microphone recording.");
      onStatusChange("error");
      return;
    }

    onStatusChange("requesting-permission");
    setDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const audioBlob = new Blob(chunksRef.current, { type });
        cleanupStream();
        stopTimers();
        setIsRecording(false);
        setDuration(0);

        if (audioBlob.size < 512) {
          onError("Recording was too short. Please try speaking for at least one second.");
          onStatusChange("error");
          return;
        }

        onRecordingComplete(audioBlob);
      });

      recorder.addEventListener("error", () => {
        cleanupStream();
        stopTimers();
        setIsRecording(false);
        onError("Recording failed. Please check microphone access and try again.");
        onStatusChange("error");
      });

      startedAtRef.current = Date.now();
      recorder.start(250);
      setIsRecording(true);
      onStatusChange("recording");

      intervalRef.current = window.setInterval(() => {
        setDuration((Date.now() - startedAtRef.current) / 1000);
      }, 250);

      maxTimeoutRef.current = window.setTimeout(() => {
        stopRecording();
      }, maxDurationSeconds * 1000);
    } catch (error) {
      cleanupStream();
      stopTimers();
      setIsRecording(false);
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      onError(
        denied
          ? "Microphone permission was denied. Enable microphone access in your browser settings."
          : "Could not start the microphone. Please check your input device.",
      );
      onStatusChange("error");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function stopTimers() {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (maxTimeoutRef.current !== null) {
      window.clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
  }

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  const label = isRecording
    ? "Stop recording"
    : disabled
      ? "Recording unavailable while translation is in progress"
      : "Start recording";

  return (
    <div className="recorderBlock">
      <button
        className={isRecording ? "micButton recording" : "micButton"}
        type="button"
        aria-label={label}
        aria-pressed={isRecording}
        disabled={disabled && !isRecording}
        onClick={handleClick}
      >
        {disabled && !isRecording ? (
          <Loader2 aria-hidden="true" className="spin" size={38} strokeWidth={1.8} />
        ) : isRecording ? (
          <Square aria-hidden="true" size={34} fill="currentColor" strokeWidth={1.8} />
        ) : (
          <Mic aria-hidden="true" size={42} strokeWidth={1.7} />
        )}
      </button>

      <div className="recorderMeta" aria-live="polite">
        {isRecording ? (
          <>
            <span className="recordingDot" aria-hidden="true" />
            Recording {formatDuration(duration)} / {formatDuration(maxDurationSeconds)}
          </>
        ) : (
          "Press the microphone to record Luganda speech"
        )}
      </div>
    </div>
  );
}

function getSupportedMimeType() {
  return MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}
