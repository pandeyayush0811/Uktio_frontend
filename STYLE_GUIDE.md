# Uktio — Portable Style Guide
_Copy-paste this whole file as context to any AI/designer to get consistent output._

## Brand direction
Premium English-speaking-practice app for a serious, aspirational
audience (interview prep, professional confidence). Aesthetic: **"Bold
Editorial"** — warm, confident, magazine-like. NOT playful/childish, NOT
generic flat SaaS blue.

## Colors (exact hex)
```
--bg: #eef0fb              /* app background, cool lavender-white */
--card: #ffffff            /* card/surface background */
--panel-2: #f4f5fb         /* secondary surface, inputs */
--ink: #23263a             /* primary text */
--ink-dim: #8b8fa3         /* secondary/muted text */
--line: #e7e8f4            /* borders, dividers */
--accent: #6a63f1          /* primary purple — legacy, used on auth/forms */
--accent-soft: #e7e5fd     /* purple tint background */
--bad: #e0575c             /* error/destructive */
--accent-orange: #d9694b   /* PRIMARY brand accent going forward — CTAs, hero */
--accent-soft-orange: #f6e2da  /* orange tint background, icon chips */
```
Rule: **`--accent-orange` (#d9694b) is the primary action color** for
anything new. `--accent` (purple, #6a63f1) still exists on older
screens (login/forms) — don't remove it, but don't use it for new
primary CTAs either. This is a known in-progress transition, not two
competing systems.

## Typography
```
--font-body / --font-display: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans Devanagari', sans-serif
--font-serif: Georgia, 'Times New Roman', serif
```
- **Serif (Georgia)** for: headlines, greetings, card titles, anything
  meant to feel warm/editorial/human. Weight 700.
- **Sans-serif (system font)** for: body text, labels, buttons, form
  inputs, anything functional/dense.
- Never use serif for small dense text (<0.85rem) — it gets muddy at
  small sizes.

## Shape & elevation
- Border radius: cards `16–22px`, buttons `10–12px`, small chips/icon
  tiles `9–10px`, pills/badges `999px` (fully rounded).
- Shadows (two recipes only, don't invent new ones):
  - Cards: `0 6px 18px -12px rgba(60,60,120,0.25)`
  - Hero/elevated elements: `0 14px 30px -14px rgba(217,105,75,0.55)` (orange-tinted, for orange-background elements) or `0 20px 40px -20px rgba(60,60,120,0.18)` (neutral, for white cards)

## Icons
Inline SVG only (no icon font, no external image files — app must work
offline in Capacitor WebView).
- Line icons (nav, utility): `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`, sized 17–22px.
- Icon "chips" (icon inside a colored rounded square): 34–36px
  container, `border-radius:9–10px`, background = a soft tint of
  whatever accent it represents (`--accent-soft` for purple contexts,
  `--accent-soft-orange` for orange contexts), icon itself sized ~50%
  of container.

## Layout constraints (mobile app, not web)
- Single column, max-width `480px`, centered.
- Root wrapper padding: `20px 20px 16px`.
- Full-height screens: `height:100vh; height:100dvh; overflow:hidden`
  (individual scrollable regions opt in with their own `overflow-y:auto`).
- Respect safe-area insets (notch/home-indicator) — don't hardcode
  fixed bottom elements without accounting for this on real devices.

## Component patterns already established (extend, don't reinvent)
- **Primary button**: full-width, `background:var(--accent-orange)` (new) or `var(--accent)` (legacy forms), white text, `border-radius:12px`, `padding:13px 20px`, weight 600.
- **Card**: `background:var(--card)`, `border-radius:16-26px`, padding `16-24px`, neutral shadow.
- **Hero/promo card**: gradient background (`linear-gradient(135deg, var(--accent-orange), #c85a3d)`), white text, used sparingly — one per screen max, for the single most important action.
- **Horizontal scroll row**: for any "browse a growing list of things" pattern (promos, categories) — never a vertical stack that could grow unbounded.
- **Empty/loading/error states**: every data-driven screen needs all three, explicitly designed — not an afterthought. Loading = centered spinner + label (`.page-loader` pattern). Error = red text + a way to recover, not a dead end.

## Motion
Subtle only: `transition` on hover/active states (0.15–0.25s ease),
button press = `transform:scale(0.98)`. No decorative animation, no
bouncing, no confetti unless celebrating a genuine milestone.

## What NOT to do
- Don't introduce a new accent color without a stated reason.
- Don't use drop-shadow + border together on the same element (pick one).
- Don't use more than ~2 font sizes on one card.
- Don't add icon-only buttons without `aria-label`.
