import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign up — earworm." };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-12 sm:pt-16">
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </div>
  );
}
