# Uktio — Design System (Audit + Living Doc)

Status: **Audit of existing `shared/style.css`**, not yet a formal system.
Update this file every time a page-level change introduces a new token,
component, or pattern.

## Current tokens (`:root` in `shared/style.css`)

```css
--bg: #eef0fb;
--card: #ffffff;
--panel-2: #f4f5fb;
--ink: #23263a;
--ink-dim: #8b8fa3;
--line: #e7e8f4;
--accent: #6a63f1;        /* primary purple/violet */
--accent-soft: #e7e5fd;
--bad: #e0575c;
--accent-orange: #d9694b; /* added later, used ONLY on the FAB */
--font-display / --font-body   /* identical values — no real distinction */
--font-serif: Georgia, 'Times New Roman', serif;  /* used only on history.html title */
```

## Issues found in current system (flagged, not yet fixed — waiting on page-by-page go-ahead)

1. **Two design eras coexist.** Original card-based system (purple accent,
   system sans-serif) + a newer "Chats" system (serif display font,
   orange accent, added later — comment literally says "New light
   'Chats' design system"). Result: `history.html` and `profile.html`
   feel visually different from `login.html`/`onboarding.html`/`settings.html`.
   This is the single biggest "does this feel handmade by one team"
   red flag — will raise as a real conversation once we're in a screen
   that touches it.
2. **No defined spacing scale.** Padding/margin values are ad-hoc:
   6, 8, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26px all appear without
   a system (not a clean 4/8pt grid).
3. **No defined type scale.** Font sizes in use: 0.7, 0.72, 0.76, 0.78,
   0.8, 0.82, 0.85, 0.86, 0.88, 0.9, 0.92, 0.94, 0.95, 0.98, 1.05, 1.15,
   1.5, 2rem — 18 distinct sizes for what should be ~6-7 step scale.
4. **Box-shadows repeated inline** rather than as tokens — same
   shadow recipe (`0 6px 18px -12px rgba(60,60,120,0.25)` /
   `0 20px 40px -20px rgba(60,60,120,0.18)`) copy-pasted across cards.
5. **No dark mode / color-scheme handling** — single fixed light palette.
6. **`--accent-orange` is a one-off** — used only for the FAB
   (`history.html`). Two accent colors with no defined relationship
   (secondary CTA? alert? just decoration?) is a smell.

None of these are being touched yet — listing them here so decisions
are visible and I don't "rediscover" the same issue on every page.

## Reusable components already in shared CSS (extend these, don't reinvent)
- `.card` — base elevated container
- `button.primary` / `button.secondary` — form actions
- `.chip` / `.chip-group` — selectable option list (onboarding)
- `.page-loader` — centered async loading state (documented as reusable in the CSS itself)
- `.collapsible-panel` — expand/collapse detail section
- `.drawer-*` — hamburger nav
- `.profile-row` / `.profile-*` — icon-label-value rows
- `.commit-mode-*` — Commit Mode banner + disclosure modal

## Mobile/Capacitor constraints already respected in current code
- `.wrap` caps width at 480px, uses `100dvh` — good practice already in place.
- `back-nav.js` — Android hardware back-button handled per-page.
- `html, body { overflow:hidden; overscroll-behavior:none }` — prevents
  browser-chrome bounce/scroll artifacts inside the WebView.

## Log of changes made through this project

### home.html (new)
- New hub/entry page. Adopts the "Chats" design system (serif + orange) as the app's primary direction going forward — see `--accent-orange`/`--font-serif` usage.
- New pattern: **config-driven horizontal scroll promo row** — `shared/promo-cards.js` is the single source of truth; adding a card there is the only step needed to add a new promotable feature. Do not hardcode new promo cards directly in HTML.
- Routing: `shared/auth.js`'s `goToPostAuthDestination()` now sends users here (was `chat.html`). `chat.html` is now a sub-screen, not the hub.
- Back-nav parents updated app-wide: `history.html`, `profile.html`, `settings.html`, `scenario.html`, `chat.html` all now point back to `home.html` (were pointing to `chat.html`).
- New token added: `--accent-soft-orange: #f6e2da` (soft tint of `--accent-orange`, for icon chip backgrounds).

### settings.html
- Header title now serif, back-link bug fixed (was hardcoded to `chat.html`, didn't match the hardware-back destination).
- Plan section rebuilt as `.plan-status-card` — visually distinct (left-border accent when active, full orange gradient card when inactive/expired) since this is the commercially important upsell surface. Replaced the old flat `.profile-fields-card` + separate CTA button pattern for this section only.
- New scoped modifier `.profile-row-icon.tint-orange` — local to settings.html's own `<style>` block, NOT added to the shared `.profile-row-icon` definition in `shared/style.css`. This means `profile.html`'s icon chips are untouched/still purple until that page is redesigned. When profile.html is redesigned, decide then whether `tint-orange` becomes the shared default or stays a modifier.
- Icon illustrations (flame/target/book style, 3D-rendered) requested by product owner but **not implemented as SVG** — that visual style is a rendered image asset, not achievable in clean vector code. Deferred until real asset files (PNG/WebP) are sourced/generated and provided; current icons remain flat-SVG placeholders, swappable later without layout changes.
