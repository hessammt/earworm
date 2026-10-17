/**
 * Deezer helpers — SERVER ONLY.
 * The browser never talks to Deezer: preview URLs expire and Deezer has no
 * CORS headers, so fresh URLs are fetched here and the audio itself is
 * streamed through our own /api/audio route.
 */

const DEEZER = "https://api.deezer.com";

/** Fetch a fresh 30s preview URL for a track. Returns null when unavailable. */
export async function getFreshPreviewUrl(
  deezerTrackId: number,
): Promise<string | null> {
  try {
    const res = await fetch(`${DEEZER}/track/${deezerTrackId}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { preview?: string };
    return json.preview && json.preview.length > 0 ? json.preview : null;
  } catch {
    return null;
  }
}
