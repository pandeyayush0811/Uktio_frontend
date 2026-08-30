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

describe('Frontend Adversarial Suite — Issue #1 (AUD-020: Scenario Progress & Commit Mode UI State)', () => {
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
  // SUITE 1: Scenario Progress State Transitions & Chip Indicators
  // ─────────────────────────────────────────────────────────────────────────

  it('test_scenario_only_completed_shows_checked_scenario_and_pending_chat', async () => {
    // Why this matters: When learner completes scenario simulation, the scenario chip MUST update to "✓ Scenario" while chat remains in progress.
    vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
      chat_seconds_done: 120,
      chat_seconds_required: 300,
      chat_requirement_met: false,
      scenario_requirement_met: true, // Scenario done!
      ms_until_reset: 5 * 3600 * 1000 // 5 hours
    });

    await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
    expect(containerEl.style.display).toBe('flex');
    expect(containerEl.className).toBe('commit-mode-banner');
    expect(containerEl.className).not.toContain('commit-mode-done');

    const scenarioChip = containerEl.children.find(c => c.textContent.includes('Scenario'));
    expect(scenarioChip).toBeDefined();
    expect(scenarioChip.textContent).toBe('✓ Scenario');
    expect(scenarioChip.className).toContain('done');

    const chatChip = containerEl.children.find(c => c.textContent.includes('Chat'));
    expect(chatChip).toBeDefined();
    expect(chatChip.textContent).toBe('Chat 2/5 min');
    expect(chatChip.className).not.toContain('done');

    expect(containerEl.textContent).toContain('Reset in 5h 0m');
  });

  it('test_scenario_pending_shows_scenario_pending_status', async () => {
    // Why this matters: When scenario is not completed, chip MUST clearly state "Scenario: Pending" without done class.
    vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
      chat_seconds_done: 300,
      chat_seconds_required: 300,
      chat_requirement_met: true,
      scenario_requirement_met: false, // Scenario NOT done!
      ms_until_reset: 2 * 3600 * 1000
    });

    await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
    expect(containerEl.style.display).toBe('flex');
    expect(containerEl.className).not.toContain('commit-mode-done');

    const scenarioChip = containerEl.children.find(c => c.textContent.includes('Scenario'));
    expect(scenarioChip).toBeDefined();
    expect(scenarioChip.textContent).toBe('Scenario: Pending');
    expect(scenarioChip.className).not.toContain('done');

    const chatChip = containerEl.children.find(c => c.textContent.includes('Chat'));
    expect(chatChip).toBeDefined();
    expect(chatChip.textContent).toBe('✓ Chat');
    expect(chatChip.className).toContain('done');
  });

  it('test_both_completed_triggers_celebratory_banner_and_both_checked_chips', async () => {
    // Why this matters: Full accountability loop satisfied — UI must celebrate complete status.
    vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
      chat_seconds_done: 360,
      chat_seconds_required: 300,
      chat_requirement_met: true,
      scenario_requirement_met: true,
      ms_until_reset: 3600000
    });

    await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
    expect(containerEl.style.display).toBe('flex');
    expect(containerEl.className).toContain('commit-mode-done');
    expect(containerEl.textContent).toContain('✓ Chat');
    expect(containerEl.textContent).toContain('✓ Scenario');
    expect(containerEl.textContent).toContain('Aaj ka Commit Mode complete ✓');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 2: Edge Cases, Null & Error Resilience
  // ─────────────────────────────────────────────────────────────────────────

  it('test_null_progress_hides_banner_cleanly_without_dom_mutation', async () => {
    // Why this matters: If network drops or backend returns null, widget fails open silently.
    vi.spyOn(authModule, 'apiFetch').mockRejectedValue(new Error('Network offline'));

    await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
    expect(containerEl.style.display).toBe('none');
    expect(containerEl.children.length).toBe(0);
  });

  it('test_non_commit_mode_plans_never_render_banner_even_if_progress_endpoint_responds', async () => {
    // Why this matters: Users on starter or free plan must never see commit mode banner.
    const spy = vi.spyOn(authModule, 'apiFetch');

    await renderCommitModeBanner(containerEl, { plan: 'starter' });
    expect(containerEl.style.display).toBe('none');
    expect(spy).not.toHaveBeenCalled();

    await renderCommitModeBanner(containerEl, { plan: 'none' });
    expect(containerEl.style.display).toBe('none');
    expect(spy).not.toHaveBeenCalled();
  });
});
