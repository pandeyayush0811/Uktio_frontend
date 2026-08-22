import { describe, it, expect } from 'vitest';
import { trialBannerText } from './plan.js';

describe('plan-gating and trialBannerText', () => {
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
});
