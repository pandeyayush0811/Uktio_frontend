import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trialBannerText, invalidatePlanCache, getPlanStatus } from './plan.js';
import * as authModule from './auth.js';

function makeSessionStorageMock() {
  const mock = {};
  Object.defineProperties(mock, {
    getItem:    { value: k => (k in mock ? mock[k] : null), enumerable: false },
    setItem:    { value: (k, v) => { mock[k] = String(v); }, enumerable: false },
    removeItem: { value: k => { delete mock[k]; }, enumerable: false },
  });
  return mock;
}

describe('plan-gating and trialBannerText', () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeSessionStorageMock();
    vi.restoreAllMocks();
    invalidatePlanCache();
  });

  it('trialBannerText returns null for paid plans or inactive trial', () => {
    expect(trialBannerText(null)).toBeNull();
    expect(trialBannerText({ plan: 'starter', trial: null })).toBeNull();
    expect(trialBannerText({ plan: 'none', trial: { active: false } })).toBeNull();
  });

  it('trialBannerText returns formatted countdown for active trial with credits including scenarios', () => {
    const text = trialBannerText({
      plan: 'none',
      trial: { active: true, chats_remaining: 3, scenarios_remaining: 1, reports_remaining: 4, days_left: 2 }
    });
    expect(text).toContain('3 chats, 1 scenario, 4 reports remaining');
  });

  it('trialBannerText returns limits reached when all chats, scenarios, and reports are 0', () => {
    const text = trialBannerText({
      plan: 'none',
      trial: { active: true, chats_remaining: 0, scenarios_remaining: 0, reports_remaining: 0, days_left: 1 }
    });
    expect(text).toContain('Free trial limits reached — Upgrade to continue practicing.');
  });

  it('getPlanStatus caches results and invalidatePlanCache forces fresh fetch', async () => {
    let callCount = 0;
    vi.spyOn(authModule, 'apiFetch').mockImplementation(async () => {
      callCount++;
      return { plan: 'starter', active: true };
    });

    const first = await getPlanStatus();
    expect(first).toEqual({ plan: 'starter', active: true });
    expect(callCount).toBe(1);

    const cached = await getPlanStatus();
    expect(cached).toEqual({ plan: 'starter', active: true });
    expect(callCount).toBe(1);

    invalidatePlanCache();

    const fresh = await getPlanStatus();
    expect(fresh).toEqual({ plan: 'starter', active: true });
    expect(callCount).toBe(2);
  });
});
