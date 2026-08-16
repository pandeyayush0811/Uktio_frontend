# Uktio Frontend — Codebase Map

Auto-generated on first exploration (Aug 2026). Update this after any
structural change (new page, new shared module, new pattern).

## Stack
- **No framework, no bundler.** Plain HTML + vanilla JS (`<script type="module">`) + one shared CSS file.
- **Capacitor** wraps `www/` into an Android app (`capacitor.config.json` → `webDir: www`).
- **Auth**: Supabase Auth. Access token cached in `localStorage`, attached via `apiFetch()` in `shared/auth.js`.
- **Voice chat**: BYOK — direct device-to-Google-Gemini, never touches backend. SDK vendored at `vendor/google-genai.bundle.mjs`.
- **Backend**: separate Node/Express repo (`Utkio_backend-main`) — routes: auth, chat, payment, scenario, user, admin. Supabase Postgres + RLS.
- **No frontend test suite exists.** Manual walkthrough only (per README).

## Page inventory (`www/*.html`)

| Page | Lines | Purpose | Flow position |
|---|---|---|---|
| `index.html` | 50 | Splash — checks session, routes to login/app | Entry point (Capacitor always loads this) |
| `login.html` | 159 | Email/password + Google sign-in | Pre-auth |
| `onboarding.html` | 263 | Multi-step wizard (name, age, goal, level, writing sample) | Post-signup, pre-app |
| `history.html` | 194 | "Chats" list — past sessions | Main app (uses newer serif "Chats" design system) |
| `chat.html` | 1129 | **Core feature** — live voice chat (BYOK, direct-to-Gemini) | Main app |
| `scenario.html` | 567 | Timed roleplay mode | Main app |
| `report.html` | 173 | Post-session AI report | Post-chat |
| `mistakes.html` | 350 | Mistake cards from report | Post-chat |
| `quiz.html` | 454 | Post-session quiz (incl. a "speak" question, also BYOK-direct) | Post-chat |
| `profile.html` | 271 | View/edit profile (uses newer "Chats" design system) | Main app |
| `settings.html` | 275 | Account settings, Gemini key management | Main app |
| `pricing.html` | 466 | Plans (Free/Starter/Commit Mode/Unlimited), Commit Mode disclosure modal | Main app / upsell |

## Shared modules (`www/shared/*.js`)

| File | Responsibility |
|---|---|
| `config.js` | Supabase URL/key, backend URL (main/local toggle), Telegram support link |
| `auth.js` | Session storage, token refresh (proactive, dedup'd), `apiFetch()` wrapper, post-auth routing |
| `sanitize.js` | `escapeHtml()` — **must** wrap any AI/user text going into `innerHTML` |
| `score-ring.js` | Shared SVG progress-ring builder (report.html + mistakes.html) |
| `mic-helpers.js` | Gemini API key local storage helpers |
| `gemini-key-check.js` | Validates Gemini key before starting a session |
| `drawer.js` | Hamburger side-nav (drawer) logic |
| `back-nav.js` | Android hardware back-button handling |
| `commit-mode-widget.js` | Daily progress banner (chat.html) |
| `plan.js` | Plan/entitlement helpers |
| `upsell.js` | Upsell prompts logic |
| `voice-live-session.js` | Core Gemini live-session wiring (used by chat.html, quiz.html) |
| `style.css` | **Single shared stylesheet for the whole app** — see DESIGN_SYSTEM.md for audit |

## Known cross-cutting rule (from README)
`report.html`, `mistakes.html`, `quiz.html` render AI-generated text into
`innerHTML`. Always pass through `escapeHtml()` — don't add a new raw
interpolation of dynamic/AI/user text.

## Working agreement for this project
- **One page/feature at a time** — no batch refactors across pages.
- Frontend-only scope. Backend touched only to read API response shapes when needed — never modified.
- `CODEBASE_MAP.md` and `DESIGN_SYSTEM.md` updated after each change that adds a new pattern/token/component.
