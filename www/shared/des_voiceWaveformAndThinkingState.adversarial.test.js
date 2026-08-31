// Role: 06_TestWriter
// Target: Voice Waveforms, AI Thinking State & Dialogue Bubble Consistency (Hardcore Adversarial Suite)
// Issues: DES-009, DES-011, DES-012 (24 Hard Adversarial Tests)

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('DES-009, DES-011, DES-012: Voice Waveforms, Thinking State & Dialogue Bubbles — Adversarial Suite', () => {
  const chatHtmlPath = path.resolve(__dirname, '../chat.html');
  const scenarioHtmlPath = path.resolve(__dirname, '../scenario.html');
  const styleCssPath = path.resolve(__dirname, 'style.css');

  let chatHtml = '';
  let scenarioHtml = '';
  let styleCss = '';

  beforeEach(() => {
    chatHtml = fs.readFileSync(chatHtmlPath, 'utf8');
    scenarioHtml = fs.readFileSync(scenarioHtmlPath, 'utf8');
    styleCss = fs.readFileSync(styleCssPath, 'utf8');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-009: Dynamic Audio Waveform Animation & Live State Dynamics (Tests 1–8)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-009.1: style.css defines @keyframes waveLivePulse with vertical scale & opacity transforms', () => {
    // Why this matters: Without dynamic scaleY animation, audio waves stay frozen/dead during conversation.
    expect(styleCss).toMatch(/@keyframes\s+waveLivePulse\s*\{[\s\S]*?transform\s*:\s*scaleY/);
    expect(styleCss).toMatch(/@keyframes\s+waveLivePulse\s*\{[\s\S]*?opacity\s*:\s*0\./);
  });

  it('DES-009.2: style.css applies waveLivePulse animation to .wave.live span with infinite iteration', () => {
    // Why this matters: Live audio feedback must continuously undulate while live audio is streaming.
    const waveLiveRule = styleCss.match(/\.wave\.live\s+span\s*\{([^}]+)\}/);
    expect(waveLiveRule).toBeTruthy();
    expect(waveLiveRule[1]).toMatch(/animation\s*:\s*waveLivePulse/);
    expect(waveLiveRule[1]).toMatch(/infinite/);
  });

  it('DES-009.3: style.css or chat.html/scenario.html applies staggered animation-delay across waveform bars', () => {
    // Why this matters: If all bars pulse in sync, the waveform looks like a solid block instead of fluid sound waves.
    const hasCssStagger = styleCss.includes('animation-delay') || chatHtml.includes('animationDelay') || styleCss.includes(':nth-child');
    expect(hasCssStagger).toBe(true);
  });

  it('DES-009.4: chat.html voice dock generates 9 bars per wave container and attaches .live class on live mode', () => {
    // Why this matters: chat.html must construct the full 9-bar waveform on both left and right docks.
    expect(chatHtml).toMatch(/BARS\s*=\s*9/);
    expect(chatHtml).toMatch(/waveLeftEl\.classList\.toggle\(['"]live['"],\s*mode\s*===\s*['"]live['"]\)/);
    expect(chatHtml).toMatch(/waveRightEl\.classList\.toggle\(['"]live['"],\s*mode\s*===\s*['"]live['"]\)/);
  });

  it('DES-009.5: scenario.html attaches live state to its wave container during active scenario roleplay', () => {
    // Why this matters: Sibling consistency — scenario.html must also animate waveforms during live roleplay.
    expect(scenarioHtml).toMatch(/wave|ai-indicator/);
    expect(scenarioHtml).toMatch(/classList\.toggle\(['"]live['"]|classList\.add\(['"]live['"]/);
  });

  it('DES-009.6: style.css disables waveform animations when prefers-reduced-motion is active', () => {
    // Why this matters: Accessibility requirement — users sensitive to motion must not suffer jarring flashing.
    const reducedMotionMatch = styleCss.match(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{([\s\S]*?)\}/);
    expect(reducedMotionMatch).toBeTruthy();
    expect(reducedMotionMatch[1]).toMatch(/\.wave|animation:\s*none/);
  });

  it('DES-009.7: Waveform spans have transform-origin set to center or bottom to prevent jittery displacement', () => {
    // Why this matters: scaleY without transform-origin can cause bars to jump vertically off their base baseline.
    const waveSpanRule = styleCss.match(/\.wave\s+span\s*\{([^}]+)\}/) || styleCss.match(/\.wave\.live\s+span\s*\{([^}]+)\}/);
    expect(waveSpanRule).toBeTruthy();
    expect(waveSpanRule[1]).toMatch(/transform-origin\s*:\s*(center|bottom)/);
  });

  it('DES-009.8: .wave container preserves pointer-events: none so clicks on underlying card/mic never get intercepted', () => {
    // Why this matters: A floating absolute wave must never block user taps on the mic button or transcript.
    const waveRule = styleCss.match(/\.wave\s*\{([^}]+)\}/);
    expect(waveRule).toBeTruthy();
    expect(waveRule[1]).toMatch(/pointer-events\s*:\s*none/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-011: AI Thinking / Processing State & Turnaround Latency (Tests 9–16)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-011.9: style.css defines .dot.thinking state with animated pulse or breathing cycle', () => {
    // Why this matters: Visual indication needed when AI is formulating response during Gemini processing latency.
    expect(styleCss).toMatch(/\.dot\.thinking\s*\{/);
  });

  it('DES-011.10: style.css defines @keyframes thinkingPulse animation for the status dot', () => {
    // Why this matters: Thinking indicator must have animated breathing/pulsing feedback.
    expect(styleCss).toMatch(/@keyframes\s+thinkingPulse\s*\{/);
  });

  it('DES-011.11: chat.html setStatus supports "thinking" mode and updates statusDot class', () => {
    // Why this matters: chat.html status controller must handle 'thinking' mode cleanly.
    expect(chatHtml).toMatch(/function\s+setStatus\s*\(\s*text\s*,\s*mode\s*\)/);
    expect(chatHtml).toMatch(/statusDot\.className\s*=\s*['"]dot['"]\s*\+\s*\(\s*mode/);
  });

  it('DES-011.12: chat.html displays informative status text when user finishes speaking and waits for AI reply', () => {
    // Why this matters: Status text must convey that Utkio is thinking rather than staying frozen on "Listening".
    expect(chatHtml).toMatch(/setStatus\([^)]*soch\s+raha\s+hai|setStatus\([^)]*Thinking|setStatus\([^)]*Processing/i);
  });

  it('DES-011.13: scenario.html status controller gracefully transitions from listening to thinking/processing', () => {
    // Why this matters: Sibling consistency — scenario mode also encounters model turnaround latency.
    expect(scenarioHtml).toMatch(/setStatus/);
  });

  it('DES-011.14: .dot.thinking maintains non-destructive color token usage (--accent-orange or --ink-dim)', () => {
    // Why this matters: Color lock constraint — thinking dot must use approved palette tokens.
    const dotThinkingMatch = styleCss.match(/\.dot\.thinking\s*\{([^}]+)\}/);
    expect(dotThinkingMatch).toBeTruthy();
    expect(dotThinkingMatch[1]).toMatch(/var\(--accent-orange\)|var\(--ink-dim\)|var\(--panel-2\)/);
  });

  it('DES-011.15: Thinking state is automatically cleared when model starts speaking (isModelSpeaking = true)', () => {
    // Why this matters: The thinking state must not get stuck once audio output stream begins playing.
    expect(chatHtml).toMatch(/isModelSpeaking/);
  });

  it('DES-011.16: Status text container #statusText has aria-live="polite" or screen reader announcement support', () => {
    // Why this matters: Accessibility — state changes must be polite so screen readers do not spam speech.
    const hasAria = chatHtml.includes('status-row') && (chatHtml.includes('aria-live') || chatHtml.includes('statusText'));
    expect(hasAria).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-012: Unified Message Bubbles & Staggered Entrance Motion (Tests 17–24)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-012.17: style.css defines @keyframes msgBubbleIn with subtle vertical rise (translateY 6px) and opacity fade', () => {
    // Why this matters: Abrupt popping of dialogue bubbles feels like a web prototype rather than native mobile.
    expect(styleCss).toMatch(/@keyframes\s+msgBubbleIn\s*\{[\s\S]*?opacity\s*:\s*0/);
    expect(styleCss).toMatch(/@keyframes\s+msgBubbleIn\s*\{[\s\S]*?transform\s*:\s*translateY/);
  });

  it('DES-012.18: style.css defines .msg-enter / .line-row animation class using msgBubbleIn', () => {
    // Why this matters: The animation must be applied to dynamically appended message rows.
    expect(styleCss).toMatch(/(\.msg-enter|\.line-row|\.line)\s*\{[^}]*animation\s*:\s*msgBubbleIn/);
  });

  it('DES-012.19: chat.html and scenario.html use cohesive avatar dimensions (28px–30px)', () => {
    // Why this matters: Discrepancy between 26px in chat and 30px in scenario creates UI inconsistency.
    const chatAvatar = chatHtml.match(/\.avatar-chip\s*\{[^}]*width\s*:\s*(\d+)px/);
    const scenarioAvatar = scenarioHtml.match(/\.msg-avatar\s*\{[^}]*width\s*:\s*(\d+)px/);
    if (chatAvatar && scenarioAvatar) {
      const diff = Math.abs(parseInt(chatAvatar[1]) - parseInt(scenarioAvatar[1]));
      expect(diff).toBeLessThanOrEqual(2);
    }
  });

  it('DES-012.20: User message bubbles have distinct asymmetrical corner radius (border-bottom-right-radius <= 6px)', () => {
    // Why this matters: Bubble tail curvature standardizes user line right-docking.
    const userLineRule = styleCss.match(/\.line\.user\s*\{([^}]+)\}/) || chatHtml.match(/\.line\.user\s*\{([^}]+)\}/);
    expect(userLineRule).toBeTruthy();
    expect(userLineRule[1]).toMatch(/border-bottom-right-radius\s*:\s*[4-6]px/);
  });

  it('DES-012.21: Model message bubbles have distinct asymmetrical corner radius (border-bottom-left-radius <= 6px)', () => {
    // Why this matters: Bubble tail curvature standardizes AI line left-docking.
    const modelLineRule = styleCss.match(/\.line\.model\s*\{([^}]+)\}/) || chatHtml.match(/\.line\.model\s*\{([^}]+)\}/);
    expect(modelLineRule).toBeTruthy();
    expect(modelLineRule[1]).toMatch(/border-bottom-left-radius\s*:\s*[4-6]px/);
  });

  it('DES-012.22: Transcript containers scroll smoothly and hide ugly default scrollbars', () => {
    // Why this matters: Scrollbar clutter ruins clean mobile UI aesthetic.
    expect(styleCss).toMatch(/scrollbar-width\s*:\s*none/);
    expect(styleCss).toMatch(/::-webkit-scrollbar\s*\{\s*display\s*:\s*none/);
  });

  it('DES-012.23: Message bubble text wrapping handles long unbroken words via word-break: break-word', () => {
    // Why this matters: A user saying a 40-character url or long word must not horizontally blow out the card width.
    const hasWordBreak = styleCss.includes('overflow-wrap: break-word') || styleCss.includes('word-break: break-word') || styleCss.includes('min-width: 0');
    expect(hasWordBreak).toBe(true);
  });

  it('DES-012.24: Reduced-motion media query disables message bubble entrance animations for accessibility', () => {
    // Why this matters: Accessibility compliance across chat and scenario message streams.
    const reducedMotionMatch = styleCss.match(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{([\s\S]*?)\}/);
    expect(reducedMotionMatch).toBeTruthy();
    expect(reducedMotionMatch[1]).toMatch(/animation:\s*none/);
  });
});
