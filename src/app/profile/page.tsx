import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { sql } from "drizzle-orm";
import {
  Crosshair,
  Gamepad2,
  Medal,
  Play,
  Star,
  TrendingUp,
} from "lucide-react";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { MAX_GAME_POINTS } from "@/lib/gameConfig";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile — earworm." };

type Stats = {
  total_points: number;
  games_played: number;
  best_game: number;
};
type Accuracy = { correct: number; total: number };
type RecentGame = {
  id: string;
  points: number;
  completed_at: string | null;
  artist: string;
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  const statsRes = await db.execute<Stats>(sql`
    select
      coalesce(sum(total_points), 0)::int as total_points,
      count(*)::int as games_played,
      coalesce(max(total_points), 0)::int as best_game
    from games
    where user_id = ${user.id} and status = 'completed'
  `);
  const accRes = await db.execute<Accuracy>(sql`
    select
      count(*) filter (where gr.status = 'correct')::int as correct,
      count(*)::int as total
    from game_rounds gr
    join games g on g.id = gr.game_id
    where g.user_id = ${user.id}
      and g.status = 'completed'
      and gr.status in ('correct', 'failed')
  `);
  const recentRes = await db.execute<RecentGame>(sql`
    select g.id, g.total_points as points, g.completed_at::text as completed_at,
           coalesce(a.name, case g.category when 'game-music' then 'Video Game Music'
                            else initcap(replace(coalesce(g.category, ''), '-', ' ')) end,
                     'Mixed Bag') as artist
    from games g
    left join artists a on a.id = g.artist_id
    where g.user_id = ${user.id} and g.status = 'completed'
    order by g.completed_at desc nulls last
    limit 10
  `);

  const stats: Stats = statsRes.rows[0] ?? {
    total_points: 0,
    games_played: 0,
    best_game: 0,
  };
  const acc: Accuracy = accRes.rows[0] ?? { correct: 0, total: 0 };
  const accuracy = acc.total > 0 ? Math.round((acc.correct / acc.total) * 100) : 0;
  const recent = recentRes.rows;

  const cards = [
    { icon: TrendingUp, label: "Total points", value: stats.total_points.toLocaleString(), accent: true },
    { icon: Gamepad2, label: "Games played", value: stats.games_played.toLocaleString(), accent: false },
    { icon: Medal, label: "Best game", value: String(stats.best_game), accent: false },
    { icon: Crosshair, label: "Accuracy", value: `${accuracy}%`, accent: false },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:pt-14">
      {/* identity */}
      <div className="fade-up flex items-center gap-4">
        <div className="grid size-16 place-items-center rounded-3xl bg-acid text-2xl font-bold uppercase text-black">
          {user.username.slice(0, 1)}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{user.username}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
      </div>

      {/* stat cards */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-3xl border p-4 ${
              c.accent
                ? "border-acid/40 bg-acid/10"
                : "border-line bg-panel"
            }`}
          >
            <c.icon
              className={`size-4 ${c.accent ? "text-acid" : "text-muted"}`}
            />
            <div
              className={`mt-3 text-3xl font-bold tracking-tight ${
                c.accent ? "text-acid" : ""
              }`}
            >
              {c.value}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
              {c.label}
            </div>
          </div>
        ))}
      </div>

      {/* recent games */}
      <div className="mt-10 flex items-end justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.35em] text-muted">
          Recent games
        </h2>
        <Star className="size-4 text-muted" />
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-panel">
        {recent.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-muted">
              No completed games yet. Your history starts here.
            </p>
            <Link
              href="/play"
              className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-acid px-7 text-sm font-bold text-black transition hover:brightness-110"
            >
              <Play className="size-4 fill-current" /> Play your first game
            </Link>
          </div>
        ) : (
          recent.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-4 border-b border-line/60 px-5 py-3.5 last:border-0"
            >
              <span className="grid size-9 place-items-center rounded-full bg-panel2">
                <Gamepad2 className="size-4 text-muted" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {g.artist}
                </span>
                <span className="block text-xs text-muted">
                  {g.completed_at
                    ? new Date(g.completed_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : ""}
                </span>
              </span>
              <span
                className={`text-base font-bold ${
                  g.points >= MAX_GAME_POINTS / 2 ? "text-acid" : "text-white"
                }`}
              >
                {g.points}
                <span className="ml-1 text-[10px] font-medium text-muted">
                  pts
                </span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
