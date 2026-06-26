import { NextResponse } from "next/server";
import { resolveModalTranslateEndpoint } from "@/lib/modal-url";

export const runtime = "nodejs";

const HEALTH_TIMEOUT_MS = 10_000;

export async function GET() {
  const modalTranslateUrl = resolveModalTranslateEndpoint(process.env.MODAL_TRANSLATE_URL);
  const modalApiKey = process.env.MODAL_API_KEY;

  if (!modalTranslateUrl || !modalApiKey) {
    return NextResponse.json(
      { status: "error", error: "Translation service is not configured." },
      { status: 500 },
    );
  }

  const healthUrl = modalTranslateUrl.replace(/\/v\d+\/translate$/, "/health");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const upstream = await fetch(healthUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${modalApiKey}` },
      signal: controller.signal,
      cache: "no-store",
    });

    const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(body, {
      status: upstream.ok ? 200 : upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { status: "error", vllm_ready: false },
      { status: 504 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
