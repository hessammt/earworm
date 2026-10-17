import { NextResponse } from "next/server";
import { and, asc, count, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { artists, songs } from "@/db/schema";
import { TOTAL_ROUNDS } from "@/lib/gameConfig";
import { ARTIST_CATEGORIES } from "@/lib/categories";
import type { ArtistInfo, CategoryInfo } from "@/lib/types";

/** Artists with enough playable songs for a full game + playable categories. */
export async function GET() {
  const artistRows = await db
    .select({
      id: artists.id,
      name: artists.name,
      imageUrl: artists.imageUrl,
      songCount: count(),
    })
    .from(artists)
    .innerJoin(songs, eq(songs.artistId, artists.id))
    .where(isNotNull(songs.previewUrl))
    .groupBy(artists.id)
    .having(sql`count(*) >= ${TOTAL_ROUNDS}`)
    .orderBy(asc(artists.name));

  const catRows = await db
    .select({
      slug: artists.category,
      songCount: count(),
      artistCount: sql<number>`count(distinct ${artists.id})::int`,
    })
    .from(artists)
    .innerJoin(songs, eq(songs.artistId, artists.id))
    .where(and(isNotNull(artists.category), isNotNull(songs.previewUrl)))
    .groupBy(artists.category)
    .having(sql`count(*) >= ${TOTAL_ROUNDS}`);

  const categories: CategoryInfo[] = catRows
    .filter((r) => r.slug)
    .map((r) => {
      const slug = r.slug as string;
      return {
        slug,
        name:
          ARTIST_CATEGORIES[slug]?.label ??
          slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: ARTIST_CATEGORIES[slug]?.description ?? "",
        songCount: r.songCount,
        artistCount: r.artistCount,
      };
    });

  return NextResponse.json({
    artists: artistRows as ArtistInfo[],
    categories,
  });
}
