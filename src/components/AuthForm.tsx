"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail, User } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/play";

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup" ? { email, username, password } : { email, password },
        ),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) {
        setError(d.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Network error — try again.");
      setBusy(false);
    }
  }

  return (
    <div className="fade-up">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-acid">
        {mode === "signup" ? "Join the game" : "Welcome back"}
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">
        {mode === "signup" ? "Create your account" : "Log in"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "signup"
          ? "Every point you earn is saved to your account — forever."
          : "Your points are waiting for you."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="h-14 w-full rounded-2xl border border-line bg-panel pl-11 pr-4 outline-none placeholder:text-muted focus:border-acid/60"
          />
        </div>

        {mode === "signup" && (
          <div className="relative">
            <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username (3–20 chars)"
              autoComplete="username"
              className="h-14 w-full rounded-2xl border border-line bg-panel pl-11 pr-4 outline-none placeholder:text-muted focus:border-acid/60"
            />
          </div>
        )}

        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              mode === "signup" ? "Password (min. 6 chars)" : "Password"
            }
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            className="h-14 w-full rounded-2xl border border-line bg-panel pl-11 pr-4 outline-none placeholder:text-muted focus:border-acid/60"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-acid text-base font-bold text-black transition hover:brightness-110 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-5 animate-spin" />}
          {mode === "signup" ? "SIGN UP & PLAY" : "LOG IN"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-acid">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="font-bold text-acid">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
