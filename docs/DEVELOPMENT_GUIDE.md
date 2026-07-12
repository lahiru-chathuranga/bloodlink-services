# DEVELOPMENT_GUIDE.md

> Local dev and deployment mechanics for both services. For *why* Render/Neon/Docker Compose were chosen this way, see `../decisions-log.md`.

---

## Local development

Both services run together via `docker-compose.yml` at the repo root — **local dev only**, Render never reads this file.

```bash
# from bloodlink-backend/
docker compose up --build
```

This starts `core-api` and `chat-api` on a shared bridge network so you can develop against both at once. Each service still connects to the same **cloud Neon database** (not a local Postgres container) — there is no local-Postgres path in this repo; Neon is used for dev and demo alike.

Running a single service without Compose, from inside its folder:

```bash
cd core-api    # or chat-api
npm install
npm run dev
```

## Environment variables

Set these per service (values live in each service's `.env`, or Render's dashboard in production — **never commit actual values**):

**`core-api/.env`**
```
DATABASE_URL=
JWT_SECRET=
RESEND_API_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
PORT=
```

**`chat-api/.env`**
```
DATABASE_URL=
JWT_SECRET=
DIALOGFLOW_PROJECT_ID=
DIALOGFLOW_CREDENTIALS_JSON=
PORT=
```

`JWT_SECRET` must be the **same value** in both services — that's what lets either service verify a token issued by `core-api`'s auth flow without a shared auth service.

## Prisma workflow

Each service has its own `prisma/schema.prisma`, scoped to the tables it owns (see `ARCHITECTURE.md`).

**`core-api`** — the primary owner of the shared database's default (`public`) schema, uses the standard migration workflow:

```bash
# after changing schema.prisma, inside core-api/
npx prisma migrate dev --name <short_description>   # local/dev: creates + applies a migration
npx prisma generate                                  # regenerate the typed client
npx prisma studio                                     # inspect data visually
```

For production (Render build step):

```bash
npx prisma migrate deploy
```

Never run `migrate dev` against the production database — it's designed for local iteration and will prompt destructively in ways `migrate deploy` won't.

**`chat-api`** — uses `prisma db push` instead, **never** `migrate dev`/`migrate deploy`:

```bash
npx prisma db push
npx prisma generate
```

Why the difference (decisions-log.md B5): both services point at the same Neon database, but `chat-api`'s `ChatbotMessage` table lives in its own Postgres schema (`chat`, via Prisma's `multiSchema` feature) rather than `public`, since Prisma's `migrate` family reconciles against the *entire* target schema — pointed at `public`, it would try to drop every `core-api` table `chat-api` doesn't declare, the first time it runs. `db push` scoped to the `chat` schema has no such collision and needs no migration-history bookkeeping for a single-model service. If `chat-api`'s schema ever grows complex enough to want real migration history, revisit this — the `chat` schema separation itself should still be kept regardless.

## Deploying (Render)

Each service is set up **once**, in the Render dashboard, then every `git push` deploys automatically:

1. New → Web Service → connect the GitHub repo.
2. **Root Directory**: `core-api` (repeat setup separately for `chat-api`).
3. **Environment**: Docker — Render builds from that folder's `Dockerfile`.
4. **Instance Type**: Free.
5. **Environment Variables**: enter the values listed above for that service.
6. **Health Check Path**: `/health`.

After setup, the pipeline is: commit → `git push` → Render detects the change in that service's Root Directory → builds its `Dockerfile` → waits for `/health` to return `200` → zero-downtime rollout. A broken deploy never takes the live service down, because Render won't route traffic to an instance that fails its health check.

### Must-not-skip details

- The app **must** bind to `process.env.PORT`, not a hardcoded port — see `decisions-log.md` C3. This is the most common reason a build succeeds but the deploy still fails health checks.
- No inbound port/security-group configuration is needed or possible on Render's free tier — don't look for it.
- Both services are directly public; there is no shared reverse proxy to configure (`decisions-log.md` A4, H3).

### Demo-day timing

Free-tier services spin down after 15 minutes idle and take 30–60s to cold-start on the next request. Hit both `/health` URLs a minute or two before presenting so neither service is cold when you demo.

## Adding a new environment variable

1. Add it to the relevant service's `.env.example` (committed, no real value) so the next person/agent knows it exists.
2. Add it in Render's dashboard for that service.
3. Read it through `config/env.ts` (see `ARCHITECTURE.md`) — never `process.env.X` scattered through the codebase, so a missing var fails loudly at boot instead of silently at first use.
