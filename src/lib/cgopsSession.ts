import { supabase } from './supabase';

// Phase A hybrid login — the CGOPS side of the two-door front.
//
// Weekly Summary keeps its own 4-digit PIN login for location chefs (unchanged),
// AND accepts the office cohort (admin / HQ / exec) via a CGOPS single-sign-on
// handoff. Which door runs is decided here, at boot, by how the user arrived:
//
//   • Launched from the CGOPS App Launcher  -> the URL carries the session in a
//     hash fragment (#cgops_sso=1&access_token=…&refresh_token=…). We adopt that
//     Supabase Auth session, read the user's role from CGOPS `user_profiles`
//     (keyed by auth_user_id), and seed the app's localStorage identity so the
//     existing AuthProvider renders them in — no PIN screen.
//   • Opened directly (a chef) -> no fragment, we do nothing and the normal PIN
//     LoginPage shows exactly as before.
//
// The office cohort is NOT in weekly_summary_users; their identity and role live
// entirely in CGOPS. Access is granted by role in CGOPS Application Access, so
// only granted roles ever get the launcher tile / a handoff.
export async function ensureCgopsSession(): Promise<void> {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (hash.get('cgops_sso') !== '1') return; // chef PIN path — leave untouched

  const access_token = hash.get('access_token') ?? '';
  const refresh_token = hash.get('refresh_token') ?? '';
  // Strip the tokens from the URL before anything else can observe them.
  history.replaceState(null, '', window.location.pathname + window.location.search);
  if (!access_token || !refresh_token) return;

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error || !data.session) {
    console.error('CGOPS SSO handoff failed:', error);
    return;
  }

  // Resolve the app role straight from CGOPS. The CGOPS role strings
  // ('admin' / 'HQ' / 'Executive Chef') satisfy the app's existing
  // isAdmin / isHQ / isExecChef checks as-is, so no translation is needed.
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, name, role')
    .eq('auth_user_id', data.session.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    console.error('CGOPS profile lookup failed:', profileError);
    return;
  }

  localStorage.setItem('user', JSON.stringify({
    id: profile.id,
    name: profile.name ?? '',
    role: profile.role ?? '',
  }));
  // Marks this as an SSO session so logout returns to CGOPS instead of the PIN screen.
  localStorage.setItem('auth_via', 'cgops');
}
