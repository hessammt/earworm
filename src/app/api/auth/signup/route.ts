import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSessionCookie } from "@/lib/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3–20 chars: letters, numbers, underscore." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  let user: { id: string; username: string };
  try {
    const [created] = await db
      .insert(users)
      .values({ email, username, passwordHash })
      .returning({ id: users.id, username: users.username });
    user = created;
  } catch (e: unknown) {
    const err = e as { code?: string; constraint?: string };
    if (err?.code === "23505") {
      const msg = err.constraint?.includes("email")
        ? "That email is already registered."
        : "That username is taken.";
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Sign up failed." }, { status: 500 });
  }

  await createSessionCookie(user.id);
  return NextResponse.json({ ok: true, user });
}
