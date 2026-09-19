# ElderCare AI

A GenAI daily companion for senior citizens, and a dashboard for the family member
who looks after them.

Two experiences, one app:

- **`/senior`** — a friendly virtual companion Rajesh can talk to, his schedule for
  the day, a guided meditation, and gentle reminders. Large type, large buttons,
  high contrast, almost no navigation.
- **`/caregiver`** — his profile, schedule, knowledge base, conversation
  transcripts, wellness reports, and discomfort alerts, each showing whether the
  family webhook notification actually went out.

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. That is the whole setup — **no database, no API key, no
configuration**. With nothing configured the app serves a complete, self-consistent
demo from an in-memory store, so the presentation can never be broken by a missing
service. See [Connecting the real backend](#connecting-the-real-backend) to switch
on live data.

## The demo, in order

1. Open **`/senior`** — Rajesh's name, age, city and language are on screen.
2. The companion greets him by name and says what is next on his day (out loud, if
   the browser allows speech).
3. **Today's Schedule** is beside the companion on a laptop, below it on a phone.
4. Press **Start Meditation** → `/senior/meditation`.
5. Follow the breathing circle. Press **Finish** (or sit through the full ten
   minutes) to complete the session.
6. Meditation flips to **Completed** on the schedule, on both screens.
7. Back on `/senior`, press **Talk to Me**.
8. Type (or say) **"My leg feels uncomfortable."**
9. The companion answers with care, records what was said, and tells him his family
   will be told. It never diagnoses anything.
10. A **Wellness Alert** appears under the conversation, showing `WEBHOOK: SENT`.
11. Open **`/caregiver`** — the new alert is already at the top, no reload needed.
12. The alert card shows the words Rajesh used, the time, and the webhook status.

`/caregiver` → **Reset demo** puts everything back to the top of the script.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Choose senior or caregiver |
| `/senior` | Companion + today's schedule + conversation |
| `/senior/meditation` | Guided breathing session |
| `/senior/schedule` | The full day, large format |
| `/senior/profile` | "About me", read-only and reassuring |
| `/caregiver` | Alerts, wellness reports, today at a glance |
| `/caregiver/conversations` | Full transcripts |
| `/caregiver/knowledge-base` | What the companion knows, and where it learned it |
| `/caregiver/profile` | Editable profile, routine and family contact |

## How it is built

Next.js 16 App Router, TypeScript, Tailwind CSS v4, Lucide icons, Framer Motion.
No UI framework. Details, including how to plug in a real-time avatar, are in
[`docs/frontend-architecture.md`](docs/frontend-architecture.md).

```
src/
  app/senior, app/caregiver   screens
  app/api/bff/*               the UI's own API — domain shapes, no secrets
  app/api/*                   the backend (Prisma + OpenAI), see below
  components/                 VirtualCompanion, ConversationPanel, DailySchedule,
                              AlertPanel, and the small ui/ kit they share
  lib/api.ts                  the only place the browser makes a request
  lib/types.ts                Senior, ScheduleItem, Conversation, WellnessReport, Alert
  lib/server/live.ts          maps live backend shapes onto those types
  lib/server/store.ts         the in-memory demo data
  lib/localStorage.ts         cache for schedule progress, chat, preferences
```

## Connecting the real backend

The backend lives in this same app: `/api/chat`, `/api/seniors/:id/...`, Prisma,
Postgres, OpenAI. The UI does not call it directly — it calls its own
`/api/bff/*` routes, which map the backend's database shapes onto the UI's domain
types server-side. One place to change, no component touched.

```bash
cp .env.example .env.local     # fill in DATABASE_URL and OPENAI_API_KEY
npm run setup                  # docker compose up, migrate, generate, seed
ELDERCARE_LIVE_API=1 npm run dev
```

Check `GET /api/health` for what is actually reachable. If the backend is
unavailable for any reason, each `/api/bff/*` route logs why and serves demo data
instead, so the demo continues either way.

## Security

- **No secret ever reaches the browser.** No `NEXT_PUBLIC_*` variable holds one,
  and nothing sensitive goes in `localStorage` — it caches schedule progress, the
  current chat and UI preferences, nothing more.
- **The frontend never calls OpenAI.** It calls `/api/bff/*` on its own origin;
  the model call happens in the backend, which owns the key.
- **The family webhook URL is never exposed.** The UI shows a status
  (`SENT` / `SIMULATED` / `PENDING` / `FAILED`) and a label, never an endpoint.
  `SIMULATED` is deliberately styled differently from `SENT`: it means the alert
  was recorded but no webhook was configured, and a caregiver must never believe a
  notification went out when it did not.
- **No medical diagnosis, anywhere.** The companion acknowledges what it is told,
  records it verbatim, and escalates to the family. Wellness reports quote the
  senior and add no interpretation.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Backend unit tests |
| `npm run setup` | Database up, migrated, generated, seeded |
