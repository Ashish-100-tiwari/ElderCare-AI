# ElderCare AI — Backend

Node + TypeScript + Next.js App Router route handlers, PostgreSQL via Prisma, OpenAI for the
companion. Everything runs inside this Next.js project — no second service, no CORS.

---

## 1. Setup

```bash
# 1. Secrets — DATABASE_URL is pre-filled for the docker-compose Postgres.
cp .env.example .env.local     # then paste your OPENAI_API_KEY

# 2. Database + schema + demo data (one command)
npm run setup

# 3. Run
npm run dev
```

`npm run setup` is `db:up` → `db:migrate` → `db:generate` → `db:seed`.

If you would rather use a hosted database (Neon, Supabase, Railway), skip `db:up` and put its
URL in `DATABASE_URL`, then:

```bash
npm run db:migrate && npm run db:generate && npm run db:seed
```

Check everything is wired up:

```bash
curl localhost:3000/api/health
# {"status":"ok","checks":{"database":true,"openaiConfigured":true,"familyWebhookConfigured":false},...}
```

### Scripts

| Script | What it does |
| --- | --- |
| `npm run setup` | Postgres container, migrate, generate, seed |
| `npm run db:up` / `db:down` | Start / stop local Postgres |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Load the demo senior + today's schedule (idempotent) |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm run db:studio` | Browse the data |
| `npm run test` | Unit tests — no database or API key needed |
| `npm run typecheck` | `tsc --noEmit` |

### Environment variables

All server-side. **None is `NEXT_PUBLIC_`**, and `src/lib/env.ts` / `src/lib/prisma.ts` /
`src/services/openaiService.ts` all start with `import "server-only"`, so importing them from a
client component is a build error rather than a leaked key.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `OPENAI_API_KEY` | for `/api/chat` | Other endpoints work without it |
| `FAMILY_WEBHOOK_URL` | no | Empty ⇒ alerts are recorded `SIMULATED`, never failed |
| `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini` |

---

## 2. API

Base URL `http://localhost:3000`.

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/seniors/:id` | Senior profile |
| GET | `/api/seniors/:id/schedule` | Today's schedule |
| PATCH | `/api/schedule/:id` | Update an activity's status |
| GET | `/api/seniors/:id/conversations` | Recent conversations (`?limit=`) |
| GET | `/api/seniors/:id/wellness` | Wellness reports (`?limit=`) |
| GET | `/api/seniors/:id/alerts` | Alerts (`?limit=`) |
| POST | `/api/chat` | Companion reply + wellness detection |
| POST | `/api/wellness` | Record a concern directly |
| GET | `/api/caregiver/:seniorId/dashboard` | Everything the dashboard needs, one call |
| GET | `/api/health` | Readiness booleans |

### POST /api/chat

```jsonc
// request
{ "seniorId": "senior-001", "message": "My leg feels uncomfortable." }

// response
{
  "response": "I'm sorry your leg is uncomfortable, Rajesh ji…",
  "wellnessAlert": true,
  "alertId": "clx…",
  "webhookStatus": "SIMULATED",
  "conversationId": "clx…"
}
```

`webhookStatus` is `SENT` when `FAMILY_WEBHOOK_URL` points somewhere real, `SIMULATED` when it is
unset, `FAILED` if the receiver rejected or timed out. `alertId` and `webhookStatus` are `null`
when no concern was detected.

### Errors

Uniform shape, never a stack trace or a credential:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "message must not be empty.", "details": { "message": ["…"] } } }
```

| Status | When |
| --- | --- |
| 400 | Malformed JSON, missing/empty `message`, bad `seniorId`, unknown `status`, unexpected body keys |
| 404 | Senior or schedule item not found |
| 405 | Wrong method |
| 503 | Database unreachable, OpenAI unavailable, or a required env var missing |
| 500 | Anything unexpected (generic message only) |

---

## 3. Layout

```
prisma/
  schema.prisma              5 models, 4 enums
  migrations/0_init/         baseline SQL
  seed.ts                    Rajesh Sharma + today's 8 activities
prisma.config.ts             Prisma 7 config (connection URL + seed command)
src/lib/
  env.ts                     server-only, lazy, never echoes a value
  prisma.ts                  PrismaClient singleton (pg driver adapter)
  validation.ts              zod schemas — strict objects
  http.ts                    ApiError, handleRoute, JSON body parsing
  logger.ts                  structured JSON logs with redaction
  sanitize.ts                control/zero-width character stripping
  serializers.ts             public vs caregiver views of a senior
  date.ts                    "today" window
src/services/
  knowledgeBaseService.ts    getSeniorContext() — the only thing the model sees
  wellnessRules.ts           pure detection rules (unit-tested)
  wellnessService.ts         detection + report/alert/webhook persistence
  webhookService.ts          sendFamilyAlert()
  openaiService.ts           the only module holding the API key
  systemPrompt.ts            the companion's rules + CONTEXT builder
  chatService.ts             the /api/chat flow end to end
  seniorService.ts           scoped reads and the schedule update
  caregiverService.ts        the aggregated dashboard
tests/                       run with `npm run test`
```

---

## 4. Design notes

**Wellness detection never trusts the client.** Request schemas are strict zod objects accepting
only `seniorId` and `message`, so a client cannot post `wellnessAlert: true` or `severity: "HIGH"`
— the extra key is a 400. The backend derives the category and severity itself from the message
text, so `/api/chat` and `/api/wellness` can never disagree.

**Two detection layers.** `wellnessRules.ts` is deterministic keyword and phrase matching:
instant, free, and identical on every run, which is what makes it safe to demo. It handles
negation ("my leg does *not* hurt" → no alert) while still catching "I don't feel well", and
includes Hindi/Hinglish terms (`dard`, `chakkar`, `bukhar`, `tabiyat theek nahi`). A set of
critical phrases — trouble breathing, chest pressure, fainting, a fall, bleeding — raises HIGH on
its own and cannot be softened by "a little". They are phrases rather than bare words so that a
meditation app hearing "let's do some deep breathing" does not alarm anyone's family. The model
classifier is layer two, consulted only when the rules find nothing *and* the sentence looks like
it is about how the senior feels — so "Good morning!" costs no API call. If it fails for any
reason, the result is "no concern", never a broken conversation.

**Nothing here diagnoses.** The stored `message` is always the senior's own sentence. `category`
is a routing label for the family; `severity` is how quickly a human should look. The system
prompt forbids naming conditions or medications, and the classifier prompt explicitly asks for
neither a cause nor a condition.

**Alerts survive webhook problems.** The report and the alert are written in one transaction, so a
caregiver never sees an alert with no report behind it. The webhook is sent *outside* that
transaction — a slow third party must not hold a database lock — and its outcome is written back
to `alert.webhookStatus` afterwards. A missing URL is `SIMULATED`, a rejection or timeout is
`FAILED`; the wellness report is never deleted either way.

**Safety is not downstream of the chat completion.** In `/api/chat`, the model call and wellness
detection run concurrently. Besides saving a round trip, this means that if OpenAI is down when
someone reports chest pain, the family alert still goes out — the request then returns 503 for the
reply, with the alert already delivered.

**Two views of a senior.** `publicSenior` (companion app) omits the family phone number;
`caregiverSenior` includes it. Neither ever returns `familyWebhookUrl` — that is delivery
infrastructure, not profile data. The dashboard gets a `webhookConfigured` boolean instead.

**Logs are structured and redacted.** One JSON line per event (`chat.request`, `wellness.detected`,
`alert.created`, `webhook.result`, `db.error`, …). Every field passes through a redactor that drops
anything whose key looks like a credential and rewrites anything shaped like an API key or a
connection string. Message text is logged as a length plus a short preview — full health
complaints belong in the database, not in stdout.

**Timezone.** The seed writes schedule times in the server's local timezone and the "today"
queries read them back the same way, so they always agree without a timezone library. Set `TZ`
(e.g. `TZ=Asia/Kolkata`) if you deploy somewhere on UTC.

**`openAlerts`.** The MVP `Alert` model has no resolved flag, so the dashboard counts alerts
raised today — the set a caregiver still needs to look at.

---

## 5. Demo flow

```bash
npm run db:reset          # fresh Rajesh + today's schedule
npm run dev
```

Optional, to see a real `SENT`: grab a URL from https://webhook.site, put it in
`FAMILY_WEBHOOK_URL`, and restart.

```bash
# 1. Profile
curl localhost:3000/api/seniors/senior-001

# 2. Today's schedule
curl localhost:3000/api/seniors/senior-001/schedule

# 3. The scenario
curl -X POST localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"seniorId":"senior-001","message":"My leg feels uncomfortable."}'
# → { "response": "…", "wellnessAlert": true, "alertId": "…", "webhookStatus": "SENT" }

# 4. The caregiver sees it immediately
curl localhost:3000/api/caregiver/senior-001/dashboard
```

The server log for step 3 reads as one story:

```
{"level":"info","event":"chat.request","seniorId":"senior-001",…}
{"level":"info","event":"wellness.detected","category":"DISCOMFORT","severity":"MEDIUM","source":"rules",…}
{"level":"info","event":"wellness.report_created",…}
{"level":"info","event":"alert.created","type":"DISCOMFORT_REPORTED",…}
{"level":"info","event":"webhook.result","status":"SENT","httpStatus":200,…}
{"level":"info","event":"chat.response","wellnessAlert":true,…}
```

Things worth demonstrating deliberately:

```bash
# Backend decides wellness, not the client — extra keys are rejected
curl -X POST localhost:3000/api/chat -H 'Content-Type: application/json' \
  -d '{"seniorId":"senior-001","message":"Hello","wellnessAlert":true}'   # 400

# Negation does not raise an alert
curl -X POST localhost:3000/api/wellness -H 'Content-Type: application/json' \
  -d '{"seniorId":"senior-001","message":"My leg does not hurt today."}'  # wellnessAlert: false

# A critical phrase escalates to HIGH
curl -X POST localhost:3000/api/wellness -H 'Content-Type: application/json' \
  -d '{"seniorId":"senior-001","message":"I am having trouble breathing."}'  # severity: HIGH

# Unknown senior / malformed JSON
curl localhost:3000/api/seniors/nope                                      # 404
curl -X POST localhost:3000/api/chat -H 'Content-Type: application/json' -d '{'  # 400
```

---

## 6. Tests

```bash
npm run test       # 70 tests, no database or API key required
```

- **Detection** (`wellnessRules.test.ts`) — the brief's examples, benign chat, negation, categories,
  severity, Hindi/Hinglish, critical phrases, and the meditation false-positive guard.
- **Webhook** (`webhookService.test.ts`) — `SIMULATED` / `SENT` / `FAILED` against a real throwaway
  HTTP server, per-senior URL override, payload shape, non-HTTP protocol refusal, timeout.
- **Validation and errors** (`api.test.ts`) — strict schemas reject a client-supplied
  `wellnessAlert` or `severity`, malformed JSON is a 400, and an unexpected error never leaks a
  connection string, a credential or a stack trace.

The database-backed paths are exercised by the curl flow above.
