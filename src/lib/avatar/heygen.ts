import type { AvatarProvider, AvatarSession, AvatarSessionConfig, CompanionState } from "./types";

/**
 * HeyGen LiveAvatar adapter — scaffolded, not yet wired.
 *
 * Everything the rest of the app needs is already satisfied by the
 * `AvatarProvider` contract, so finishing this adapter is a contained job:
 *
 *  1. `npm install @heygen/streaming-avatar`
 *  2. Replace the marked section in `createSession` with the SDK calls.
 *  3. Register it: `registerAvatarProvider(heyGenProvider)`.
 *  4. Put `HEYGEN_API_KEY` on the backend and have it mint a session token in
 *     `POST /api/avatar/session`. The key must never reach the browser.
 *
 * The session token arrives via `config.token`, which our own server fetched.
 */

type Listener<T> = (payload: T) => void;

class EventBus {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  on(event: string, listener: Listener<never>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as Listener<unknown>);
    this.listeners.set(event, set);
    return () => set.delete(listener as Listener<unknown>);
  }

  emit(event: string, payload?: unknown): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload as never));
  }
}

export const heyGenProvider: AvatarProvider = {
  id: "heygen-live-avatar",
  label: "HeyGen LiveAvatar",

  async createSession(config: AvatarSessionConfig): Promise<AvatarSession> {
    const bus = new EventBus();
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.className = "size-full object-cover";

    /* ---------------------------------------------------------------------
     * Replace with the real SDK, e.g.:
     *
     *   const avatar = new StreamingAvatar({ token: config.token });
     *   avatar.on(StreamingEvents.STREAM_READY, (e) => {
     *     video.srcObject = e.detail;
     *     bus.emit("ready");
     *   });
     *   avatar.on(StreamingEvents.AVATAR_START_TALKING, () => bus.emit("statechange", "speaking"));
     *   avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => bus.emit("statechange", "idle"));
     *   await avatar.createStartAvatar({ avatarName: config.avatarId, voice: { voiceId: config.voiceId } });
     * ------------------------------------------------------------------ */
    void config;

    const setState = (state: CompanionState) => bus.emit("statechange", state);

    return {
      attach(container) {
        container.replaceChildren(video);
      },
      async speak(text: string) {
        setState("speaking");
        // await avatar.speak({ text, taskType: TaskType.REPEAT });
        void text;
        setState("idle");
      },
      async interrupt() {
        // await avatar.interrupt();
        setState("idle");
      },
      async stop() {
        // await avatar.stopAvatar();
        video.srcObject = null;
      },
      on(event, listener) {
        return bus.on(event, listener as Listener<never>);
      },
    };
  },
};
