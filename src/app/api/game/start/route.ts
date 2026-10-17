import { NextRequest, NextResponse } from "next/server";
import { getIdentity } from "@/lib/session";
import { GameError, startGame } from "@/lib/game";
import type { StartResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const artistId =
      typeof body?.artistId === "string" ? body.artistId : undefined;
    const category =
      typeof body?.category === "string" ? body.category : undefined;
    const idn = await getIdentity(true);
    const state = await startGame(idn, { artistId, category });
    return NextResponse.json({ state } satisfies StartResponse);
  } catch (e) {
    if (e instanceof GameError) {
      return NextResponse.json(
        { error: e.message } satisfies StartResponse,
        { status: e.status },
      );
    }
    console.error(e);
    return NextResponse.json(
      { error: "Could not start a game right now." } satisfies StartResponse,
      { status: 500 },
    );
  }
}
