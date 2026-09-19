import type { AvatarProvider } from "./types";

/**
 * Single registration point for a real-time avatar provider.
 *
 * Today nothing is registered, so `VirtualCompanion` draws the built-in
 * illustrated companion. To switch to a live avatar, add one line in a client
 * entry point (for example the senior layout):
 *
 *   import { registerAvatarProvider } from "@/lib/avatar/registry";
 *   import { heyGenProvider } from "@/lib/avatar/heygen";
 *   registerAvatarProvider(heyGenProvider);
 *
 * and set the provider credentials on the *backend* so `/api/bff/avatar/session`
 * starts returning `{ configured: true, token }`.
 */

let provider: AvatarProvider | null = null;

export function registerAvatarProvider(next: AvatarProvider): void {
  provider = next;
}

export function getAvatarProvider(): AvatarProvider | null {
  return provider;
}

export function clearAvatarProvider(): void {
  provider = null;
}
