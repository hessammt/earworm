import { sql } from "drizzle-orm";
import { db } from "@/db";

export type LeaderPeriod = "all" | "week" | "month";

export type LeaderRow = {
  rank: number;
  id: string;
  username: string;
  points: number;
  games: number;
  isYou: boolean;
};

/**
 * Global leaderboard: ranks players by TOTAL points across all completed
 * games and all artists. `week` / `month` scope the points to games that
 * finished within the current ISO week / calendar month.
 */
export async function getLeaderboard(
  period: LeaderPeriod,
  currentUserId: string | null,
): Promise<LeaderRow[]> {
  const bound =
    period === "week"
      ? sql`and g.completed_at >= date_trunc('week', now())`
      : period === "month"
        ? sql`and g.completed_at >= date_trunc('month', now())`
        : sql``;

  const res = await db.execute<{
    id: string;
    username: string;
    points: number;
    games: number;
  }>(sql`
    select
      u.id,
      u.username,
      coalesce(sum(g.total_points), 0)::int as points,
      count(g.id)::int as games
    from users u
    join games g
      on g.user_id = u.id
     and g.status = 'completed'
     ${bound}
    group by u.id, u.username
    having count(g.id) > 0
    order by points desc, games asc, u.username asc
    limit 100
  `);

  return res.rows.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    username: r.username,
    points: r.points,
    games: r.games,
    isYou: r.id === currentUserId,
  }));
}
