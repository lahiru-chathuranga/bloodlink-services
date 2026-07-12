# ARCHITECTURE.md

> Folder structure and layering rules for the BloodLink backend. This file covers **structure and mechanics only** — for *why* a service/library/hosting choice was made, see `../decisions-log.md`; for schema, see `../data-model.md`; for endpoint payloads, see `../api-contract.md`; for step-by-step "how do I add a route," see `ENDPOINT_GUIDE.md`.

---

## Two services, one repo

```
bloodlink-backend/
├── docker-compose.yml     # local dev only — Render never reads this
├── core-api/
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma  # owns: user, otp, drive, slot, booking, waitlist,
│   │                      #        urgentRequest, donation
│   └── src/
└── chat-api/
    ├── Dockerfile
    ├── package.json
    ├── prisma/
    │   └── schema.prisma  # owns: chatbotMessage only
    └── src/
```

`core-api` and `chat-api` are **independently deployable** — separate `package.json`, separate `Dockerfile`, separate Render Web Service, separate Root Directory. They connect to the same Neon Postgres database (see `decisions-log.md` B1) but each Prisma schema only defines the models that service is allowed to touch. **Never import or query a table outside a service's own ownership list above, even though the DB technically allows it.**

No `eligibility` table exists, and `core-api` has no eligibility route/controller/service — the F4 MCQ is validated entirely client-side (`requirements.md` decision #30, `data-model.md` §6). Don't add one back without checking that decision first.

Services **never call each other at runtime** (`decisions-log.md` A3). If a task seems to need `chat-api` to read something from `core-api`'s tables, that's a signal to re-read the requirements — it almost certainly doesn't, since the chatbot is general-FAQ only.

---

## Internal layout — `core-api/src/`

```
core-api/src/
├── index.ts                # boots the HTTP server, binds process.env.PORT
├── app.ts                  # Express app assembly: middleware, route mounting
├── config/
│   └── env.ts               # reads & validates process.env once, exports typed config
├── routes/                  # one file per resource, thin — no logic
│   ├── auth.routes.ts
│   ├── users.routes.ts
│   ├── drives.routes.ts      # also owns all /organizer/drives* routes, per api-contract.md §5
│   ├── bookings.routes.ts
│   ├── urgent-requests.routes.ts  # also owns GET /staff/donors, per api-contract.md §5
│   ├── donations.routes.ts
│   ├── reference.routes.ts   # GET /reference/cities — addendum, api-contract.md §5/C4
│   ├── admin.routes.ts       # POST /admin/staff-invite, POST /admin/staff/:id — addendum, api-contract.md §5/C4
│   └── home.routes.ts        # GET /home/feed — optional standalone file; may instead be folded into users.routes.ts, per api-contract.md §5
├── controllers/              # one file per resource, matches routes/ 1:1
│   ├── auth.controller.ts
│   ├── users.controller.ts
│   ├── drives.controller.ts
│   ├── bookings.controller.ts
│   ├── urgent-requests.controller.ts
│   ├── donations.controller.ts
│   ├── reference.controller.ts
│   └── admin.controller.ts
├── services/                 # business logic + Prisma calls live here, nowhere else
│   ├── auth.service.ts
│   ├── users.service.ts
│   ├── drives.service.ts
│   ├── bookings.service.ts   # one-active-booking rule, cooldown-vs-slot-date live here
│   ├── urgent-requests.service.ts
│   ├── donations.service.ts
│   ├── reference.service.ts
│   └── admin.service.ts
├── middleware/
│   ├── require-auth.ts       # verifies JWT
│   ├── require-organizer.ts  # gate on isOrganizer
│   ├── require-hospital-staff.ts  # gate on isHospitalStaff
│   ├── require-admin-secret.ts    # gates /admin/* on X-Admin-Secret, not JWT — api-contract.md §3/§5
│   ├── rate-limit.ts
│   ├── error-handler.ts      # formats thrown errors per API_CONVENTIONS.md
│   └── validate.ts           # generic Zod-schema-validation middleware
├── schemas/                  # Zod request schemas, one file per resource
│   ├── auth.schema.ts
│   ├── drives.schema.ts
│   ├── bookings.schema.ts
│   └── ...
├── lib/
│   ├── prisma.ts             # single shared PrismaClient instance
│   ├── mailer.ts             # Nodemailer + Resend SMTP transport
│   ├── otp-templates.ts      # the three purpose-keyed email templates
│   ├── qr.ts                 # QR identifier generation (qrcode)
│   ├── haversine.ts          # distance calc for city-proximity queries
│   └── logger.ts             # pino instance
└── prisma/
    └── schema.prisma
```

## Internal layout — `chat-api/src/`

A much thinner slice of the same shape — one resource, one external dependency:

```
chat-api/src/
├── index.ts
├── app.ts
├── config/
│   └── env.ts
├── routes/
│   └── chat.routes.ts
├── controllers/
│   └── chat.controller.ts
├── services/
│   └── chat.service.ts       # forwards message to Dialogflow, persists history
├── middleware/
│   ├── require-auth.ts       # same JWT verification as core-api (shared JWT_SECRET)
│   ├── rate-limit.ts
│   └── error-handler.ts
├── schemas/
│   └── chat.schema.ts
├── lib/
│   ├── prisma.ts
│   ├── dialogflow.ts          # Dialogflow ES client wrapper
│   └── logger.ts
└── prisma/
    └── schema.prisma          # chatbotMessage model only
```

---

## Layering rule (applies to both services)

Request flow is always: **route → middleware → controller → service → Prisma**.

- **`routes/`** — declares the path, HTTP method, and which middleware/controller handles it. No logic, no Prisma calls, no business rules. If a route file is doing anything besides wiring, it's misplaced.
- **`middleware/`** — cross-cutting concerns only: auth, role gates, rate limiting, request validation, error formatting. Never resource-specific business logic.
- **`controllers/`** — parses/validates the request (via the `schemas/` Zod schema + `validate.ts` middleware), calls exactly one service function, shapes the service's result into the response envelope (`API_CONVENTIONS.md`). Controllers do not talk to Prisma directly and do not contain business rules — they orchestrate.
- **`services/`** — all business logic and all Prisma calls live here. This is where invariants from `decisions-log.md` and `requirement.md`'s decisions log get enforced (one-active-booking-system-wide, cooldown-vs-slot-date, waitlist max 10 per-drive, OTP purpose matching, etc.). A controller should never need to re-derive one of these rules — if it's checking business state, that check belongs in a service function instead.
- **`lib/`** — stateless helpers and third-party client wrappers (Prisma client singleton, mailer, QR gen, Dialogflow client, logger). No Express-specific code here — these should be usable/testable outside the HTTP layer.

## File naming convention

- One file per resource per layer: `{resource}.routes.ts`, `{resource}.controller.ts`, `{resource}.service.ts`, `{resource}.schema.ts` — kept in sync 1:1 so any agent can find the matching file across layers instantly.
- Resource names match `data-model.md` table names (`drives`, `bookings`, `urgent-requests`, not synonyms).
- No barrel/`index.ts` re-export files inside `routes/`, `controllers/`, `services/`, `schemas/`, or `lib/` — import the exact file, same rule the mobile repo follows.

## Stack (what — see `decisions-log.md` section D for why)

| Layer | Library |
|---|---|
| Runtime | Node.js 20/22 LTS |
| Framework | Express |
| Validation | Zod |
| ORM | Prisma |
| Auth | `jsonwebtoken` + `bcryptjs` |
| Email | Nodemailer → Resend SMTP relay |
| QR generation | `qrcode` (server-side, at registration only) |
| Logging | `pino` |
| Config | `dotenv` |
