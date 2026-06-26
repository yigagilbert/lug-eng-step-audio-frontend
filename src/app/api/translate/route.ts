import { NextResponse } from "next/server";
import { resolveModalTranslateEndpoint } from "@/lib/modal-url";
import {
  DIRECTIONS,
  MODEL_MODES,
  VOICES,
  isValidCombo,
  type Direction,
  type ModelMode,
  type Voice,
} from "@/lib/translation-settings";
import type { ModalTranslateResponse } from "@/lib/types";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 120_000;

const ALLOWED_FIELDS = new Set([
  "return_audio",
  "return_text",
  "temperature",
  "top_p",
  "max_new_tokens",
  "repetition_penalty",
  "model_mode",
  "direction",
  "voice",
]);

const DEFAULT_FIELDS: Record<string, string> = {
  return_audio: "true",
  return_text:  "true",
  model_mode:   "focused",
  direction:    "lug_to_eng",
  voice:        "female",
};

type ErrorPayload = {
  error: string;
  details?: string;
  warnings?: string[];
};

type ResponseHeaders = Record<string, string>;

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function POST(request: Request) {
  const corsHeaders = getCorsHeaders(request);
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_AUDIO_BYTES + 64_000) {
    return jsonError(
      "Recording is too large. Please keep clips under 30 seconds.",
      413,
      undefined,
      corsHeaders,
    );
  }

  const modalTranslateUrl = resolveModalTranslateEndpoint(process.env.MODAL_TRANSLATE_URL);
  const modalApiKey = process.env.MODAL_API_KEY;

  if (!modalTranslateUrl || !modalApiKey) {
    return jsonError("Translation service is not configured.", 500, undefined, corsHeaders);
  }

  let incomingForm: FormData;
  try {
    incomingForm = await request.formData();
  } catch {
    return jsonError("Could not read the audio upload. Please try again.", 400, undefined, corsHeaders);
  }

  const audio = incomingForm.get("audio");
  if (!(audio instanceof File)) {
    return jsonError("Missing audio file in form field `audio`.", 400, undefined, corsHeaders);
  }

  if (audio.size <= 0) {
    return jsonError("Recording was empty. Please record again.", 400, undefined, corsHeaders);
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonError(
      "Recording is too large. Please keep clips under 30 seconds.",
      413,
      undefined,
      corsHeaders,
    );
  }

  if (!isAllowedAudioType(audio.type)) {
    return jsonError(
      "Unsupported audio format. Please use a modern browser recorder.",
      415,
      undefined,
      corsHeaders,
    );
  }

  // ── Defensive validation of model_mode/direction/voice ─────────────────────
  const modelMode = (getStringField(incomingForm, "model_mode") ?? DEFAULT_FIELDS.model_mode) as string;
  const direction = (getStringField(incomingForm, "direction") ?? DEFAULT_FIELDS.direction) as string;
  const voice     = (getStringField(incomingForm, "voice")     ?? DEFAULT_FIELDS.voice)     as string;

  if (!isMember<ModelMode>(modelMode, MODEL_MODES)) {
    return jsonError(
      `model_mode must be one of ${MODEL_MODES.join(", ")}.`,
      400, undefined, corsHeaders,
    );
  }
  if (!isMember<Direction>(direction, DIRECTIONS)) {
    return jsonError(
      `direction must be one of ${DIRECTIONS.join(", ")}.`,
      400, undefined, corsHeaders,
    );
  }
  if (!isMember<Voice>(voice, VOICES)) {
    return jsonError(
      `voice must be one of ${VOICES.join(", ")}.`,
      400, undefined, corsHeaders,
    );
  }
  if (!isValidCombo(modelMode, direction)) {
    return jsonError(
      `direction '${direction}' is not supported by model_mode '${modelMode}'.`,
      400, undefined, corsHeaders,
    );
  }

  // ── Build upstream form ────────────────────────────────────────────────────
  const upstreamForm = new FormData();
  upstreamForm.append("audio", audio, audio.name || "source-recording.webm");

  for (const [key, defaultValue] of Object.entries(DEFAULT_FIELDS)) {
    upstreamForm.set(key, getStringField(incomingForm, key) ?? defaultValue);
  }

  for (const key of ALLOWED_FIELDS) {
    if (key in DEFAULT_FIELDS) {
      continue;
    }
    const value = getStringField(incomingForm, key);
    if (value !== undefined) {
      upstreamForm.set(key, value);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(modalTranslateUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${modalApiKey}`,
      },
      body: upstreamForm,
      signal: controller.signal,
      cache: "no-store",
    });

    const responseBody = await readResponseBody(upstreamResponse);

    if (!upstreamResponse.ok) {
      const upstreamMessage = getUpstreamMessage(responseBody);
      if (isModalInvalidFunctionCall(upstreamMessage)) {
        return jsonError(
          "Configured Modal URL is not the Step-Audio2 FastAPI endpoint.",
          502,
          "MODAL_TRANSLATE_URL is reaching Modal but not the deployed ASGI app. " +
            "Expected pattern: https://<workspace>--stepaudio2-luganda-s2st-stepaudio2server-serve.modal.run " +
            "(after `modal deploy`; drop the `-dev` suffix that `modal run` adds). " +
            "Look up the current URL with `modal app list` or the last `modal deploy` output, " +
            "then verify with: curl -H \"Authorization: Bearer $MODAL_API_KEY\" $MODAL_TRANSLATE_URL/health",
          corsHeaders,
        );
      }

      return jsonError(
        "Translation service returned an error.",
        normalizeStatus(upstreamResponse.status),
        upstreamMessage,
        corsHeaders,
      );
    }

    return NextResponse.json(responseBody as ModalTranslateResponse, {
      headers: {
        "Cache-Control": "no-store",
        ...corsHeaders,
      },
    });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "Translation timed out. Please try a shorter recording."
        : "Could not reach the translation service. Please try again.";
    return jsonError(message, 504, undefined, corsHeaders);
  } finally {
    clearTimeout(timeout);
  }
}

function getStringField(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isMember<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

function isAllowedAudioType(type: string) {
  if (!type) {
    return true;
  }
  return (
    type.startsWith("audio/") ||
    type === "video/webm" ||
    type === "application/octet-stream"
  );
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 300) };
  }
}

function getUpstreamMessage(body: unknown) {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  const candidate = record.error ?? record.detail ?? record.message;
  return typeof candidate === "string" ? candidate : undefined;
}

function isModalInvalidFunctionCall(message: string | undefined) {
  return message?.toLowerCase().includes("modal-http: invalid function call") ?? false;
}

function normalizeStatus(status: number) {
  if (status >= 400 && status <= 599) {
    return status;
  }
  return 502;
}

function getCorsHeaders(request: Request): ResponseHeaders {
  const origin = request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();

  if (!origin || !allowedOrigins.has(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function getAllowedOrigins() {
  return new Set(
    (process.env.TRANSLATE_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );
}

function jsonError(
  error: string,
  status: number,
  details?: string,
  extraHeaders: ResponseHeaders = {},
) {
  const payload: ErrorPayload = details ? { error, details } : { error };
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}
