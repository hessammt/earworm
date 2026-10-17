"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      className="rounded-full p-2 text-muted transition hover:bg-white/5 hover:text-white"
      title="Log out"
      aria-label="Log out"
    >
      <LogOut className="size-4" />
    </button>
  );
}
