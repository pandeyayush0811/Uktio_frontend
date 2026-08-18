import { apiFetch } from './auth.js';
import { formatTrialTimeLeft } from './trial-time.js';
import { cachedFetch, invalidateCache } from './api-cache.js';

const PLAN_CACHE_KEY = 'plan_status';
// Plan rarely changes mid-session (only right after a checkout), so a
// short TTL is enough to collapse the repeat hits from home/settings/
// chat/quiz all calling this within seconds of each other, without ever
// showing something more than a minute stale.
const PLAN_CACHE_TTL_MS = 60 * 1000;

// Returns { plan, plan_expires_at, active, trial } or null on network/auth
// error. `trial` is null once the user has a paid plan; otherwise it's
// { active, days_left, chats_remaining, reports_remaining, chat_limit,
// report_limit } — see GET /payments/status on the backend.
//
// Cached for PLAN_CACHE_TTL_MS — pass { force: true } right after an
// action that you KNOW changed the plan server-side (e.g. the user just
// returned from a successful checkout) so that one call always hits the
// network instead of possibly serving a stale "no active plan".
export async function getPlanStatus(opts = {}) {
  try {
    const { value } = await cachedFetch(PLAN_CACHE_KEY, () => apiFetch('/payments/status'), PLAN_CACHE_TTL_MS, opts);
    return value;
  } catch (e) {
    return null;
  }
}

/** Call right after a successful checkout/plan change so the very next
 *  getPlanStatus() call (even a plain, non-forced one on another page)
 *  goes to the network instead of serving what's now a stale cache. */
export function invalidatePlanCache() {
  invalidateCache(PLAN_CACHE_KEY);
}

// Call this right after requireCompleteProfile() on any page that needs
// an active plan (chat.html, quiz.html). Redirects to pricing.html if
// the user doesn't have one.
//
// This is a UX check only, NOT the security boundary — it just saves a
// non-paying user from opening the mic and having a whole conversation
// they won't be able to save. The actual enforcement is server-side
// (requirePlan middleware on POST /chat/sessions), which can't be
// bypassed by skipping/tampering with this call. That's why this fails
// OPEN (lets the user through) on a network error rather than blocking
// them — a transient backend hiccup here shouldn't lock someone out;
// the backend will still correctly reject the session save if their
// plan really isn't active.
export async function requireActivePlan() {
  const status = await getPlanStatus();
  if (!status) {
    console.warn('Could not verify plan status — allowing through for now; the backend still enforces this on session save.');
    return null;
  }
  if (!status.active) {
    window.location.href = 'pricing.html';
    return null;
  }
  return status;
}

// Short Hinglish banner text for "X chats / Y reports left" during an
// active trial, or null if there's nothing worth showing (paid plan, or
// status unavailable). Pages like chat.html/pricing.html can drop this
// straight into a banner element.
export function trialBannerText(status) {
  if (!status || !status.trial || !status.trial.active) return null;
  const { chats_remaining, reports_remaining, days_left } = status.trial;
  return `Free trial: ${chats_remaining} chat${chats_remaining !== 1 ? 's' : ''} and ${reports_remaining} report${reports_remaining !== 1 ? 's' : ''} remaining (${formatTrialTimeLeft(days_left)}).`;
}