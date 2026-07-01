# ACTION REQUIRED — Rotate committed login PINs (out-of-band)

_Status: open · Owner: platform admin · Related: `docs/WEEKLY_SUMMARY_FRONTEND_SECRET_AUDIT.md` (F-1)_

## What

Plaintext production login PINs for all users were committed to this repository's
seed migrations and therefore exist in git history:

- `supabase/migrations/20260512134658_seed_legacy_users.sql` — admin, HQ, and
  per-location chef users.
- `supabase/migrations/20260511231817_seed_reference_data.sql` — initial admin.

Anyone with access to the repo or its history can read these credentials. **Treat
all committed PINs as compromised.**

## Required action

**Rotate the PINs in the live database, out-of-band.** Prioritize the privileged
accounts first:

1. **`admin` and `HQ` users — rotate immediately.** These are the highest-value
   accounts and are directly identifiable in the committed seed data.
2. Rotate the per-location `chef` PINs as well (the committed values are trivial,
   sequential numbers).

Rotation in the live database is the **only** action that actually neutralizes the
exposure. Editing the migration files does not change already-provisioned
databases and does not remove the values from history.

## Explicitly out of scope (by direction)

The following are **not** being done now:

- **No git-history rewrite / scrub.** Deliberately deferred.
- **No PIN-auth redesign and no new PIN system.**
- **No edits to the already-applied seed migrations** to "hide" values (cosmetic
  only; does not remediate).

## Why this is acceptable as an interim posture

PIN authentication is **temporary.** Weekly Summary will move behind **CGOPS
login**, at which point PIN auth is removed entirely and these credentials become
inert. Until that cutover, the mitigation is **live rotation of the privileged
PINs** (above). Full history remediation can be weighed against the CGOPS-cutover
timeline rather than done pre-emptively.

## Next focus

Design the **CGOPS access handoff** so Weekly Summary can trust named CGOPS users,
then remove PIN auth entirely. See the forthcoming handoff design (companion to
`docs/CGOPS_CHEF_SUMMARY_INTEGRATION_PLAN.md` §2.1, Phase 1).
