const TRANSLATE_PATH = "/v1/translate";
const VERSIONED_TRANSLATE_PATH_PATTERN = /\/v\d+\/translate$/;

export function resolveModalTranslateEndpoint(rawUrl: string | undefined) {
  const baseUrl = rawUrl?.trim().replace(/\/+$/, "");

  if (!baseUrl) {
    return "";
  }

  if (baseUrl.endsWith(TRANSLATE_PATH)) {
    return baseUrl;
  }

  if (VERSIONED_TRANSLATE_PATH_PATTERN.test(baseUrl)) {
    return baseUrl.replace(VERSIONED_TRANSLATE_PATH_PATTERN, TRANSLATE_PATH);
  }

  return `${baseUrl}${TRANSLATE_PATH}`;
}
