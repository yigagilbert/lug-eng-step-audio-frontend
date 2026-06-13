const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

export function normalizeBasePath(value: string | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, "") ?? "";

  if (!trimmed || trimmed === "/") {
    return "";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function withBasePath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeBasePath(configuredBasePath)}${normalizedPath}`;
}
