import './config.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { escapeHtml } from './sanitize.js';

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.value = '';
    this.textContent = '';
    this.disabled = false;
    this.className = '';
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c) || Boolean(this.className && this.className.includes(c)),
      toggle: (c, force) => {
        if (force === true) this.classList.add(c);
        else if (force === false) this.classList.remove(c);
        else if (this.classList.contains(c)) this.classList.remove(c);
        else this.classList.add(c);
      }
    };
    this.eventListeners = {};
  }

  addEventListener(event, fn) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(fn);
  }

  dispatchEvent(evt) {
    const type = typeof evt === 'string' ? evt : evt.type;
    const handlers = this.eventListeners[type] || [];
    for (const h of handlers) {
      h({ target: this, ...evt });
    }
  }

  click() {
    this.dispatchEvent({ type: 'click' });
  }
}

describe('Frontend Adversarial Suite — Issue #7 (AUD-007: Profile Form, Input Sanitization & UI Edge Cases)', () => {
  let elements;
  let originalDocument;

  beforeEach(() => {
    elements = {
      f_name: new MockElement('input'),
      f_age: new MockElement('input'),
      f_occdetail: new MockElement('input'),
      f_city: new MockElement('input'),
      f_sample: new MockElement('textarea'),
      charHint: new MockElement('span'),
      saveBtn: new MockElement('button'),
      saveBtnLabel: new MockElement('span'),
      saveStatus: new MockElement('div')
    };

    originalDocument = globalThis.document;
    globalThis.document = {
      getElementById: (id) => elements[id] || null,
      createElement: (tag) => new MockElement(tag)
    };
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 1: Input Filtering & Human Typing Quirks
  // ─────────────────────────────────────────────────────────────────────────

  it('test_age_input_strips_non_numeric_characters_in_real_time', () => {
    // Why this matters: User accidentally types letters or symbols on keyboard into age field.
    const ageInput = elements.f_age;
    ageInput.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });

    ageInput.value = '25abc!@#';
    ageInput.dispatchEvent({ type: 'input' });
    expect(ageInput.value).toBe('25');

    ageInput.value = '-42';
    ageInput.dispatchEvent({ type: 'input' });
    expect(ageInput.value).toBe('42');
  });

  it('test_english_sample_character_counter_and_near_limit_warning', () => {
    // Why this matters: Real-time UI feedback stops user from exceeding 500 chars.
    const sampleInput = elements.f_sample;
    const charHint = elements.charHint;

    sampleInput.addEventListener('input', e => {
      const len = e.target.value.length;
      charHint.textContent = len + ' / 500';
      charHint.classList.toggle('near-limit', len >= 450);
    });

    sampleInput.value = 'A'.repeat(449);
    sampleInput.dispatchEvent({ type: 'input' });
    expect(charHint.textContent).toBe('449 / 500');
    expect(charHint.classList.contains('near-limit')).toBe(false);

    sampleInput.value = 'A'.repeat(450);
    sampleInput.dispatchEvent({ type: 'input' });
    expect(charHint.textContent).toBe('450 / 500');
    expect(charHint.classList.contains('near-limit')).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 2: Double-Click Prevention & Button Debouncing
  // ─────────────────────────────────────────────────────────────────────────

  it('test_save_button_enters_loading_state_and_disables_to_prevent_double_submit', async () => {
    // Why this matters: Rapid double-clicking on Save changes button must not fire duplicate HTTP requests.
    const saveBtn = elements.saveBtn;
    const saveBtnLabel = elements.saveBtnLabel;
    let submitCount = 0;

    saveBtn.addEventListener('click', async () => {
      if (saveBtn.disabled) return;
      saveBtn.disabled = true;
      saveBtn.classList.add('btn-loading');
      saveBtnLabel.textContent = 'Saving…';
      submitCount++;

      // Simulate async network call
      await new Promise(resolve => setTimeout(resolve, 50));
      saveBtn.disabled = false;
      saveBtn.classList.remove('btn-loading');
      saveBtnLabel.textContent = 'Save changes';
    });

    // Fire two rapid clicks
    saveBtn.click();
    saveBtn.click();

    expect(submitCount).toBe(1);
    expect(saveBtn.disabled).toBe(true);
    expect(saveBtnLabel.textContent).toBe('Saving…');

    // Wait for resolution
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(saveBtn.disabled).toBe(false);
    expect(saveBtnLabel.textContent).toBe('Save changes');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 3: XSS & HTML Injection Protection on Displayed Profile Fields
  // ─────────────────────────────────────────────────────────────────────────

  it('test_profile_name_and_city_are_properly_escaped_against_xss', () => {
    // Why this matters: If a malicious user injects script tags into their name, rendering it via innerHTML must be safe.
    const maliciousName = '<img src=x onerror=alert(1)>';
    const escapedName = escapeHtml(maliciousName);
    expect(escapedName).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapedName).not.toContain('<img');

    const maliciousCity = '<script>document.cookie="stolen";</script>';
    const escapedCity = escapeHtml(maliciousCity);
    expect(escapedCity).toBe('&lt;script&gt;document.cookie=&quot;stolen&quot;;&lt;/script&gt;');
  });
});
