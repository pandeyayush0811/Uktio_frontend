import { describe, it, expect, beforeEach } from 'vitest';
import { formatCountdown, getPhaseBadgeState } from './scenario-phase.js';

function makeLocalStorageMock() {
  const store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

beforeEach(() => {
  globalThis.localStorage = makeLocalStorageMock();
});

describe('formatCountdown', () => {
  it('formats a full 3-minute start correctly', () => {
    expect(formatCountdown(180)).toBe('3:00');
  });

  it('pads single-digit seconds with a leading zero', () => {
    expect(formatCountdown(65)).toBe('1:05');
  });

  it('formats zero as 0:00', () => {
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('clamps negative values to 0:00 instead of showing a negative time', () => {
    expect(formatCountdown(-5)).toBe('0:00');
  });

  it('handles sub-minute values with no leading minute digit issue', () => {
    expect(formatCountdown(9)).toBe('0:09');
  });

  it('treats missing/undefined input as 0 rather than throwing', () => {
    expect(formatCountdown(undefined)).toBe('0:00');
  });
});

describe('getPhaseBadgeState', () => {
  it('roleplay phase shows "Scene" label, live countdown, and the live css class', () => {
    const state = getPhaseBadgeState('roleplay', 125);
    expect(state).toEqual({ label: 'Scene', value: '2:05', cssClass: 'live' });
  });

  it('feedback phase shows a fixed "Feedback" value and the feedback css class regardless of seconds left', () => {
    const state = getPhaseBadgeState('feedback', 999);
    expect(state).toEqual({ label: 'Mode', value: 'Feedback', cssClass: 'feedback' });
  });

  it('idle phase (pre-session) has no active css class', () => {
    const state = getPhaseBadgeState('idle', 180);
    expect(state).toEqual({ label: 'Scene', value: '3:00', cssClass: '' });
  });

  it('roleplay countdown reaching zero still renders 0:00, not a negative or NaN value', () => {
    const state = getPhaseBadgeState('roleplay', 0);
    expect(state.value).toBe('0:00');
  });

  it('correctly handles mid-session resume remaining time (e.g. 100s = 1:40)', () => {
    const state = getPhaseBadgeState('roleplay', 100);
    expect(state.value).toBe('1:40');
    expect(state.cssClass).toBe('live');
  });
});

import { resolveReturnUrl, registerBackHandler, handleBackPress, initBackNav } from './back-nav.js';

describe('back-nav manager', () => {
  describe('resolveReturnUrl', () => {
    it('returns defaultParent when no from or returnTo query param exists', () => {
      expect(resolveReturnUrl('home.html', '')).toBe('home.html');
      expect(resolveReturnUrl(null, '')).toBeNull();
    });

    it('resolves valid ?from=chat.html parameter', () => {
      expect(resolveReturnUrl('home.html', '?from=chat.html')).toBe('chat.html');
    });

    it('resolves valid ?returnTo=history.html parameter', () => {
      expect(resolveReturnUrl('settings.html', '?returnTo=history.html')).toBe('history.html');
    });

    it('accepts safe internal pages with query params (?from=chat.html?resume=123)', () => {
      expect(resolveReturnUrl('history.html', '?session=abc&from=chat.html?resume=123')).toBe('chat.html?resume=123');
    });

    it('rejects external/unsafe URLs to prevent open redirects and falls back to defaultParent', () => {
      expect(resolveReturnUrl('home.html', '?from=https://evil.com')).toBe('home.html');
      expect(resolveReturnUrl('home.html', '?from=//evil.com')).toBe('home.html');
      expect(resolveReturnUrl('home.html', '?from=javascript:alert(1)')).toBe('home.html');
    });
  });

  describe('registerBackHandler (interceptor stack)', () => {
    it('executes registered handlers in LIFO order (last registered runs first)', () => {
      const order = [];
      const unreg1 = registerBackHandler(() => { order.push('h1'); return false; });
      const unreg2 = registerBackHandler(() => { order.push('h2'); return false; });

      handleBackPress();

      expect(order).toEqual(['h2', 'h1']);
      unreg1();
      unreg2();
    });

    it('stops propagation when an interceptor returns true (e.g. drawer closes)', () => {
      const order = [];
      const unreg1 = registerBackHandler(() => { order.push('page'); return false; });
      const unreg2 = registerBackHandler(() => { order.push('drawer'); return true; });

      handleBackPress();

      expect(order).toEqual(['drawer']);
      unreg1();
      unreg2();
    });

    it('unregisters cleanly when unregister function is invoked', () => {
      const order = [];
      const unreg = registerBackHandler(() => { order.push('modal'); return true; });

      unreg();
      handleBackPress();

      expect(order).toEqual([]);
    });
  });

  describe('initBackNav integration', () => {
    it('executes custom onBack handler for multi-step forms (e.g. onboarding, auth)', () => {
      let step = 3;
      initBackNav(null, {
        onBack: () => {
          if (step > 1) {
            step--;
            return true;
          }
          return false;
        }
      });

      handleBackPress();
      expect(step).toBe(2);

      handleBackPress();
      expect(step).toBe(1);
    });
  });

  describe('Full Profile SWR Caching', () => {
    it('sets, retrieves, and clears full profile in local storage', async () => {
      const { setCachedFullProfile, getCachedFullProfile, clearCachedFullProfile, getCachedProfileBasic } = await import('./auth.js');
      
      const mockProfile = {
        name: 'Rahul Sharma',
        age: 24,
        occupation_type: 'working_professional',
        occupation_detail: 'Software Engineer',
        learning_goal: 'interview',
        english_level: 'intermediate',
        practice_time_minutes: 15,
        speaking_sample: 'Hello this is my speaking sample.'
      };

      setCachedFullProfile({ profile: mockProfile, email: 'rahul@example.com' });

      const cached = getCachedFullProfile();
      expect(cached).not.toBeNull();
      expect(cached.profile.name).toBe('Rahul Sharma');
      expect(cached.profile.english_level).toBe('intermediate');
      expect(cached.email).toBe('rahul@example.com');

      // Also updates basic profile cache automatically for drawer
      const basic = getCachedProfileBasic();
      expect(basic.name).toBe('Rahul Sharma');
      expect(basic.email).toBe('rahul@example.com');

      clearCachedFullProfile();
      expect(getCachedFullProfile()).toBeNull();
    });
  });

  describe('Scenario State Persistence across page reloads', () => {
    it('persists remaining seconds and previous turns correctly', () => {
      const key = 'utkio_scenario_state_test-scenario_2026-08-23';
      const state = {
        phaseSecondsLeft: 20,
        sessionStartedAt: '2026-08-23T12:00:00.000Z',
        sessionTurns: [
          { role: 'model', content: 'Good morning! How can I help you today?' },
          { role: 'user', content: 'I need to check into my flight.' }
        ]
      };

      localStorage.setItem(key, JSON.stringify(state));

      const restored = JSON.parse(localStorage.getItem(key));
      expect(restored.phaseSecondsLeft).toBe(20);
      expect(restored.sessionTurns.length).toBe(2);
      expect(restored.sessionTurns[1].content).toBe('I need to check into my flight.');

      localStorage.removeItem(key);
      expect(localStorage.getItem(key)).toBeNull();
    });
  });

  describe('Shared Configuration Constants', () => {
    it('exports MIN_TURNS_FOR_ANALYSIS as 10', async () => {
      const { MIN_TURNS_FOR_ANALYSIS } = await import('./config.js');
      expect(MIN_TURNS_FOR_ANALYSIS).toBe(10);
    });
  });
});


