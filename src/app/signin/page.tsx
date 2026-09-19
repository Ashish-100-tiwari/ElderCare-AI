import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Logo } from "@/components/Logo";
import { SignInForm } from "@/components/SignInForm";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in — ElderCare AI",
};

// Reads the session cookie, so this page can never be prerendered or cached.
export const dynamic = "force-dynamic";

/**
 * Only a same-origin path is an acceptable post-sign-in destination.
 *
 * `?redirect=https://evil.example` would otherwise turn our own sign-in page
 * into an open redirect, which is exactly the shape a phishing link wants.
 * `//evil.example` is rejected too: the browser reads a protocol-relative URL as
 * an absolute one.
 */
function safeRedirect(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  if (value.startsWith("/signin")) return undefined; // no loops
  return value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { redirect: requested } = await searchParams;
  const redirectTo = safeRedirect(requested);

  // Already signed in — there is nothing to do here.
  const session = await getSession();
  if (session) redirect(redirectTo ?? "/senior");

  return (
    <main
      id="main"
      className="page-aura senior-scope mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-12 sm:px-8"
    >
      <Logo size="md" className="animate-rise-in mb-8" tagline="Companion care" />

      {/* The form sits on its own raised surface: on a screen this empty, a card
          is what tells you where to look first. */}
      <section className="animate-rise-in rounded-4xl border border-ink-200/80 bg-white/90 p-6 shadow-lift backdrop-blur-sm sm:p-8 [animation-delay:90ms]">
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-ink-900">Welcome back</h1>
        <p className="mt-3 text-pretty text-xl leading-relaxed text-ink-600">
          Sign in to see today&rsquo;s plan and talk with your companion.
        </p>

        <div className="mt-7">
          <SignInForm redirectTo={redirectTo} />
        </div>
      </section>

      <p className="animate-rise-in mt-6 flex items-start gap-3 rounded-3xl border border-calm-200/80 bg-calm-50/70 px-5 py-4 text-base leading-relaxed text-ink-600 [animation-delay:180ms]">
        <ShieldCheck size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-calm-600" />
        Your sign-in is kept in a secure cookie on this device only. Ask a family member if you do
        not know your password.
      </p>
    </main>
  );
}
