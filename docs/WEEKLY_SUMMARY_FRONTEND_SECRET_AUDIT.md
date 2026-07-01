# Weekly Summary (Chef Summary) — Front-End Secret Exposure Audit

_Prepared: 2026-07-01 · Repo: `CG_Chef_Summary` (this repository)_

## Objective

Confirm, before attaching Weekly Summary to CGOPS, that the current standalone
app does **not** expose secrets, privileged keys, service-role keys, API keys,
admin credentials, webhook secrets, OpenAI keys, or Supabase service keys in
front-end code, committed files, build output, environment examples, or
browser-accessible configuration. This is **not** a PIN-auth redesign (that is
removed at CGOPS cutover) — it is a secret-exposure sweep.

## Method

Scanned tracked files: `src/`, `public/`, `index.html`, `.gitignore`, all
`supabase/migrations/*`, `supabase/functions/*`, docs, and the committed
`CG_Dashboard-main.zip`. Searched for JWT (`eyJ…`), OpenAI (`sk-…`),
`service_role`/`SUPABASE_SERVICE`, hardcoded PINs/credentials, and every
`import.meta.env.VITE_*` reference. **All credential values are redacted below.**

---

## Bottom line

> **The front-end bundle exposes no privileged secret.** The only values that
> reach the browser are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — both
> **publishable by design**. There is **no** service-role key, OpenAI key, or
> webhook secret in `src/`, `public/`, `index.html`, build output, or any
> committed env file. OpenAI keys are used **only** inside Edge Functions
> (server-side).
>
> The one real credential exposure is **server-side seed SQL**: **plaintext
> production login PINs for all ~21 users are committed** in migration files (and
> in git history). These are not shipped to the browser, but they are live
> credentials readable by anyone with repo access.

---

## Findings

### F-1 — Plaintext production PINs committed in seed migrations — **CRITICAL**

- **Files:** `supabase/migrations/20260512134658_seed_legacy_users.sql` (1 admin,
  4 HQ, 16 chef users, each `INSERT … (name, pin, role, restaurant)`);
  `supabase/migrations/20260511231817_seed_reference_data.sql` (initial admin
  user). The chef PINs are trivial sequential 4-digit values; the admin/HQ PINs
  are 5–8 digits. **Values redacted here.**
- **Name involved:** the `pin` column values in the `INSERT INTO users …`
  statements (real per-user login PINs), plus named individuals and their roles.
- **Why it matters:** these are **live authentication credentials** for the
  current app, committed in source and preserved in git history. Anyone with
  read access to the repo (or its history, or any fork/clone/PR) can log in as any
  user, including `admin`/`HQ`. The role and location are committed alongside,
  so the admin/HQ accounts are directly identifiable.
- **Browser-exposed?** **No.** Migration SQL is server-side and is not bundled
  into the front-end. Exposure is via **repository access / git history**, not the
  browser.
- **Recommended fix:**
  1. **Rotate now (out-of-band):** change the PINs in the live database, starting
     with the privileged `admin`/`HQ` accounts. Rotation is the only action that
     actually neutralizes the exposure — editing source does not.
  2. **Stop seeding real credentials in source:** replace committed PINs with
     placeholders or a first-run/secure-provisioning step; seed data should never
     contain real login secrets.
  3. **History:** if the repo is (or may become) accessible beyond the trusted
     group, plan a history scrub (e.g. filter-repo) for the PIN values; treat all
     committed PINs as compromised regardless.
- **Safe to do before CGOPS auth integration?** **Rotation of privileged
  (admin/HQ) PINs: yes — do it now**, low-risk and high-value; these accounts are
  the biggest exposure and PIN auth still governs access until cutover. Editing an
  already-applied migration or rewriting history is **not** low-risk (migration
  immutability, fresh-provision breakage, disruptive history rewrite) — **defer to
  a deliberate decision**, do not auto-apply. Since all PIN auth is removed at
  CGOPS cutover, full history scrubbing can be weighed against that timeline.

### F-2 — Committed CGOPS source snapshot contains a plaintext admin PIN — **MEDIUM**

- **File:** `CG_Dashboard-main.zip` (repo root; the CGOPS reference snapshot used
  for the platform audit).
- **Name involved:** inside the archive,
  `.../migrations/20260404161939_create_users_table.sql` seeds an admin user with
  a hardcoded PIN (**redacted**). No JWT/OpenAI/service-role literals were found in
  the archive, and it contains no `.env`.
- **Why it matters:** a second app's admin credential is embedded in this repo.
  It is a credential-in-history hygiene issue, and bloats the repo with unrelated
  third-app source.
- **Browser-exposed?** **No** (a zip at repo root is not part of the build).
- **Recommended fix:** remove the zip from the repo (keep it as out-of-band
  reference material), and rotate that CGOPS admin PIN as part of the CGOPS
  remediation. Because it's your own reference artifact, **confirm before
  deletion** rather than removing unilaterally.
- **Safe before CGOPS?** Yes — removing an unused zip is low-risk; history still
  retains it, so pair with the CGOPS-side PIN rotation.
- **Status:** the zip was **removed from the working tree** (git-tracked deletion).
  It remains in history; the embedded CGOPS admin PIN must still be rotated
  CGOPS-side.

### F-3 — Supabase URL + anon key in the browser bundle — **LOW (informational; by design)**

- **Files:** `src/lib/supabase.ts` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`);
  same two vars in `src/components/GuidedWeeklyPackage.tsx` and
  `src/components/WeeklyExecutiveReport.tsx` when calling Edge Functions.
- **Why it matters:** `VITE_*` values are **inlined into the client bundle** and
  are world-readable. This is **expected** for the Supabase **anon** key, which is
  a publishable key — its safety depends on RLS, not on secrecy (RLS gaps are
  covered separately in `docs/CGOPS_PLATFORM_SECURITY_IDENTITY_AUDIT.md`, not
  here).
- **Browser-exposed?** **Yes — intentionally.** Not a secret leak.
- **Recommended fix:** none required. **Guardrail:** never place the
  service-role key (or any privileged secret) in a `VITE_*` variable — confirmed
  absent today. Optionally document this in an `.env.example` (F-4).
- **Safe before CGOPS?** N/A (no change needed).

### F-4 — No `.env.example`; env hygiene otherwise good — **LOW (cleanup)**

- **Evidence:** `.env` is git-ignored (`.gitignore`); **no** `.env`/`.env.*` file
  is tracked; **no** `dist/`/build output is committed; `index.html` and
  `public/` contain no secrets.
- **Why it matters:** posture is good; the only gap is the absence of a
  values-free `.env.example` documenting which `VITE_*` vars are required (and
  implicitly, that only the anon key belongs there).
- **Browser-exposed?** No.
- **Recommended fix (optional):** add `.env.example` listing `VITE_SUPABASE_URL`
  and `VITE_SUPABASE_ANON_KEY` with empty/placeholder values and a comment that
  **no service-role or privileged key** may be added.
- **Safe before CGOPS?** Yes — additive, low-risk.

---

## What was checked and found clean

- **No `service_role` / `SUPABASE_SERVICE_ROLE_KEY` anywhere in `src/`.** Confirmed
  absent — no privileged key is used outside Edge Functions.
- **No OpenAI key (`sk-…`) or `OPENAI_*` in the front-end.** OpenAI is called only
  from `supabase/functions/generate-chef-summary`, `…/generate-executive-summary`,
  `…/generate-executive-statements` (server-side, `Deno.env`).
- **Edge Function calls from the browser** use `Bearer ${VITE_SUPABASE_ANON_KEY}`
  — the publishable anon key, which is correct (not the service-role key).
- **No JWT/OpenAI/service-role literals** in any tracked text file, in
  `package.json`/lockfile, in `.bolt/`, or inside `CG_Dashboard-main.zip`.
- **No committed `.env`, no committed build output.**

---

## Severity summary

| ID | Severity | Finding | Browser-exposed | Actioned now? |
|---|---|---|---|---|
| F-1 | **Critical** | Plaintext production PINs in seed migrations (+ history) | No (repo/history) | Rotate privileged PINs out-of-band; source/history changes deferred |
| F-2 | **Medium** | CGOPS zip embeds a plaintext admin PIN | No | Confirm-then-remove; rotate CGOPS PIN |
| F-3 | **Low** | Anon key + URL in bundle (by design) | Yes (intended) | None needed |
| F-4 | **Low** | No `.env.example` (hygiene otherwise good) | No | Optional add |

## Recommendation on implementation

Per the stated guardrail ("implement only a clear exposed secret with a low-risk
fix"): **no in-repo code change fully remediates F-1** — the effective fix is
**live PIN rotation (out-of-band)** plus decisions on migration/history handling,
none of which is a low-risk unilateral edit. I have therefore **not modified any
files**. Safe, low-risk actions available on your go-ahead: (a) add `.env.example`
(F-4); (b) remove `CG_Dashboard-main.zip` from the repo (F-2). The privileged-PIN
rotation (F-1) is the top priority and must happen in the live database.
