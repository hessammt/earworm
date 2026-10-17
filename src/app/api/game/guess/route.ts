import { NextRequest, NextResponse } from "next/server";
import { getIdentity } from "@/lib/session";
import { GameError, submitGuess } from "@/lib/game";
import type { GuessResponse } from "@/lib/types";

/** Server-authoritative guess validation + scoring. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const songId = String(body?.songId ?? "");
    const idn = await getIdentity(false);
    const result = await submitGuess(idn, songId);
    return NextResponse.json(result satisfies GuessResponse);
  } catch (e) {
    if (e instanceof GameError) {
      return NextResponse.json(
        { error: e.message } satisfies GuessResponse,
        { status: e.status },
      );
    }
    console.error(e);
    return NextResponse.json(
      { error: "Guess failed — try again." } satisfies GuessResponse,
      { status: 500 },
    );
  }
}
