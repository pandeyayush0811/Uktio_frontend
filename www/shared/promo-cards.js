// Single source of truth for the horizontal-scroll promo cards on
// home.html. home.html just loops over this array and renders whatever
// is here — it never hardcodes a specific card.
//
// TO ADD A NEW PROMO CARD (e.g. a new feature launch): add one object
// below. Nothing else needs to change — no HTML edit, no home.html
// script edit. It will automatically appear in the scroll row, in
// array order.
//
// Fields:
//   id     — unique string, used as a DOM key (no spaces)
//   title  — short card title (few words)
//   desc   — one short line, no more than ~40 chars (card is small)
//   icon   — raw inline SVG string. Use stroke="currentColor",
//            viewBox="0 0 24 24", stroke-width="2" to match the rest
//            of the app's icon set (see shared/drawer.js for examples).
//   link   — where tapping the card navigates to
//   badge  — optional short uppercase text (e.g. "NEW"); null to omit

export const PROMO_CARDS = [
  {
    id: 'commit-mode',
    title: 'Commit Mode',
    desc: 'Daily streak, daily discipline.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
    link: 'pricing.html#commit-mode',
    badge: null,
  },
  {
    id: 'scenario',
    title: 'Scenario Practice',
    desc: 'Real-world roleplay, timed.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    link: 'scenario.html',
    badge: null,
  },
];
