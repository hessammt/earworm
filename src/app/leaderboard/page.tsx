import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Trophy, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getLeaderboard, type LeaderPeriod } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leaderboard — earworm." };

const TABS: { key: LeaderPeriod; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  const period: LeaderPeriod = p === "week" || p === "month" ? p : "all";
  const user = await getCurrentUser();
  const rows = await getLeaderboard(period, user?.id ?? null);
  const you = rows.find((r) => r.isYou);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:pt-14">
      <div className="fade-up">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-acid">
          <Trophy className="size-4" /> Global ranking
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Leaderboard</h1>
        <p className="mt-2 text-sm text-muted">
          Total points across every game and every artist. Guests don&apos;t
          count — <Link href="/signup" className="font-bold text-acid">sign up</Link> to compete.
        </p>
      </div>

      {/* tabs */}
      <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-panel p-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/leaderboard" : `/leaderboard?p=${t.key}`}
            className={`rounded-xl py-2.5 text-center text-sm font-bold transition ${
              period === t.key
                ? "bg-acid text-black"
                : "text-muted hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* your standing (when outside the list for this period) */}
      {user && !you && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-acid/30 bg-acid/5 px-4 py-3 text-sm text-muted">
          <Users className="size-4 shrink-0 text-acid" />
          You haven&apos;t scored in this period yet — finish a game to enter
          the board.
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-panel">
        {rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-muted">
            Nobody has scored{" "}
            {period === "all" ? "yet" : `this ${period === "week" ? "week" : "month"}`}
            . Be the first.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[3rem_1fr_5.5rem_4.5rem] items-center gap-2 border-b border-line/70 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">
              <span>Rank</span>
              <span>Player</span>
              <span className="text-right">Points</span>
              <span className="text-right">Games</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                className={`grid grid-cols-[3rem_1fr_5.5rem_4.5rem] items-center gap-2 border-b border-line/50 px-5 py-3.5 last:border-0 ${
                  r.isYou ? "bg-acid/10" : ""
                }`}
              >
                <span
                  className={`flex items-center justify-center text-lg font-bold ${
                    r.rank === 1
                      ? "text-acid"
                      : r.rank <= 3
                        ? "text-white"
                        : "text-muted"
                  }`}
                >
                  {r.rank === 1 ? (
                    <Crown className="size-5 fill-acid/20" />
                  ) : (
                    r.rank
                  )}
                </span>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-panel2 text-xs font-bold uppercase text-acid">
                    {r.username.slice(0, 1)}
                  </span>
                  <span className="truncate text-sm font-semibold">
                    {r.username}
                    {r.isYou && (
                      <span className="ml-2 rounded-full bg-acid px-2 py-0.5 text-[10px] font-bold text-black">
                        YOU
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-right text-base font-bold text-acid">
                  {r.points.toLocaleString()}
                </span>
                <span className="text-right text-sm text-muted">{r.games}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
