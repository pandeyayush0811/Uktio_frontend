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
--accent: #6a63f1;        /* primary purple/violet — legacy, login/onboarding/settings forms */
--accent-soft: #e7e5fd;
--bad: #e0575c;
--good: #3a9463;          /* NEW (chat.html pass) — semantic green, parallel to --bad; connected/live states */
--accent-orange: #d9694b; /* now the primary CTA/accent app-wide going forward, per STYLE_GUIDE.md */
--accent-soft-orange: #f6e2da;
--font-display / --font-body   /* identical values — no real distinction */
--font-serif: Georgia, 'Times New Roman', serif;  /* now used on history.html, home.html, settings.html, scenario.html, chat.html headers */
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

### scenario.html (full visual rebuild, matches product-owner-provided reference mockup)
- Countdown moved from a small chip to a **circular progress ring** (SVG, pure code) — orange arc depletes as time passes, center shows `m:ss`, "LIVE" + pulsing dot beneath it during roleplay. Ring switches to a static filled state with a "Feedback" label once phase 2 starts (monologue has no fixed countdown).
- Chat transcript redesigned: AI lines get a small sparkle-icon avatar chip; user lines get a timestamp + read-checkmark underneath, right-aligned. Timestamps are client-side/cosmetic only (`new Date()` at message-creation time) — not sent to the backend, matches the existing pattern of UI-only metadata (see `persistLocalSession()`'s comment on why `phase` itself is dropped before syncing).
- **Feedback messages are now a distinct card** (trophy icon + "Feedback" heading + body + timestamp), not a tinted chat bubble — matches the reference mockup. Behavior refinement: the card treatment is now keyed off `role === 'model' && phase === 'feedback'` specifically, not just `phase === 'feedback'` — a user question asked during the feedback phase still renders as a normal user bubble, not wrapped in the coaching-card styling.
- Mic dock rebuilt: primary mic button + a secondary circular "AI is speaking" indicator, both with fixed captions underneath ("Tap to speak / Speak clearly and naturally" vs "AI is speaking / Please listen") that swap highlight state based on `onSpeakingChange`. Replaces the previous free-text `micMuteNote` sentence-based approach.
- Completion ("locked") card rebuilt as a celebratory orange-tinted card (icon + serif headline + subtext + pill CTA), replacing the flat grey box. **Trophy is now a real illustration asset** (`assets/icons/trophy-celebration.webp`) — product-owner-provided PNG (1254×1254, 1.5MB), resized to 400×400 and converted to WebP (78KB) for mobile bundle size. Kept as a raster image deliberately, not traced to SVG — the glossy gradients/confetti wouldn't survive vectorization. Display slot widened from the earlier 58px flat-icon placeholder to 108px so the illustration (which spreads confetti well beyond the trophy itself) reads properly instead of being cropped/illegible at icon size. The small 30px trophy icon inside the feedback-message card stays flat SVG — a photographic asset at that size would just look blurry, so that one small inline icon is a deliberately different treatment from the large celebratory illustration.
- Footer (mic-permission disclaimer) restored with a lock icon, matching the reference mockup.
- Session-aware locked-banner CTA (deep-links to `report.html?session=<id>&generate=1` when the just-completed session's id is known, same pattern `history.html` already uses; falls back to `history.html` when the scenario was already locked on page-load) — a genuinely useful navigation fix, kept independent of the visual rebuild.
- Non-visual improvements kept from an external contributor's earlier pass on this page: the `shared/plan.js` trial-banner bug fix via new module `shared/trial-time.js` (`formatTrialTimeLeft` — rounds fractional days cleanly, switches to hours under 1 day), and the project's first test suite (`vitest`, `trial-time.test.js` + `scenario-phase.test.js`, 19 tests, all passing). `shared/scenario-phase.js`'s `formatCountdown()` is still used (now for the ring's center label); its chip-specific `getPhaseBadgeState()` helper is no longer called since the ring's visual states don't map 1:1 to the old chip's shape — the pure formatting function was reused, the chip-shaped helper wasn't.
- App-wide Hinglish/English UI-copy convention is still an open, undecided question (system status lines here are English; in-scene AI voice and some static labels like "Aaj ka scenario complete!" remain Hinglish) — flagging again since this is the second page where the inconsistency surfaced.

### chat.html (visual pass — matches scenario.html/home.html era)
- Header title switched to serif (`--font-serif`), scoped locally via inline style on this page's `<h1 class="app-title">` — same pattern settings.html already used. Shared `.app-title` class itself untouched, so login/onboarding headers are unaffected.
- New token: `--good: #3a9463` added to `shared/style.css` — parallel to the existing `--bad` semantic token, used for the status dot's "live/connected" state. Additive only, no existing rule changed.
- Status dot now actually changes color (`.dot.live` = green, `.dot.err` = red) — previously these modifier classes were toggled by JS but had zero CSS backing them, so the dot was always the same grey regardless of state. Fixed as part of this pass since it's the same component being restyled.
- **New reusable transcript pattern**: `.line-row` (wraps `.avatar-chip` + `.line-col`) replaces the old flat `.line` bubbles. AI lines get a small sparkle-icon avatar chip (orange-tinted, matches STYLE_GUIDE's icon-chip spec); user lines get a `.line-meta` caption (client-side timestamp + checkmark icon, cosmetic only — same UI-only-metadata pattern scenario.html established, never sent to the backend). `addLine()`/`addHistoricalLine()` in chat.html's inline script updated to build this DOM shape; `sessionTurns`/sync logic untouched.
- Mic dock rebuilt: wave bars split into `#waveLeft`/`#waveRight` flanking the mic button (was a single absolute-positioned group behind it) — matches the reference mockup's symmetric waveform. Mic button is now orange-filled (`--accent-orange`) as the default state (was white-with-purple-icon, purple-filled only when active) — aligns with STYLE_GUIDE's "orange is primary CTA" rule. `buildWave()`/`setStatus()` updated accordingly; connect/session logic untouched.
- Report-pill and locked-banner re-themed from purple-outline/flat-grey to solid-orange / orange-gradient-card — matches the celebratory treatment already established on scenario.html's completion card for this class of "important upsell/completion moment" surface.
- Footer mic-permission line got a lock icon (inline SVG, matches STYLE_GUIDE's icon spec) — copy unchanged.
- **Known deferred item**: the reference mockup shows a two-line status area (bold state label + a separate descriptive subtitle). Kept as a single dynamic line for this pass — `setStatus()` is called from ~15 places in this file with full custom copy each time, and splitting it into two tiers would mean rewriting every call site's message into a label+subtitle pair. Flagging as a real follow-up, not silently dropped.

### settings.html — Legal section added
- New "Legal" section inserted between "Help & Community" and "About" — two tappable rows (Terms and conditions, Privacy policy) in one `.profile-fields-card` shell, separated by a 1px divider. Reuses the existing `.profile-row-icon.tint-orange` icon-chip (already scoped to this page) — no new shared token.
- New scoped classes, local to settings.html's own `<style>` block only: `.legal-label` (orange section-label + small "New" pill), `.legal-link-row` (link-row layout + divider-between-siblings), `.legal-link-label`. Nothing added to `shared/style.css`.
- Rows link out to two new standalone pages, `terms.html` and `privacy.html` — same header/back-nav pattern as every other page (`initBackNav('settings.html')`). Both currently contain clearly-marked **placeholder** legal copy (product owner needs to supply real text before this ships) — structure (h2 sections) is ready, content is not final.
- Zero existing settings.html logic touched — Plan/AI-Setup/Account/Help sections, `getPlanStatus()`, Gemini key handling, logout: all byte-identical.

### shared/drawer.js + shared/style.css's `.drawer-*` rules (visual pass — matches home/scenario/chat/settings/pricing era)
- **Biggest remaining "two design eras" gap, now closed.** Drawer was the last major cross-cutting component still on the legacy purple/sans system (`--accent-soft`/`--accent` avatar, no serif, flat nav rows) even though all 4 pages that mount it (home, profile, history, scenario) had already moved to the orange/serif era. Matches product-owner-provided reference mockup.
- User avatar: switched from purple (`--accent-soft`/`--accent`) to the standard orange icon-chip treatment (`--accent-soft-orange`/`--accent-orange`) — same pattern as every icon-chip elsewhere in the app. User name now serif, matches card-title convention.
- Nav items: active-state highlight now uses `var(--bg)` (the app's own lavender-white background token, already existed — not a new color) as a subtle selected-row tint, with the active item's icon recoloring to `--accent-orange`. Hover state unchanged (`--panel-2`). No new tokens added.
- "New chat" row gets a distinct circular-outline treatment around its plus icon (scoped `#drawerNewChat svg` rule) — visually marks it as an action, not a navigation destination, without changing its markup structure.
- Recent-chat rows rebuilt as bordered cards (`1px solid var(--line)`, `14px` radius) instead of flat hover-only rows — avatar circle now orange-tinted (same icon-chip pattern), and **each row now also shows session duration** (`formatDuration()`, a small local copy of the same pure function `history.html` already uses — kept local rather than imported cross-file for one formatter) alongside the existing date/turn-count, so the row reads "date · duration · turns", consistent with what `history.html` already shows. No new data added — everything shown was already returned by `/chat/sessions`.
- **Explicitly decided against inventing per-session titles** (e.g. "Client meeting roleplay") — the backend's `/chat/sessions` response has no `title`/`topic` field, only `id`/`started_at`/`ended_at`/`turn_count`/`session_type`/`has_report`. Product owner confirmed: keep the existing date/duration/turn-count pattern (matches history.html), do not fabricate session names. Real per-session titles would require a backend change (new field + generation logic) — flagged as a future backend-team decision, not attempted here per "frontend-only, never modify backend" rule.
- Drawer panel gets a rounded outer-right edge (`border-radius: 0 24px 24px 0`) and a slightly deeper overlay tint (0.35 → 0.4 opacity) for better contrast against the reference mockup — cosmetic only, no structural change.
- Drawer's own loading-spinner color fixed from legacy `--accent` (purple) to `--accent-orange` — same component, same pass, consistency fix.
- **Zero data/session logic touched** — `apiFetch()` calls, cache-first profile load, resume-session click handler, `mountDrawer()`'s public API (`{ open, close }`), all byte-identical. Only the visual layer and one added display-only formatting field.

### pricing.html (visual pass — matches home/scenario/chat/settings era)
- Header title switched to serif, larger (`.plans-title`), inline-added alongside `.app-title` (scoped to this page, shared class untouched).
- **Commit Mode is now the visually featured plan** — orange border + "Most committed" badge + solid orange gradient CTA — per product-owner decision (this app's highest-engagement tier). Starter and Unlimited use outline-style orange buttons (secondary weight); this is the first page where one plan card is deliberately made more prominent than its siblings.
- Each plan card got a small hand-built inline-SVG line-art illustration (plant/sprout for Trial, hot-air-balloon for Starter, mountain-with-flag for Commit Mode, moon-and-mountains for Unlimited) — flat outline style, no new asset files, consistent with STYLE_GUIDE's "inline SVG only, must work offline in Capacitor WebView" rule. Not raster/photographic — deliberately kept as simple line-art since that's what the reference called for, unlike scenario.html's trophy which needed a raster asset for a glossy/confetti look.
- Price typography rebuilt: serif large amount, small superscript-style ₹ symbol, divider line under the price row before the feature list — replaces the old flat "₹99/30 days" single-line treatment.
- Checkmark icons swapped from small plain check-strokes to a circular check-badge icon (bigger, more deliberate, orange) for the feature lists.
- Trial card, when not the active plan, now gets a scoped `.trial{opacity:0.82}` quieter treatment from the start (previously it only dimmed reactively via a JS-added `.dimmed` class after upgrade) — cleaner starting state than the old flat white-card-among-equals look.
- Commit Mode's badge is dual-purpose: "Most committed" (marketing label, shown to non-owners by default) swaps to "Current plan" via a one-line `textContent` change in `refreshPlanState()` once `status.plan === 'commit_mode'` is true — same element, same JS trigger point as before, only the displayed copy changed.
- Buttons renamed from shared `.primary`/`.secondary` to a new page-scoped `.plan-cta` (`.outline` / `.solid` / `.muted` variants) — kept fully local to pricing.html's `<style>` block, shared `button.primary`/`.secondary` definitions in `shared/style.css` untouched, so no other page (login, onboarding, settings, etc.) is affected. Verified: every `id` the inline script references (`starterBtn`, `commitModeBtn`, `unlimitedBtn`, all badges/msgs) still exists exactly once and only `textContent`/`disabled`/`style.display` are mutated by JS — no `classList` calls depended on the old class names, so this rename was purebehavior-neutral.
- Commit Mode disclosure modal (the pre-purchase consent screen) got a serif heading, orange-tinted rule-number chips, and orange consent/confirm button — scoped overrides in pricing.html's own `<style>` block on top of the shared `.commit-mode-*` classes in `shared/style.css` (those shared rules themselves untouched — confirmed via search that they're only ever referenced from this one page, so no cross-page risk either way, but kept the edit local per convention).
- Footer payment-disclaimer line got a small lock icon, matching chat.html's footer treatment from the previous pass.
- **Zero payment/plan logic touched** — `refreshPlanState()`, checkout flows, waitlist flow, Commit Mode consent-then-checkout sequence all byte-identical except the one badge-text line noted above.
