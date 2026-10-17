import Link from "next/link";
import { count } from "drizzle-orm";
import {
  AudioLines,
  ChevronRight,
  Disc3,
  MousePointerClick,
  Play,
  Trophy,
} from "lucide-react";
import { db } from "@/db";
import { artists, games, songs } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { getLeaderboard } from "@/lib/leaderboard";
import { MAX_GAME_POINTS, TOTAL_ROUNDS } from "@/lib/gameConfig";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  const [[songRow], [artistRow], [gameRow], top] = await Promise.all([
    db.select({ value: count() }).from(songs),
    db.select({ value: count() }).from(artists),
    db.select({ value: count() }).from(games),
    getLeaderboard("all", user?.id ?? null).then((r) => r.slice(0, 5)),
  ]);

  return (
    <div className="overflow-hidden">
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[480px] bg-[radial-gradient(closest-side,rgba(200,255,46,0.14),transparent)]"
        />
        <div
          aria-hidden
          className="drift pointer-events-none absolute -right-32 top-10 hidden size-96 rounded-full border border-acid/10 bg-[repeating-radial-gradient(circle_at_center,rgba(200,255,46,0.05)_0_2px,transparent_2px_14px)] md:block"
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
          <div className="flex h-6 items-end gap-1" aria-hidden>
            {[0.9, 0.5, 0.7, 0.3, 0.8, 0.45, 0.65].map((d, i) => (
              <span
                key={i}
                className="eq-bar w-1 rounded-full bg-acid"
                style={{ height: "100%", animationDelay: `${d}s` }}
              />
            ))}
            <span className="ml-3 text-xs font-bold uppercase tracking-[0.35em] text-acid">
              A Heardle-style game
            </span>
          </div>

          <h1 className="mt-6 text-[13vw] font-bold leading-[0.9] tracking-tight sm:text-7xl md:text-8xl">
            GUESS THE
            <br />
            SONG<span className="text-acid">.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base text-muted sm:text-lg">
            Half a second. That&apos;s all you get — at first. One artist,{" "}
            {TOTAL_ROUNDS} songs, five ever-longer snippets. The faster you
            recognize it, the more points you bank — and every point climbs
            the global leaderboard.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/play"
              className="group inline-flex h-14 items-center gap-2 rounded-full bg-acid px-8 text-base font-bold text-black transition hover:brightness-110"
            >
              <Play className="size-5 fill-current" />
              {user ? "PLAY NOW" : "PLAY FREE"}
              <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex h-14 items-center gap-2 rounded-full border border-line bg-panel px-8 text-base font-bold transition hover:border-white/40"
            >
              <Trophy className="size-5" />
              Leaderboard
            </Link>
          </div>

          <div className="mt-12 grid max-w-lg grid-cols-3 gap-4">
            {[
              { label: "songs in archive", value: songRow?.value ?? 0 },
              { label: "artists", value: artistRow?.value ?? 0 },
              { label: "games played", value: gameRow?.value ?? 0 },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-white sm:text-4xl">
                  {Number(s.value).toLocaleString()}
                </div>
                <div className="mt-1 text-[11px] font-medium uppercase tracking-widest text-muted">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="border-t border-line/60">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-xs font-bold uppercase tracking-[0.35em] text-muted">
            How it works
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Disc3,
                title: "Pick an artist",
                body: "Go random or choose from the archive. Every round is a different song by that artist.",
              },
              {
                icon: AudioLines,
                title: "Trust your ears",
                body: "Stage 1 is a 0.5s sting worth 5 points. Wrong or skip? Hear double — for fewer points.",
              },
              {
                icon: MousePointerClick,
                title: `${MAX_GAME_POINTS} points on the table`,
                body: "Every point you earn is saved to your account across every game and every artist.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-3xl border border-line bg-panel p-6 transition hover:border-acid/40"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-acid/10 text-acid">
                  <c.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOP PLAYERS ──────────────────────────────────────────── */}
      <section className="border-t border-line/60">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.35em] text-muted">
              Top players · all time
            </h2>
            <Link
              href="/leaderboard"
              className="text-xs font-bold text-acid transition hover:brightness-110"
            >
              View all →
            </Link>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-line bg-panel">
            {top.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted">
                No games finished yet — the first legend could be you.
              </p>
            ) : (
              top.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-4 border-b border-line/60 px-5 py-4 last:border-0 ${
                    r.isYou ? "bg-acid/10" : ""
                  }`}
                >
                  <span
                    className={`w-8 text-center text-lg font-bold ${
                      r.rank <= 3 ? "text-acid" : "text-muted"
                    }`}
                  >
                    {r.rank}
                  </span>
                  <span className="grid size-9 place-items-center rounded-full bg-panel2 text-sm font-bold uppercase text-acid">
                    {r.username.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {r.username}
                    {r.isYou && (
                      <span className="ml-2 rounded-full bg-acid px-2 py-0.5 text-[10px] font-bold text-black">
                        YOU
                      </span>
                    )}
                  </span>
                  <span className="text-lg font-bold text-acid">
                    {r.points.toLocaleString()}
                    <span className="ml-1 text-xs font-medium text-muted">
                      pts
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
