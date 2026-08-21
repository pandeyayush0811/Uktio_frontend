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
| `history.html` | ~250 | "Chats" list — past sessions, date-grouped (structural rebuild) | Main app (uses newer serif "Chats" design system) |
| `chat.html` | 1129 | **Core feature** — live voice chat (BYOK, direct-to-Gemini) | Main app |
| `scenario.html` | 567 | Timed roleplay mode | Main app |
| `report.html` | 175 | Post-session AI report (Hinglish natural write-up) | Post-chat |
| `mistakes.html` | ~20 | Backward-compatible redirect bridge to report.html | Legacy route |
| `quiz.html` | ~20 | Backward-compatible redirect bridge to report.html | Legacy route |
| `profile.html` | 271 | View/edit profile (uses newer "Chats" design system) | Main app |
| `settings.html` | 275 | Account settings, Gemini key management | Main app |
| `pricing.html` | 466 | Plans (Free/Starter/Commit Mode/Unlimited), Commit Mode disclosure modal | Main app / upsell |
| `terms.html` | ~50 | Terms and conditions (placeholder legal copy, structure only) | Linked from settings.html |
| `privacy.html` | ~50 | Privacy policy (placeholder legal copy, structure only) | Linked from settings.html |

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
| `trial-time.js` | Pure `formatTrialTimeLeft(daysLeft)` — used by `plan.js`'s `trialBannerText()`, so it affects every page that shows the trial banner (chat.html, pricing.html, scenario.html). Has a test file. |
| `scenario-phase.js` | Pure `formatCountdown(seconds)`, used by scenario.html's countdown ring. Has a test file. |
| `promo-cards.js` | Config array for home.html's promo scroll row — single source of truth, see home.html section below |
| `history-grouping.js` | Pure `groupSessionsByDate(sessions, now)` — buckets history.html's session list into Today/Yesterday/This week/Earlier. Has a test file. |
| `upsell.js` | Upsell prompts logic |
| `voice-live-session.js` | Core Gemini live-session wiring (used by chat.html, quiz.html, scenario.html) |
| `style.css` | **Single shared stylesheet for the whole app** — see DESIGN_SYSTEM.md for audit |

## Test coverage
As of the `scenario.html` rebuild, the project has its first test suite:
`vitest` (dev dependency only, zero runtime/bundle impact). Run with
`npm test`. Current coverage is narrow and intentional — only pure,
DOM-free logic modules are tested (`trial-time.js`, `scenario-phase.js`,
`history-grouping.js`, 29 tests total, all passing). DOM-heavy / voice-session-coupled code
(most of chat.html, scenario.html, quiz.html, and history.html's card
rendering/expand/search itself) is still untested.
Strategy going forward: keep extracting pure logic (formatting,
state→label mapping, validation) into small DOM-free modules as pages
get touched, rather than attempting full-page/voice-session mocking.

## Known cross-cutting rule (from README)
`report.html`, `mistakes.html`, `quiz.html` render AI-generated text into
`innerHTML`. Always pass through `escapeHtml()` — don't add a new raw
interpolation of dynamic/AI/user text.

## Working agreement for this project
- **One page/feature at a time** — no batch refactors across pages.
- Frontend-only scope. Backend touched only to read API response shapes when needed — never modified.
- `CODEBASE_MAP.md` and `DESIGN_SYSTEM.md` updated after each change that adds a new pattern/token/component.
