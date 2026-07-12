# API_CONVENTIONS.md

> How every response is shaped in code, regardless of endpoint. `../api-contract.md` defines *what* each endpoint returns (the payload); this file defines the *wrapper* every payload is poured into, plus status codes, validation-error formatting, and logging. Applies to both `core-api` and `chat-api`.

---

## Success envelope

```json
{
  "success": true,
  "data": { }
}
```

`data` holds exactly the payload shape defined for that endpoint in `api-contract.md` — an object or an array, never a bare top-level array or scalar. Lists use a `data` object with an `items` key plus pagination metadata if the endpoint is paginated:

```json
{
  "success": true,
  "data": {
    "items": [ ],
    "total": 42
  }
}
```

## Error envelope

```json
{
  "success": false,
  "error": {
    "code": "COOLDOWN_NOT_ELIGIBLE",
    "message": "You can donate again in 14 days.",
    "details": { }
  }
}
```

- `code` — a stable, UPPER_SNAKE_CASE string the mobile app can switch on. Not a copy of the HTTP status name.
- `message` — human-readable, safe to show directly in the UI.
- `details` — optional, only for structured extra context (e.g. Zod field errors). Omit the key entirely when there's nothing to add — don't send `"details": null`.

## HTTP status code mapping

| Situation | Status |
|---|---|
| Success (read or write) | `200` |
| Successful resource creation | `201` |
| Validation failure (Zod) | `400` |
| Missing/invalid JWT | `401` |
| Valid JWT, wrong role (`isOrganizer`/`isHospitalStaff` gate failed) | `403` |
| Resource not found | `404` |
| Business-rule conflict (e.g. already has an active booking, slot full, waitlist full, OTP purpose mismatch) | `409` |
| Rate limit exceeded | `429` |
| Unhandled server error | `500` |

Business-rule conflicts (`409`) are the most common miss — an agent's first instinct is often `400`. If the request was *well-formed* but rejected because of app state (cooldown, capacity, one-booking rule), that's `409`, not `400`. Reserve `400` for malformed/invalid input only.

## Validation error formatting

When `validate.ts` middleware catches a Zod failure, format `details` as a flat array, not Zod's nested `ZodError` shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      { "field": "bloodType", "message": "Required" }
    ]
  }
}
```

## Auth header

`Authorization: Bearer <jwt>` on every protected route. Both services verify against the same `JWT_SECRET` env var (set independently per service, per `decisions-log.md` A-topology notes) — there is no shared auth service to call.

## Rate limit response

On `429`, still use the standard error envelope:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests — try again shortly."
  }
}
```

## Health check

`GET /health` on both services, unauthenticated, used by Render to gate deploys (`decisions-log.md` C1–C3). Returns:

```json
{ "success": true, "data": { "status": "ok" } }
```

Return `200` only if the DB connection is actually alive — a `200` that doesn't check Prisma connectivity defeats the point of the health check.

## Logging (`pino`)

Log one structured line per request at minimum, including: method, path, status code, duration, and — if authenticated — the userId (never the JWT itself, never the raw password or OTP). Log service-layer business-rule rejections (409s) at `info`, not `error` — they're expected application flow, not failures. Reserve `error` level for unhandled exceptions and upstream failures (Dialogflow, Resend, R2, Neon connectivity).
