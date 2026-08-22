import { describe, it, expect } from 'vitest';
import { trialBannerText } from './plan.js';

describe('plan-gating and trialBannerText', () => {
  it('trialBannerText returns null for paid plans or inactive trial', () => {
    expect(trialBannerText(null)).toBeNull();
    expect(trialBannerText({ plan: 'starter', trial: null })).toBeNull();
    expect(trialBannerText({ plan: 'none', trial: { active: false } })).toBeNull();
  });

  it('trialBannerText returns formatted countdown for active trial with credits', () => {
    const text = trialBannerText({
      plan: 'none',
      trial: { active: true, chats_remaining: 3, reports_remaining: 4, days_left: 2 }
    });
    expect(text).toContain('3 chats and 4 reports remaining');
  });

  it('trialBannerText returns limits reached when both chats and reports are 0', () => {
    const text = trialBannerText({
      plan: 'none',
      trial: { active: true, chats_remaining: 0, reports_remaining: 0, days_left: 1 }
    });
    expect(text).toContain('Free trial limits reached — Upgrade to continue practicing.');
  });
});
