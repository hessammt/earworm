import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Log in — earworm." };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-12 sm:pt-16">
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
