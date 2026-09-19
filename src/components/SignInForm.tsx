"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, TriangleAlert } from "lucide-react";

import { BigButton } from "@/components/ui/BigButton";
import { TextField } from "@/components/ui/Field";

/** Where to land after a successful sign-in, unless a redirect was passed in. */
const DEFAULT_DESTINATION = "/senior";

interface SignInFormProps {
  /** Already validated on the server as a same-site path. */
  redirectTo?: string;
}

export function SignInForm({ redirectTo }: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(body?.error?.message ?? "Could not sign in. Please try again.");
        setPassword("");
        return;
      }

      // The session lives in an httpOnly cookie, so every cached server render
      // from before sign-in is now stale. refresh() drops that cache; without it
      // the dashboard can paint its signed-out shell for a moment.
      router.replace(redirectTo || DEFAULT_DESTINATION);
      router.refresh();
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
      // `pending` stays true on the success path — the page is navigating away,
      // and re-enabling the button would invite a second submit.
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? (
        // aria-live so a screen reader announces the failure without the user
        // having to hunt for it.
        <p
          role="alert"
          className="animate-rise-in flex items-start gap-2.5 rounded-2xl border-2 border-care-300 bg-care-50 px-4 py-3.5 text-lg font-semibold leading-snug text-care-800 shadow-soft"
        >
          <TriangleAlert size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-care-600" />
          {error}
        </p>
      ) : null}

      <TextField
        id="email"
        name="email"
        label="Email"
        fieldSize="lg"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        autoFocus
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={pending}
      />

      <div className="relative">
        <TextField
          id="password"
          name="password"
          label="Password"
          fieldSize="lg"
          // Room for the show/hide button, so a long password never slides under it.
          inputClassName="pr-14"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="Your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
        />
        <button
          type="button"
          onClick={() => setShowPassword((visible) => !visible)}
          // Older eyes and unfamiliar keyboards make a typo likely, and a masked
          // field gives no way to spot it. Anchored to the bottom of the field
          // group rather than offset from the top, so the label height cannot
          // knock it out of alignment.
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute bottom-1.5 right-2 grid size-11 place-items-center rounded-xl text-ink-500 transition-colors hover:bg-calm-50 hover:text-calm-700"
        >
          {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>

      <BigButton
        type="submit"
        size="lg"
        fullWidth
        disabled={pending}
        className="mt-1 shadow-lift hover:-translate-y-px disabled:translate-y-0"
        iconRight={pending ? undefined : <ArrowRight size={22} />}
        icon={pending ? <LockKeyhole size={22} className="animate-pulse" /> : undefined}
      >
        {pending ? "Signing in…" : "Sign in"}
      </BigButton>
    </form>
  );
}
