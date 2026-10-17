import { eq } from "drizzle-orm";
import { db } from "@/db";
import { gameRounds, songs } from "@/db/schema";
import { getFreshPreviewUrl } from "@/lib/deezer";

/**
 * Audio proxy. The client only knows the opaque round id — never the song.
 * Deezer preview URLs expire, so we always resolve a fresh one server-side
 * (falling back to the stored URL) and stream the MP3 through here, which
 * also sidesteps Deezer's missing CORS headers.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const { roundId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(roundId)) {
    return new Response("Not found", { status: 404 });
  }

  const rows = await db
    .select({
      deezerTrackId: songs.deezerTrackId,
      previewUrl: songs.previewUrl,
    })
    .from(gameRounds)
    .innerJoin(songs, eq(gameRounds.songId, songs.id))
    .where(eq(gameRounds.id, roundId))
    .limit(1);

  const song = rows[0];
  if (!song) return new Response("Not found", { status: 404 });

  let url = await getFreshPreviewUrl(song.deezerTrackId);
  if (url && url !== song.previewUrl) {
    // Keep the stored URL warm as a fallback — fire and forget.
    void db
      .update(songs)
      .set({ previewUrl: url })
      .where(eq(songs.deezerTrackId, song.deezerTrackId))
      .catch(() => {});
  }
  url = url ?? song.previewUrl;
  if (!url) return new Response("No preview available", { status: 404 });

  try {
    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return new Response("Preview unavailable", { status: 502 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Preview unavailable", { status: 502 });
  }
}
