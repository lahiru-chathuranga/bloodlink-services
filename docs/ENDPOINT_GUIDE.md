# ENDPOINT_GUIDE.md

> The recipe for adding **one new endpoint** to `core-api` or `chat-api`. Follow this order every time — it keeps every endpoint shaped the same way and stops logic from leaking into the wrong layer. Before step 1, always check `../api-contract.md` (what this endpoint must accept/return) and `../decisions-log.md` + `requirement.md`'s decisions log (what invariants apply) — **do not invent either from memory.**

---

## 0. Before writing any code

- [ ] Find this endpoint in `../api-contract.md`. If it isn't there, stop and add it there first — the contract is the source of truth, not the code.
- [ ] Check `../data-model.md` for the exact field names/types/enums involved. Don't guess a field name.
- [ ] Check `../decisions-log.md` and `requirement.md`'s decisions log for any invariant that touches this endpoint (e.g. booking endpoints → one-active-booking-system-wide + cooldown-vs-slot-date; OTP endpoints → purpose matching; urgent request endpoints → hospital name required).

## 1. Schema — `schemas/{resource}.schema.ts`

Define the Zod schema for the request body/params/query first. This is the single place validation rules live — controllers and the mobile app's form validation both derive from this shape (mobile mirrors the shape manually, per the mobile repo's own convention; there is no shared npm package).

## 2. Route — `routes/{resource}.routes.ts`

Wire the path, HTTP method, and middleware chain, in this order:

```
router.post(
  "/drives/:id/bookings",
  requireAuth,              // 1. JWT must be valid
  requireOrganizer,         // 2. role gate, only if this endpoint needs one — omit otherwise
  validate(bookingSchema),  // 3. Zod validation
  bookingsController.create // 4. controller, last
);
```

Only add a role-gate middleware (`requireOrganizer` / `requireHospitalStaff`) if `api-contract.md` says this endpoint is restricted — don't add one speculatively, and don't skip one the contract requires.

## 3. Controller — `controllers/{resource}.controller.ts`

- Read the already-validated body from `req.body` (validation happened in middleware — don't re-validate).
- Call **one** service function. If a controller is calling two or more service functions to accomplish one endpoint, that's usually a sign the service function is scoped wrong — fix the service layer, don't compose logic in the controller.
- Wrap the service's return value in the standard response envelope from `API_CONVENTIONS.md`.
- Do not catch errors here for formatting — let them propagate to `middleware/error-handler.ts`, which owns error-response shaping.

## 4. Service — `services/{resource}.service.ts`

This is where the endpoint actually does its work:

- All Prisma calls happen here, not in the controller.
- All business-rule checks happen here — pull the exact rule from `decisions-log.md` / `requirement.md`'s decisions log rather than re-deriving it. Example: a new "reschedule booking" endpoint still has to enforce one-active-booking-system-wide and cooldown-vs-slot-date, even though neither rule is specific to "reschedule" — check the log, don't assume the existing `create` service function's checks are the only ones that apply.
- Throw typed errors (not raw strings) for anything the error-handler needs to map to a specific HTTP status — see `API_CONVENTIONS.md` for the status-code table.

## 5. Response

Confirm the shape returned matches `../api-contract.md` exactly — field names, nesting, and null-handling. If the contract and what the service naturally returns don't match, reshape in the controller; don't change the contract to match the code without updating `api-contract.md` in the same change.

---

## Definition of done

- [ ] Matches `api-contract.md` request/response shape exactly.
- [ ] Field names/enums match `data-model.md`.
- [ ] Any relevant invariant from `decisions-log.md` / `requirement.md`'s decisions log is enforced in the **service** layer.
- [ ] Correct middleware chain (auth, role gate if applicable, validation).
- [ ] Errors use the shared error-handler / envelope from `API_CONVENTIONS.md`, not ad-hoc `res.status().json()` calls.
- [ ] No Prisma calls outside `services/`.
- [ ] No new file added to `routes/`, `controllers/`, `services/`, or `schemas/` without its matching counterpart in the other three (see `ARCHITECTURE.md` naming convention).
