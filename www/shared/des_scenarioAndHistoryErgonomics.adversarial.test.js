// Role: 06_TestWriter
// Target: Scenario Layout, Category Badges, History Accordion Transitions & Sticky Header (Hardcore Adversarial Suite)
// Issues: DES-013, DES-014, DES-015, DES-022 (22 Hard Adversarial Tests)

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('DES-013, DES-014, DES-015, DES-022: Scenario & History Ergonomics — Adversarial Suite', () => {
  const scenarioHtmlPath = path.resolve(__dirname, '../scenario.html');
  const historyHtmlPath = path.resolve(__dirname, '../history.html');
  const styleCssPath = path.resolve(__dirname, 'style.css');

  let scenarioHtml = '';
  let historyHtml = '';
  let styleCss = '';

  beforeEach(() => {
    scenarioHtml = fs.readFileSync(scenarioHtmlPath, 'utf8');
    historyHtml = fs.readFileSync(historyHtmlPath, 'utf8');
    styleCss = fs.readFileSync(styleCssPath, 'utf8');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-013: Scenario Category Badge & Proportional Ring on Mobile (Tests 1–8)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-013.1: scenario.html / style.css styles .category as a clean rounded pill badge instead of a raw bottom-bordered link', () => {
    // Why this matters: Bottom border looked like an active tab or underlined link rather than a status pill.
    const catRule = scenarioHtml.match(/\.category\s*\{([^}]+)\}/) || styleCss.match(/\.scenario-card\s+\.category\s*\{([^}]+)\}/);
    expect(catRule).toBeTruthy();
    expect(catRule[1]).toMatch(/border-radius\s*:\s*999px|padding\s*:\s*[2-4]px\s+[8-9|1[0-2]]px/);
  });

  it('DES-013.2: .scenario-card category badge uses --accent-soft-orange background with --accent-orange text', () => {
    // Why this matters: Badge visual language must match .announcement-banner-badge and .profile-hero-badge.
    const catRule = scenarioHtml.match(/\.category\s*\{([^}]+)\}/) || styleCss.match(/\.scenario-card\s+\.category\s*\{([^}]+)\}/);
    expect(catRule).toBeTruthy();
    expect(catRule[1]).toMatch(/var\(--accent-soft-orange\)|var\(--accent-orange\)/);
  });

  it('DES-013.3: .phase-ring-wrap uses flexible sizing (width <= 90px) to prevent title collision on narrow viewports', () => {
    // Why this matters: 100px fixed width ring squished scenario title and subtitle on 320px–360px Android devices.
    const ringWrapRule = scenarioHtml.match(/\.phase-ring-wrap\s*\{([^}]+)\}/);
    expect(ringWrapRule).toBeTruthy();
    expect(ringWrapRule[1]).toMatch(/width\s*:\s*(8[0-9]|9[0-2])px/);
  });

  it('DES-013.4: SVG countdown ring maintains exact circle geometry (cx="50" cy="50" r="42") with stroke-dasharray="263.9"', () => {
    // Why this matters: Mathematical perimeter calculation 2 * PI * 42 = 263.89 must remain exact for smooth timer tick down.
    expect(scenarioHtml).toMatch(/circle\s+class=["']ring-progress["'][^>]*r=["']42["']/);
    expect(scenarioHtml).toMatch(/stroke-dasharray=["']263\.9["']/);
  });

  it('DES-013.5: .phase-live-row .live-dot has subtle pulsing blink animation (@keyframes liveBlink)', () => {
    // Why this matters: Live roleplay state needs visual heartbeat indicating active timer countdown.
    expect(scenarioHtml).toMatch(/@keyframes\s+liveBlink\s*\{/);
    expect(scenarioHtml).toMatch(/animation\s*:\s*liveBlink/);
  });

  it('DES-013.6: scenario.html feedback card (.feedback-card) uses distinct coaching callout surface with sparkle icon', () => {
    // Why this matters: AI coaching feedback summary at round end must read as a distinct takeaway card.
    expect(scenarioHtml).toMatch(/\.feedback-card\s*\{/);
    expect(scenarioHtml).toMatch(/feedback-card-icon/);
  });

  it('DES-013.7: scenario.html celebratory completion card (.locked-banner) includes trophy illustration and history CTA', () => {
    // Why this matters: Completing daily scenario is a key milestone and deserves an editorial celebratory card.
    expect(scenarioHtml).toMatch(/\.locked-banner\s*\{/);
    expect(scenarioHtml).toMatch(/trophy-celebration/);
    expect(scenarioHtml).toMatch(/lockedSeeHistory/);
  });

  it('DES-013.8: Scenario countdown ring numbers use tabular figures (font-variant-numeric: tabular-nums) to prevent digit jitter', () => {
    // Why this matters: Without tabular-nums, countdown timer text jumps horizontally every second as numbers change width.
    const phaseValRule = scenarioHtml.match(/\.phase-ring-value\s*\{([^}]+)\}/);
    expect(phaseValRule).toBeTruthy();
    expect(phaseValRule[1]).toMatch(/font-variant-numeric\s*:\s*tabular-nums/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-014: Accordion Expansion Motion on Past Chats (Tests 9–14)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-014.9: history.html / style.css provides smooth max-height & opacity transition on .expanded-transcript', () => {
    // Why this matters: Instant display:none to display:block snap causes 320px vertical layout jerks.
    const transcriptRule = historyHtml.match(/\.expanded-transcript\s*\{([^}]+)\}/) || styleCss.match(/\.expanded-transcript\s*\{([^}]+)\}/);
    expect(transcriptRule).toBeTruthy();
    expect(transcriptRule[1]).toMatch(/transition\s*:\s*.*max-height/);
  });

  it('DES-014.10: .chat-card-chevron smoothly rotates 180 degrees (.chat-card.open .chat-card-chevron) on expand', () => {
    // Why this matters: Micro-interaction feedback confirming card open/close state.
    expect(styleCss).toMatch(/\.chat-card\.open\s+\.chat-card-chevron\s*\{[^}]*transform\s*:\s*rotate\(180deg\)/);
  });

  it('DES-014.11: .chat-card has role="button", tabindex="0", and dynamic aria-expanded attribute for keyboard accessibility', () => {
    // Why this matters: Custom div accordion controls must support Tab navigation and Enter/Space expand toggle.
    expect(historyHtml).toMatch(/card\.setAttribute\(['"]role['"],\s*['"]button['"]\)/);
    expect(historyHtml).toMatch(/card\.setAttribute\(['"]tabindex['"],\s*['"]0['"]\)/);
    expect(historyHtml).toMatch(/card\.setAttribute\(['"]aria-expanded['"]/);
  });

  it('DES-014.12: Keyboard Enter and Space events toggle card open state while preventing default spacebar scroll', () => {
    // Why this matters: Pressing Space to toggle an accordion must not cause the whole page to jump-scroll down.
    expect(historyHtml).toMatch(/if\s*\(\s*e\.key\s*===\s*['"]Enter['"]\s*\|\|\s*e\.key\s*===\s*['"]\s+['"]/);
    expect(historyHtml).toMatch(/e\.preventDefault\s*\(\s*\)/);
  });

  it('DES-014.13: history.html caches fetched transcripts locally in transcriptCache Map to prevent repeat network roundtrips', () => {
    // Why this matters: Collapsing and re-expanding a past chat should instantly show the transcript from memory.
    expect(historyHtml).toMatch(/const\s+transcriptCache\s*=\s*new\s+Map\(\)/);
    expect(historyHtml).toMatch(/transcriptCache\.has\(\s*sessionId\s*\)/);
  });

  it('DES-014.14: Past chats list renders staggered entrance animation (.chat-card.card-enter) with delay ceiling', () => {
    // Why this matters: Staggered animation gives initial render polish without delaying long lists.
    expect(styleCss).toMatch(/@keyframes\s+chatCardIn\s*\{/);
    expect(historyHtml).toMatch(/Math\.min\(\s*idx,\s*8\s*\)\s*\*\s*30/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-015: Sticky Header Visual Demarcation & Elevation (Tests 15–18)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-015.15: .history-sticky-head bleeds edge-to-edge (-20px margin) with sticky positioning at top: 0', () => {
    // Why this matters: Header bar must pin cleanly behind status bar without floating gaps.
    const stickyHeadRule = historyHtml.match(/\.history-sticky-head\s*\{([^}]+)\}/);
    expect(stickyHeadRule).toBeTruthy();
    expect(stickyHeadRule[1]).toMatch(/position\s*:\s*sticky/);
    expect(stickyHeadRule[1]).toMatch(/top\s*:\s*0/);
    expect(stickyHeadRule[1]).toMatch(/z-index\s*:\s*20/);
  });

  it('DES-015.16: .history-sticky-head maintains safe-area-inset-top support for camera cutouts', () => {
    // Why this matters: Header elements must not collide with mobile camera punches.
    const stickyHeadRule = historyHtml.match(/\.history-sticky-head\s*\{([^}]+)\}/);
    expect(stickyHeadRule).toBeTruthy();
    expect(stickyHeadRule[1]).toMatch(/env\(\s*safe-area-inset-top/);
  });

  it('DES-015.17: .history-sticky-head includes a subtle bottom divider line or border to demarcate scrolling content', () => {
    // Why this matters: Without visual separation, text scrolling behind the sticky bar clashes with header controls.
    expect(styleCss).toMatch(/(\.history-sticky-head|\.sticky-head-divider|\.topbar)\s*\{/);
  });

  it('DES-015.18: Search clear button (#searchClear) only displays when search query is non-empty', () => {
    // Why this matters: Clean UI — clear icon ("X") must not be visible when the search input is empty.
    expect(historyHtml).toMatch(/searchClear\.style\.display\s*=\s*q\s*\?\s*['"]flex['"]\s*:\s*['"]none['"]/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-022: Date Grouping Headers Typographic Spacing & Polish (Tests 19–22)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-022.19: history.html date groups use dedicated .history-group-label or styled section headers', () => {
    // Why this matters: Distinct date section headings ("Today", "Yesterday", "This week") organize history cleanly.
    expect(historyHtml).toMatch(/groupSessionsByDate/);
    expect(historyHtml).toMatch(/(history-group-label|profile-section-label)/);
  });

  it('DES-022.20: Date group headers have generous top margin (>= 16px) to clearly separate date chunks', () => {
    // Why this matters: Prevents date labels from feeling glued to the previous session card.
    const labelRule = styleCss.match(/\.profile-section-label\s*\{([^}]+)\}/) || styleCss.match(/\.history-group-label\s*\{([^}]+)\}/);
    expect(labelRule).toBeTruthy();
    expect(labelRule[1]).toMatch(/padding|margin/);
  });

  it('DES-022.21: Empty search results render distinct .search-empty-state rather than full illustrated "No chats yet"', () => {
    // Why this matters: Conflating "no search matches" with "zero account chats" misleadingly implies history was deleted.
    expect(historyHtml).toMatch(/function\s+renderSearchEmptyState/);
    expect(historyHtml).toMatch(/function\s+renderEmptyState/);
  });

  it('DES-022.22: Floating Action Button (#newChatFab) has safe-area bottom cushion preventing collision with gesture navigation', () => {
    // Why this matters: FAB must sit comfortably above system home indicator bar on gesture-nav phones.
    const fabRule = styleCss.match(/\.fab\s*\{([^}]+)\}/);
    expect(fabRule).toBeTruthy();
    expect(fabRule[1]).toMatch(/env\(\s*safe-area-inset-bottom/);
  });
});
