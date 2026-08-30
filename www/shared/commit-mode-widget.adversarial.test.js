import './config.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCommitModeProgress, renderCommitModeBanner } from './commit-mode-widget.js';
import * as authModule from './auth.js';
import { invalidateAllCache } from './api-cache.js';

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.className = '';
    this.style = {};
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c) || (this.className && this.className.includes(c)),
      toggle: (c, force) => {
        if (force === true) this.classList.add(c);
        else if (force === false) this.classList.remove(c);
        else if (this.classList.contains(c)) this.classList.remove(c);
        else this.classList.add(c);
      }
    };
    this.children = [];
    this._textContent = '';
  }

  get textContent() {
    if (this.children.length > 0) {
      return this.children.map(c => c.textContent).join(' ');
    }
    return this._textContent;
  }

  set textContent(v) {
    this._textContent = String(v);
    this.children = [];
  }

  set innerHTML(html) {
    if (html === '') {
      this.children = [];
      this._textContent = '';
    }
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

function makeStorageMock() {
  const mock = {};
  Object.defineProperties(mock, {
    getItem: { value: (k) => (k in mock ? mock[k] : null), writable: true, configurable: true },
    setItem: { value: (k, v) => { mock[k] = String(v); }, writable: true, configurable: true },
    removeItem: { value: (k) => { delete mock[k]; }, writable: true, configurable: true },
    clear: { value: () => { for (const k of Object.keys(mock)) delete mock[k]; }, writable: true, configurable: true }
  });
  return mock;
}

describe('Frontend Adversarial Suite — Issue #5 (AUD-005: Commit Mode Banner & Progress Widget)', () => {
  let containerEl;
  let originalDocument;
  let originalWindow;
  let originalFetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.sessionStorage = makeStorageMock();
    globalThis.localStorage = makeStorageMock();

    originalWindow = globalThis.window;
    originalFetch = globalThis.fetch;
    originalDocument = globalThis.document;

    globalThis.document = {
      createElement: (tag) => new MockElement(tag)
    };

    globalThis.window = {
      location: { href: 'http://localhost/home.html' },
      UKTIO_CONFIG: { BACKEND_URL: 'https://utkio-backend.onrender.com' }
    };
    globalThis.UKTIO_CONFIG = globalThis.window.UKTIO_CONFIG;

    containerEl = new MockElement('div');
    invalidateAllCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 1: Non-Commit Mode & Plan Gating Display Rules
  // ─────────────────────────────────────────────────────────────────────────

  it('test_banner_hidden_when_plan_is_starter_or_free', async () => {
    // Why this matters: Non-commit users must never see accountability countdowns.
    await renderCommitModeBanner(containerEl, { plan: 'starter' });
    expect(containerEl.style.display).toBe('none');

    await renderCommitModeBanner(containerEl, { plan: 'none' });
    expect(containerEl.style.display).toBe('none');

    await renderCommitModeBanner(containerEl, null);
    expect(containerEl.style.display).toBe('none');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 2: Network Degradation, Offline & Malformed API Responses
  // ─────────────────────────────────────────────────────────────────────────

  it('test_banner_fails_open_silently_on_network_error_without_throwing', async () => {
    // Why this matters: Widget is a motivational banner, not a blocker. Network drops must fail-open cleanly.
    vi.spyOn(authModule, 'apiFetch').mockRejectedValue(new Error('Network disconnected (503)'));

    const progress = await getCommitModeProgress();
    expect(progress).toBeNull();

    await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
    expect(containerEl.style.display).toBe('none');
  });

  it('test_banner_handles_zero_progress_state', async () => {
    // Why this matters: Brand new day morning state (0 seconds done, scenario not done).
    vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
      chat_seconds_done: 0,
      chat_seconds_required: 300,
      chat_requirement_met: false,
      scenario_requirement_met: false,
      ms_until_reset: 14 * 3600 * 1000 // 14 hours
    });

    await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
    expect(containerEl.style.display).toBe('flex');
    expect(containerEl.className).toBe('commit-mode-banner');
    expect(containerEl.textContent).toContain('Chat 0/5 min');
    expect(containerEl.textContent).toContain('Scenario: Pending');
    expect(containerEl.textContent).toContain('Reset in 14h 0m');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 3: Partial & Complete Progress States
  // ─────────────────────────────────────────────────────────────────────────

  it('test_banner_renders_partial_chat_and_completed_scenario', async () => {
    // Why this matters: User did scenario at lunch and 3 mins of chat in evening (180s/300s).
    vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
      chat_seconds_done: 180,
      chat_seconds_required: 300,
      chat_requirement_met: false,
      scenario_requirement_met: true,
      ms_until_reset: 2 * 3600 * 1000 + 15 * 60 * 1000 // 2h 15m
    });

    await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
    expect(containerEl.style.display).toBe('flex');
    expect(containerEl.textContent).toContain('Chat 3/5 min');
    expect(containerEl.textContent).toContain('✓ Scenario');
    expect(containerEl.textContent).toContain('Reset in 2h 15m');
  });

  it('test_banner_renders_fully_completed_state_with_commit_mode_done_styling', async () => {
    // Why this matters: When both requirements are met, UI turns green with celebratory message.
    vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
      chat_seconds_done: 350,
      chat_seconds_required: 300,
      chat_requirement_met: true,
      scenario_requirement_met: true,
      ms_until_reset: 1800000
    });

    await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
    expect(containerEl.style.display).toBe('flex');
    expect(containerEl.className).toContain('commit-mode-done');
    expect(containerEl.textContent).toContain('✓ Chat');
    expect(containerEl.textContent).toContain('✓ Scenario');
    expect(containerEl.textContent).toContain('Aaj ka Commit Mode complete ✓');
  });

  it('test_banner_countdown_edge_case_near_and_past_midnight', async () => {
    // Why this matters: When ms_until_reset <= 0 (right at 12:00 AM IST), displays 'Resets soon'.
    vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
      chat_seconds_done: 100,
      chat_seconds_required: 300,
      chat_requirement_met: false,
      scenario_requirement_met: false,
      ms_until_reset: 0
    });

    await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
    expect(containerEl.textContent).toContain('Resets soon');
  });
});
