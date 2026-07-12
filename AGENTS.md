# Agent Instructions

Before writing any code in `core-api/` or `chat-api/`, read the relevant guides below for your task — **root docs first, then local docs**. Root `../docs/` defines *what* to build (the contract shared with `bloodlink-mobile`); local `docs/` defines *how this codebase is organized* to build it. Skipping the root docs is the most common way an endpoint gets built that doesn't match what the mobile app actually calls.

## Root docs (`../docs/`) — read first

| File | Read when |
| --- | --- |
| [`../docs/api-contract.md`](../docs/api-contract.md) | Before implementing, modifying, or even discussing any endpoint. The exact request/response shape, auth requirement, and every documented `409`/error reason for every route this service owns. If an endpoint isn't listed there, add it there first — don't write the route from memory of what "seems right." |
| [`../docs/data-model.md`](../docs/data-model.md) | Before touching `prisma/schema.prisma`, writing a migration, or referencing any field name in a service function. The single source of truth for every table, enum, and encryption rule — includes the two-layer enforcement pattern for the one-confirmed-booking invariant and why `BloodType` can't be a native Prisma enum. |
| [`../docs/decisions-log.md`](../docs/decisions-log.md) | Before adding a dependency, a new service, or changing how the two services talk to Neon/each other. Check here before assuming an infra choice is up for debate — most already have a documented rationale. |
| [`../docs/requirements.md`](../docs/requirements.md) | Before implementing business logic whose exact rule isn't obvious from the contract alone (e.g. why cooldown checks the slot's date, not today). The product-level decisions log at the end is the fastest way to check if an ambiguity is already resolved. |
| [`../docs/cities.md`](../docs/cities.md) | Before writing or touching the `City` seed script, or any Haversine/proximity query. Verified coordinates, the seed-by-slug ID convention correction, and the reference SQL/JS distance formula. |
| [`../docs/userflow.md`](../docs/userflow.md) | Before implementing an endpoint whose *purpose* is unclear from `api-contract.md` alone — §5's screen specs explain which mobile screen calls it and why, which is often the fastest way to understand an endpoint's edge cases. |
| [`../docs/eligibility-questions.md`](../docs/eligibility-questions.md) | Only if the team has explicitly adopted the 10-question eligibility set — and even then, this is a `bloodlink-mobile` concern, not `core-api`'s: the eligibility MCQ is validated entirely client-side (`requirements.md` decision #30), so `core-api` has no eligibility route/controller/service to build against this file at all. |

## Local docs (`docs/`) — read second

| File | Read when |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Before creating any file or folder in `core-api/` or `chat-api/`. The two-service repo layout, per-service internal folder structure (`routes/` → `controllers/` → `services/` → `middleware/`/`schemas/`/`lib/`), the layering rule (routes thin, business logic only in `services/`), and the file-naming convention (one file per resource per layer, no barrels). |
| [`docs/ENDPOINT_GUIDE.md`](docs/ENDPOINT_GUIDE.md) | Before adding or modifying any single endpoint. The step-by-step recipe — schema → route → controller → service → response — plus the Definition of Done checklist. This is the file that tells you to check `../docs/api-contract.md` and `../docs/decisions-log.md` before writing the service function, so re-read it if you're tempted to skip that step. |
| [`docs/API_CONVENTIONS.md`](docs/API_CONVENTIONS.md) | Before writing any response, error, or logging code. The success/error envelope shape, HTTP status code mapping (including the `409`-vs-`400` distinction for business-rule conflicts), Zod validation-error formatting, and `pino` logging conventions. This is the *wrapper* every payload goes in — the payload contents themselves are `../docs/api-contract.md`'s job, not this file's. |
| [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md) | Before running either service locally, adding an env var, or deploying. `docker-compose` local dev, the Prisma `migrate dev` vs. `migrate deploy` distinction, per-service env var lists, and the Render setup/deploy steps including the `process.env.PORT` binding requirement that's the most common cause of a build succeeding but the deploy failing. |

## Read Order for the Most Common Task: Adding a New Endpoint

1. `../docs/api-contract.md` — does it exist? If not, add it there first.
2. `../docs/data-model.md` — confirm every field name/type/enum involved.
3. `../docs/decisions-log.md` + `../docs/requirements.md`'s decisions log — any invariant that applies (booking rules, OTP purpose matching, etc.)?
4. `docs/ENDPOINT_GUIDE.md` — follow the schema → route → controller → service → response recipe.
5. `docs/API_CONVENTIONS.md` — confirm the response envelope and status code are correct before considering it done.
