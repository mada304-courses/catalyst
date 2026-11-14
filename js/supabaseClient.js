/**
 * supabaseClient.js
 * ------------------------------------------------------------------
 * Creates the single shared Supabase client used across the site.
 *
 * IMPORTANT — about these two values:
 * `SUPABASE_URL` and `SUPABASE_ANON_KEY` are PUBLIC identifiers, not secrets.
 * They are meant to be shipped in frontend code — that's how every Supabase
 * static site works. The anon key can only do what your Row Level Security
 * (RLS) policies in sql/schema.sql allow it to do. Real protection comes
 * from those database policies, never from hiding this key.
 *
 * The one key that must NEVER appear in frontend code is the
 * `service_role` key — it bypasses RLS entirely. This project does not
 * use it anywhere in the browser.
 *
 * Fill in your own project's values below (Supabase Dashboard →
 * Project Settings → API).
 * ------------------------------------------------------------------
 */

const SUPABASE_URL = 'https://qowalhwfijrupnekseic.supabase.co';
/**Publishable/anon key */
const SUPABASE_ANON_KEY = 'sb_publishable_V98WgQJP0OJkBkuM6kc9VA_iTNzzLJK';

if (SUPABASE_URL.includes('YOUR-PROJECT-REF')) {
  // Loud, visible warning during setup rather than a silent failure.
  console.warn(
    '[Catalyst] supabaseClient.js still has placeholder credentials. ' +
    'Update SUPABASE_URL and SUPABASE_ANON_KEY in js/supabaseClient.js.'
  );
}

// `supabase` global comes from the CDN script tag loaded in <head> before this file:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
window.CatalystDB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // required so password-reset links work
  },
});
