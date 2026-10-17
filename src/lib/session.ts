import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const SESSION_COOKIE = "ew_session";
const GUEST_COOKIE = "ew_guest";
const encoder = new TextEncoder();

function secret() {
  return encoder.encode(
    process.env.AUTH_SECRET || "earworm-dev-secret-change-me",
  );
}

export async function createSessionCookie(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secret());
    return (payload.uid as string) ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const id = await getSessionUserId();
  if (!id) return null;
  const rows = await db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function getStoredGuestId(): Promise<string | null> {
  const store = await cookies();
  return store.get(GUEST_COOKIE)?.value ?? null;
}

async function ensureGuestId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;
  if (existing) return existing;
  const id = crypto.randomUUID();
  store.set(GUEST_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return id;
}

export type Identity = { userId: string | null; guestId: string | null };

/**
 * Resolve who is playing. Logged-in users win; otherwise a guest cookie.
 * Pass `createGuest=true` from routes that are allowed to mint a guest id
 * (only when starting a game).
 */
export async function getIdentity(createGuest = false): Promise<Identity> {
  const userId = await getSessionUserId();
  if (userId) return { userId, guestId: null };
  const guestId = createGuest
    ? await ensureGuestId()
    : await getStoredGuestId();
  return { userId: null, guestId };
}
