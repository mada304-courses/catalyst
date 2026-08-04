/**
 * auth.js
 * ------------------------------------------------------------------
 * All authentication logic lives here: sign up, log in, log out,
 * password reset, and reading the current user's profile/role.
 *
 * AUTHORIZATION NOTE (read this before touching this file):
 * `CatalystAuth.getProfile()` fetches the user's role from the
 * `profiles` table so the UI can decide what to show (e.g. the Admin
 * Dashboard link). That is a *display* decision only. The real
 * authorization boundary is enforced in Postgres via Row Level
 * Security policies (see sql/schema.sql) — every insert/update/delete
 * to `events` and `site_settings` is independently checked there, so
 * even a user who edits this file in devtools cannot write data they
 * aren't allowed to.
 * ------------------------------------------------------------------
 */

window.CatalystAuth = (function () {
  const db = () => window.CatalystDB;

  let currentSession = null;
  let currentProfile = null; // { id, full_name, email, role, created_at }
  const listeners = [];      // callbacks fired on any auth/profile change

  function notify() {
    listeners.forEach((cb) => cb({ session: currentSession, profile: currentProfile }));
  }

  /** Subscribe to auth state changes. Returns an unsubscribe function. */
  function onChange(callback) {
    listeners.push(callback);
    // Immediately hand the subscriber the current state
    callback({ session: currentSession, profile: currentProfile });
    return () => {
      const i = listeners.indexOf(callback);
      if (i > -1) listeners.splice(i, 1);
    };
  }

  async function loadProfile(userId) {
    if (!userId) {
      currentProfile = null;
      return null;
    }
    const { data, error } = await db()
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[Catalyst] Failed to load profile:', error.message);
      currentProfile = null;
      return null;
    }
    currentProfile = data;
    return data;
  }

  /** Call once on page load to hydrate session state from localStorage / Supabase. */
  async function init() {
    const { data: { session } } = await db().auth.getSession();
    currentSession = session;
    if (session?.user) await loadProfile(session.user.id);
    notify();

    db().auth.onAuthStateChange(async (event, session) => {
      currentSession = session;

      if (event === 'PASSWORD_RECOVERY') {
        // A user arrived here via a password-reset email link.
        listeners.forEach((cb) => cb({ session, profile: currentProfile, passwordRecovery: true }));
        return;
      }

      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        currentProfile = null;
      }
      notify();
    });
  }

  /** Re-reads the current user's profile and notifies subscribers. Used after
   *  a password-recovery flow, where the UI intentionally skipped the normal
   *  render step (see main.js) while the "set new password" modal was open. */
  async function refreshProfile() {
    if (currentSession?.user) await loadProfile(currentSession.user.id);
    notify();
  }

  function isLoggedIn() {
    return !!currentSession?.user;
  }

  function isAdmin() {
    return currentProfile?.role === 'admin';
  }

  function getSession() {
    return currentSession;
  }

  function getProfile() {
    return currentProfile;
  }

  /* ------------------------------ Actions ------------------------------ */

  async function signUp({ fullName, email, password }) {
    const { data, error } = await db().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }, // read by the handle_new_user() trigger
    });
    if (error) throw error;
    // If email confirmation is enabled in Supabase, data.session will be null here.
    return data;
  }

  async function signIn({ email, password }) {
    const { data, error } = await db().auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentSession = data.session;
    await loadProfile(data.user.id);
    notify();
    return data;
  }

  async function signOut() {
    const { error } = await db().auth.signOut();
    if (error) throw error;
    currentSession = null;
    currentProfile = null;
    notify();
  }

  async function sendPasswordReset(email) {
    const { error } = await db().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw error;
  }

  async function updatePassword(newPassword) {
    const { error } = await db().auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  return {
    init,
    onChange,
    refreshProfile,
    isLoggedIn,
    isAdmin,
    getSession,
    getProfile,
    signUp,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
  };
})();
