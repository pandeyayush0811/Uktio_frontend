# Uktio App (Frontend)

Capacitor-based Android app. The actual app is a set of static HTML/JS
files in `www/` — no build step, no bundler, no framework. Each page
(`chat.html`, `history.html`, `report.html`, etc.) is a standalone HTML
file with its own `<script type="module">`, sharing common logic
through `www/shared/*.js`.

## Architecture, in short

- **Auth**: Supabase Auth (`www/shared/auth.js`). The access token is
  cached and attached to every backend API call.
- **Backend**: all non-voice API calls (login, profile, chat-history
  sync, reports) go to the Node/Express backend — see
  `www/shared/config.js` for the URL, and `www/shared/auth.js`'s
  `apiFetch()` for how calls are made.
- **Voice chat is BYOK (bring your own key)**: the user enters their
  own Google Gemini API key in Settings. Real-time voice conversation
  (`chat.html`) and the "speak" quiz question (`quiz.html`) talk
  **directly to Google Gemini from the device** — this traffic never
  touches the backend. The Gemini SDK is vendored locally at
  `www/vendor/google-genai.bundle.mjs` (see that folder's README for
  why, and how to update it).
- **XSS note**: `report.html`, `mistakes.html`, and `quiz.html` render
  AI-generated text (from the backend's OpenAI call) into the page.
  That text is always passed through `escapeHtml()`
  (`www/shared/sanitize.js`) before being placed in `innerHTML` — don't
  add a new interpolation of dynamic/AI/user-spoken text into an
  `innerHTML` template without wrapping it the same way.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Point the app at your backend** — edit `www/shared/config.js`:
   ```js
   const ACTIVE_BACKEND = 'main'; // 'main' | 'local'
   const BACKENDS = {
     main: 'https://your-deployed-backend.com',
     local: 'http://<your-machine-LAN-IP>:3999' // for testing against a locally-run backend
   };
   ```
   Leaving `ACTIVE_BACKEND` set to `'local'` prints a loud console
   warning on load so it's hard to accidentally ship a build still
   pointed at a dev machine's local network.

3. **Sync into the Android project** (after any change to `www/`):
   ```bash
   npx cap sync android
   ```

4. **Run in Android Studio**, or:
   ```bash
   npx cap open android
   ```

## Project layout

```
www/
  index.html, login.html, onboarding.html   Entry/auth flow
  chat.html                                   Core voice-chat feature (BYOK, direct-to-Gemini)
  history.html                                 Past sessions list
  report.html, mistakes.html, quiz.html          Post-session AI report, mistake cards, quiz
  profile.html, settings.html                     Account management
  shared/
    config.js         Backend URL + Supabase config
    auth.js            Login/session/apiFetch helper
    sanitize.js         escapeHtml() — see XSS note above
    score-ring.js         Shared SVG progress-ring builder (report.html + mistakes.html)
    mic-helpers.js          Gemini API key storage/retrieval helpers
    gemini-key-check.js       Validates a Gemini key before starting a session
    drawer.js, back-nav.js      Nav UI helpers
  vendor/
    google-genai.bundle.mjs    Vendored Gemini SDK (see vendor/README.md)
android/                     Capacitor's generated native Android project
```

## Testing a change before you ship

There's no automated frontend test suite (these are plain static
files) — after any change, manually walk through: sign up → onboarding
→ start a chat → end it → generate report → view mistakes → take the
quiz. That path touches most of the shared modules.
