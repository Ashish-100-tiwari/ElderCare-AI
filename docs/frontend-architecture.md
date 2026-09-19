# ElderCare AI — frontend architecture

How the UI is put together, why the API layer looks the way it does, and how to plug
in a real-time avatar. Start with the [README](../README.md) for setup and the demo
script.

## Design system

The primary user is 72 and may not have used an app like this before, so the senior
experience is built to one rule: **one obvious thing to do per screen**.

- Body text starts at 17px and grows to 18px on tablets and up (`.senior-scope`).
  Headings are 30–40px. Nothing on a senior screen is smaller than 15px.
- Buttons are at minimum 56px tall with an icon and a short label. Primary actions
  are full-width on mobile.
- Four palettes, defined as Tailwind v4 `@theme` tokens in `globals.css`: `calm`
  (teal — the senior's primary action), `warm` (amber — what is coming up next),
  `care` (soft red — wellness alerts, never alarming), `brand` (indigo — caregiver
  chrome), on a warm off-white `canvas`. Text is `ink-900` on light surfaces, which
  clears WCAG AA everywhere and AAA for body copy.
- Large radii (`rounded-4xl`/`5xl`) and soft shadows, so the interface reads as calm
  rather than clinical.
- Every interactive element has a 3px `:focus-visible` outline. Icons are decorative
  (`aria-hidden`) with text labels beside them; icon-only controls carry an
  `aria-label`.
- `prefers-reduced-motion` disables all animation globally, including Framer Motion.
- The caregiver side is denser on purpose — tables, counts, and timestamps — but
  never below 14px.

Both experiences are responsive: on `/senior` the companion and schedule sit side by
side from 1024px and stack (companion → schedule → conversation) below that.

## Data flow

```
components ──▶ lib/api.ts ──▶ /api/bff/*  ──▶ lib/server/live.ts ──▶ backend /api/*
     ▲                            │                                    (Prisma, OpenAI)
     │                            └─▶ lib/server/store.ts (in-memory demo data)
ElderCareProvider
```

**`lib/api.ts`** is the only module in the browser that makes a request. It exposes
the functions the spec calls for — `getSenior`, `getSchedule`, `getConversations`,
`sendMessage`, `createWellnessReport`, `getWellnessReports`, `getAlerts`,
`updateSchedule` — plus `submitWellnessCheck`, `acknowledgeAlert`,
`getKnowledgeBase`, `completeMeditation`, `resetDemo` and `requestAvatarSession`.
All of them return the domain types in `lib/types.ts`. No component fetches.

**`/api/bff/*`** is the UI's own API. Each route asks `lib/server/live.ts` for the
data and falls back to `lib/server/store.ts` when there is no live backend. This is
the boundary that keeps secrets server-side: the browser only ever talks to its own
origin.

**`lib/server/live.ts`** is the single place the backend's shapes are translated:

| Backend | UI |
| --- | --- |
| `activity`, `description`, `scheduledTime` (ISO) | `title`, `note`, `time` (`"HH:mm"`) |
| `UPCOMING` / `IN_PROGRESS` / `COMPLETED` / `SKIPPED` | `upcoming` / `in-progress` / `completed` / `missed` |
| one row per exchange (`userMessage` + `aiResponse`) | a `Conversation` with a `messages[]` thread, grouped by day |
| `AlertType` + `webhookStatus` | `Alert.type`, `severity`, `title`, `webhook{...}` |
| `{ error: { code, message } }` | `ApiError` with a sentence a caregiver can read |

It talks HTTP rather than importing `@/services/*` directly, for two reasons: the
backend's route contract is its public surface where its function signatures are
not, and the same code path works unchanged when the backend moves out of this app
(set `BACKEND_API_URL`).

**`ElderCareProvider`** (in the root layout) holds one copy of the senior, schedule,
conversations, alerts and wellness reports for the whole app. That is what makes the
demo's step 11 work: the alert raised on `/senior` is already in memory when the
presenter navigates to `/caregiver`, with no reload. Alerts also poll every 20s and
are mirrored into `localStorage`, so the dashboard is right even on a cold load.

**`useResource`** wraps every fetch and exposes the four states each screen must
handle — loading, error, empty, success — plus optimistic `mutate` and optional
polling. `ResourceView` renders them consistently: a skeleton, then
"Unable to load senior information." with a **Try Again** button, or an empty state,
or the content.

**`lib/localStorage.ts`** is a cache, never a source of truth. It holds the current
senior id, today's schedule progress, whether the meditation is done, the last 40
chat messages, UI preferences and the alerts seen so far. Schedule overrides are
day-scoped, so yesterday's ticks do not bleed into today. Nothing secret goes in it,
by rule and by comment.

## Components

`VirtualCompanion` is deliberately vendor-agnostic. It renders an illustrated
companion with idle / listening / thinking / speaking states, inside a container
whose only job is to be a stable mount point for something better.

## Plugging in HeyGen (or D-ID, or Simli)

Three steps, none of which touch a page or a component:

1. Set `HEYGEN_API_KEY` (and optionally `HEYGEN_AVATAR_ID`) server-side.
   `/api/bff/avatar/session` mints a short-lived streaming token and returns
   `{ configured: true, token }`. The key itself never leaves the server. Any
   failure returns `{ configured: false }` and the built-in companion keeps working.
2. Implement `AvatarProvider` / `AvatarSession` from `lib/avatar/types.ts` —
   `attach(container)`, `speak(text)`, `interrupt()`, `stop()`, `on(event)`.
   `lib/avatar/heygen.ts` is the scaffold, with the SDK call sites marked.
3. Register it once in a client entry point:

   ```ts
   import { registerAvatarProvider } from "@/lib/avatar/registry";
   import { heyGenProvider } from "@/lib/avatar/heygen";

   registerAvatarProvider(heyGenProvider);
   ```

`VirtualCompanion` asks the registry for a provider, asks the server for a session,
and attaches the provider's video into its container. If any of that is missing it
draws the illustrated companion instead — which is the same reason the whole app
falls back to demo data: a presentation should never depend on a third party.

Speech in and out uses the Web Speech API (`SpeechRecognition` for the microphone,
`speechSynthesis` for the companion's voice), both feature-detected after mount and
both optional — the typed conversation is always available.

## Deliberate deviations from the spec

- **Meditation is seeded as `upcoming`, not `completed`.** The spec's example
  schedule shows it complete, but demo steps 5–7 require completing it live and
  watching the status change. Wake Up and Breakfast are seeded `completed` so the
  schedule still looks like a morning in progress.
- **The caregiver's "Today's Activities" count is computed, not fixed.** It reads
  `{completed}/{total}` from the schedule rather than a hardcoded "6 / 8", so it
  stays truthful as the demo progresses.
- **`WebhookStatus` has a `simulated` state** the original type did not, because the
  backend has one. It is styled differently from `SENT` on purpose — see the
  security notes in the README.

## Known gaps

- `PATCH /api/schedule/:id`, profile writes, and alert acknowledgement do not exist
  on the backend yet. In live mode a status change is held in a server-side overlay
  (`lib/server/live.ts`) so the demo still works; delete that overlay when the
  endpoint ships.
- The backend models a smaller senior than the UI shows. Live mode leaves `city`
  and the family email blank rather than inventing them; display-only preferences
  such as the meditation length fall back to defaults.
- The knowledge base's "learned from conversations" list is demo-only. In live mode
  it is empty, because the backend does not extract facts yet and observations must
  not be presented as real.
- Live mode has been verified only for its fallback path — this machine has no
  Docker, so the mapping has not been run against a seeded Postgres.
