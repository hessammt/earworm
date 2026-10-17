import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/session";
import { getCurrentGameState } from "@/lib/game";
import type { CurrentResponse } from "@/lib/types";

/** Resume support: restores an in-progress game after refresh/revisit. */
export async function GET() {
  try {
    const idn = await getIdentity(false);
    const state = await getCurrentGameState(idn);
    return NextResponse.json({ state } satisfies CurrentResponse);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { state: null } satisfies CurrentResponse,
      { status: 200 },
    );
  }
}
