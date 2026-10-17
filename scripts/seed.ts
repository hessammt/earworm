/**
 * Seed the song archive from the Deezer public API (no key needed).
 *
 * Usage:
 *   npx tsx scripts/seed.ts                                    # default roster
 *   npx tsx scripts/seed.ts "Daft Punk" "ABBA"                 # specific artists
 *   npx tsx scripts/seed.ts --category=game-music "C418" ...   # tag artists into
 *                                                              # a category
 *                                                              # (enables the
 *                                                              # category game)
 *
 * For each artist it stores: name, image, and their top tracks with title,
 * album, cover art, Deezer track id and preview URL. Tracks without a
 * preview are skipped. Re-running is safe (idempotent upserts) — use it to
 * keep growing the archive.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { artists, songs } from "../src/db/schema";

const DEFAULT_ARTISTS = [
  // Classic rock & pop
  "Queen", "The Beatles", "ABBA", "Michael Jackson", "Madonna",
  "Nirvana", "Radiohead", "Coldplay", "U2", "Metallica",
  "AC/DC", "Led Zeppelin", "Pink Floyd", "The Rolling Stones", "David Bowie",
  "Prince", "Elton John", "Fleetwood Mac", "Bee Gees", "Whitney Houston",
  // 90s / 00s
  "Oasis", "Blur", "The Cure", "Depeche Mode", "Gorillaz",
  "Daft Punk", "Red Hot Chili Peppers", "The Killers", "Arctic Monkeys", "Linkin Park",
  // Pop & R&B
  "Beyoncé", "Taylor Swift", "Adele", "Ed Sheeran", "Bruno Mars",
  "Rihanna", "Katy Perry", "Lady Gaga", "Justin Timberlake", "Ariana Grande",
  "The Weeknd", "Dua Lipa", "Billie Eilish", "Harry Styles", "Lana Del Rey",
  // Hip hop
  "Drake", "Eminem", "Kanye West", "Kendrick Lamar", "Snoop Dogg",
  // Dance & indie
  "Imagine Dragons", "Twenty One Pilots", "Tame Impala", "The Strokes", "Muse",
  // Soul / reggae / country roots
  "Stevie Wonder", "Aretha Franklin", "Bob Marley", "Johnny Cash", "Earth, Wind & Fire",
];

const DEEZER = "https://api.deezer.com";
const TRACKS_PER_ARTIST = 100; // Deezer /artist/{id}/top max
const REQUEST_DELAY_MS = 250;  // stay friendly with rate limits

const dbUrl = process.env.DATABASE_URL ?? "";
const isLocalDb = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");
const pool = new Pool({
  connectionString: dbUrl,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});
const db = drizzle(pool);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ArtistSearchHit = {
  id: number;
  name: string;
  nb_fan?: number;
  picture_xl?: string;
  picture_big?: string;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

type TopTrack = {
  id: number;
  title: string;
  preview?: string;
  duration?: number;
  album?: { title?: string; cover_xl?: string; cover_big?: string };
};

async function searchArtist(name: string): Promise<ArtistSearchHit | null> {
  const res = await fetch(
    `${DEEZER}/search/artist?q=${encodeURIComponent(name)}&limit=15`,
  );
  if (!res.ok) throw new Error(`artist search HTTP ${res.status}`);
  const json = (await res.json()) as { data?: ArtistSearchHit[] };
  const hits = json.data ?? [];
  if (hits.length === 0) return null;
  // Prefer an exact (normalized) name match; break ties by fan count so
  // "Queen" resolves to Queen and not a tribute act.
  const byFans = (a: ArtistSearchHit, b: ArtistSearchHit) =>
    (b.nb_fan ?? 0) - (a.nb_fan ?? 0);
  const exact = hits.filter((h) => norm(h.name) === norm(name));
  return (exact.length > 0 ? exact : hits).sort(byFans)[0];
}

async function topTracks(artistId: number): Promise<TopTrack[]> {
  const res = await fetch(
    `${DEEZER}/artist/${artistId}/top?limit=${TRACKS_PER_ARTIST}`,
  );
  if (!res.ok) throw new Error(`top tracks HTTP ${res.status}`);
  const json = (await res.json()) as { data?: TopTrack[] };
  return json.data ?? [];
}

async function seedArtist(name: string, category: string | null) {
  const hit = await searchArtist(name);
  await sleep(REQUEST_DELAY_MS);
  if (!hit) {
    console.log(`  ✗ "${name}" — not found on Deezer`);
    return { added: 0, playable: 0 };
  }

  const imageUrl = hit.picture_xl ?? hit.picture_big ?? null;
  const [artist] = await db
    .insert(artists)
    .values({ name: hit.name, deezerArtistId: hit.id, imageUrl, category })
    .onConflictDoUpdate({
      target: artists.deezerArtistId,
      set: category
        ? { name: hit.name, imageUrl, category }
        : { name: hit.name, imageUrl },
    })
    .returning({ id: artists.id });

  const tracks = await topTracks(hit.id);
  await sleep(REQUEST_DELAY_MS);

  let playable = 0;
  for (const t of tracks) {
    if (!t.preview) continue; // never store songs we can't play
    await db
      .insert(songs)
      .values({
        artistId: artist.id,
        title: t.title,
        album: t.album?.title ?? null,
        coverUrl: t.album?.cover_xl ?? t.album?.cover_big ?? null,
        deezerTrackId: t.id,
        previewUrl: t.preview,
        duration: t.duration ?? null,
      })
      .onConflictDoUpdate({
        target: songs.deezerTrackId,
        set: {
          title: t.title,
          album: t.album?.title ?? null,
          coverUrl: t.album?.cover_xl ?? t.album?.cover_big ?? null,
          previewUrl: t.preview,
          duration: t.duration ?? null,
        },
      });
    playable++;
  }

  console.log(
    `  ✓ ${hit.name}: ${playable} playable tracks (${tracks.length - playable} skipped, no preview)`,
  );
  return { added: tracks.length, playable };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set (check your .env)");
    process.exit(1);
  }

  const rawArgs = process.argv.slice(2);
  let category: string | null = null;
  const args = rawArgs.filter((a) => {
    if (a.startsWith("--category=")) {
      category = a.slice("--category=".length);
      return false;
    }
    return true;
  });
  const list = args.length > 0 ? args : DEFAULT_ARTISTS;
  console.log(
    `Seeding ${list.length} artist(s) from Deezer…${category ? ` (category: ${category})` : ""}\n`,
  );

  let totalPlayable = 0;
  for (const name of list) {
    try {
      const { playable } = await seedArtist(name, category);
      totalPlayable += playable;
    } catch (e) {
      console.error(`  ✗ "${name}" — ${(e as Error).message}`);
    }
  }

  console.log(`\nDone. ${totalPlayable} playable tracks upserted.`);
  console.log("Tip: re-run with more artist names any time to grow the archive.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void pool.end());
