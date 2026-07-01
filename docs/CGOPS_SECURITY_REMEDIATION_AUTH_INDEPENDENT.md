# CGOPS Security Remediation — Auth-Independent Work

_Prepared: 2026-07-01 · Companion to `docs/CGOPS_PLATFORM_SECURITY_IDENTITY_AUDIT.md`_

## Purpose & scope

Per direction: the **PIN / user-authentication** model will be **dropped entirely
when CGOPS becomes the identity provider**, and the current user group is small,
so user-auth exposure is an accepted interim risk. This document therefore covers
**only the hardening that will remain valid after the CGOPS connection** —
machine-to-machine and infrastructure security that does not depend on how users
log in. No effort here is thrown away by the CGOPS transition.

**These changes apply to the CGOPS repository** (audited from the
`CG_Dashboard-main.zip` snapshot), which is outside this repo's push scope — so
each item below is written as **copy-paste-ready** code/SQL/config with its target
path.

### What is deferred vs. done now

| Audit area | Verdict | Why |
|---|---|---|
| Plaintext PINs, anon-readable `users`, localStorage session, client-side admin role, PIN hashing | **DEFER** | Removed when CGOPS issues identity; interim risk accepted |
| Claim-based **read** scoping / location isolation on data tables | **DEFER** | Predicate shape depends on the future CGOPS token claims |
| Revoking **anon write** on data tables the app writes via the anon key (e.g. chef summaries) | **DEFER** | Would break the current app until a real principal exists |
| **Email webhook** sender authentication | **DO NOW** | Machine integration; stays external forever |
| **Internal edge-function** authentication | **DO NOW** | Service-to-service; independent of user auth |
| **Broken/insecure cron** | **DO NOW** | Scheduled infra; no user involved |
| **CORS** allow-list | **DO NOW** | Origin policy stable across auth model |
| **Anon write/delete** on tables written **only by service-role functions** (`guest_feedback`, `raw_emails`) | **DO NOW** | Reads stay open for the UI; revoking writes won't break the app and closes a PII-tampering hole |
| **Rate limiting** on webhook/functions | **DO NOW** | Abuse protection is auth-agnostic |
| **Error/log hygiene** | **DO NOW** | Independent of auth |
| **CI/CD** secret scanning, dependency & migration gates | **DO NOW** | Repo hygiene, auth-agnostic |
| **Backup / DR** runbook | **DO NOW** | Data-protection, auth-agnostic |
| **Secrets rotation** (service-role, OpenAI, new shared secrets) — **not** the PIN | **DO NOW** | Machine secrets persist post-CGOPS |

---

## New environment secrets to provision

Set these in the Supabase project (Edge Function secrets); none is user-auth
related, all survive the CGOPS transition:

| Secret | Purpose |
|---|---|
| `WEBHOOK_SHARED_SECRET` | Authenticates the inbound email provider to `receive-email` |
| `INTERNAL_FUNCTION_SECRET` | Authenticates internal function-to-function and cron calls |
| `ALLOWED_ORIGINS` | Comma-separated browser origins allowed to call browser-facing functions |

---

## Item 1 — Authenticate the inbound email webhook (High)

`receive-email` currently accepts **anonymous** POSTs and runs with the
service-role key. Add sender verification. This endpoint stays a machine webhook
regardless of user auth.

**New shared helper** — `supabase/functions/_shared/secretAuth.ts`:

```ts
// Constant-time string comparison (length check is acceptable for random secrets).
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < ab.length; i++) out |= ab[i] ^ bb[i];
  return out === 0;
}

// Returns a 401 Response if the shared secret header is missing/invalid, else null.
export function requireSharedSecret(
  req: Request,
  envVar: string,
  headerName: string,
  corsHeaders: Record<string, string>,
): Response | null {
  const expected = Deno.env.get(envVar) ?? "";
  const provided = req.headers.get(headerName) ?? "";
  if (!expected || !timingSafeEqual(expected, provided)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}
```

**In `receive-email/index.ts`**, immediately after the `OPTIONS` handling:

```ts
import { requireSharedSecret } from "../_shared/secretAuth.ts";
// ...
if (req.method === "OPTIONS") {
  return new Response(null, { status: 200, headers: corsHeaders });
}

// NEW: verify the email provider before doing any privileged work.
const unauthorized = requireSharedSecret(req, "WEBHOOK_SHARED_SECRET", "x-webhook-secret", corsHeaders);
if (unauthorized) return unauthorized;
```

**Provider config:** set the email provider (CloudMailin) to send the header
`x-webhook-secret: <WEBHOOK_SHARED_SECRET>`. If the provider can't send custom
headers, use its HTTP Basic Auth on the target URL and verify the `Authorization:
Basic …` header instead (same constant-time compare). If the provider supports
HMAC request signing, prefer that (verify `hmac(secret, rawBody)`).

---

## Item 2 — Authenticate internal edge functions (High)

`process-slp-attachment`, `process-daily-logbook`, and `process-guest-feedback`
are meant to be called **only** by `receive-email`, but they validate nothing.
Give them a dedicated internal secret (do **not** reuse the service-role key as
the caller token — that spreads a god credential).

**In each internal function**, right after `OPTIONS`:

```ts
import { requireSharedSecret } from "../_shared/secretAuth.ts";
// ...
const unauthorized = requireSharedSecret(req, "INTERNAL_FUNCTION_SECRET", "x-internal-secret", corsHeaders);
if (unauthorized) return unauthorized;
```

**Update `receive-email`'s fan-out calls** to send the internal secret instead of
the service-role bearer. For each of the three `fetch(\`${supabaseUrl}/functions/v1/…\`)`
calls, change the headers:

```ts
// BEFORE
headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
// AFTER
headers: { 'x-internal-secret': Deno.env.get('INTERNAL_FUNCTION_SECRET')!, 'Content-Type': 'application/json' },
```

**Deployment:** set these three functions to `verify_jwt = false` (they are not
user-facing and now enforce their own secret). In `supabase/config.toml`:

```toml
[functions.process-slp-attachment]
verify_jwt = false
[functions.process-daily-logbook]
verify_jwt = false
[functions.process-guest-feedback]
verify_jwt = false
[functions.receive-email]
verify_jwt = false   # external webhook; protected by WEBHOOK_SHARED_SECRET
[functions.generate-daily-insights]
verify_jwt = false   # cron-invoked; protected by INTERNAL_FUNCTION_SECRET (Item 3)
```

> Note: `verify_jwt` is a **deploy-time** setting not represented in the audited
> snapshot — confirm current values in the Supabase console and pin them in
> `config.toml` so they're reviewable in git.

---

## Item 3 — Fix the broken, unauthenticated cron (Medium)

`setup_daily_insights_cron_v2.sql` builds the URL from
`request.headers ... ->> 'host'`, which is **null in a cron context** (no HTTP
request), so the call is malformed — and it sends **no authorization**. Replace it
with Vault-stored config + the internal secret. New migration:

```sql
-- Store config once (run manually / seed migration; do not commit real values):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<INTERNAL_FUNCTION_SECRET>', 'internal_function_secret');

select cron.unschedule('generate-daily-insights-job')
where exists (select 1 from cron.job where jobname = 'generate-daily-insights-job');

select cron.schedule(
  'generate-daily-insights-job',
  '0 9 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/generate-daily-insights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')
    ),
    body := jsonb_build_object('date', (current_date - interval '1 day')::text)
  );
  $$
);
```

**In `generate-daily-insights/index.ts`**, after `OPTIONS`, require the same
secret (the `triggeredBy: 'manual'` browser path, if kept, would move behind the
CGOPS token later — for now gate all callers):

```ts
import { requireSharedSecret } from "../_shared/secretAuth.ts";
const unauthorized = requireSharedSecret(req, "INTERNAL_FUNCTION_SECRET", "x-internal-secret", corsHeaders);
if (unauthorized) return unauthorized;
```

---

## Item 4 — Replace CORS `*` with an origin allow-list (High for a hub)

All eight functions return `Access-Control-Allow-Origin: *`. Server-to-server
functions (`receive-email`, `process-*`, cron target) don't need permissive CORS
at all; browser-facing ones (`generate-chef-summary`, `generate-executive-summary`,
`export-executive-report`) should echo only known origins.

**Add to `_shared/secretAuth.ts` (or a `cors.ts`):**

```ts
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allow = origin && ALLOWED.includes(origin) ? origin : (ALLOWED[0] ?? "");
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-internal-secret, x-webhook-secret",
  };
}
```

Browser-facing functions call `const corsHeaders = corsHeadersFor(req);` at the
top of the handler instead of the module-level `*` constant. For server-only
functions, drop the `Access-Control-Allow-Origin` header entirely (they aren't
called from browsers). `ALLOWED_ORIGINS` starts as today's app origin and later
adds `https://cgops.ca` when the launcher lands — the mechanism doesn't change.

---

## Item 5 — Revoke anon write/delete on service-written tables (Medium)

`guest_feedback` and `raw_emails` are **written only by service-role functions**
(which bypass RLS), yet expose `INSERT`/`UPDATE`/`DELETE` to `public`/`anon`
(`guest_feedback`: `TO public` for all four verbs; `raw_emails`: anon insert).
Revoking these **won't break the app** (writes come from the service role) and
closes a PII-tampering / log-injection hole. Reads stay open until the auth phase.
New migration:

```sql
-- guest_feedback: keep public SELECT (UI reads via anon), drop public writes.
drop policy if exists "Allow public insert to guest_feedback" on guest_feedback;
drop policy if exists "Allow public update to guest_feedback" on guest_feedback;
drop policy if exists "Allow public delete from guest_feedback" on guest_feedback;

-- raw_emails: written by the receive-email service-role function; drop anon insert.
drop policy if exists "Allow anon insert raw emails" on raw_emails;   -- match actual policy name
-- (Confirm exact policy names via \d+ / pg_policies before applying.)
```

> This is the one RLS change included, and only because these tables are
> **service-written** — so the write policies are pure surface area with no app
> dependency. All other RLS (read scoping, tables the browser writes) is deferred
> to the CGOPS auth phase as noted above.

---

## Item 6 — Rate limiting & abuse protection (Medium)

No login/webhook/function throttling exists. Auth-agnostic protections to add:

- **Edge/CDN layer:** enable request rate limiting in front of the functions
  domain (Supabase platform setting / WAF) for `receive-email` and the `generate-*`
  functions.
- **Lightweight app-level guard** for the webhook: a `webhook_calls` table keyed by
  minute + source, rejecting bursts, or reuse the shared-secret so unauthenticated
  floods are cheap-rejected at Item 1 before any DB work.
- **OpenAI cost guard:** the `generate-*` functions call OpenAI with the
  service-role/`OPENAI_API_KEY`; cap invocation frequency so an authenticated-but-
  looping caller can't run up spend.

(Full per-tenant quotas belong with the CGOPS gateway later; the above are the
stable interim floors.)

---

## Item 7 — Error & log hygiene (Low)

Functions return raw `error.message` to callers and `console.log` payload
contents (`receive-email` logs sender/subject; parsers may log data). Auth-agnostic
cleanup:

- Return a **generic** client error (`{ error: "processing failed" }`) with a
  correlation id; log the detail server-side only.
- Avoid logging full email bodies / PII; log identifiers and counts.
- Never echo secrets or SQL errors to the HTTP response.

---

## Item 8 — CI/CD security gates (Medium)

No `.github/` controls were present in the snapshot. Add to the **CGOPS repo**
`.github/workflows/security.yml` — entirely auth-independent:

```yaml
name: security
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Secret scan (gitleaks)
        uses: gitleaks/gitleaks-action@v2
      - name: Dependency audit
        run: npm ci && npm audit --audit-level=high
      - name: Migration sanity (no blanket anon writes in NEW migrations)
        run: |
          ! git diff --name-only origin/main... -- 'supabase/migrations/*.sql' \
            | xargs -r grep -lE "TO (anon|public)[^;]*WITH CHECK \(true\)" \
            || (echo "New migration grants anon/public unrestricted write" && exit 1)
```

Also enable branch protection (required review + required checks) and GitHub
secret scanning / push protection on the CGOPS repo. **Rotate any real
service-role / OpenAI keys** exposed during development, and **rotate the
committed admin PIN** now even though PIN auth is going away (it's a live
credential in history until then).

---

## Item 9 — Backup & disaster recovery (Medium)

Auth-agnostic; needed the moment CGOPS is the system of record:

- Confirm/enable **PITR** on the Supabase plan; set an explicit **RPO/RTO**.
- Document a **restore runbook** and run a **restore drill** on a staging project.
- Snapshot/export policy for the financial + feedback tables.
- Record all of the above in a `docs/DR_RUNBOOK.md` in the CGOPS repo.

---

## Suggested order of execution

1. **Item 1 + 2 + Item 4 helper** (webhook + internal secrets + CORS helper) — one
   PR; closes the largest machine-facing holes and shares one helper module.
2. **Item 3** (cron fix) — depends on `INTERNAL_FUNCTION_SECRET` from step 1.
3. **Item 5** (revoke service-written table writes) — standalone migration.
4. **Item 8** (CI gates) + rotate keys/PIN — protects everything after.
5. **Item 6, 7, 9** (rate limits, log hygiene, DR) — hardening pass.

None of these is invalidated by the CGOPS identity migration; when it lands, the
user-facing `verify_jwt`/CORS origins simply gain the CGOPS token and
`https://cgops.ca` origin, and the deferred user-auth/RLS items are addressed
then per the audit's Phases 1–3.
