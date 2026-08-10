import { apiFetch } from './auth.js';

// Returns { plan, plan_expires_at, active } or null on network/auth error.
export async function getPlanStatus() {
  try {
    return await apiFetch('/payments/status');
  } catch (e) {
    return null;
  }
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
