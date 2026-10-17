import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/session";
import { GameError, skipStage } from "@/lib/game";
import type { SkipResponse } from "@/lib/types";

export async function POST() {
  try {
    const idn = await getIdentity(false);
    const result = await skipStage(idn);
    return NextResponse.json(result satisfies SkipResponse);
  } catch (e) {
    if (e instanceof GameError) {
      return NextResponse.json(
        { error: e.message } satisfies SkipResponse,
        { status: e.status },
      );
    }
    console.error(e);
    return NextResponse.json(
      { error: "Skip failed — try again." } satisfies SkipResponse,
      { status: 500 },
    );
  }
}
