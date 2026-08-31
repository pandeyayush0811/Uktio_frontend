// Role: 06_TestWriter (Senior Frontend Adversarial QA)
// Issues: DES-006, DES-007, DES-008, DES-023, DES-026, DES-027, DES-031, DES-032
// Scope: Onboarding & Registration Wizard & Design System Remediation
// Total Tests: 166 Hardcore Adversarial & Edge-Case Tests (20+ per issue)
// Target Files: frontend_updated/frontend/www/onboarding.html, frontend_updated/frontend/www/shared/style.css

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Adversarial & Hardcore Test Suite — Issues DES-006 to DES-032: Onboarding & Design System Remediation', () => {
  const onboardingHtmlPath = path.resolve(__dirname, '../onboarding.html');
  const styleCssPath = path.resolve(__dirname, 'style.css');

  let onboardingHtml = '';
  let styleCss = '';

  beforeEach(() => {
    onboardingHtml = fs.readFileSync(onboardingHtmlPath, 'utf8');
    styleCss = fs.readFileSync(styleCssPath, 'utf8');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: DES-006 — Visible Step Counter Label (Step 2 of 9) (21 Tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-006: Visible Step Counter Label (Step X of 9)', () => {
    // Why this matters: Sighted users on multi-step flows need clear visual feedback of their position and remaining steps to prevent drop-off and fatigue.

    it('DES-006.1: onboarding.html contains #progressStepLabel element in DOM markup', () => {
      // Catches missing step counter label element in onboarding.html
      expect(onboardingHtml).toMatch(/id=["']progressStepLabel["']/);
    });

    it('DES-006.2: #progressStepLabel has class progress-step-label', () => {
      // Catches unstyled or improperly classed progress label
      expect(onboardingHtml).toMatch(/<div[^>]*class=["'][^"']*progress-step-label[^"']*["'][^>]*id=["']progressStepLabel["']/);
    });

    it('DES-006.3: #progressStepLabel is placed immediately above or adjacent to .progress-track', () => {
      // Ensures the counter label sits above the progress track for natural reading order
      const trackIdx = onboardingHtml.indexOf('class="progress-track"');
      const labelIdx = onboardingHtml.indexOf('id="progressStepLabel"');
      expect(trackIdx).toBeGreaterThan(-1);
      expect(labelIdx).toBeGreaterThan(-1);
      expect(labelIdx).toBeLessThan(trackIdx);
    });

    it('DES-006.4: Initial static HTML contains default step text "Step 1 of 9"', () => {
      // Prevents empty flash before JS execution on initial paint
      expect(onboardingHtml).toMatch(/<div[^>]*id=["']progressStepLabel["'][^>]*>\s*Step 1 of 9\s*<\/div>/);
    });

    it('DES-006.5: renderStep function dynamically updates progressStepLabel textContent', () => {
      // Catches failure to update visible label when transitioning steps
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).toMatch(/progressStepLabel.*textContent\s*=\s*`Step\s*\$\{current\s*\+\s*1\}\s*of\s*\$\{steps\.length\}`/);
    });

    it('DES-006.6: #stepAnnounce element remains intact with class sr-only and aria-live polite', () => {
      // Ensures screen-reader WCAG accessibility is not destroyed when introducing sighted visual label
      expect(onboardingHtml).toMatch(/<div[^>]*class=["'][^"']*sr-only[^"']*["'][^>]*id=["']stepAnnounce["'][^>]*aria-live=["']polite["']/);
    });

    it('DES-006.7: renderStep updates both #progressStepLabel and #stepAnnounce', () => {
      // Ensures both sighted and assistive tech receive synchronized step updates
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).toMatch(/stepAnnounce\.textContent\s*=\s*`Step\s*\$\{current\s*\+\s*1\}\s*of\s*\$\{steps\.length\}`/);
      expect(renderStepMatch[1]).toMatch(/progressStepLabel/);
    });

    it('DES-006.8: #progressStepLabel is NOT hidden via sr-only class', () => {
      // Catches regression where visible label is accidentally hidden inside sr-only
      const labelTagMatch = onboardingHtml.match(/<[^>]*id=["']progressStepLabel["'][^>]*>/);
      expect(labelTagMatch).toBeTruthy();
      expect(labelTagMatch[0]).not.toMatch(/\bsr-only\b/);
    });

    it('DES-006.9: Dynamic step count denominator uses steps.length rather than hardcoded 9 in JS', () => {
      // Catches fragile hardcoding if steps array length changes
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).toMatch(/\$\{steps\.length\}/);
      expect(renderStepMatch[1]).not.toMatch(/of\s+9`/);
    });

    it('DES-006.10: style.css defines .progress-step-label rule', () => {
      // Catches missing CSS rule for step label
      expect(styleCss).toMatch(/\.progress-step-label\s*\{[^}]*\}/);
    });

    it('DES-006.11: .progress-step-label uses compact font-size 0.75rem', () => {
      // Ensures label is subtle microcopy and does not overpower card header
      const match = styleCss.match(/\.progress-step-label\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-size\s*:\s*0\.75rem/);
    });

    it('DES-006.12: .progress-step-label sets bold font-weight 700', () => {
      // Ensures high legibility at micro scale
      const match = styleCss.match(/\.progress-step-label\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-weight\s*:\s*700/);
    });

    it('DES-006.13: .progress-step-label uses muted ink color var(--ink-dim)', () => {
      // Ensures label does not create excessive visual weight
      const match = styleCss.match(/\.progress-step-label\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/color\s*:\s*var\(--ink-dim\)/);
    });

    it('DES-006.14: .progress-step-label sets uppercase text-transform', () => {
      // Matches design system badge & microcopy pattern
      const match = styleCss.match(/\.progress-step-label\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/text-transform\s*:\s*uppercase/);
    });

    it('DES-006.15: .progress-step-label sets letter-spacing 0.05em', () => {
      // Matches optical tracking for uppercase microcopy
      const match = styleCss.match(/\.progress-step-label\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/letter-spacing\s*:\s*0\.05em/);
    });

    it('DES-006.16: .progress-step-label is right-aligned (text-align: right)', () => {
      // Aligns with right edge of progress track
      const match = styleCss.match(/\.progress-step-label\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/text-align\s*:\s*right/);
    });

    it('DES-006.17: .progress-step-label defines bottom margin 8px before track', () => {
      // Prevents label colliding with progress bar
      const match = styleCss.match(/\.progress-step-label\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/margin-bottom\s*:\s*8px/);
    });

    it('DES-006.18: onboarding.html has exactly one #progressStepLabel ID in entire file', () => {
      // Catches duplicate ID DOM defects
      const matches = onboardingHtml.match(/id=["']progressStepLabel["']/g);
      expect(matches).toBeTruthy();
      expect(matches.length).toBe(1);
    });

    it('DES-006.19: Back button click handler re-renders step and preserves progressStepLabel sync', () => {
      // Verifies back button listener calls renderStep()
      const backListenerMatch = onboardingHtml.match(/backBtn\.addEventListener\(\s*['"]click['"]\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\}\);/);
      expect(backListenerMatch).toBeTruthy();
      expect(backListenerMatch[1]).toMatch(/renderStep\(\)/);
    });

    it('DES-006.20: Occupation switch click handler re-renders step and preserves progressStepLabel sync', () => {
      // Verifies occSwitchLink click listener calls renderStep()
      const occListenerMatch = onboardingHtml.match(/#occSwitchLink['"]\)\.addEventListener\(\s*['"]click['"]\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\}\);/);
      expect(occListenerMatch).toBeTruthy();
      expect(occListenerMatch[1]).toMatch(/renderStep\(\)/);
    });

    it('DES-006.21: renderProgress synchronizes progressBar percentage with current step index', () => {
      // Ensures progress track width matches step label index
      const renderProgressMatch = onboardingHtml.match(/function\s+renderProgress\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderProgressMatch).toBeTruthy();
      expect(renderProgressMatch[1]).toMatch(/Math\.round\(\s*\(\s*\(\s*current\s*\+\s*1\s*\)\s*\/\s*steps\.length\s*\)\s*\*\s*100\s*\)/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: DES-007 — Step Navigation Rise-and-Fade Transition (21 Tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-007: Step Navigation Rise-and-Fade Transition (stepFadeIn & Reduced Motion)', () => {
    // Why this matters: Abrupt content snapping causes cognitive dissonance; smooth hardware-accelerated animations create a native mobile app feel.

    it('DES-007.1: style.css defines @keyframes stepFadeIn', () => {
      // Catches missing keyframe definition
      expect(styleCss).toMatch(/@keyframes\s+stepFadeIn\s*\{[^}]*\}/);
    });

    it('DES-007.2: @keyframes stepFadeIn starts at opacity: 0 and translateY(6px)', () => {
      // Ensures 6px upward rise starting position
      expect(styleCss).toMatch(/@keyframes\s+stepFadeIn\s*\{[\s\S]*?from\s*\{[^}]*opacity\s*:\s*0[^}]*transform\s*:\s*translateY\(\s*6px\s*\)/i);
    });

    it('DES-007.3: @keyframes stepFadeIn ends at opacity: 1 and translateY(0)', () => {
      // Ensures resting destination position
      expect(styleCss).toMatch(/@keyframes\s+stepFadeIn\s*\{[\s\S]*?to\s*\{[^}]*opacity\s*:\s*1[^}]*transform\s*:\s*translateY\(\s*0\s*\)/i);
    });

    it('DES-007.4: style.css defines .step-enter class rule', () => {
      // Catches missing .step-enter class
      expect(styleCss).toMatch(/\.step-enter\s*\{[^}]*\}/);
    });

    it('DES-007.5: .step-enter uses snappy animation duration of 0.2s', () => {
      // Catches sluggish transitions that delay form completion
      const match = styleCss.match(/\.step-enter\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/animation\s*:\s*stepFadeIn\s+0\.2s/i);
    });

    it('DES-007.6: .step-enter uses cubic-bezier(0.16, 1, 0.3, 1) deceleration easing curve', () => {
      // Ensures fluid iOS/Android native motion curve
      const match = styleCss.match(/\.step-enter\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/cubic-bezier\(\s*0\.16\s*,\s*1\s*,\s*0\.3\s*,\s*1\s*\)/i);
    });

    it('DES-007.7: style.css includes @media (prefers-reduced-motion: reduce) block', () => {
      // Catches missing accessibility media query
      expect(styleCss).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{/);
    });

    it('DES-007.8: @media (prefers-reduced-motion: reduce) guards .step-enter with animation: none !important', () => {
      // Ensures motion sensitivity compliance under WCAG 2.3.3
      const mediaMatch = styleCss.match(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{([\s\S]*?)\}/);
      expect(mediaMatch).toBeTruthy();
      expect(mediaMatch[1]).toMatch(/\.step-enter/);
      expect(mediaMatch[1]).toMatch(/animation\s*:\s*none\s*!important/);
    });

    it('DES-007.9: renderStep in onboarding.html removes step-enter class before triggering', () => {
      // Prevents stale animation class blocking retrigger
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).toMatch(/stepBody\.classList\.remove\(['"]step-enter['"]\)/);
    });

    it('DES-007.10: renderStep in onboarding.html forces DOM reflow via offsetWidth', () => {
      // Required to reset keyframe state in modern WebKit/Blink engines
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).toMatch(/void\s+stepBody\.offsetWidth;/);
    });

    it('DES-007.11: renderStep in onboarding.html adds step-enter class after reflow', () => {
      // Ensures animation fires on every step transition
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).toMatch(/stepBody\.classList\.add\(['"]step-enter['"]\)/);
    });

    it('DES-007.12: Reflow sequence order is strictly: remove -> reflow -> add', () => {
      // Catches out-of-order class manipulation that fails to trigger animation
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      const code = renderStepMatch[1];
      const removeIdx = code.indexOf("stepBody.classList.remove('step-enter')");
      const reflowIdx = code.indexOf('void stepBody.offsetWidth');
      const addIdx = code.indexOf("stepBody.classList.add('step-enter')");
      expect(removeIdx).toBeGreaterThan(-1);
      expect(reflowIdx).toBeGreaterThan(-1);
      expect(addIdx).toBeGreaterThan(-1);
      expect(removeIdx).toBeLessThan(reflowIdx);
      expect(reflowIdx).toBeLessThan(addIdx);
    });

    it('DES-007.13: stepBody contains stepTitle, stepSub, and stepContent inside animation wrapper', () => {
      // Ensures the entire step content animates together rather than disjointed fragments
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).toMatch(/stepBody\.innerHTML\s*=\s*`<div class=["']step-title["']/);
      expect(renderStepMatch[1]).toMatch(/<div class=["']step-sub["']/);
      expect(renderStepMatch[1]).toMatch(/<div id=["']stepContent["']>/);
    });

    it('DES-007.14: step-enter uses only transform and opacity properties for GPU acceleration', () => {
      // Prevents CPU layout thrashing by avoiding top, margin, or height animations
      const keyframeMatch = styleCss.match(/@keyframes\s+stepFadeIn\s*\{([\s\S]*?)\}/);
      expect(keyframeMatch).toBeTruthy();
      expect(keyframeMatch[1]).not.toMatch(/\btop\s*:/);
      expect(keyframeMatch[1]).not.toMatch(/\bmargin\s*:/);
      expect(keyframeMatch[1]).not.toMatch(/\bheight\s*:/);
    });

    it('DES-007.15: Initial renderStep call on page load triggers entrance animation', () => {
      // Ensures Step 0 also enters smoothly
      expect(onboardingHtml).toMatch(/renderStep\(\);/);
    });

    it('DES-007.16: Next button click advancing step calls renderStep', () => {
      // Ensures forward step navigation triggers transition
      expect(onboardingHtml).toMatch(/if\s*\(\s*current\s*<\s*steps\.length\s*-\s*1\s*\)\s*\{\s*current\+\+;\s*renderStep\(\);\s*return;\s*\}/);
    });

    it('DES-007.17: Back button click advancing step calls renderStep', () => {
      // Ensures reverse step navigation triggers transition
      const backMatch = onboardingHtml.match(/backBtn\.addEventListener\(\s*['"]click['"]\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\}\);/);
      expect(backMatch).toBeTruthy();
      expect(backMatch[1]).toMatch(/current--;\s*renderStep\(\);/);
    });

    it('DES-007.18: statusMsg is cleared at the start of renderStep before transition triggers', () => {
      // Prevents stale error message from hanging around during step transition
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).toMatch(/statusMsg\.textContent\s*=\s*['"]['"]/);
    });

    it('DES-007.19: .progress-bar uses smooth width transition in style.css', () => {
      // Ensures progress fill eases smoothly alongside step content transition
      const match = styleCss.match(/\.progress-bar\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/transition\s*:\s*width\s+0\.3s\s+ease/);
    });

    it('DES-007.20: .progress-bar uses burnt-orange accent token var(--accent-orange)', () => {
      // Ensures progress track color harmony
      const match = styleCss.match(/\.progress-bar\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/background\s*:\s*var\(--accent-orange\)/);
    });

    it('DES-007.21: .step-enter does not cause horizontal scrollbar or viewport overflow', () => {
      // Confirms translateY is purely vertical without translateX drift
      const keyframeMatch = styleCss.match(/@keyframes\s+stepFadeIn\s*\{([\s\S]*?)\}/);
      expect(keyframeMatch).toBeTruthy();
      expect(keyframeMatch[1]).not.toMatch(/translateX/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: DES-008 — Multi-Choice Chips Checkmark/Radio Indicator (21 Tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-008: Multi-Choice Chips Checkmark & Radio Indicator Affordance', () => {
    // Why this matters: Plain color background changes are insufficient on low-contrast screens; explicit checkmark radio circles provide unambiguous selection feedback.

    it('DES-008.1: .chip rule in style.css defines position: relative', () => {
      // Needed to position absolute ::after indicator
      const match = styleCss.match(/\.chip\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/position\s*:\s*relative/);
    });

    it('DES-008.2: .chip defines right padding to prevent text colliding with radio indicator', () => {
      // Catches text clipping behind radio circle
      const match = styleCss.match(/\.chip\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/padding(-right)?\s*:\s*[^;]*44px/);
    });

    it('DES-008.3: style.css defines .chip::after pseudo-element', () => {
      // Catches missing unselected radio circle
      expect(styleCss).toMatch(/\.chip::after\s*\{[^}]*\}/);
    });

    it('DES-008.4: .chip::after is positioned absolutely on the right', () => {
      // Verifies right: 14px positioning
      const match = styleCss.match(/\.chip::after\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/position\s*:\s*absolute/);
      expect(match[1]).toMatch(/right\s*:\s*14px/);
    });

    it('DES-008.5: .chip::after is vertically centered via top: 50% and translateY(-50%)', () => {
      // Verifies vertical centering
      const match = styleCss.match(/\.chip::after\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/top\s*:\s*50%/);
      expect(match[1]).toMatch(/transform\s*:\s*translateY\(\s*-50%\s*\)/);
    });

    it('DES-008.6: .chip::after has circular dimensions (18px x 18px, border-radius: 50%)', () => {
      // Verifies standard radio circle geometry
      const match = styleCss.match(/\.chip::after\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/width\s*:\s*18px/);
      expect(match[1]).toMatch(/height\s*:\s*18px/);
      expect(match[1]).toMatch(/border-radius\s*:\s*50%/);
    });

    it('DES-008.7: .chip::after has unselected border using var(--line)', () => {
      // Verifies unselected resting state border
      const match = styleCss.match(/\.chip::after\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border\s*:\s*1\.5px\s+solid\s+var\(--line\)/);
    });

    it('DES-008.8: style.css defines .chip.selected::after pseudo-element', () => {
      // Catches missing selected checkmark indicator rule
      expect(styleCss).toMatch(/\.chip\.selected::after\s*\{[^}]*\}/);
    });

    it('DES-008.9: .chip.selected::after uses burnt-orange background var(--accent-orange)', () => {
      // Verifies filled radio circle on active selection
      const match = styleCss.match(/\.chip\.selected::after\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/background-color\s*:\s*var\(--accent-orange\)/);
    });

    it('DES-008.10: .chip.selected::after matches border-color with var(--accent-orange)', () => {
      // Verifies border matches fill on active selection
      const match = styleCss.match(/\.chip\.selected::after\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border-color\s*:\s*var\(--accent-orange\)/);
    });

    it('DES-008.11: .chip.selected::after embeds crisp white checkmark SVG in background-image', () => {
      // Verifies SVG data URI checkmark icon
      const match = styleCss.match(/\.chip\.selected::after\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/background-image\s*:\s*url\(/);
      expect(match[1]).toMatch(/stroke='%23ffffff'|stroke='white'|stroke='%23fff'/);
    });

    it('DES-008.12: .chip.selected::after sets background-repeat: no-repeat and center positioning', () => {
      // Prevents tiled or clipped SVG checkmark
      const match = styleCss.match(/\.chip\.selected::after\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/background-repeat\s*:\s*no-repeat/);
      expect(match[1]).toMatch(/background-position\s*:\s*center/);
    });

    it('DES-008.13: .chip.selected::after sets background-size to 11px 11px (or 10px 10px)', () => {
      // Ensures crisp proportions inside 18px circle
      const match = styleCss.match(/\.chip\.selected::after\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/background-size\s*:\s*1[01]px\s+1[01]px/);
    });

    it('DES-008.14: .chip:active defines tactile spring compression transform: scale(0.98)', () => {
      // Ensures tactile tap response on touch devices
      const match = styleCss.match(/\.chip:active\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/transform\s*:\s*scale\(\s*0\.98\s*\)/);
    });

    it('DES-008.15: .chip defines transition for border-color, background, and transform', () => {
      // Ensures smooth state transitions
      const match = styleCss.match(/\.chip\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/transition\s*:[^;]*border-color[^;]*background[^;]*transform/);
    });

    it('DES-008.16: .chip-title is styled with font-weight: 600 and display: block', () => {
      // Ensures clear hierarchical title styling
      const match = styleCss.match(/\.chip-title\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-weight\s*:\s*600/);
      expect(match[1]).toMatch(/display\s*:\s*block/);
    });

    it('DES-008.17: .chip-sub is styled with font-size: 0.78rem and color: var(--ink-dim)', () => {
      // Ensures secondary explanation text styling
      const match = styleCss.match(/\.chip-sub\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-size\s*:\s*0\.78rem/);
      expect(match[1]).toMatch(/color\s*:\s*var\(--ink-dim\)/);
    });

    it('DES-008.18: renderChips function in onboarding.html manages aria-pressed accessibility attribute', () => {
      // Verifies WCAG toggle button accessibility
      const renderChipsMatch = onboardingHtml.match(/function\s+renderChips\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderChipsMatch).toBeTruthy();
      expect(renderChipsMatch[1]).toMatch(/btn\.setAttribute\(['"]aria-pressed['"],\s*String\(answers\[key\]\s*===\s*opt\.value\)\)/);
      expect(renderChipsMatch[1]).toMatch(/btn\.setAttribute\(['"]aria-pressed['"],\s*['"]true['"]\)/);
    });

    it('DES-008.19: renderChips removes selected class from sibling chips on new selection', () => {
      // Ensures single-choice exclusivity
      const renderChipsMatch = onboardingHtml.match(/function\s+renderChips\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderChipsMatch).toBeTruthy();
      expect(renderChipsMatch[1]).toMatch(/c\.classList\.remove\(['"]selected['"]\)/);
    });

    it('DES-008.20: renderChips adds selected class to newly clicked chip', () => {
      // Ensures clicked chip receives selected state
      const renderChipsMatch = onboardingHtml.match(/function\s+renderChips\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderChipsMatch).toBeTruthy();
      expect(renderChipsMatch[1]).toMatch(/btn\.classList\.add\(['"]selected['"]\)/);
    });

    it('DES-008.21: .chip:hover applies var(--accent-orange) border highlight', () => {
      // Ensures hover feedback on desktop browsers
      const match = styleCss.match(/\.chip:hover\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border-color\s*:\s*var\(--accent-orange\)/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: DES-023 — Hindi Translation Badge & Textarea Focus Glow (21 Tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-023: Hindi Translation Prompt Box Badge & Textarea Focus Glow', () => {
    // Why this matters: Editorial category badges clearly anchor the prompt language, and textarea 3px focus glow provides visual confirmation of input activation.

    it('DES-023.1: textarea:focus in style.css defines border-color with var(--accent-orange)', () => {
      // Catches unstyled textarea focus border
      const match = styleCss.match(/textarea:focus\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border-color\s*:\s*var\(--accent-orange\)/);
    });

    it('DES-023.2: textarea:focus in style.css defines 3px halo box-shadow with var(--accent-soft-orange)', () => {
      // Catches missing focus halo glow on translation textarea
      const match = styleCss.match(/textarea:focus\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/box-shadow\s*:\s*0\s+0\s+0\s+3px\s+var\(--accent-soft-orange\)/);
    });

    it('DES-023.3: textarea:focus does NOT use legacy purple tokens var(--accent) or var(--accent-soft)', () => {
      // Catches purple focus regression on textarea
      const match = styleCss.match(/textarea:focus\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).not.toMatch(/var\(--accent\)/);
      expect(match[1]).not.toMatch(/var\(--accent-soft\)/);
    });

    it('DES-023.4: style.css defines .translate-prompt-badge class rule', () => {
      // Catches missing CSS rule for Hindi badge pill
      expect(styleCss).toMatch(/\.translate-prompt-badge\s*\{[^}]*\}/);
    });

    it('DES-023.5: .translate-prompt-badge sets display: inline-block', () => {
      // Ensures badge pill wraps tightly around content
      const match = styleCss.match(/\.translate-prompt-badge\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/display\s*:\s*inline-block/);
    });

    it('DES-023.6: .translate-prompt-badge sets pill border-radius: 999px', () => {
      // Matches app pill geometry
      const match = styleCss.match(/\.translate-prompt-badge\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border-radius\s*:\s*999px/);
    });

    it('DES-023.7: .translate-prompt-badge uses burnt-orange text color var(--accent-orange)', () => {
      // Verifies badge text token
      const match = styleCss.match(/\.translate-prompt-badge\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/color\s*:\s*var\(--accent-orange\)/);
    });

    it('DES-023.8: .translate-prompt-badge uses soft-orange background var(--accent-soft-orange)', () => {
      // Verifies badge background token
      const match = styleCss.match(/\.translate-prompt-badge\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/background\s*:\s*var\(--accent-soft-orange\)/);
    });

    it('DES-023.9: .translate-prompt-badge sets uppercase text-transform and letter-spacing', () => {
      // Verifies editorial microcopy styling
      const match = styleCss.match(/\.translate-prompt-badge\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/text-transform\s*:\s*uppercase/);
      expect(match[1]).toMatch(/letter-spacing\s*:\s*0\.04em/);
    });

    it('DES-023.10: .translate-prompt-badge sets compact padding 2px 8px and margin-bottom: 8px', () => {
      // Verifies badge spacing
      const match = styleCss.match(/\.translate-prompt-badge\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/padding\s*:\s*2px\s+8px/);
      expect(match[1]).toMatch(/margin-bottom\s*:\s*8px/);
    });

    it('DES-023.11: onboarding.html translation step renders .translate-prompt-badge with text "Hindi"', () => {
      // Catches missing Hindi badge inside translation step markup
      expect(onboardingHtml).toMatch(/<span\s+class=["']translate-prompt-badge["']>\s*Hindi\s*<\/span>/);
    });

    it('DES-023.12: onboarding.html wraps Hindi prompt in .translate-prompt-text container', () => {
      // Ensures clean separation between badge pill and quote text
      expect(onboardingHtml).toMatch(/<div\s+class=["']translate-prompt-text["']>/);
    });

    it('DES-023.13: HINDI_TRANSLATE_PROMPT constant contains genuine intermediate Hindi sentence', () => {
      // Catches placeholder or corrupted string
      expect(onboardingHtml).toMatch(/const\s+HINDI_TRANSLATE_PROMPT\s*=\s*['"]हमारे घर में हर रविवार को सब लोग मिलकर खाना बनाते हैं और शाम को साथ बैठकर बातें करते हैं।['"]/);
    });

    it('DES-023.14: Translation textarea #f_sample has maxlength="500"', () => {
      // Prevents memory/database overload on sample submission
      expect(onboardingHtml).toMatch(/<textarea[^>]*id=["']f_sample["'][^>]*maxlength=["']500["']/);
    });

    it('DES-023.15: Translation textarea #f_sample has descriptive placeholder', () => {
      // Catches missing placeholder
      expect(onboardingHtml).toMatch(/<textarea[^>]*id=["']f_sample["'][^>]*placeholder=["']Type your English translation here\.\.\.["']/);
    });

    it('DES-023.16: #charHint displays dynamic character count "0 / 500"', () => {
      // Catches missing character counter
      expect(onboardingHtml).toMatch(/<div\s+class=["']char-hint["']\s+id=["']charHint["']>\s*0\s*\/\s*500\s*<\/div>/);
    });

    it('DES-023.17: textarea input listener updates charHint dynamically', () => {
      // Catches stale character count on typing
      expect(onboardingHtml).toMatch(/ta\.addEventListener\(\s*['"]input['"]\s*,\s*e\s*=>\s*\{[\s\S]*?charHint.*textContent\s*=\s*e\.target\.value\.length\s*\+\s*'\s*\/\s*500'/);
    });

    it('DES-023.18: textarea input listener syncs value with answers.english_sample', () => {
      // Catches disconnected form binding
      expect(onboardingHtml).toMatch(/answers\.english_sample\s*=\s*e\.target\.value/);
    });

    it('DES-023.19: Translation step is marked as optional: true with optionalKey: "english_sample"', () => {
      // Ensures users can skip translation if hesitant
      const sampleStepMatch = onboardingHtml.match(/title:\s*['"]Translate this into English['"][\s\S]*?optional:\s*true[\s\S]*?optionalKey:\s*['"]english_sample['"]/);
      expect(sampleStepMatch).toBeTruthy();
    });

    it('DES-023.20: refreshNextLabel switches button text between "Skip" and "Next" based on sample value', () => {
      // Verifies button dynamically reflects field state
      const refreshNextLabelMatch = onboardingHtml.match(/function\s+refreshNextLabel\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(refreshNextLabelMatch).toBeTruthy();
      expect(refreshNextLabelMatch[1]).toMatch(/step\.optional\s*&&\s*!stepHasValue\(step\)\s*\?\s*['"]Skip['"]\s*:\s*['"]Next['"]/);
    });

    it('DES-023.21: .translate-prompt-box in style.css has border-radius 12px and panel-2 background', () => {
      // Ensures container card styling matches card tokens
      const match = styleCss.match(/\.translate-prompt-box\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/background\s*:\s*var\(--panel-2\)/);
      expect(match[1]).toMatch(/border-radius\s*:\s*12px/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 5: DES-026 — Purple Halo Regression Fix to Burnt-Orange (20 Tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-026: Purple Focus Halo Regression Cleanse to Burnt-Orange', () => {
    // Why this matters: Inconsistent purple focus halos break visual theme cohesion across form inputs in Onboarding, Settings, and Profile screens.

    it('DES-026.1: Global input:focus in style.css uses border-color: var(--accent-orange)', () => {
      // Catches legacy purple border in global input:focus
      const match = styleCss.match(/(?:^|\n)\s*input:focus\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border-color\s*:\s*var\(--accent-orange\)/);
    });

    it('DES-026.2: Global input:focus in style.css uses box-shadow: 0 0 0 3px var(--accent-soft-orange)', () => {
      // Catches legacy purple box-shadow halo in global input:focus
      const match = styleCss.match(/(?:^|\n)\s*input:focus\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/box-shadow\s*:\s*0\s+0\s+0\s+3px\s+var\(--accent-soft-orange\)/);
    });

    it('DES-026.3: Global input:focus does NOT contain var(--accent)', () => {
      // Strict negative assertion ensuring legacy purple accent variable is fully purged
      const match = styleCss.match(/(?:^|\n)\s*input:focus\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).not.toMatch(/var\(--accent\)/);
    });

    it('DES-026.4: Global input:focus does NOT contain var(--accent-soft)', () => {
      // Strict negative assertion ensuring legacy purple accent-soft variable is fully purged
      const match = styleCss.match(/(?:^|\n)\s*input:focus\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).not.toMatch(/var\(--accent-soft\)/);
    });

    it('DES-026.5: style.css input rule defines smooth transition for border-color and box-shadow', () => {
      // Ensures focus ring eases in smoothly rather than snapping
      const match = styleCss.match(/(?:^|\n)\s*input\[type=password\][^{]*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/transition\s*:[^;]*border-color\s+0\.15s[^;]*box-shadow\s+0\.15s/);
    });

    it('DES-026.6: input rule sets outline: none to suppress default browser blue/black outline', () => {
      // Prevents conflicting browser focus rings
      const match = styleCss.match(/(?:^|\n)\s*input\[type=password\][^{]*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/outline\s*:\s*none/);
    });

    it('DES-026.7: input rule applies to text, password, email, and tel input types', () => {
      // Ensures all standard text entry controls share the uniform base styling
      expect(styleCss).toMatch(/input\[type=password\],\s*input\[type=text\],\s*input\[type=email\],\s*input\[type=tel\]/);
    });

    it('DES-026.8: Onboarding Name field #f_name is an input type="text"', () => {
      // Verifies step 0 input inherits global input:focus
      expect(onboardingHtml).toMatch(/<input[^>]*type=["']text["'][^>]*id=["']f_name["']/);
    });

    it('DES-026.9: Onboarding Age field #f_age is an input with inputmode="numeric"', () => {
      // Verifies step 1 input inherits global input:focus
      expect(onboardingHtml).toMatch(/<input[^>]*inputmode=["']numeric["'][^>]*id=["']f_age["']/);
    });

    it('DES-026.10: Onboarding Occupation detail #f_occdetail is an input type="text"', () => {
      // Verifies step 3 input inherits global input:focus
      expect(onboardingHtml).toMatch(/<input[^>]*type=["']text["'][^>]*id=["']f_occdetail["']/);
    });

    it('DES-026.11: Onboarding City field #f_city is an input type="text"', () => {
      // Verifies step 4 input inherits global input:focus
      expect(onboardingHtml).toMatch(/<input[^>]*type=["']text["'][^>]*id=["']f_city["']/);
    });

    it('DES-026.12: .password-field input styling retains padding-right: 44px for eye toggle without breaking focus halo', () => {
      // Ensures password toggle alignment does not distort focus halo
      const match = styleCss.match(/\.password-field\s+input\[type=password\][^{]*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/padding-right\s*:\s*44px/);
    });

    it('DES-026.13: Global input background uses var(--panel-2) and text color uses var(--ink)', () => {
      // Ensures high-contrast readability
      const match = styleCss.match(/(?:^|\n)\s*input\[type=password\][^{]*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/background\s*:\s*var\(--panel-2\)/);
      expect(match[1]).toMatch(/color\s*:\s*var\(--ink\)/);
    });

    it('DES-026.14: input placeholder styling uses var(--ink-dim) with opacity 0.55', () => {
      // Ensures soft placeholder contrast
      const match = styleCss.match(/input::placeholder\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/color\s*:\s*var\(--ink-dim\)/);
      expect(match[1]).toMatch(/opacity\s*:\s*0\.55/);
    });

    it('DES-026.15: No hardcoded legacy purple hex #6a63f1 or #7c75f3 exists in focus rules', () => {
      // Purges hardcoded purple hex values across any focus blocks in style.css
      const focusMatches = styleCss.match(/[^}]*:focus\s*\{[^}]*\}/g) || [];
      focusMatches.forEach(rule => {
        expect(rule).not.toMatch(/#6a63f1/i);
        expect(rule).not.toMatch(/#7c75f3/i);
        expect(rule).not.toMatch(/#5b54e0/i);
      });
    });

    it('DES-026.16: .status-msg.ok uses var(--accent-orange) for success feedback', () => {
      // Verifies feedback message tone alignment
      const match = styleCss.match(/\.status-msg\.ok\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/color\s*:\s*var\(--accent-orange\)/);
    });

    it('DES-026.17: .status-msg.err uses var(--bad) for error feedback', () => {
      // Verifies error color contrast
      const match = styleCss.match(/\.status-msg\.err\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/color\s*:\s*var\(--bad\)/);
    });

    it('DES-026.18: input:focus does not alter layout box model or padding', () => {
      // Confirms focus halo is rendered purely via box-shadow to prevent layout shift
      const match = styleCss.match(/(?:^|\n)\s*input:focus\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).not.toMatch(/\bpadding\s*:/);
      expect(match[1]).not.toMatch(/\bmargin\s*:/);
      expect(match[1]).not.toMatch(/\bwidth\s*:/);
    });

    it('DES-026.19: .input-shake keyframe animation is available for validation failures', () => {
      // Ensures validation shake feedback is maintained
      expect(styleCss).toMatch(/@keyframes\s+inputShake\s*\{/);
      expect(styleCss).toMatch(/\.input-shake\s*\{\s*animation\s*:\s*inputShake/);
    });

    it('DES-026.20: Form inputs border-radius is unified at 10px', () => {
      // Verifies rounded card geometry
      const match = styleCss.match(/(?:^|\n)\s*input\[type=password\][^{]*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border-radius\s*:\s*10px/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 6: DES-027 — Step Titles Typography in Georgia Serif (21 Tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-027: Step Titles Typography in Georgia Serif (--font-serif)', () => {
    // Why this matters: Seamless typographic continuity from Auth headers to Onboarding step titles establishes brand identity and visual elegance.

    it('DES-027.1: .step-title in style.css declares font-family: var(--font-serif)', () => {
      // Catches missing Georgia serif font-family declaration on step titles
      const match = styleCss.match(/\.step-title\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-family\s*:\s*var\(--font-serif\)/);
    });

    it('DES-027.2: .step-title in style.css declares font-size: 1.3rem', () => {
      // Catches undersized step title font
      const match = styleCss.match(/\.step-title\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-size\s*:\s*1\.3rem/);
    });

    it('DES-027.3: .step-title in style.css declares font-weight: 700', () => {
      // Ensures bold serif heading weight
      const match = styleCss.match(/\.step-title\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-weight\s*:\s*700/);
    });

    it('DES-027.4: .step-title in style.css sets margin: 0 0 6px', () => {
      // Verifies tight title-to-subtitle vertical rhythm
      const match = styleCss.match(/\.step-title\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/margin\s*:\s*0\s+0\s+6px/);
    });

    it('DES-027.5: .step-title in style.css declares color: var(--ink)', () => {
      // Ensures primary ink heading color
      const match = styleCss.match(/\.step-title\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/color\s*:\s*var\(--ink\)/);
    });

    it('DES-027.6: .step-title in style.css sets letter-spacing: -0.01em', () => {
      // Verifies optical kerning for serif titles
      const match = styleCss.match(/\.step-title\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/letter-spacing\s*:\s*-0\.01em/);
    });

    it('DES-027.7: :root in style.css declares --font-serif with Georgia fallback stack', () => {
      // Catches missing --font-serif token definition across :root blocks
      expect(styleCss).toMatch(/--font-serif\s*:[^;]*Georgia/i);
    });

    it('DES-027.8: .step-sub in style.css maintains font-size: 0.85rem and color: var(--ink-dim)', () => {
      // Ensures body sans-serif subtitle contrast
      const match = styleCss.match(/\.step-sub\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-size\s*:\s*0\.85rem/);
      expect(match[1]).toMatch(/color\s*:\s*var\(--ink-dim\)/);
      expect(match[1]).toMatch(/margin\s*:\s*0\s+0\s+20px/);
    });

    it('DES-027.9: onboarding.html renderStep injects title into .step-title #stepTitleText', () => {
      // Verifies DOM structure for accessibility and rendering
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).toMatch(/<div\s+class=["']step-title["']\s+id=["']stepTitleText["']>\$\{title\}<\/div>/);
    });

    it('DES-027.10: renderStep sets aria-labelledby="stepTitleText" on inputs and textareas', () => {
      // Ensures WCAG 1.3.1 screen reader label association
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).toMatch(/control\.setAttribute\(['"]aria-labelledby['"],\s*['"]stepTitleText['"]\)/);
    });

    it('DES-027.11: Step 0 defines title "Enter your name"', () => {
      // Verifies step 0 copy
      expect(onboardingHtml).toMatch(/title:\s*['"]Enter your name['"]/);
    });

    it('DES-027.12: Step 1 defines title "Enter your age"', () => {
      // Verifies step 1 copy
      expect(onboardingHtml).toMatch(/title:\s*['"]Enter your age['"]/);
    });

    it('DES-027.13: Step 2 defines title "Are you a student or a working professional?"', () => {
      // Verifies step 2 copy
      expect(onboardingHtml).toMatch(/title:\s*['"]Are you a student or a working professional\?['"]/);
    });

    it('DES-027.14: Step 3 defines dynamic title function based on occupation_type', () => {
      // Verifies step 3 dynamic copy
      expect(onboardingHtml).toMatch(/title\(\)\s*\{\s*return\s+answers\.occupation_type\s*===\s*['"]student['"]\s*\?\s*['"]Which class\/course are you in\?['"]\s*:\s*['"]What is your profession\/role\?['"];\s*\}/);
    });

    it('DES-027.15: Step 4 defines title "Which city do you live in?"', () => {
      // Verifies step 4 copy
      expect(onboardingHtml).toMatch(/title:\s*['"]Which city do you live in\?['"]/);
    });

    it('DES-027.16: Step 5 defines title "Why do you want to improve your English?"', () => {
      // Verifies step 5 copy
      expect(onboardingHtml).toMatch(/title:\s*['"]Why do you want to improve your English\?['"]/);
    });

    it('DES-027.17: Step 6 defines title "What is your current English level?"', () => {
      // Verifies step 6 copy
      expect(onboardingHtml).toMatch(/title:\s*['"]What is your current English level\?['"]/);
    });

    it('DES-027.18: Step 7 defines title "Translate this into English"', () => {
      // Verifies step 7 copy
      expect(onboardingHtml).toMatch(/title:\s*['"]Translate this into English['"]/);
    });

    it('DES-027.19: Step 8 defines title "How much time can you spare daily for practice?"', () => {
      // Verifies step 8 copy
      expect(onboardingHtml).toMatch(/title:\s*['"]How much time can you spare daily for practice\?['"]/);
    });

    it('DES-027.20: All 9 steps have valid non-empty title definitions', () => {
      // Verifies no step has undefined or empty title
      const stepTitleMatches = onboardingHtml.match(/title(\(\))?:\s*['"][^'"]+['"]|title\(\)\s*\{/g);
      expect(stepTitleMatches).toBeTruthy();
      expect(stepTitleMatches.length).toBe(9);
    });

    it('DES-027.21: .auth-step-title in login.html and .step-title in onboarding.html share font-family and 1.3rem size', () => {
      // Verifies cross-page typography consistency between auth and onboarding
      const authTitleMatch = styleCss.match(/\.auth-step-title\s*\{([^}]+)\}/);
      const stepTitleMatch = styleCss.match(/\.step-title\s*\{([^}]+)\}/);
      expect(authTitleMatch).toBeTruthy();
      expect(stepTitleMatch).toBeTruthy();
      expect(authTitleMatch[1]).toMatch(/var\(--font-serif\)/);
      expect(stepTitleMatch[1]).toMatch(/var\(--font-serif\)/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 7: DES-031 — Back Button Visibility Geometry Stability (20 Tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-031: Back Button Visibility & Layout Geometry Stability', () => {
    // Why this matters: Using display: none snaps button widths from 100% to 70%, creating jarring layout shifts on step 0 to step 1 transitions.

    it('DES-031.1: onboarding.html initializes #backBtn with style="visibility:hidden;pointer-events:none;"', () => {
      // Catches legacy display:none on initial backBtn markup
      const match = onboardingHtml.match(/<button[^>]*id=["']backBtn["'][^>]*style=["']([^"']*)["']/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/visibility\s*:\s*hidden/);
      expect(match[1]).toMatch(/pointer-events\s*:\s*none/);
      expect(match[1]).not.toMatch(/display\s*:\s*none/);
    });

    it('DES-031.2: renderStep in onboarding.html toggles backBtn visibility property rather than display', () => {
      // Catches renderStep overriding with display:none
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).not.toMatch(/backBtn\.style\.display/);
      expect(renderStepMatch[1]).toMatch(/backBtn\.style\.visibility\s*=\s*['"]hidden['"]/);
      expect(renderStepMatch[1]).toMatch(/backBtn\.style\.visibility\s*=\s*['"]visible['"]/);
    });

    it('DES-031.3: renderStep in onboarding.html toggles backBtn pointerEvents property', () => {
      // Prevents phantom clicks when hidden on step 0
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).toMatch(/backBtn\.style\.pointerEvents\s*=\s*['"]none['"]/);
      expect(renderStepMatch[1]).toMatch(/backBtn\.style\.pointerEvents\s*=\s*['"]auto['"]/);
    });

    it('DES-031.4: Step 0 condition in renderStep sets visibility: hidden and pointerEvents: none', () => {
      // Verifies step 0 branch logic
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).toMatch(/if\s*\(\s*current\s*===\s*0\s*\)\s*\{[^}]*backBtn\.style\.visibility\s*=\s*['"]hidden['"][^}]*backBtn\.style\.pointerEvents\s*=\s*['"]none['']/);
    });

    it('DES-031.5: Step > 0 condition in renderStep sets visibility: visible and pointerEvents: auto', () => {
      // Verifies step > 0 branch logic
      const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\nfunction/);
      expect(renderStepMatch).toBeTruthy();
      expect(renderStepMatch[1]).toMatch(/else\s*\{[^}]*backBtn\.style\.visibility\s*=\s*['"]visible['"][^}]*backBtn\.style\.pointerEvents\s*=\s*['"]auto['']/);
    });

    it('DES-031.6: .step-nav container uses display: flex and gap: 10px in style.css', () => {
      // Verifies flex container styling
      const match = styleCss.match(/\.step-nav\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/display\s*:\s*flex/);
      expect(match[1]).toMatch(/gap\s*:\s*10px/);
    });

    it('DES-031.7: .step-nav button.primary sets flex: 1 in style.css', () => {
      // Ensures primary action button takes remaining flex share consistently
      const match = styleCss.match(/\.step-nav\s+button\.primary\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/flex\s*:\s*1/);
    });

    it('DES-031.8: .step-nav button.secondary sets flex: 0 0 auto and width: auto', () => {
      // Ensures back button reserves fixed width even when visibility is hidden
      expect(styleCss).toMatch(/\.step-nav\s+button\.secondary\s*\{[^}]*flex\s*:\s*0\s+0\s+auto/);
      expect(styleCss).toMatch(/\.step-nav\s+button\.secondary\s*\{[^}]*width\s*:\s*auto/);
    });

    it('DES-031.9: .step-nav button.secondary sets padding: 13px 18px in style.css', () => {
      // Verifies touch target size
      expect(styleCss).toMatch(/\.step-nav\s+button\.secondary\s*\{[^}]*padding\s*:\s*13px\s+18px/);
    });

    it('DES-031.10: Back button click listener guards with if (current > 0)', () => {
      // Prevents underflow below step 0
      const match = onboardingHtml.match(/backBtn\.addEventListener\(\s*['"]click['"]\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\}\);/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/if\s*\(\s*current\s*>\s*0\s*\)\s*\{\s*current--;\s*renderStep\(\);\s*\}/);
    });

    it('DES-031.11: Android hardware back button handler swallows back event on step 0', () => {
      // Prevents bypassing onboarding via hardware back key on first step
      const backNavMatch = onboardingHtml.match(/initBackNav\([\s\S]*?onBack:\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\}\);/);
      expect(backNavMatch).toBeTruthy();
      expect(backNavMatch[1]).toMatch(/if\s*\(\s*current\s*>\s*0\s*\)\s*\{\s*current--;\s*renderStep\(\);\s*return\s+true;\s*\}/);
      expect(backNavMatch[1]).toMatch(/return\s+false;\s*\/\/\s*on step 0/);
    });

    it('DES-031.12: Final step submission disables #backBtn during async saving', () => {
      // Prevents user navigating back mid-save
      expect(onboardingHtml).toMatch(/nextBtn\.disabled\s*=\s*true;\s*\n\s*backBtn\.disabled\s*=\s*true;/);
    });

    it('DES-031.13: Final step submission error re-enables #backBtn', () => {
      // Ensures user can navigate back to fix mistakes on server error
      expect(onboardingHtml).toMatch(/catch\s*\([^)]*\)\s*\{[\s\S]*?backBtn\.disabled\s*=\s*false/);
    });

    it('DES-031.14: Final step submission disables #nextBtn during async saving', () => {
      // Prevents double-submit on final step
      expect(onboardingHtml).toMatch(/nextBtn\.disabled\s*=\s*true;\s*\n\s*backBtn\.disabled\s*=\s*true;/);
    });

    it('DES-031.15: Final step submission error re-enables #nextBtn', () => {
      // Ensures user can retry submission
      expect(onboardingHtml).toMatch(/catch\s*\([^)]*\)\s*\{[\s\S]*?nextBtn\.disabled\s*=\s*false/);
    });

    it('DES-031.16: #backBtn text is "Back"', () => {
      // Verifies button copy
      expect(onboardingHtml).toMatch(/<button[^>]*id=["']backBtn["'][^>]*>\s*Back\s*<\/button>/);
    });

    it('DES-031.17: #nextBtn text is dynamically updated by refreshNextLabel', () => {
      // Verifies next button copy management
      const match = onboardingHtml.match(/function\s+refreshNextLabel\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/nextBtn\.textContent\s*=\s*current\s*===\s*steps\.length\s*-\s*1\s*\?\s*['"]Get Started['"]/);
    });

    it('DES-031.18: #nextBtn displays "Get Started" on step 8 (final step)', () => {
      // Verifies final step CTA text
      const match = onboardingHtml.match(/function\s+refreshNextLabel\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/['"]Get Started['"]/);
    });

    it('DES-031.19: #nextBtn displays "Skip" on untouched optional steps', () => {
      // Verifies skip affordance on optional fields
      const match = onboardingHtml.match(/function\s+refreshNextLabel\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/step\.optional\s*&&\s*!stepHasValue\(step\)\s*\?\s*['"]Skip['"]\s*:\s*['"]Next['"]/);
    });

    it('DES-031.20: #nextBtn displays "Next" on standard required steps', () => {
      // Verifies standard forward button text
      const match = onboardingHtml.match(/function\s+refreshNextLabel\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/:\s*['"]Next['"]/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 8: DES-032 — Occupation Switch Link Styled Pill Affordance (21 Tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-032: Occupation Switch Link Styled Pill Affordance', () => {
    // Why this matters: An unstyled text button looks like broken footnote copy; styling it as an interactive pill with bidirectional swap icon communicates clear intent.

    it('DES-032.1: .auth-switch-link in style.css declares display: inline-flex', () => {
      // Catches block or inline display that breaks pill layout
      const match = styleCss.match(/\.auth-switch-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/display\s*:\s*inline-flex/);
    });

    it('DES-032.2: .auth-switch-link in style.css declares border-radius: 999px', () => {
      // Catches missing rounded pill radius
      const match = styleCss.match(/\.auth-switch-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border-radius\s*:\s*999px/);
    });

    it('DES-032.3: .auth-switch-link in style.css uses background: var(--accent-soft-orange)', () => {
      // Catches missing background pill tint
      const match = styleCss.match(/\.auth-switch-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/background\s*:\s*var\(--accent-soft-orange\)/);
    });

    it('DES-032.4: .auth-switch-link in style.css sets subtle border with rgba(217, 105, 75, 0.18)', () => {
      // Verifies subtle accent border definition
      const match = styleCss.match(/\.auth-switch-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border\s*:\s*1px\s+solid\s+rgba\(\s*217\s*,\s*105\s*,\s*75\s*,\s*0\.18\s*\)/);
    });

    it('DES-032.5: .auth-switch-link in style.css sets text color var(--accent-orange)', () => {
      // Verifies burnt-orange text color
      const match = styleCss.match(/\.auth-switch-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/color\s*:\s*var\(--accent-orange\)/);
    });

    it('DES-032.6: .auth-switch-link in style.css sets font-size: 0.78rem and font-weight: 600', () => {
      // Verifies microcopy typography
      const match = styleCss.match(/\.auth-switch-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-size\s*:\s*0\.78rem/);
      expect(match[1]).toMatch(/font-weight\s*:\s*600/);
    });

    it('DES-032.7: .auth-switch-link in style.css sets padding: 7px 14px', () => {
      // Verifies pill internal spacing
      const match = styleCss.match(/\.auth-switch-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/padding\s*:\s*7px\s+14px/);
    });

    it('DES-032.8: .auth-switch-link in style.css sets margin: 4px 0 10px', () => {
      // Verifies vertical separation from input and next button
      const match = styleCss.match(/\.auth-switch-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/margin\s*:\s*4px\s+0\s+10px/);
    });

    it('DES-032.9: .auth-switch-link in style.css sets align-items: center and gap between icon and text', () => {
      // Ensures swap SVG icon is vertically centered with label text
      const match = styleCss.match(/\.auth-switch-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/align-items\s*:\s*center/);
      expect(match[1]).toMatch(/gap\s*:\s*[67]px/);
    });

    it('DES-032.10: .auth-switch-link in style.css sets cursor: pointer', () => {
      // Ensures interactive pointer affordance
      const match = styleCss.match(/\.auth-switch-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/cursor\s*:\s*pointer/);
    });

    it('DES-032.11: onboarding.html step 3 renders #occSwitchLink with class auth-switch-link', () => {
      // Catches missing switch button in occupation step
      expect(onboardingHtml).toMatch(/<button[^>]*type=["']button["'][^>]*id=["']occSwitchLink["'][^>]*class=["']auth-switch-link["']/);
    });

    it('DES-032.12: #occSwitchLink explicitly specifies type="button"', () => {
      // Prevents accidental form submission on click
      expect(onboardingHtml).toMatch(/<button[^>]*type=["']button["'][^>]*id=["']occSwitchLink["']/);
    });

    it('DES-032.13: #occSwitchLink contains inline SVG icon with width="14" and height="14"', () => {
      // Catches missing swap icon
      const occStepMatch = onboardingHtml.match(/id=["']occSwitchLink["'][\s\S]*?<\/button>/);
      expect(occStepMatch).toBeTruthy();
      expect(occStepMatch[0]).toMatch(/<svg[^>]*width=["']14["'][^>]*height=["']14["']/);
    });

    it('DES-032.14: SVG icon in #occSwitchLink has aria-hidden="true"', () => {
      // Prevents screen readers announcing raw SVG vectors
      const occStepMatch = onboardingHtml.match(/id=["']occSwitchLink["'][\s\S]*?<\/button>/);
      expect(occStepMatch).toBeTruthy();
      expect(occStepMatch[0]).toMatch(/<svg[^>]*aria-hidden=["']true["']/);
    });

    it('DES-032.15: SVG icon in #occSwitchLink uses stroke="currentColor"', () => {
      // Ensures icon color matches text color dynamically
      const occStepMatch = onboardingHtml.match(/id=["']occSwitchLink["'][\s\S]*?<\/button>/);
      expect(occStepMatch).toBeTruthy();
      expect(occStepMatch[0]).toMatch(/stroke=["']currentColor["']/);
    });

    it('DES-032.16: SVG icon in #occSwitchLink defines bidirectional swap arrow path', () => {
      // Verifies bidirectional swap arrow coordinates
      const occStepMatch = onboardingHtml.match(/id=["']occSwitchLink["'][\s\S]*?<\/button>/);
      expect(occStepMatch).toBeTruthy();
      expect(occStepMatch[0]).toMatch(/<path\s+d=["']M16 3l4 4-4 4["']/);
      expect(occStepMatch[0]).toMatch(/<path\s+d=["']M20 7H4["']/);
      expect(occStepMatch[0]).toMatch(/<path\s+d=["']M8 21l-4-4 4-4["']/);
      expect(occStepMatch[0]).toMatch(/<path\s+d=["']M4 17h16["']/);
    });

    it('DES-032.17: Student mode label reads "Already graduated / doing something else? Tap here"', () => {
      // Verifies student state copy
      expect(onboardingHtml).toMatch(/Already graduated \/ doing something else\? Tap here/);
    });

    it('DES-032.18: Professional mode label reads "Actually, I\'m currently a student — tap here"', () => {
      // Verifies professional state copy
      expect(onboardingHtml).toMatch(/Actually, I'm currently a student — tap here/);
    });

    it('DES-032.19: #occSwitchLink click listener flips answers.occupation_type between student and professional', () => {
      // Verifies state toggle logic
      const occListenerMatch = onboardingHtml.match(/#occSwitchLink['"]\)\.addEventListener\(\s*['"]click['"]\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\}\);/);
      expect(occListenerMatch).toBeTruthy();
      expect(occListenerMatch[1]).toMatch(/answers\.occupation_type\s*=\s*isStudent\s*\?\s*['"]professional['"]\s*:\s*['"]student['"]/);
    });

    it('DES-032.20: #occSwitchLink click listener calls renderStep() to re-render with updated labels', () => {
      // Verifies step is re-rendered immediately on toggle
      const occListenerMatch = onboardingHtml.match(/#occSwitchLink['"]\)\.addEventListener\(\s*['"]click['"]\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\}\);/);
      expect(occListenerMatch).toBeTruthy();
      expect(occListenerMatch[1]).toMatch(/renderStep\(\);/);
    });

    it('DES-032.21: .auth-switch-link text is wrapped in <span> for clean flex alignment', () => {
      // Verifies semantic text span wrapping alongside SVG icon
      const occStepMatch = onboardingHtml.match(/id=["']occSwitchLink["'][\s\S]*?<\/button>/);
      expect(occStepMatch).toBeTruthy();
      expect(occStepMatch[0]).toMatch(/<span>\$\{isStudent\s*\?[^}]*\}<\/span>/);
    });
  });
});
