# CGOPS Platform Security & Identity Audit

_Prepared: 2026-07-01_

## Scope & method

This audits CGOPS Dashboard against its intended future as the **authentication,
authorization, application-launcher, and integration hub** for the CG platform —
the identity/permission provider that Weekly Summary, Product Center, People,
Purchasing, Beverage, Finance, Marketing, etc. will trust.

**Source reviewed:** the CGOPS snapshot committed to this repo as
`CG_Dashboard-main.zip` (project date 2026-05-04): `src/lib/*`,
`src/components/*`, all `supabase/functions/*`, and all `supabase/migrations/*`.

**Important caveat — some posture lives outside the repo.** Supabase Edge
Function JWT-verification (`verify_jwt`), platform secrets, storage buckets, PITR
/ backup settings, network restrictions, and CI configuration are set in the
Supabase and GitHub dashboards, not in this snapshot (there is no
`supabase/config.toml`, `.env`, or `.github/` in the archive). Where a finding
depends on that out-of-repo config, it is flagged **[verify in console]**. The
code-level evidence is strong enough that the conclusion does not hinge on it.

Credentials found in source are **redacted** here and flagged for rotation rather
than reproduced.

---

## Headline verdict

> **Is CGOPS ready to become the authentication and permissions provider for the
> CG application ecosystem?**
>
> **No — not in its current state.** CGOPS today has **no real authentication
> system to extend to anyone.** It does not use Supabase Auth; it runs every
> query through the **public anonymous key**, authenticates users by reading a
> **plaintext PIN** out of an **anon-readable `users` table**, and keeps "sessions"
> as unsigned JSON in `localStorage`. Authorization (roles/permissions) is
> enforced **only in the React UI** — the database is wide open to the anon role,
> so any check can be bypassed by calling the API directly. There are **no
> verifiable identity tokens** for another app to trust, and no server-side
> authorization to delegate.
>
> Becoming the platform IdP is the **right destination**, but it requires
> **building the authentication/authorization layer that does not yet exist**,
> plus remediating several critical data-exposure issues first. This is
> foundational work, not a configuration tweak. The roadmap in §13 sequences it.

---

## Severity summary

| Severity | Count | Themes |
|---|---|---|
| **Critical** | 5 | Anon-readable plaintext PINs; anon write to `users`/`roles`/`permissions`; no real auth (anon key for everything); client-side-only authorization; unauthenticated service-role webhook |
| **High** | 6 | Committed admin credential; PII (`guest_feedback`) world-readable/writable; `raw_emails` anon read/write; no edge-function caller validation; CORS `*` on all functions; no location-level data isolation |
| **Medium** | 5 | No rate limiting; unsigned/long-lived localStorage session; broken/insecure cron auth pattern; no audit logging of security events; no data dictionary of trust claims |
| **Low** | 3 | Verbose error/console leakage; inconsistent RLS migration hygiene; anon key treated as a secret |
| **Future Enhancement** | 6 | SSO/OIDC, MFA, per-app RLS scoping, secrets manager, DR/PITR runbook, CI security gates |

---

## 1. Authentication — **CRITICAL**

**Current state:** there is no Supabase Auth, no JWT, no server-verified session.

- **Anon key for all access.** `src/lib/supabase.ts` creates a single client with
  `VITE_SUPABASE_ANON_KEY` and nothing ever authenticates. A migration comment
  states it plainly: *"The Supabase client operates with anon key for all
  queries"* (`supabase/migrations/20260405010432_allow_anon_read_raw_emails.sql`).
  Consequence: **every `TO authenticated` RLS policy in the schema is dead code**;
  only `TO anon`/`TO public` policies ever apply.
- **PIN auth against an anon-readable table (CRITICAL).** `LoginPage.tsx` reads
  `users` by `pin` with the anon client and compares in the browser. The `users`
  table stores `pin` as **plaintext** and its RLS is `SELECT ... TO anon USING
  (true)` (`create_users_table.sql`). **Anyone with the app URL and the public
  anon key can dump every user's PIN, name, and role** — no login required.
- **Sessions are unsigned localStorage (MEDIUM→High).** `src/lib/auth.tsx` stores
  `{id,name,role}` in `localStorage` with no signature or expiry. Editing that
  object to `{"role":"admin"}` grants admin in the UI; there is nothing to verify
  against because the server never issued anything.
- **JWT lifecycle / refresh tokens: N/A** — none exist. There is nothing to
  expire, rotate, or revoke.
- **Future SSO readiness: none.** There is no identity to federate. SSO/OIDC would
  be built from zero.

## 2. Authorization — **CRITICAL**

- **Permissions are cosmetic (CRITICAL).** A real RBAC schema exists
  (`permissions`, `role_permissions` — `create_permissions_system.sql`) but is
  enforced **only in React**. Because the DB is anon-open (below), any user (or
  anyone with the anon key) can bypass UI gating by calling Supabase directly.
- **Anon write to identity tables (CRITICAL).** `users` has `INSERT`/`UPDATE`
  `TO anon WITH CHECK (true)` — **anyone can create an admin user or change any
  PIN/role.** `roles` and `role_permissions` were likewise opened to anon
  (`fix_roles_rls_for_anon_access.sql`, `create_permissions_system.sql` grants
  `TO public`). Authorization data is attacker-writable.
- **Admin bypass by design.** `LoginPage.tsx` lets `admin`/`hq` roles skip the
  location check; `auth.tsx` derives `isAdmin` purely from the client-held role
  string. Admin is a self-assertable client value, not a server claim.
- **No location-level data isolation (High).** RLS predicates are `USING (true)`,
  not scoped to the user's location. A store user can read every location's
  financials via the API regardless of the `restaurant` field checked at login.
- **Scale of exposure:** ~31 migrations grant `TO anon`/`TO public`, and ~225
  policy clauses are `USING (true)` / `WITH CHECK (true)`.

## 3. Edge Functions — **HIGH**

Eight functions in `supabase/functions/*`. Common issues:

- **No caller validation (High).** **No function validates the inbound caller** —
  none call `auth.getUser()` or check the `Authorization` header. Every function's
  access control depends entirely on the out-of-repo `verify_jwt` setting
  **[verify in console]**.
- **Unauthenticated service-role webhook (Critical/High).** `receive-email`
  (CloudMailin) accepts anonymous POSTs, uses the **service-role key**, writes to
  `raw_emails`, and **fans out to other functions using the service-role key as a
  bearer token**. There is no shared-secret or signature check on the sender, so
  anyone who finds the URL can inject arbitrary "emails" and drive privileged
  processing. It must be public to receive webhooks, which makes the missing
  signature verification the core problem.
- **Cron auth is broken/insecure (Medium).** `setup_daily_insights_cron_v2.sql`
  builds the target URL from `current_setting('request.headers')::json->>'host'`
  — cron has no request headers, so `host` is null and the call is likely
  malformed, and it passes **no authorization**. Privileged scheduled work with no
  authenticated principal.
- **CORS `*` on every function (High for a platform hub).** All functions return
  `Access-Control-Allow-Origin: *`. For an identity/integration hub this should be
  an allow-list of known app origins.
- **Service-role usage is broad (High).** `receive-email`, `process-slp-attachment`,
  `process-daily-logbook`, `process-guest-feedback`, `generate-daily-insights`,
  `generate-executive-summary`, `export-executive-report` all instantiate a
  service-role client — full RLS bypass — with no per-caller authorization in
  front of it.
- **Internal vs external not separated.** `process-*` functions are meant to be
  internal (called by `receive-email`) but are deployed like any other function;
  their protection depends solely on `verify_jwt` **[verify in console]**.
- **Rate limiting: none** in code (see §4).

## 4. API security — **HIGH / MEDIUM**

- The primary "API" is **PostgREST via the anon key**, so API security == RLS,
  which is effectively disabled (§2). This is the central exposure.
- **No rate limiting or abuse protection** on login (PIN brute force — the space
  is 4–8 digits and directly queryable), on the email webhook, or on functions.
- **No request validation / signing** between components; trust is "possession of
  a URL" or "possession of the anon key."

## 5. Secrets management — **HIGH / LOW**

- **Committed credential (High).** The initial admin **PIN is hardcoded in
  `create_users_table.sql`** (value redacted here). It is in git history and must
  be **rotated**, not just edited out.
- **Good:** no `.env`, service-role key, or JWT literals found in `src/` or the
  archive — service/OpenAI keys are read from `Deno.env` at runtime.
- **Anon key is treated as a secret (Low/conceptual).** It is publishable by
  design; the problem is not its exposure but that the security model *depends* on
  it being secret. Fixing RLS removes that dependency.
- **No secrets manager / rotation policy** for the service-role and OpenAI keys
  (rotation, least privilege, per-environment separation) — **Future Enhancement**.

## 6. Database security — **CRITICAL**

- **RLS present but neutralized.** RLS is enabled on tables, but the operative
  policies grant the anon role unrestricted read/write. The pattern is visible
  across the migration timeline as a series of *"allow anon …"* / *"public
  access"* fixes (raw_emails, chef summaries, fiscal calendar, SLP, roles) —
  each opened up to make the anon-key client work, progressively dismantling the
  security boundary.
- **Sensitive tables exposed:** `users` (PINs), `guest_feedback` (guest PII —
  `TO public` for all of SELECT/INSERT/UPDATE/DELETE), `raw_emails` (inbound email
  bodies, anon read+insert), and all financial tables (`pl_line_items`, SLP,
  weekly summaries) are anon-accessible.
- **No tenant/location scoping** in predicates (§2). For a multi-location,
  soon-to-be-multi-app platform this is the key structural gap.

## 7. Storage security — **MEDIUM**

- No Supabase Storage buckets are referenced in the snapshot. File attachments
  arrive as **base64 in the email webhook** and their content is persisted into
  `raw_emails.raw_json` — an **anon-readable** table. So "storage" today is
  effectively unsecured blobs inside an open table. If/when real buckets are
  introduced (exports, uploads), they will need explicit, authenticated,
  location-scoped policies from day one.

## 8. GitHub / CI/CD security — **MEDIUM / Future**

- No `.github/` workflows, branch-protection, secret-scanning, or dependency
  policy is present in the snapshot — CI security posture is unverified and
  presumed minimal. The project shows Bolt origins (`.bolt/`), consistent with
  rapid prototyping rather than a hardened pipeline.
- Migrations are applied ad hoc (duplicate timestamped re-applications appear in
  the list), suggesting no gated migration review. For a platform of record,
  migration review + secret scanning + dependency audit should gate merges.

## 9. Backup & disaster recovery — **MEDIUM / Future**

- Nothing in-repo addresses PITR, backup cadence, restore testing, or an RTO/RPO
  target. Supabase provides managed backups by plan, but there is **no documented
  DR runbook** and no evidence of restore drills. As the system of record for
  identity and financials, this needs an explicit, tested plan **[verify in
  console]**.

## 10. Multi-application trust — **CRITICAL (blocking)**

- **There is no trust primitive to build on.** Federating identity to Weekly
  Summary et al. requires CGOPS to **issue verifiable, signed, short-lived tokens
  with role/permission/location claims**, and to **enforce authorization
  server-side**. Today CGOPS has neither. Any "trust CGOPS for identity" model
  built now would be trusting an unsigned `localStorage` blob and an open
  database.
- The correct target (an OIDC-style issuer + per-app RLS + service-to-service
  auth) is described in §12.

---

## 11. Root cause

Almost every Critical/High traces to **one architectural decision**: the app was
built to run entirely on the **anonymous key with authentication simulated in the
client.** To make that work, RLS was progressively opened to `anon`, which
dismantled the database boundary and made the RBAC schema cosmetic. Fixing the
symptoms piecemeal will not help; the platform needs a **real server-side
identity and authorization layer**, after which RLS can be re-tightened to
`auth.uid()`/claims. This is the same **Phase 1 (authentication/access)** work the
CGOPS ↔ Weekly Summary integration plan already sequences first — it is now
confirmed as the hard dependency for everything else.

---

## 12. Target architecture for platform identity & authorization

What CGOPS needs to become a safe IdP for the ecosystem:

1. **Real authentication.** Adopt **Supabase Auth** (or a dedicated IdP) as the
   identity store. Replace PIN-in-table with proper credentials: at minimum PINs
   **hashed** (bcrypt/argon2) and verified **server-side** in an edge function
   (never a client-side table read); ideally email/OAuth logins with PIN retained
   only as a convenience factor. Issue **signed JWTs** with short TTLs and
   **refresh-token rotation**.
2. **Authorization as verifiable claims.** Put `role`, `permissions`, and
   `location scope` into **custom JWT claims** (e.g. Supabase Auth Hook /
   custom access token hook). The client stops being the source of truth for
   "am I admin."
3. **RLS keyed to identity.** Rewrite every policy from `USING (true)` to
   `USING (auth.uid() = ... )` / claim- and location-scoped predicates. Remove
   all blanket `TO anon` write policies. Anon becomes read-only where genuinely
   public, nothing more.
4. **CGOPS as OIDC-style issuer for sibling apps.** Weekly Summary and future
   apps receive a **CGOPS-signed identity token** on entry (the `cgops.ca/…`
   launcher of the integration plan), validate its signature/claims server-side,
   and derive their own session — no shared user table, no shared PINs. This is
   exactly the Phase-1 token in `CGOPS_CHEF_SUMMARY_INTEGRATION_PLAN.md §2.1`.
5. **Service-to-service auth.** App↔app and function↔function calls use
   **client-credentials / signed service JWTs**, not the service-role key as a
   bearer. Reserve the service-role key for trusted server contexts only, behind
   an authorization check.
6. **Edge-function hardening.** Turn `verify_jwt` on for user-facing functions;
   validate the caller (`auth.getUser`) and check permissions inside each
   function; separate **internal** functions (invoked only by other functions
   with a service credential) from **external** ones; replace CORS `*` with an
   **origin allow-list**; add **rate limiting** (login, webhooks, functions);
   verify webhook senders with a **shared secret / HMAC signature**
   (`receive-email`).
7. **Gateway & secret hygiene.** Centralize CORS/rate-limit/authz at the launcher
   layer; move secrets to a managed store with rotation and per-environment
   separation; rotate the committed admin PIN and any keys exposed during this
   era.
8. **Observability & DR.** Add security audit logging (logins, permission
   changes, service-role actions), and a tested backup/PITR runbook with RTO/RPO.

---

## 13. Implementation roadmap

Sequenced so the platform is safe to extend before any app trusts it. Phases 0–2
are prerequisites to CGOPS acting as an IdP at all.

| Phase | Focus | Key work | Exit criteria |
|---|---|---|---|
| **Phase 0 — Contain (Critical, immediate)** | Stop active data exposure | Remove anon **write** on `users`/`roles`/`role_permissions`; remove anon **read** on `users`, `guest_feedback`, `raw_emails`; move PIN verification into a server-side edge function; **rotate the committed admin PIN**; add a shared-secret/HMAC check to `receive-email`; lock CORS to known origins | No table exposes PINs/PII to anon; identity tables not anon-writable; webhook authenticated |
| **Phase 1 — Real authentication** | Replace simulated auth | Adopt Supabase Auth; hash PINs; issue signed JWTs w/ refresh rotation; replace localStorage identity with a verified session; `verify_jwt` on for user-facing functions | Users authenticate against a server-issued, expiring, signed token |
| **Phase 2 — Server-side authorization** | Make RBAC real | Role/permission/location as JWT claims; rewrite RLS from `USING (true)` to claim/location-scoped; enforce permissions inside edge functions; per-location data isolation | UI bypass via direct API calls no longer grants unauthorized data |
| **Phase 3 — Platform IdP** | CGOPS issues identity to sibling apps | CGOPS-signed identity token at the `cgops.ca/weekly-summary` launcher; consuming apps validate claims; service-to-service client-credentials; internal/external function split | Weekly Summary logs a user in purely from a CGOPS-verified token (integration plan §2.1) |
| **Phase 4 — Hardening & scale** | Production posture | Origin allow-lists + rate limiting everywhere; secrets manager + rotation; security audit logging; CI secret-scanning/dependency/migration gates; backup/PITR runbook + restore drills | Documented, tested, monitored controls across auth, API, secrets, DR |
| **Future Enhancements** | Beyond baseline | SSO/OIDC federation, MFA, step-up auth for admin, per-app scoped tokens & consent, anomaly detection | As prioritized |

**Guardrails:** do not extend identity to any sibling app before Phases 0–2 are
complete — federating a broken trust root multiplies the blast radius across every
future application. Preserve the incremental integration architecture already
documented; this security work *is* its Phase 1 dependency, now scoped concretely.

---

## Appendix — evidence index (CGOPS snapshot paths)

| Finding | Evidence |
|---|---|
| Anon key for everything | `src/lib/supabase.ts`; comment in `migrations/20260405010432_allow_anon_read_raw_emails.sql` |
| Client-side PIN login | `src/components/LoginPage.tsx` |
| localStorage session / client-derived admin | `src/lib/auth.tsx` |
| Plaintext PINs, anon read + anon write, committed admin PIN | `migrations/20260404161939_create_users_table.sql` |
| Cosmetic RBAC, public read of permissions | `migrations/20260405143826_create_permissions_system.sql` |
| Roles opened to anon | `migrations/20260405024131_fix_roles_rls_for_anon_access.sql` |
| Guest PII world read/write | `migrations/20260405120354_create_guest_feedback_table.sql` |
| raw_emails anon read/insert | `migrations/20260405010432_*`, `20260405010111_*` |
| Unauthenticated service-role webhook + fan-out | `supabase/functions/receive-email/index.ts` |
| Broad service-role use, CORS `*`, no caller validation | all `supabase/functions/*/index.ts` |
| Broken/insecure cron auth | `migrations/20260405014554_setup_daily_insights_cron_v2.sql` |
| Companion integration architecture (Phase 1 auth) | `docs/CGOPS_CHEF_SUMMARY_INTEGRATION_PLAN.md` |
