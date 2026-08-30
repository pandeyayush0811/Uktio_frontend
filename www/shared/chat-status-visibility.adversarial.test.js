import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Role: 06_TestWriter (Senior Frontend/Backend Adversarial QA)
// Issue: AUD-029 (Issue #6: Status Row and Footer Visibility in chat.html)
// Target Files:
//   - frontend_updated/frontend/www/chat.html
//   - frontend_updated/frontend/www/scenario.html
//   - frontend_updated/frontend/www/shared/chat-functional-contracts.test.js

describe('Adversarial Test Suite — AUD-029 (Issue #6: Status Row & Footer Visibility & State Transitions)', () => {
  const wwwDir = path.resolve(__dirname, '..');
  const chatHtmlPath = path.resolve(wwwDir, 'chat.html');
  const scenarioHtmlPath = path.resolve(wwwDir, 'scenario.html');

  const chatHtmlSource = fs.readFileSync(chatHtmlPath, 'utf8');
  const scenarioHtmlSource = fs.readFileSync(scenarioHtmlPath, 'utf8');

  // =========================================================================
  // SUITE 1: CSS AST & Static Layout Style Contracts
  // =========================================================================
  describe('Suite 1: CSS AST & Static Layout Style Contracts', () => {
    // Why this matters: Verifies .status-row is not hidden by CSS rules in chat.html
    it('test_status_row_css_rule_presence_and_visibility_contract', () => {
      const statusRowCssMatch = chatHtmlSource.match(/\.status-row\s*\{([^}]+)\}/);
      expect(statusRowCssMatch, '.status-row CSS rule should exist in chat.html').not.toBeNull();
      const statusRowCss = statusRowCssMatch ? statusRowCssMatch[1] : '';

      // Must strictly NOT contain any hiding declarations
      expect(statusRowCss).not.toMatch(/visibility\s*:\s*hidden/i);
      expect(statusRowCss).not.toMatch(/visibility\s*:\s*collapse/i);
      expect(statusRowCss).not.toMatch(/display\s*:\s*none/i);
      expect(statusRowCss).not.toMatch(/opacity\s*:\s*0(?![.\d])/i);
      expect(statusRowCss).not.toMatch(/clip-path\s*:\s*inset/i);
      expect(statusRowCss).not.toMatch(/transform\s*:\s*scale\(0\)/i);

      // Must explicitly declare flex centering layout
      expect(statusRowCss).toMatch(/display\s*:\s*flex/i);
      expect(statusRowCss).toMatch(/align-items\s*:\s*center/i);
      expect(statusRowCss).toMatch(/justify-content\s*:\s*center/i);
    });

    // Why this matters: Verifies footer with mic permission help is not hidden by CSS in chat.html
    it('test_footer_css_rule_presence_and_visibility_contract', () => {
      const footerCssMatch = chatHtmlSource.match(/footer\s*\{([^}]+)\}/);
      expect(footerCssMatch, 'footer CSS rule should exist in chat.html').not.toBeNull();
      const footerCss = footerCssMatch ? footerCssMatch[1] : '';

      // Must strictly NOT contain hiding declarations
      expect(footerCss).not.toMatch(/visibility\s*:\s*hidden/i);
      expect(footerCss).not.toMatch(/visibility\s*:\s*collapse/i);
      expect(footerCss).not.toMatch(/display\s*:\s*none/i);
      expect(footerCss).not.toMatch(/opacity\s*:\s*0(?![.\d])/i);

      // Must declare flex layout for icon and notice text
      expect(footerCss).toMatch(/display\s*:\s*flex/i);
      expect(footerCss).toMatch(/align-items\s*:\s*center/i);
    });

    // Why this matters: Ensures semantic color tokens for live (green) and error (red) states are applied
    it('test_status_dot_and_text_css_tokens_contract', () => {
      const dotBaseMatch = chatHtmlSource.match(/\.dot\s*\{([^}]+)\}/);
      expect(dotBaseMatch, '.dot CSS rule must exist in chat.html').not.toBeNull();
      const dotBaseCss = dotBaseMatch[1];
      expect(dotBaseCss).toContain('border-radius:50%');
      expect(dotBaseCss).toContain('var(--ink-dim)');

      const dotLiveMatch = chatHtmlSource.match(/\.dot\.live\s*\{([^}]+)\}/);
      expect(dotLiveMatch, '.dot.live CSS rule must exist in chat.html').not.toBeNull();
      expect(dotLiveMatch[1]).toContain('var(--good)');

      const dotErrMatch = chatHtmlSource.match(/\.dot\.err\s*\{([^}]+)\}/);
      expect(dotErrMatch, '.dot.err CSS rule must exist in chat.html').not.toBeNull();
      expect(dotErrMatch[1]).toContain('var(--bad)');

      const statusTextMatch = chatHtmlSource.match(/#statusText\s*\{([^}]+)\}/);
      expect(statusTextMatch, '#statusText CSS rule must exist in chat.html').not.toBeNull();
      expect(statusTextMatch[1]).toContain('var(--ink-dim)');
    });

    // Why this matters: Cross-checks parity with scenario.html to prevent regressions in sibling roleplay page
    it('test_sibling_parity_scenario_html_status_and_footer_visibility_contracts', () => {
      const scenarioStatusRowMatch = scenarioHtmlSource.match(/\.status-row\s*\{([^}]+)\}/);
      expect(scenarioStatusRowMatch, '.status-row CSS rule should exist in scenario.html').not.toBeNull();
      const scenarioStatusRowCss = scenarioStatusRowMatch ? scenarioStatusRowMatch[1] : '';

      expect(scenarioStatusRowCss).not.toMatch(/visibility\s*:\s*hidden/i);
      expect(scenarioStatusRowCss).not.toMatch(/display\s*:\s*none/i);
      expect(scenarioStatusRowCss).toMatch(/display\s*:\s*flex/i);

      const scenarioFooterMatch = scenarioHtmlSource.match(/footer\s*\{([^}]+)\}/);
      expect(scenarioFooterMatch, 'footer CSS rule should exist in scenario.html').not.toBeNull();
      const scenarioFooterCss = scenarioFooterMatch ? scenarioFooterMatch[1] : '';

      expect(scenarioFooterCss).not.toMatch(/visibility\s*:\s*hidden/i);
      expect(scenarioFooterCss).not.toMatch(/display\s*:\s*none/i);
    });

    // Why this matters: Sibling scan across ALL frontend HTML pages to guarantee no accidental hidden elements
    it('test_global_frontend_html_pages_audit_for_accidental_hidden_visibility', () => {
      const htmlFiles = fs.readdirSync(wwwDir).filter(f => f.endsWith('.html'));
      expect(htmlFiles.length).toBeGreaterThanOrEqual(10);

      const violations = [];
      for (const htmlFile of htmlFiles) {
        const fullPath = path.resolve(wwwDir, htmlFile);
        const content = fs.readFileSync(fullPath, 'utf8');

        // Check if any <style> block contains visibility: hidden
        const styleBlocks = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
        for (const block of styleBlocks) {
          if (/visibility\s*:\s*hidden/i.test(block)) {
            violations.push(`${htmlFile} contains visibility: hidden in <style> block`);
          }
        }
      }

      expect(violations, `Found visibility: hidden violations in: ${violations.join(', ')}`).toEqual([]);
    });
  });

  // =========================================================================
  // SUITE 2: DOM Hierarchy & Initial Mount State Integrity
  // =========================================================================
  describe('Suite 2: DOM Hierarchy & Initial Mount State Integrity', () => {
    // Why this matters: Confirms correct container structure so screen readers and users see status on initial load
    it('test_initial_markup_structure_contains_valid_status_row_hierarchy', () => {
      expect(chatHtmlSource).toContain('<div class="status-row">');
      expect(chatHtmlSource).toContain('<div class="dot" id="statusDot"></div>');
      expect(chatHtmlSource).toContain('<span id="statusText">Tap the mic button below to start</span>');

      // Verify DOM ordering: statusDot precedes statusText inside status-row
      const statusRowIdx = chatHtmlSource.indexOf('<div class="status-row">');
      const dotIdx = chatHtmlSource.indexOf('id="statusDot"', statusRowIdx);
      const textIdx = chatHtmlSource.indexOf('id="statusText"', statusRowIdx);
      const endRowIdx = chatHtmlSource.indexOf('</div>', textIdx);

      expect(statusRowIdx).toBeGreaterThan(-1);
      expect(dotIdx).toBeGreaterThan(statusRowIdx);
      expect(textIdx).toBeGreaterThan(dotIdx);
      expect(endRowIdx).toBeGreaterThan(textIdx);
    });

    // Why this matters: Confirms footer contains required browser guideline text and lock SVG icon
    it('test_initial_footer_contains_required_guideline_and_svg_icon', () => {
      expect(chatHtmlSource).toContain('<footer>');
      expect(chatHtmlSource).toContain('<svg viewBox="0 0 24 24"');
      expect(chatHtmlSource).toContain('Mic access chahiye hoga (browser permission maangega). Best Chrome/Edge mein chalega.');
      expect(chatHtmlSource).toContain('</footer>');
    });

    // Why this matters: Verifies proper flex vertical flow where status-row sits above chat transcript and mic
    it('test_chat_container_and_mic_dock_vertical_flow_coexistence', () => {
      const headerIdx = chatHtmlSource.indexOf('<header class="topbar">');
      const statusRowIdx = chatHtmlSource.indexOf('<div class="status-row">');
      const trialBannerIdx = chatHtmlSource.indexOf('id="trialBanner"');
      const chatCardIdx = chatHtmlSource.indexOf('<div class="chat-card">');
      const micDockIdx = chatHtmlSource.indexOf('<div class="mic-dock">');
      const footerIdx = chatHtmlSource.indexOf('<footer>');

      expect(headerIdx).toBeLessThan(statusRowIdx);
      expect(statusRowIdx).toBeLessThan(trialBannerIdx);
      expect(trialBannerIdx).toBeLessThan(chatCardIdx);
      expect(chatCardIdx).toBeLessThan(micDockIdx);
      expect(micDockIdx).toBeLessThan(footerIdx);
    });
  });

  // =========================================================================
  // SUITE 3: Adversarial setStatus(text, mode) Lifecycle & State Machine
  // =========================================================================
  describe('Suite 3: Adversarial setStatus(text, mode) Lifecycle & State Machine', () => {
    function createStatusController(sourceCode) {
      const setStatusMatch = sourceCode.match(/function\s+setStatus\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/);
      if (!setStatusMatch) throw new Error('setStatus function not found');
      const setStatusBody = setStatusMatch[0];

      const statusText = { textContent: '' };
      const statusDot = { className: '' };
      const micBtn = {
        classList: {
          classes: new Set(),
          toggle(cls, val) {
            if (val) this.classes.add(cls);
            else this.classes.delete(cls);
          },
          contains(cls) { return this.classes.has(cls); }
        }
      };
      const waveLeftEl = {
        classList: {
          classes: new Set(),
          toggle(cls, val) {
            if (val) this.classes.add(cls);
            else this.classes.delete(cls);
          },
          contains(cls) { return this.classes.has(cls); }
        }
      };
      const waveRightEl = {
        classList: {
          classes: new Set(),
          toggle(cls, val) {
            if (val) this.classes.add(cls);
            else this.classes.delete(cls);
          },
          contains(cls) { return this.classes.has(cls); }
        }
      };

      const setStatusFn = new Function('statusText', 'statusDot', 'micBtn', 'waveLeftEl', 'waveRightEl', `
        return ${setStatusBody}
      `)(statusText, statusDot, micBtn, waveLeftEl, waveRightEl);

      return {
        setStatus: setStatusFn,
        statusText,
        statusDot,
        micBtn,
        waveLeftEl,
        waveRightEl
      };
    }

    // Why this matters: Verifies that passing null or undefined mode cleanly resets dot class without "dot null" bug
    it('test_setStatus_default_mode_handling_when_mode_is_null_or_undefined', () => {
      const ctrl = createStatusController(chatHtmlSource);

      ctrl.setStatus('Tap the mic button below to start', null);
      expect(ctrl.statusText.textContent).toBe('Tap the mic button below to start');
      expect(ctrl.statusDot.className).toBe('dot');
      expect(ctrl.micBtn.classList.contains('active')).toBe(false);
      expect(ctrl.waveLeftEl.classList.contains('live')).toBe(false);
      expect(ctrl.waveRightEl.classList.contains('live')).toBe(false);

      ctrl.setStatus('Tap the mic button below to start', undefined);
      expect(ctrl.statusText.textContent).toBe('Tap the mic button below to start');
      expect(ctrl.statusDot.className).toBe('dot');
      expect(ctrl.micBtn.classList.contains('active')).toBe(false);
    });

    // Why this matters: Verifies transition into connected live state activates dot, mic button glow, and audio waves
    it('test_setStatus_live_active_mode_transition', () => {
      const ctrl = createStatusController(chatHtmlSource);

      ctrl.setStatus('Connected — mic on', 'live');
      expect(ctrl.statusText.textContent).toBe('Connected — mic on');
      expect(ctrl.statusDot.className).toBe('dot live');
      expect(ctrl.micBtn.classList.contains('active')).toBe(true);
      expect(ctrl.waveLeftEl.classList.contains('live')).toBe(true);
      expect(ctrl.waveRightEl.classList.contains('live')).toBe(true);
    });

    // Why this matters: Verifies transition into error mode displays error styling and deactivates mic glow
    it('test_setStatus_error_mode_transition', () => {
      const ctrl = createStatusController(chatHtmlSource);

      // Prior live state
      ctrl.setStatus('Connected — mic on', 'live');

      // Transition to error
      ctrl.setStatus('Could not start microphone — please try again.', 'err');
      expect(ctrl.statusText.textContent).toBe('Could not start microphone — please try again.');
      expect(ctrl.statusDot.className).toBe('dot err');
      expect(ctrl.micBtn.classList.contains('active')).toBe(false);
      expect(ctrl.waveLeftEl.classList.contains('live')).toBe(false);
      expect(ctrl.waveRightEl.classList.contains('live')).toBe(false);
    });

    // Why this matters: Verifies custom/future mode tags (e.g. 'warn', 'info') format valid CSS classes
    it('test_setStatus_custom_or_edge_case_mode_transitions', () => {
      const ctrl = createStatusController(chatHtmlSource);

      ctrl.setStatus('Low network warning', 'warn');
      expect(ctrl.statusText.textContent).toBe('Low network warning');
      expect(ctrl.statusDot.className).toBe('dot warn');
      expect(ctrl.micBtn.classList.contains('active')).toBe(false);

      // Reset with empty string
      ctrl.setStatus('', '');
      expect(ctrl.statusText.textContent).toBe('');
      expect(ctrl.statusDot.className).toBe('dot');
    });

    // Why this matters: Stresses the status state machine with a rapid, out-of-order event flapping storm
    it('test_setStatus_rapid_adversarial_flapping_sequence', () => {
      const ctrl = createStatusController(chatHtmlSource);

      const sequence = [
        { text: 'Tap the mic button below to start', mode: null, expectedClass: 'dot', active: false },
        { text: 'Connecting...', mode: null, expectedClass: 'dot', active: false },
        { text: 'Connected — mic on', mode: 'live', expectedClass: 'dot live', active: true },
        { text: 'Internet connection nahi hai — check karke phir try karo.', mode: 'err', expectedClass: 'dot err', active: false },
        { text: 'Internet wapas aa gaya — mic dabao', mode: null, expectedClass: 'dot', active: false },
        { text: 'Connecting...', mode: null, expectedClass: 'dot', active: false },
        { text: 'Connected — mic on', mode: 'live', expectedClass: 'dot live', active: true },
        { text: 'Call received — session paused. Tap mic to continue.', mode: null, expectedClass: 'dot', active: false },
        { text: 'Connected — mic on', mode: 'live', expectedClass: 'dot live', active: true },
        { text: 'Session closed due to 90 seconds of inactivity. Tap mic to resume.', mode: null, expectedClass: 'dot', active: false },
        { text: 'Please add your AI Access Key in Settings.', mode: 'err', expectedClass: 'dot err', active: false },
        { text: 'Tap the mic button below to start', mode: null, expectedClass: 'dot', active: false }
      ];

      for (let i = 0; i < sequence.length; i++) {
        const step = sequence[i];
        ctrl.setStatus(step.text, step.mode);
        expect(ctrl.statusText.textContent, `Step ${i} text mismatch`).toBe(step.text);
        expect(ctrl.statusDot.className, `Step ${i} dot class mismatch`).toBe(step.expectedClass);
        expect(ctrl.micBtn.classList.contains('active'), `Step ${i} mic active mismatch`).toBe(step.active);
        expect(ctrl.waveLeftEl.classList.contains('live'), `Step ${i} waveLeft mismatch`).toBe(step.active);
        expect(ctrl.waveRightEl.classList.contains('live'), `Step ${i} waveRight mismatch`).toBe(step.active);
      }
    });
  });

  // =========================================================================
  // SUITE 4: Real-World Voice Session Event Integration Triggers
  // =========================================================================
  describe('Suite 4: Real-World Voice Session Event Integration Triggers', () => {
    // Why this matters: Verifies onStatus callback forwards live WebSocket events directly to setStatus
    it('test_event_trigger_onStatus_callback_integration', () => {
      expect(chatHtmlSource).toContain('onStatus: (text, mode) => {');
      expect(chatHtmlSource).toContain('setStatus(text, mode);');
    });

    // Why this matters: Verifies missing API key error path triggers error dot and prompt to open settings
    it('test_event_trigger_startSession_missing_api_key_error_flow', () => {
      expect(chatHtmlSource).toContain("if (result.reason === 'no_api_key') {");
      expect(chatHtmlSource).toContain("setStatus('Please add your AI Access Key in Settings.', 'err')");
      expect(chatHtmlSource).toContain("window.location.href = 'settings.html?needsKey=missing'");
    });

    // Why this matters: Verifies invalid API key error path triggers error dot and redirection
    it('test_event_trigger_startSession_invalid_api_key_error_flow', () => {
      expect(chatHtmlSource).toContain("else if (result.reason === 'invalid_api_key') {");
      expect(chatHtmlSource).toContain("setStatus((result.message || 'Invalid AI Key') + ' — go to Settings to fix this.', 'err')");
      expect(chatHtmlSource).toContain("settings.html?needsKey=invalid");
    });

    // Why this matters: Verifies unhandled exception in voiceSession.start invokes error status fallback
    it('test_event_trigger_startSession_generic_throw_exception', () => {
      expect(chatHtmlSource).toContain("catch (err) {");
      expect(chatHtmlSource).toContain("setStatus('Could not start microphone — please try again.', 'err')");
    });

    // Why this matters: Verifies phone call / OS audio focus loss pauses session and prompts tap to resume
    it('test_event_trigger_phone_call_interruption_event', () => {
      expect(chatHtmlSource).toContain('onInterrupted: (info) => {');
      expect(chatHtmlSource).toContain("setStatus('Call received — session paused. Tap mic to continue.', null)");
    });

    // Why this matters: Verifies inactivity timeout triggers correct status message for stagnant turns vs 90s silence
    it('test_event_trigger_inactivity_timeout_events', () => {
      expect(chatHtmlSource).toContain('onInactivityTimeout: (info) => {');
      expect(chatHtmlSource).toContain("Session paused due to extended inactivity. Tap mic to continue.");
      expect(chatHtmlSource).toContain("Session closed due to 90 seconds of inactivity. Tap mic to resume.");
    });

    // Why this matters: Verifies resume loader state transitions (loading -> ready or report-locked or error)
    it('test_event_trigger_resume_context_loader_lifecycle', () => {
      expect(chatHtmlSource).toContain("setStatus('Loading previous conversation…', null)");
      expect(chatHtmlSource).toContain("setStatus('This chat already has a report.', null)");
      expect(chatHtmlSource).toContain("setStatus('Tap the mic button below to start.', null)");
      expect(chatHtmlSource).toContain("setStatus('Could not load previous chat — you can start a new session.', 'err')");
    });

    // Why this matters: Verifies offline/online listeners update status text and protect against mic operations while offline
    it('test_event_trigger_offline_and_online_banner_listeners', () => {
      expect(chatHtmlSource).toContain("onOffline: () => {");
      expect(chatHtmlSource).toContain("setStatus('Internet connection nahi hai — check karke phir try karo.', 'err')");
      expect(chatHtmlSource).toContain("onBackOnline: () => {");
      expect(chatHtmlSource).toContain("setStatus('Internet wapas aa gaya — mic dabao', null)");

      // Guard check: Must NOT modify status or mic when session is actively in-flight
      expect(chatHtmlSource).toContain("if (!voiceSession.isActive() && !isBusy && !isLocked)");
    });
  });

  // =========================================================================
  // SUITE 5: Adversarial Inputs, Extremes & Boundary Cases
  // =========================================================================
  describe('Suite 5: Adversarial Inputs, Extremes & Boundary Cases', () => {
    function createStatusController(sourceCode) {
      const setStatusMatch = sourceCode.match(/function\s+setStatus\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/);
      const setStatusBody = setStatusMatch[0];

      const statusText = { textContent: '' };
      const statusDot = { className: '' };
      const micBtn = { classList: { toggle: vi.fn() } };
      const waveLeftEl = { classList: { toggle: vi.fn() } };
      const waveRightEl = { classList: { toggle: vi.fn() } };

      const setStatusFn = new Function('statusText', 'statusDot', 'micBtn', 'waveLeftEl', 'waveRightEl', `
        return ${setStatusBody}
      `)(statusText, statusDot, micBtn, waveLeftEl, waveRightEl);

      return { setStatus: setStatusFn, statusText, statusDot, micBtn, waveLeftEl, waveRightEl };
    }

    // Why this matters: Ensures extremely long server error messages or prompts don't crash setStatus or throw exceptions
    it('test_adversarial_extremely_long_status_message_injection', () => {
      const ctrl = createStatusController(chatHtmlSource);
      const megaString = 'A'.repeat(5000) + ' ' + '⚠️'.repeat(100);

      expect(() => ctrl.setStatus(megaString, 'err')).not.toThrow();
      expect(ctrl.statusText.textContent).toBe(megaString);
      expect(ctrl.statusDot.className).toBe('dot err');
    });

    // Why this matters: Verifies that status strings containing HTML / JS scripts cannot execute XSS (textContent assignment safe)
    it('test_adversarial_html_and_script_tag_sanitization_in_status_text', () => {
      const ctrl = createStatusController(chatHtmlSource);
      const maliciousPayload = "<script>alert('pwned')</script><img src=x onerror=alert(1)><b>Bold Error</b>";

      ctrl.setStatus(maliciousPayload, 'err');
      expect(ctrl.statusText.textContent).toBe(maliciousPayload);
      // Ensures textContent is used and no innerHTML property assignment exists in setStatus
      expect(chatHtmlSource).toMatch(/statusText\.textContent\s*=\s*text/);
      expect(chatHtmlSource).not.toMatch(/statusText\.innerHTML\s*=\s*text/);
    });

    // Why this matters: Verifies Hindi/Devanagari, Urdu, emoji characters are preserved with full fidelity
    it('test_adversarial_unicode_and_multilingual_status_strings', () => {
      const ctrl = createStatusController(chatHtmlSource);
      const hinglishNotice = 'कॉल आया है — सत्र रोका गया। बातचीत जारी रखने के लिए माइक दबाएं। 🎙️ ⚡ 🔴';

      ctrl.setStatus(hinglishNotice, null);
      expect(ctrl.statusText.textContent).toBe(hinglishNotice);
      expect(ctrl.statusDot.className).toBe('dot');
    });

    // Why this matters: Verifies null, undefined, non-string primitives (numbers, booleans, objects) are handled without crash
    it('test_adversarial_non_string_primitives_safety', () => {
      const ctrl = createStatusController(chatHtmlSource);

      expect(() => ctrl.setStatus(12345, null)).not.toThrow();
      expect(ctrl.statusText.textContent).toBe(12345);

      expect(() => ctrl.setStatus(false, null)).not.toThrow();
      expect(ctrl.statusText.textContent).toBe(false);

      expect(() => ctrl.setStatus({ error: 'fatal' }, 'err')).not.toThrow();
      expect(ctrl.statusText.textContent).toEqual({ error: 'fatal' });
      expect(ctrl.statusDot.className).toBe('dot err');
    });
  });
});
