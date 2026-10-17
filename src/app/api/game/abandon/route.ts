import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/session";
import { abandonGame } from "@/lib/game";

/** Quit the in-progress game (excluded from stats and leaderboard). */
export async function POST() {
  const idn = await getIdentity(false);
  await abandonGame(idn);
  return NextResponse.json({ ok: true });
}
