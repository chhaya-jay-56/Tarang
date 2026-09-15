/**
 * CDN URL helper for Cloudflare R2 hosted assets.
 *
 * In production, resolves to https://cdn.trytarang.app/...
 * In local dev, falls back to relative paths (public/ dir).
 */

const CDN_BASE =
  process.env.NEXT_PUBLIC_CDN_URL || "https://cdn.trytarang.app";

/**
 * Build a full CDN URL for a given asset path.
 * @param path — relative path within the R2 bucket (e.g. "video_examples/demo.mp4")
 */
export function cdnUrl(path: string): string {
  // Strip leading slash to avoid double-slash
  const clean = path.replace(/^\/+/, "");
  return `${CDN_BASE}/${clean}`;
}

/**
 * Shorthand for video_examples folder assets.
 */
export function videoUrl(filename: string): string {
  return cdnUrl(`video_examples/${filename}`);
}
