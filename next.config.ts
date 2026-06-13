import type { NextConfig } from "next";

function normalizeBasePath(value: string | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, "") ?? "";

  if (!trimmed || trimmed === "/") {
    return "";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

const isStaticExport = process.env.NEXT_OUTPUT === "export";
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isStaticExport
    ? {
        output: "export",
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
      }
    : {}),
  ...(basePath
    ? {
        assetPrefix: basePath,
        basePath,
      }
    : {}),
};

export default nextConfig;
