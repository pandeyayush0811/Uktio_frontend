// ── Microsoft Clarity & Behavioral Analytics ──────────────────────────────────
// Automatically tracks heatmaps, user tap points, screen flow, and session replays.
// Initialized from shared/config.js on every page.

let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const cfg = (typeof window !== 'undefined' ? window.UKTIO_CONFIG : (typeof globalThis !== 'undefined' ? globalThis.UKTIO_CONFIG : null)) || {};
  const clarityId = cfg.CLARITY_PROJECT_ID;

  if (!clarityId) {
    console.info('Analytics is OFF — set UKTIO_CONFIG.CLARITY_PROJECT_ID in shared/config.js to enable user tracking.');
    return;
  }

  try {
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", clarityId);

    initialized = true;
    console.debug('[Analytics] Microsoft Clarity initialized with ID:', clarityId);
  } catch (err) {
    console.warn('[Analytics] Failed to initialize Clarity (non-fatal):', err);
  }
}

// ── Custom Event Tracking ───────────────────────────────────────────────────
// Use this to log key milestones (e.g. voice_session_start, payment_success)
export function trackEvent(eventName, properties = {}) {
  if (!window.clarity) return;

  // Security guard: purge any sensitive data or API keys before tracking
  const safeProps = { ...properties };
  delete safeProps.password;
  delete safeProps.apiKey;
  delete safeProps.token;
  delete safeProps.access_token;
  delete safeProps.geminiKey;

  try {
    window.clarity("event", eventName);
    if (Object.keys(safeProps).length > 0) {
      for (const [k, v] of Object.entries(safeProps)) {
        if (v !== undefined && v !== null) {
          window.clarity("set", k, String(v));
        }
      }
    }
    console.debug(`[Analytics Event] ${eventName}`, safeProps);
  } catch (e) {
    // Analytics never crashes the app
  }
}

// ── User Identification ─────────────────────────────────────────────────────
// Identifies the user in Clarity session recordings after login/signup
export function identifyUser(userId, traits = {}) {
  if (!window.clarity || !userId) return;
  try {
    // clarity("identify", customId, customSessionId, customPageId, friendlyName)
    window.clarity("identify", String(userId), undefined, undefined, traits.name || traits.email || undefined);
    if (traits.plan) {
      window.clarity("set", "user_plan", String(traits.plan));
    }
  } catch (e) {
    // Non-fatal
  }
}
