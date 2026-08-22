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
// an active plan (chat.html, scenario.html). Redirects to pricing.html if
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
export async function requireActivePlan(kind = 'chat') {
  const status = await getPlanStatus();
  if (!status) {
    console.warn('Could not verify plan status — allowing through for now; the backend still enforces this on session save.');
    return null;
  }

  // Paid plan users (starter / commit_mode / unlimited) are always unblocked
  if (status.plan && status.plan !== 'none') {
    return status;
  }

  // Trial users: verify specific permission for chat vs scenario vs report
  const canPerform = (kind === 'report')
    ? status.can_report
    : (kind === 'scenario' ? status.can_scenario : status.can_chat);

  const allowed = (canPerform !== undefined)
    ? canPerform
    : Boolean(status.active && status.trial && (
        kind === 'report'
          ? status.trial.reports_remaining > 0
          : (kind === 'scenario'
              ? (status.trial.scenarios_remaining !== undefined ? status.trial.scenarios_remaining > 0 : true)
              : status.trial.chats_remaining > 0)
      ));

  if (!allowed) {
    const reason = (!status.active || (status.trial && !status.trial.active))
      ? 'trial_expired'
      : (kind === 'report' ? 'report_limit' : (kind === 'scenario' ? 'scenario_limit' : 'chat_limit'));
    window.location.href = 'pricing.html?reason=' + encodeURIComponent(reason);
    return null;
  }
  return status;
}

// Short Hinglish banner text for "X chats / Y scenarios / Z reports left" during an
// active trial, or null if there's nothing worth showing (paid plan, or
// status unavailable). Pages like chat.html/pricing.html can drop this
// straight into a banner element.
export function trialBannerText(status) {
  if (!status || !status.trial || !status.trial.active) return null;
  const { chats_remaining, reports_remaining, scenarios_remaining, days_left } = status.trial;
  const scenariosLeft = scenarios_remaining !== undefined ? scenarios_remaining : 0;

  if (chats_remaining <= 0 && reports_remaining <= 0 && scenariosLeft <= 0) {
    return 'Free trial limits reached — Upgrade to continue practicing.';
  }

  const parts = [];
  parts.push(`${chats_remaining} chat${chats_remaining !== 1 ? 's' : ''}`);
  if (scenarios_remaining !== undefined) {
    parts.push(`${scenarios_remaining} scenario${scenarios_remaining !== 1 ? 's' : ''}`);
  }
  parts.push(`${reports_remaining} report${reports_remaining !== 1 ? 's' : ''}`);

  return `Free trial: ${parts.join(', ')} remaining (${formatTrialTimeLeft(days_left)}).`;
}