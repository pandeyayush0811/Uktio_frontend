// Fill these in from:
// - Supabase Dashboard -> Project Settings -> API (URL + anon public key)
// - The backend URL wherever you deploy uktio-backend (Render/Railway/etc.)
// The anon key is safe to ship in the app — it only allows what your
// Supabase RLS policies permit, nothing more.

// Testing against a locally-run backend vs. the deployed production one?
// Don't retype/comment-swap the URL every time — just flip this one word
// and reload (browser preview: instant; native app: `npx cap sync android`
// then rebuild, since www/ gets copied into the Android project).
const ACTIVE_BACKEND = 'main'; // 'main' | 'local'

const BACKENDS = {
  main: 'https://utkio-backend.onrender.com',
  local: 'http://10.215.18.30:3999' 
};

// Safety net: this is easy to forget about after a local-testing
// session. It doesn't change any behavior — the app still connects to
// whatever ACTIVE_BACKEND says above — it just makes it loud and hard
// to miss in the console if 'local' is still active, so a production
// build doesn't silently ship pointed at a dev machine's home/office
// Wi-Fi IP (which would just fail for every real user).
if (ACTIVE_BACKEND === 'local') {
  console.warn(
    '%c⚠️ ACTIVE_BACKEND is set to \'local\' (%s) — shared/config.js',
    'font-weight:bold;font-size:14px;color:#fff;background:#c0392b;padding:4px 8px;border-radius:4px;',
    BACKENDS.local
  );
  console.warn('If this is a production/release build, flip ACTIVE_BACKEND to \'main\' before shipping.');
}

window.UKTIO_CONFIG = {
  SUPABASE_URL: 'https://pwdglktwuquoswqoyely.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZGdsa3R3dXF1b3N3cW95ZWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTYyODAsImV4cCI6MjEwMTE5MjI4MH0.GdwAJAXx8x98QvkvW1HAZh7F3PIZiV3Uqeoqm54ohRo',
  BACKEND_URL: BACKENDS[ACTIVE_BACKEND] // no trailing slash
};
