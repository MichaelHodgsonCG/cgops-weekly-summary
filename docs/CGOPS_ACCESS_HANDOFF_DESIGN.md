# CGOPS → Weekly Summary — Access Handoff Design (Signed-JWT, first cut)

_Prepared: 2026-07-01 · Companion to `docs/CGOPS_CHEF_SUMMARY_INTEGRATION_PLAN.md` §2.1 (Phase 1)
and `docs/CGOPS_PLATFORM_SECURITY_IDENTITY_AUDIT.md`_

## Goal & approach

Let Weekly Summary **trust named CGOPS users** so a user who is signed into CGOPS
can enter Weekly Summary without a separate login — replacing today's
**self-asserted** identity (a `{id,name,role}` blob in `localStorage`,
`src/lib/auth.tsx`) with a **CGOPS-cryptographically-vouched** identity.

Design decisions (per direction):

1. **Signed-JWT handoff for the first cut** — CGOPS mints a short-lived signed
   assertion; Weekly Summary verifies it. Simple, stateless, no shared login DB.
2. **OIDC-ready shape** — claims and JWKS-based verification are deliberately
   OIDC-shaped so this can graduate to a full authorization-code flow later
   (§12) without changing the trust model.
3. **Keep Weekly Summary's `users`/`roles`/`permissions` tables** (from
   `supabase/migrations/…_create_users_roles_permissions.sql`) **temporarily**;
   CGOPS claims are **mapped onto** them (§7).
4. **PIN auth stays as a fallback** through rollout; nothing about
   `LoginPage.tsx` / `users.pin` is removed until the handoff is proven (§10–§13).

> **Honest scope note.** This handoff upgrades *identity integrity* (who CGOPS
> vouches for) — it does **not** by itself make the database enforce that
> identity. Weekly Summary still queries Supabase with the anon key under
> currently-open RLS (see the platform audit). DB-level enforcement (RLS keyed to
> the verified identity) is a **separate, later** step and is out of scope here.
> The win now: identity is no longer forgeable by editing `localStorage`.

---

## 1. Trust model

- **Issuer (IdP):** CGOPS. Holds a **private signing key**, publishes the matching
  **public key** at a JWKS endpoint. CGOPS is the only party that can mint a valid
  handoff token.
- **Audience (RP / consumer):** Weekly Summary. Holds **no CGOPS secret** — it
  verifies with the **public** key only. This is why asymmetric signing is chosen
  over a shared HMAC secret: no secret crosses the app boundary, and it is the
  same primitive OIDC uses.
- **Transport:** HTTPS only, under the `cgops.ca` parent (Weekly Summary served at
  `cgops.ca/weekly-summary` per the integration plan).

---

## 2. Token claims

CGOPS mints a compact JWT (the "handoff assertion"). Header + payload:

```jsonc
// header
{ "alg": "RS256", "typ": "JWT", "kid": "cgops-handoff-2026-07" }

// payload
{
  "iss": "https://cgops.ca",              // issuer — verified
  "aud": "weekly-summary",                // audience — verified (reject others)
  "sub": "cgops-user-8f3a…",              // stable CGOPS user id (primary map key)
  "email": "jdoe@charcoalgroup.ca",       // secondary map key / display
  "name": "John Doe",                     // display only
  "cg_roles": ["chef"],                   // CGOPS role(s) → mapped (§7)
  "cg_permissions": ["chef.view", "pl.upload"], // optional fine-grained claims
  "cg_locations": ["cg-loc-0421"],        // CGOPS location id(s) → mapped (§7)
  "iat": 1751380000,
  "nbf": 1751380000,
  "exp": 1751380120,                      // ~120s TTL (§4)
  "jti": "b1e2…-one-time"                 // unique id for replay protection (§5)
}
```

Notes:
- `sub` is the **durable identity key**; `email` is a fallback match. Names/roles
  are claims, never trusted from the client.
- `cg_permissions` is optional in the first cut — role mapping (§7) is enough to
  start; permission claims let us later retire Weekly Summary's role table.
- Keep the token **minimal**; no PII beyond name/email.

---

## 3. Signing & verification

- **Algorithm:** **RS256** (or EdDSA) — asymmetric. CGOPS signs with the private
  key; Weekly Summary verifies with the public key from CGOPS's **JWKS**
  (`https://cgops.ca/.well-known/jwks.json`), selected by `kid`.
- **Verification happens server-side** in a new Weekly Summary Edge Function
  `verify-cgops-handoff` (never in the browser — the browser can't be trusted to
  enforce the checks, and this is where the WS session is established).
- **Verification steps (all must pass):**
  1. Signature valid against the JWKS key for the token's `kid`.
  2. `iss === "https://cgops.ca"`.
  3. `aud === "weekly-summary"`.
  4. `exp`/`nbf`/`iat` valid within a small clock-skew leeway (±60s).
  5. `jti` unseen (replay check, §5).
  6. `sub` resolves to a Weekly Summary user mapping (§7), else fallback (§8).
- **Key management:** CGOPS keys carry a `kid` and rotate on a schedule; Weekly
  Summary caches JWKS and **refetches on an unknown `kid`**. Old keys stay
  published until all short-lived tokens signed by them have expired.

---

## 4. Expiry

- **Handoff assertion TTL: ~120 seconds.** It exists only to cross the boundary
  once; it is not a session.
- On success, `verify-cgops-handoff` establishes the **Weekly Summary session**
  and returns it to the SPA. First cut: a **WS-signed session token** (short-ish,
  e.g. 8–12h, refreshable by re-entering from CGOPS) plus the mapped identity —
  replacing the self-asserted `localStorage` identity in `auth.tsx`. (Because RLS
  is not yet identity-enforced, this session is defense-in-depth, not DB
  enforcement — see scope note.)

---

## 5. Replay protection

Yes — needed, because the assertion is a bearer credential:

- **One-time `jti`:** `verify-cgops-handoff` records each accepted `jti` in a
  `handoff_nonces` table (`jti` PK, `expires_at`). A second presentation of the
  same `jti` is rejected. Rows are purged after `exp`.
- **Short TTL (§4)** bounds the replay window even before the nonce check.
- **`aud` binding** stops a token minted for another app being replayed here.
- **Transport:** pass the assertion in the URL **fragment** (`#…`, not sent to
  servers/referrers/logs) or, hardened, as a **one-time `code`** the SPA exchanges
  server-side (the OIDC-style path, §12). A `state`/`nonce` round-trip guards the
  callback against CSRF/fixation.

```sql
CREATE TABLE handoff_nonces (
  jti text PRIMARY KEY,
  sub text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
-- periodic: DELETE FROM handoff_nonces WHERE expires_at < now();
```

---

## 6. Redirect flow (IdP-initiated, first cut)

```
1. User is signed into CGOPS.
2. User clicks "Weekly Summary" in the CGOPS launcher.
3. CGOPS backend mints the handoff assertion (aud=weekly-summary, sub=this user,
   roles/locations claims, 120s exp, unique jti) and 302-redirects to:
      https://cgops.ca/weekly-summary/auth/callback#assertion=<JWT>&state=<random>
4. Weekly Summary SPA reads the fragment and POSTs { assertion, state } to its
   Edge Function `verify-cgops-handoff`.
5. verify-cgops-handoff: validates signature+claims (§3), burns the jti (§5),
   maps sub→WS user + roles/locations (§7), returns a WS session.
6. SPA stores the WS session (replacing the localStorage self-asserted identity)
   and lands the user in the app.
   On any failure → fallback (§8).
```

This is IdP-initiated SSO. RP-initiated (WS bounces an unauthenticated visitor to
CGOPS `/authorize`) is the natural §12 extension.

---

## 7. Role & location mapping

CGOPS claims are mapped onto Weekly Summary's existing tables (kept temporarily):

- **Identity:** add a `cgops_user_id` column (or a `cgops_identity_map` table)
  keyed to `users.id`. Match order: `sub` → `cgops_user_id`, else `email`. On
  first successful handoff for an unmapped-but-email-matched user, link the
  mapping (auto-provision optional, admin-gated).
- **Role:** map `cg_roles[]` → Weekly Summary `roles` via a small
  `cgops_role_map(cgops_role text, ws_role_id uuid)`. Until `cg_permissions` is
  adopted, the WS role continues to drive the existing `role_permissions` checks.
- **Location:** map `cg_locations[]` → WS `location_id` via the
  **`location_external_map`** already specified in the integration plan §9
  (`external_system='cgops'`, `external_location_id=<cg location id>`). This is the
  same table the data-prefill integration uses — one mapping, reused.
- **Precedence:** claims are authoritative per-session; the WS row is a cache for
  RBAC wiring, not a second source of truth for *who* the user is.

---

## 8. Fallback behavior

The handoff is **additive**; PIN login remains the guaranteed path during rollout:

| Condition | Behaviour |
|---|---|
| Feature flag off | Normal PIN login (`LoginPage.tsx`) — no change |
| Assertion missing/expired/invalid signature | Reject; show "Couldn't sign in from CGOPS" + offer PIN login |
| `jti` replay | Reject; offer re-entry from CGOPS |
| `sub`/`email` maps to no WS user | Offer PIN login; surface to admin to create the mapping |
| CGOPS/JWKS unreachable | Offer PIN login; log for ops |

No handoff failure can lock a user out while PIN auth still exists.

---

## 9. CGOPS-side changes

- **Signing key + JWKS:** generate an RS256/EdDSA keypair; store the **private
  key** in CGOPS secrets/KMS; publish the public key at
  `/.well-known/jwks.json` with a `kid`.
- **Mint endpoint / launcher action:** on "open Weekly Summary," mint the handoff
  assertion for the current CGOPS user (server-side) and redirect per §6.
- **Claim population:** include `sub`, `email`, `name`, `cg_roles`,
  (optional `cg_permissions`), `cg_locations`, standard time claims, unique `jti`.
- **Launcher route:** host `cgops.ca/weekly-summary` (reverse proxy / mount to the
  separate Weekly Summary app, per the integration plan — codebases stay separate).
- **Key rotation policy** (scheduled, `kid`-tagged, overlap window).

## 10. Weekly Summary-side changes

- **New Edge Function `verify-cgops-handoff`** (verification + session, §3–§7).
- **`auth.tsx`:** accept a **CGOPS-verified session** as an identity source
  alongside the existing PIN path; identity/role now come from verified claims,
  not a hand-written `localStorage` object. Keep the PIN path intact behind the
  flag.
- **Callback route** `/auth/callback` to receive the fragment and call the edge
  function.
- **Schema:** `handoff_nonces` (§5); `cgops_user_id`/`cgops_identity_map`,
  `cgops_role_map`, reuse `location_external_map` (§7).
- **No change** to `LoginPage.tsx` PIN flow yet (it's the fallback).

## 11. Environment variables & secrets

| Side | Name | Secret? | Purpose |
|---|---|---|---|
| CGOPS | `HANDOFF_SIGNING_PRIVATE_KEY` (or KMS ref) | **Yes** | Sign assertions |
| CGOPS | `HANDOFF_KEY_ID` | No | `kid` for rotation |
| CGOPS | `HANDOFF_ISSUER` = `https://cgops.ca` | No | `iss` |
| Weekly Summary (edge) | `CGOPS_JWKS_URL` = `https://cgops.ca/.well-known/jwks.json` | No | Fetch public keys |
| Weekly Summary (edge) | `CGOPS_ISSUER` = `https://cgops.ca` | No | Verify `iss` |
| Weekly Summary (edge) | `WEEKLY_SUMMARY_AUDIENCE` = `weekly-summary` | No | Verify `aud` |
| Weekly Summary (edge) | `WS_SESSION_SIGNING_SECRET` | **Yes** | Sign the returned WS session token |
| Weekly Summary (frontend) | `VITE_CGOPS_HANDOFF_ENABLED` | No | Feature flag (fallback control) |

Weekly Summary holds **no CGOPS signing secret** (verification is public-key) — a
deliberate property that limits blast radius and keeps `VITE_*` free of privileged
material (consistent with the front-end secret audit).

---

## 12. Graduating to OIDC / auth-code (later, no trust-model change)

The first cut is already OIDC-shaped, so graduation is additive:
- Replace the fragment-delivered assertion with a **one-time `code`** and a CGOPS
  **`/token`** endpoint that Weekly Summary's edge function exchanges server-side
  (token never touches the browser).
- Add CGOPS **`/authorize`** for **RP-initiated** login (WS redirects
  unauthenticated visitors to CGOPS).
- Keep the same `iss`/`aud`/`sub`/`jti`/JWKS machinery and the same claim→WS
  mapping. Only the delivery changes.

---

## 13. Rollout plan

| Stage | Scope | Guardrail |
|---|---|---|
| **A. Build (dark)** | Ship `verify-cgops-handoff`, callback route, schema, mapping — flag **off**. CGOPS mints to a test route. | No user impact |
| **B. Pilot** | Enable flag for a pilot cohort; CGOPS launcher entry live for them. | PIN still available for everyone |
| **C. Default-on** | All users enter via CGOPS; PIN remains the fallback. | Monitor handoff success, unmapped users |
| **D. Prove** | Define exit metrics: e.g. **N consecutive days** with zero unexplained handoff failures, **100% of active users mapped**, fallback usage ≈ 0. | Sign-off before D→cutover |
| **E. Cutover** | Disable PIN auth (see §15). | Rollback still possible for a defined window |

## 14. Rollback plan

- **Instant, config-only:** set `VITE_CGOPS_HANDOFF_ENABLED=false` (and/or stop the
  CGOPS launcher entry) → users fall back to the **untouched PIN login**.
- Because PIN auth, `users.pin`, and `LoginPage.tsx` are **left in place** until
  Stage E, rollback requires **no data restore and no redeploy of removed code**.
- Keep the pre-cutover build/tag available for a defined window after Stage E so
  PIN auth can be redeployed if a latent handoff issue appears.

---

## 15. What can be removed after a successful cutover

Once Stage D exit metrics hold and the rollback window closes:

- **PIN login UI & logic:** the PIN + location flow in `src/components/LoginPage.tsx`.
- **PIN storage:** the `users.pin` column and PIN-specific seed data
  (`…_seed_legacy_users.sql`, `…_seed_reference_data.sql`) — which also **closes
  the committed-PIN exposure** tracked in `docs/PIN_ROTATION_REQUIRED.md`.
- **Self-asserted identity:** the hand-written `localStorage` `{id,name,role}`
  path in `src/lib/auth.tsx` (replaced by the CGOPS-verified session).
- **PIN docs:** `AUTHENTICATION_NOTES.md`.
- **The fallback branch and `VITE_CGOPS_HANDOFF_ENABLED` flag.**
- **Later (not at cutover):** if Weekly Summary begins consuming `cg_permissions`
  directly, its `users`/`roles`/`permissions`/`cgops_role_map` tables can be
  retired too — but per direction these are **kept temporarily**; treat as a
  follow-on once claim-based authz is proven.

---

## 16. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Token replay** | One-time `jti` + ~120s TTL + `aud` binding (§5) |
| **Token leakage via URL logs/referrer** | Deliver in fragment (not sent to servers); graduate to one-time `code` exchange (§12) |
| **Clock skew** rejects valid tokens | ±60s leeway on `exp`/`nbf`/`iat` |
| **Key rotation breaks verification** | `kid`-tagged JWKS, WS refetches on unknown `kid`, overlap window |
| **Unmapped / newly-added users** | Fallback to PIN + admin mapping tooling; optional email-matched auto-link |
| **CGOPS becomes a login SPOF** | Keep PIN fallback until Stage D proven; monitor availability before removing it |
| **CSRF / session fixation on callback** | `state`/`nonce` round-trip; verify server-side |
| **False sense of enforcement** (open RLS) | Documented scope note; DB-level RLS enforcement tracked as a separate later phase — do not advertise this as data-layer authz |
| **`aud` confusion across future apps** | Per-app `aud`; WS rejects anything not `weekly-summary` — reusable pattern for Product Center, People, etc. |

---

## Appendix — anchor references

| Concern | Where |
|---|---|
| Current self-asserted identity (to be replaced) | `src/lib/auth.tsx` |
| Current PIN login (fallback, later removed) | `src/components/LoginPage.tsx` |
| Weekly Summary RBAC tables (kept temporarily) | `supabase/migrations/…_create_users_roles_permissions.sql` |
| Location mapping table (reused) | `docs/CGOPS_CHEF_SUMMARY_INTEGRATION_PLAN.md` §9 (`location_external_map`) |
| Phase-1 auth framing | `docs/CGOPS_CHEF_SUMMARY_INTEGRATION_PLAN.md` §2.1 |
| Front-end secret posture / `VITE_*` guardrail | `docs/WEEKLY_SUMMARY_FRONTEND_SECRET_AUDIT.md` |
| Committed-PIN rotation (closed by §15 removal) | `docs/PIN_ROTATION_REQUIRED.md` |
