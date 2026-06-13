import { describe, expect, it } from "vitest";
import { resolveModalTranslateEndpoint } from "@/lib/modal-url";

describe("resolveModalTranslateEndpoint", () => {
  it("appends the translate path to a Modal base URL", () => {
    expect(resolveModalTranslateEndpoint("https://example.modal.run")).toBe(
      "https://example.modal.run/v1/translate",
    );
  });

  it("does not append the translate path when the env var is already the endpoint", () => {
    expect(resolveModalTranslateEndpoint("https://example.modal.run/v1/translate")).toBe(
      "https://example.modal.run/v1/translate",
    );
  });

  it("normalizes whitespace and trailing slashes", () => {
    expect(resolveModalTranslateEndpoint(" https://example.modal.run/v1/translate/ ")).toBe(
      "https://example.modal.run/v1/translate",
    );
  });

  it("normalizes other versioned translate endpoints to v1", () => {
    expect(resolveModalTranslateEndpoint("https://example.modal.run/v3/translate")).toBe(
      "https://example.modal.run/v1/translate",
    );
  });
});
