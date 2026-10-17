import { NextRequest, NextResponse } from "next/server";
import { asc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { artists, songs } from "@/db/schema";
import type { SearchResult } from "@/lib/types";

/** Autocomplete over the whole archive: matches song titles, shows artist. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ results: [] });

  const safe = q.replace(/[%_\\]/g, "").slice(0, 80);
  if (!safe) return NextResponse.json({ results: [] });

  const rows = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: artists.name,
      coverUrl: songs.coverUrl,
    })
    .from(songs)
    .innerJoin(artists, eq(songs.artistId, artists.id))
    .where(ilike(songs.title, `%${safe}%`))
    .orderBy(
      sql`case when ${songs.title} ilike ${safe + "%"} then 0 else 1 end`,
      asc(songs.title),
    )
    .limit(10);

  return NextResponse.json({ results: rows as SearchResult[] });
}
