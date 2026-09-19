"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/cn";

interface SignOutButtonProps {
  /** `lg` for the senior screens, where every target is deliberately large. */
  size?: "sm" | "lg";
  className?: string;
}

export function SignOutButton({ size = "sm", className }: SignOutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    if (pending) return;
    setPending(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // The cookie may well be gone anyway, and there is nothing useful to say
      // here — send them to /signin regardless. The proxy will bounce them back
      // if the session somehow survived.
    }

    // replace(), not push(): the signed-in page must not be one Back away.
    router.replace("/signin");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={pending}
      title="Sign out"
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border font-semibold transition-colors disabled:opacity-60",
        size === "lg"
          ? "size-14 justify-center border-2 border-ink-300 bg-white text-ink-600 hover:bg-ink-100 hover:text-ink-900"
          : "border-ink-200 px-3 py-2 text-xs text-ink-600 hover:bg-ink-100",
        className,
      )}
    >
      <LogOut size={size === "lg" ? 26 : 14} aria-hidden="true" />
      {size === "lg" ? <span className="sr-only">Sign out</span> : pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
