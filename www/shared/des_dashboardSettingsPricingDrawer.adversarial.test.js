// Role: 06_TestWriter
// Target: Dashboard Nav, Pricing Page Density, Settings Groups & Drawer Monogram (Hardcore Adversarial Suite)
// Issues: DES-016, DES-017, DES-018, DES-019, DES-021 (24 Hard Adversarial Tests)

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('DES-016, DES-017, DES-018, DES-019, DES-021: Dashboard, Pricing, Settings & Drawer — Adversarial Suite', () => {
  const homeHtmlPath = path.resolve(__dirname, '../home.html');
  const pricingHtmlPath = path.resolve(__dirname, '../pricing.html');
  const settingsHtmlPath = path.resolve(__dirname, '../settings.html');
  const drawerJsPath = path.resolve(__dirname, 'drawer.js');
  const styleCssPath = path.resolve(__dirname, 'style.css');

  let homeHtml = '';
  let pricingHtml = '';
  let settingsHtml = '';
  let drawerJs = '';
  let styleCss = '';

  beforeEach(() => {
    homeHtml = fs.readFileSync(homeHtmlPath, 'utf8');
    pricingHtml = fs.readFileSync(pricingHtmlPath, 'utf8');
    settingsHtml = fs.readFileSync(settingsHtmlPath, 'utf8');
    drawerJs = fs.readFileSync(drawerJsPath, 'utf8');
    styleCss = fs.readFileSync(styleCssPath, 'utf8');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-016: Home Quick Nav Tiles Geometry & Bottom Safe-Area Inset (Tests 1–6)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-016.1: style.css styles .quick-nav-tile with cohesive card border-radius (14px–18px) instead of 999px pill', () => {
    // Why this matters: 999px pill shape looked like floating action buttons rather than secondary navigation cards.
    const tileRule = styleCss.match(/\.quick-nav-tile\s*\{([^}]+)\}/);
    expect(tileRule).toBeTruthy();
    expect(tileRule[1]).toMatch(/border-radius\s*:\s*(1[4-8]px|var\(--radius-card\))/);
  });

  it('DES-016.2: .quick-nav-grid uses CSS Grid with 2 equal columns and 12px gap', () => {
    // Why this matters: Layout balance — tiles must sit symmetrically side-by-side.
    const gridRule = styleCss.match(/\.quick-nav-grid\s*\{([^}]+)\}/);
    expect(gridRule).toBeTruthy();
    expect(gridRule[1]).toMatch(/grid-template-columns\s*:\s*1fr\s+1fr/);
    expect(gridRule[1]).toMatch(/gap\s*:\s*12px/);
  });

  it('DES-016.3: style.css applies safe-area bottom cushion to .home-wrap preventing gesture navigation collisions', () => {
    // Why this matters: Quick nav tiles were flush against the screen bottom on bezel-less Android phones.
    const wrapRule = styleCss.match(/\.home-wrap\s*\{([^}]+)\}/) || styleCss.match(/\.wrap\s*\{([^}]+)\}/);
    expect(wrapRule).toBeTruthy();
    expect(wrapRule[1]).toMatch(/env\(\s*safe-area-inset-bottom/);
  });

  it('DES-016.4: home.html hero start card (.hero-start-card) uses editorial gradient with burnt-orange shadow recipe', () => {
    // Why this matters: The single primary action card on home must dominate visual hierarchy.
    const heroRule = styleCss.match(/\.hero-start-card\s*\{([^}]+)\}/);
    expect(heroRule).toBeTruthy();
    expect(heroRule[1]).toMatch(/linear-gradient/);
    expect(heroRule[1]).toMatch(/border-radius\s*:\s*26px/);
  });

  it('DES-016.5: home.html Explore promo scroll (.promo-scroll) has right-edge gradient mask for scroll cue', () => {
    // Why this matters: Subtle mask provides visual cue that horizontal cards continue off-screen.
    const promoScrollRule = styleCss.match(/\.promo-scroll\s*\{([^}]+)\}/);
    expect(promoScrollRule).toBeTruthy();
    expect(promoScrollRule[1]).toMatch(/mask-image|overflow-x\s*:\s*auto/);
  });

  it('DES-016.6: home.html greeting displays real calculated streak badge with SVG flame icon', () => {
    // Why this matters: Streak motivation is a core retention hook and must render cleanly beside greeting.
    expect(homeHtml).toMatch(/home-streak-badge/);
    expect(homeHtml).toMatch(/homeStreakValue/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-017 & DES-018: Pricing Card Density & Commit Mode Sheet (Tests 7–14)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-017.7: pricing.html plan cards have compact vertical feature spacing (gap <= 12px)', () => {
    // Why this matters: Excessive vertical gaps stretched the pricing page over 1,800px.
    const featureListRule = styleCss.match(/\.plan-features\s*\{([^}]+)\}/) || pricingHtml.match(/\.plan-features\s*\{([^}]+)\}/);
    expect(featureListRule).toBeTruthy();
    expect(featureListRule[1]).toMatch(/gap\s*:\s*(8|9|10|11|12)px/);
  });

  it('DES-017.8: pricing.html featured plan (Commit Mode) has elevated border and distinctive shadow recipe', () => {
    // Why this matters: Highest commitment plan must visually stand out from standard starter tier.
    const featuredRule = pricingHtml.match(/\.plan-card\.featured\s*\{([^}]+)\}/) || styleCss.match(/\.plan-card\.featured\s*\{([^}]+)\}/);
    expect(featuredRule).toBeTruthy();
    expect(featuredRule[1]).toMatch(/border-color\s*:\s*var\(--accent-orange\)/);
  });

  it('DES-017.9: pricing.html Unlimited tier is visually dimmed/compacted as waitlist-only', () => {
    // Why this matters: Disabled tiers should not dominate vertical page space over active purchasing options.
    expect(pricingHtml).toMatch(/unlimitedCard/);
    expect(pricingHtml).toMatch(/unlimitedBtn/);
    expect(pricingHtml).toMatch(/Join waitlist/i);
  });

  it('DES-018.10: Commit Mode disclosure bottom sheet (.commit-mode-disclosure-card) has top rounded corners (22px–24px)', () => {
    // Why this matters: Standard bottom-sheet curvature for mobile dialogs.
    const sheetRule = styleCss.match(/\.commit-mode-disclosure-card\s*\{([^}]+)\}/);
    expect(sheetRule).toBeTruthy();
    expect(sheetRule[1]).toMatch(/border-radius\s*:\s*2[2-6]px\s+2[2-6]px\s+0\s+0/);
  });

  it('DES-018.11: Commit Mode disclosure overlay (.commit-mode-disclosure-overlay) has backdrop blur or semi-transparent scrim', () => {
    // Why this matters: Scrim focuses visual attention on critical non-refundable policy terms.
    const overlayRule = styleCss.match(/\.commit-mode-disclosure-overlay\s*\{([^}]+)\}/);
    expect(overlayRule).toBeTruthy();
    expect(overlayRule[1]).toMatch(/rgba\(20,\s*20,\s*35/);
  });

  it('DES-018.12: Commit Mode rules use circular numbered step badges (.commit-mode-rule .num) with accent soft tint', () => {
    // Why this matters: Clear typographic ordering for strict habit contract clauses.
    const numRule = styleCss.match(/\.commit-mode-rule\s+\.num\s*\{([^}]+)\}/);
    expect(numRule).toBeTruthy();
    expect(numRule[1]).toMatch(/border-radius\s*:\s*50%/);
  });

  it('DES-018.13: Commit Mode consent row has clear checkbox hit area and structured label', () => {
    // Why this matters: Mandatory regulatory consent must be unambiguous and comfortably checkable.
    const consentRule = styleCss.match(/\.commit-mode-consent-row\s*\{([^}]+)\}/);
    expect(consentRule).toBeTruthy();
    expect(consentRule[1]).toMatch(/border-radius\s*:\s*12px/);
  });

  it('DES-018.14: Commit Mode purchase button is disabled until user explicitly checks the consent checkbox', () => {
    // Why this matters: Compliance gate — checkout must not proceed without explicit user agreement to daily streak policy.
    expect(pricingHtml).toMatch(/commitModeConsent/);
    expect(pricingHtml).toMatch(/commitModeConfirmBtn\.disabled/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-019: Settings Grouped Layout & Destructive Action Polish (Tests 15–20)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-019.15: settings.html organizes settings into labeled sections (Account, Plan, AI Setup, Help, Legal, About)', () => {
    // Why this matters: Scannable grouping of account controls.
    expect(settingsHtml).toMatch(/settings-section-label/);
    expect(settingsHtml).toMatch(/Account/);
    expect(settingsHtml).toMatch(/Plan/);
    expect(settingsHtml).toMatch(/AI Setup/);
    expect(settingsHtml).toMatch(/Help/);
    expect(settingsHtml).toMatch(/Legal/);
  });

  it('DES-019.16: settings.html style.css defines .btn-destructive-outline / destructive styling for #deleteKeyBtn', () => {
    // Why this matters: Destructive actions (deleting Gemini API key) must have clear visual danger cues.
    expect(settingsHtml).toMatch(/deleteKeyBtn/);
    expect(settingsHtml).toMatch(/var\(--bad\)|destructive/);
  });

  it('DES-019.17: settings.html AI Setup provides collapsible details panel (.collapsible-panel) with smooth max-height transition', () => {
    // Why this matters: Accordion panel must smoothly expand when user wants to view security details.
    const collRule = styleCss.match(/\.collapsible-panel\s*\{([^}]+)\}/);
    expect(collRule).toBeTruthy();
    expect(collRule[1]).toMatch(/transition\s*:\s*.*max-height/);
  });

  it('DES-019.18: settings.html Legal section contains direct links to in-app terms.html and privacy.html', () => {
    // Why this matters: Play Store and regulatory compliance requirement.
    expect(settingsHtml).toMatch(/href=["']terms\.html["']/);
    expect(settingsHtml).toMatch(/href=["']privacy\.html["']/);
  });

  it('DES-019.19: settings.html logout button triggers accessible confirmation dialog before clearing session', () => {
    // Why this matters: Accidental logout tap must be confirmed to prevent unintentional session drops.
    expect(settingsHtml).toMatch(/showConfirmDialog/);
    expect(settingsHtml).toMatch(/logout/);
  });

  it('DES-019.20: settings.html displays active plan status card with renewal date and manage plan CTA', () => {
    // Why this matters: User must clearly see their active subscription tier and expiration.
    expect(settingsHtml).toMatch(/planCard/);
    expect(settingsHtml).toMatch(/vPlanExpiry/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-021: Navigation Drawer Monogram Avatar & Brand Consistency (Tests 21–24)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-021.21: drawer.js renders user initial monogram in Georgia serif when user name is available', () => {
    // Why this matters: Personal touch and consistency with profile.html hero avatar.
    expect(drawerJs).toMatch(/drawerUserName|drawerAvatar|drawer-avatar/);
  });

  it('DES-021.22: drawer.js provides smooth open/close transform transition (translateX) with backdrop overlay', () => {
    // Why this matters: Navigation drawer must slide smoothly from the left edge.
    const panelRule = styleCss.match(/\.drawer-panel\s*\{([^}]+)\}/);
    expect(panelRule).toBeTruthy();
    expect(panelRule[1]).toMatch(/transition\s*:\s*transform/);
    expect(panelRule[1]).toMatch(/transform\s*:\s*translateX\(-100%\)/);
  });

  it('DES-021.23: drawer.js registers Android hardware back button handler to close drawer when open', () => {
    // Why this matters: Native Android UX standard — pressing back when drawer is open closes the drawer, not the app.
    expect(drawerJs).toMatch(/registerBackHandler/);
  });

  it('DES-021.24: drawer.js highlights active page navigation link based on activePage parameter', () => {
    // Why this matters: User must see their current location in the navigation hierarchy.
    expect(drawerJs).toMatch(/activePage\s*===\s*['"]home['"]/);
    expect(drawerJs).toMatch(/activePage\s*===\s*['"]profile['"]/);
    expect(drawerJs).toMatch(/activePage\s*===\s*['"]chats['"]/);
  });
});
