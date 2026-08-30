import './config.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, showConnectionError, fetchProfileWithRetry } from './auth.js';

function createStorageMock() {
  const store = {};
  return {
    getItem: vi.fn(k => (k in store ? store[k] : null)),
    setItem: vi.fn((k, v) => { store[k] = String(v); }),
    removeItem: vi.fn(k => { delete store[k]; }),
    clear: vi.fn(() => {
      for (const k of Object.keys(store)) delete store[k];
    }),
    _store: store
  };
}

describe('AUD-026 Adversarial: Frontend Error Handling & Language Consistency', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    globalThis.localStorage = createStorageMock();
    globalThis.sessionStorage = createStorageMock();

    const bodyEl = {
      innerHTML: '',
      querySelector: (sel) => {
        if (sel === '.step-title') {
          const match = bodyEl.innerHTML.match(/<div class="step-title">([^<]+)<\/div>/);
          return match ? { textContent: match[1] } : null;
        }
        if (sel === '.step-sub') {
          const match = bodyEl.innerHTML.match(/<div class="step-sub">([^<]+)<\/div>/);
          return match ? { textContent: match[1] } : null;
        }
        if (sel === 'button.primary' || sel === '.primary') {
          const match = bodyEl.innerHTML.match(/<button class="primary"[^>]*>([^<]+)<\/button>/);
          return match ? { textContent: match[1] } : null;
        }
        return null;
      }
    };

    globalThis.document = { body: bodyEl };
    globalThis.window = {
      location: { href: 'http://localhost/chat.html', reload: vi.fn() },
      UKTIO_CONFIG: { BACKEND_URL: 'https://utkio-backend.onrender.com' }
    };
    globalThis.UKTIO_CONFIG = globalThis.window.UKTIO_CONFIG;
  });

  it('apiFetch extracts human-readable data.message over raw machine code data.error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'scenario_already_done_today',
        message: "Today's scenario is already complete — a new scenario will be available tomorrow."
      })
    });

    try {
      await apiFetch('/chat/sessions', { method: 'POST', body: '{}' });
      expect.fail('apiFetch should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.message).toBe("Today's scenario is already complete — a new scenario will be available tomorrow.");
      expect(err.data).toEqual({
        error: 'scenario_already_done_today',
        message: "Today's scenario is already complete — a new scenario will be available tomorrow."
      });
    }
  });

  it('apiFetch falls back cleanly to data.error when data.message is absent', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'started_at must be a valid ISO timestamp'
      })
    });

    try {
      await apiFetch('/chat/sessions', { method: 'POST', body: '{}' });
      expect.fail('apiFetch should have thrown');
    } catch (err) {
      expect(err.status).toBe(400);
      expect(err.message).toBe('started_at must be a valid ISO timestamp');
    }
  });

  it('apiFetch falls back to HTTP status code when both message and error are absent', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({})
    });

    try {
      await apiFetch('/chat/sessions', { method: 'POST', body: '{}' });
      expect.fail('apiFetch should have thrown');
    } catch (err) {
      expect(err.status).toBe(503);
      expect(err.message).toBe('Request failed (503)');
    }
  });

  it('apiFetch handles non-JSON / HTML responses (e.g. reverse proxy 504 gateway timeout)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      json: async () => {
        throw new Error('Unexpected token < in JSON at position 0');
      }
    });

    try {
      await apiFetch('/chat/sessions/sess-1/analyze', { method: 'POST', body: '{}' });
      expect.fail('apiFetch should have thrown');
    } catch (err) {
      expect(err.status).toBe(504);
      expect(err.message).toBe('Request failed (504)');
      expect(err.data).toEqual({});
    }
  });

  it('apiFetch handles network disconnection with clean English offline message', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    try {
      await apiFetch('/users/me');
      expect.fail('apiFetch should have thrown');
    } catch (err) {
      expect(err.message).toBe('No internet connection. Please check your network and try again.');
    }
  });

  it('showConnectionError renders clean and friendly English copy', () => {
    showConnectionError();
    const title = document.body.querySelector('.step-title');
    const sub = document.body.querySelector('.step-sub');
    const btn = document.body.querySelector('button.primary');

    expect(title.textContent).toBe('Unable to Connect 😕');
    expect(sub.textContent).toContain('The server is not responding right now');
    expect(btn.textContent).toBe('Try Again');
  });

  it('fetchProfileWithRetry reports clean English status messages during retries', async () => {
    const statusCalls = [];
    const onStatus = (msg) => statusCalls.push(msg);

    // Mock fetch to simulate 1 transient failure followed by success
    let attempts = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('Network timeout');
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, profile: { name: 'Pankaj' } })
      };
    });

    const result = await fetchProfileWithRetry(onStatus, false);
    expect(result.ok).toBe(true);
    expect(statusCalls.length).toBeGreaterThan(0);
    expect(statusCalls[0]).toMatch(/^Connecting to server\.\.\. \(\d+\/\d+\)$/);
  });
});
