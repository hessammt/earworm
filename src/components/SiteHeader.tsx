import Link from "next/link";
import { AudioLines } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { LogoutButton } from "./LogoutButton";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-bold tracking-tight"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-acid text-black">
            <AudioLines className="size-4" strokeWidth={2.5} />
          </span>
          <span className="text-lg">
            earworm<span className="text-acid">.</span>
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
          <Link
            href="/play"
            className="rounded-full px-3 py-1.5 font-medium text-muted transition hover:bg-white/5 hover:text-white"
          >
            Play
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-full px-3 py-1.5 font-medium text-muted transition hover:bg-white/5 hover:text-white"
          >
            Leaders
          </Link>
          {user ? (
            <>
              <Link
                href="/profile"
                className="ml-1 max-w-28 truncate rounded-full bg-white/10 px-3 py-1.5 font-semibold transition hover:bg-white/15 sm:max-w-40"
              >
                {user.username}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-full px-3 py-1.5 font-medium text-muted transition hover:text-white min-[400px]:block"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="ml-1 rounded-full bg-acid px-4 py-1.5 font-semibold text-black transition hover:brightness-110"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
