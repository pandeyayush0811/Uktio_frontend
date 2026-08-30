// Role: 10_FunctionalSanityTester & 06_TestWriter
// Target: Onboarding Wizard UI / Real-World Usability
// Issues Tested: DES-006, DES-007, DES-008, DES-009, DES-010

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Functional Sanity & Real-World UI Tests — Onboarding Wizard (onboarding.html & style.css)', () => {
  const onboardingHtmlPath = path.resolve(__dirname, '../onboarding.html');
  const styleCssPath = path.resolve(__dirname, 'style.css');

  let onboardingHtmlContent = '';
  let styleCssContent = '';

  beforeEach(() => {
    onboardingHtmlContent = fs.readFileSync(onboardingHtmlPath, 'utf8');
    styleCssContent = fs.readFileSync(styleCssPath, 'utf8');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. DES-006: Onboarding Progress Visualization (Linear Bar vs 9 Tiny Dots)
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-006: Progress Visualization for Multi-Step Onboarding', () => {
    it('test_onboarding_replaces_9_static_dots_with_modern_progress_bar', () => {
      // Real-World Issue: 9 static circular 8px dots look cramped on mobile and provide weak feedback.
      // Expect modern linear progress bar container or dynamic track.
      expect(onboardingHtmlContent).toMatch(/class=["'][^"']*(?:progress-bar|progress-track|progress-pill-wrap)[^"']*["']/);
    });

    it('test_style_css_defines_animated_progress_bar_fill', () => {
      expect(styleCssContent).toMatch(/\.progress-bar|\.progress-fill|\.progress-track/);
      expect(styleCssContent).toMatch(/transition\s*:\s*[^;]*width/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. DES-007: Step Transition Motion & Height Easing
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-007: Step Navigation Entrance Animations & Easing', () => {
    it('test_renderStep_applies_entrance_animation_class', () => {
      // Real-World Issue: Clicking Next/Back wipes DOM with zero transition, causing jarring layout jerks.
      const renderStepMatch = onboardingHtmlContent.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(renderStepMatch, 'renderStep function must exist in onboarding.html').toBeTruthy();

      const body = renderStepMatch[1];
      expect(body).toMatch(/classList\.add\(['"]step-enter['"]\)|stepFadeIn|\.animate\(/);
    });

    it('test_style_css_defines_step_fade_in_keyframes', () => {
      expect(styleCssContent).toMatch(/@keyframes\s+stepFadeIn/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. DES-008: Selection Chips Visual Hierarchy & Title/Subtitle Structure
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-008: Multi-Choice Selection Chips Typographic Hierarchy', () => {
    it('test_renderChips_structures_title_and_description_hierarchy', () => {
      // Real-World Issue: Single-line long strings lack visual scanability for non-fluent Indian users.
      const renderChipsMatch = onboardingHtmlContent.match(/function\s+renderChips\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(renderChipsMatch).toBeTruthy();

      const body = renderChipsMatch[1];
      expect(body).toMatch(/chip-title|chip-sub|chip-label|chip-desc/);
    });

    it('test_style_css_defines_chip_active_press_scale', () => {
      const chipActiveMatch = styleCssContent.match(/\.chip:active\s*\{([^}]+)\}/);
      expect(chipActiveMatch, '.chip:active rule should provide tactile feedback').toBeTruthy();
      expect(chipActiveMatch[1]).toMatch(/transform\s*:\s*scale\s*\(\s*0\.9[5-9]/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. DES-009: Occupation Switch Link Styling
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-009: Secondary Role Switch Action Presentation', () => {
    it('test_occupation_switch_link_avoids_raw_inline_styles_and_underline', () => {
      // Real-World Issue: Inline styles with heavy underline look like a broken 1990s web hyperlink.
      const linkMatch = onboardingHtmlContent.match(/id=["']occSwitchLink["'][^>]*style=["']([^"']*)["']/);
      if (linkMatch) {
        expect(linkMatch[1]).not.toMatch(/text-decoration\s*:\s*underline/i);
        expect(linkMatch[1]).not.toMatch(/color\s*:\s*var\(--accent\)/i);
      }
      expect(onboardingHtmlContent).toMatch(/class=["'][^"']*auth-switch-link[^"']*["']/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. DES-010: Translation Sample Textarea & Hindi Prompt Presentation
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-010: Translation Textarea Touch Safety & Quote Callout Box', () => {
    it('test_style_css_disables_textarea_resize_on_touch_devices', () => {
      // Real-World Issue: Dragging bottom-right resize corner breaks mobile layout.
      const textareaMatch = styleCssContent.match(/textarea\s*\{([^}]+)\}/);
      expect(textareaMatch, 'textarea rule in style.css').toBeTruthy();
      expect(textareaMatch[1]).toMatch(/resize\s*:\s*none/i);
    });

    it('test_hindi_translation_prompt_is_wrapped_in_dedicated_callout_box', () => {
      // Real-World Issue: Hindi prompt embedded inside generic helper text reduces reading focus.
      expect(onboardingHtmlContent).toMatch(/class=["'][^"']*(?:translate-prompt-box|quote-callout|prompt-surface)[^"']*["']/);
    });
  });
});
