/**
 * Artist categories. An artist with `artists.category = "game-music"` becomes
 * part of the Video Game Music pool — players can start a "category game"
 * where all 10 rounds are drawn from every artist in the category.
 */
export const ARTIST_CATEGORIES: Record<
  string,
  { label: string; description: string }
> = {
  "game-music": {
    label: "Video Game Music",
    description: "Iconic themes & soundtracks, mixed across games",
  },
};

export function categoryLabel(slug: string | null | undefined): string {
  if (!slug) return "Mixed Bag";
  return (
    ARTIST_CATEGORIES[slug]?.label ??
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
