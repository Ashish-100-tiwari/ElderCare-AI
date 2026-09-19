/**
 * Avatar provider contract.
 *
 * `VirtualCompanion` renders an illustrated companion by default and knows
 * nothing about any vendor. To plug in a real-time avatar (HeyGen LiveAvatar,
 * D-ID, Simli…) you implement this interface and register it once — see
 * `lib/avatar/registry.ts`. No component or page needs to change.
 */

export type CompanionState = "idle" | "listening" | "thinking" | "speaking";

export interface AvatarSessionConfig {
  /** Short-lived token minted server-side by `/api/bff/avatar/session`. */
  token: string;
  sessionId?: string;
  avatarId?: string;
  voiceId?: string;
  language?: string;
}

export interface AvatarSessionEvents {
  statechange: CompanionState;
  ready: void;
  error: Error;
}

export interface AvatarSession {
  /** Attaches the provider's <video> element into our avatar container. */
  attach(container: HTMLElement): void;
  /** Makes the avatar say something out loud with lip sync. */
  speak(text: string): Promise<void>;
  /** Stops the current utterance so the senior can interrupt. */
  interrupt(): Promise<void>;
  stop(): Promise<void>;
  on<K extends keyof AvatarSessionEvents>(
    event: K,
    listener: (payload: AvatarSessionEvents[K]) => void,
  ): () => void;
}

export interface AvatarProvider {
  id: string;
  label: string;
  /** Called only after the server confirms a provider is configured. */
  createSession(config: AvatarSessionConfig): Promise<AvatarSession>;
}
