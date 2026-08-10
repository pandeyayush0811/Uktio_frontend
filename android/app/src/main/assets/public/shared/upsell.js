// Post-chat-session membership upsell — a lightweight bottom-sheet shown
// right after a session finishes syncing, ONLY to users who don't have an
// active paid plan yet (paying members never see this — no point nagging
// someone who already converted).
//
// Deliberately built as plain DOM here (no framework) so it can be reused
// from any page (chat.html today; report.html/quiz.html could import the
// same function later) with a single import + one function call.
//
// This is a soft nudge, NOT the paywall — it never blocks anything, it's
// dismissible, and it doesn't reappear again in the same page session
// once dismissed (see shouldShow below). The actual enforcement remains
// server-side (requirePlan middleware) exactly as before.

const SESSION_DISMISS_KEY = 'uktio_upsell_dismissed_this_pageload';

function alreadyDismissedThisPageLoad() {
  // Deliberately in-memory (module-level var), not localStorage — a
  // dismiss should only silence the card for the rest of THIS page view,
  // not forever. Next time they open chat.html (next session), they see
  // it again. Prevents nagging twice in the same multi-turn session
  // (finalizeAndSyncSession can fire more than once per page view) while
  // still surfacing it every time they come back to practice.
  return window[SESSION_DISMISS_KEY] === true;
}

function markDismissedThisPageLoad() {
  window[SESSION_DISMISS_KEY] = true;
}

/**
 * Shows the upsell bottom-sheet if appropriate. No-ops safely if the user
 * already has an active paid plan, if status is unavailable, or if it was
 * already dismissed once during this page view.
 *
 * @param {object|null} status - result of getPlanStatus() from plan.js
 */
export function maybeShowPostSessionUpsell(status) {
  if (!status || status.active === undefined) return;
  if (status.plan && status.plan !== 'none') return; // already a paying member (even if expired-but-was-paid, don't nag mid-flow)
  if (alreadyDismissedThisPageLoad()) return;

  const trial = status.trial;
  showUpsellSheet(trial);
}

function showUpsellSheet(trial) {
  if (document.getElementById('upsellOverlay')) return; // already open, don't stack

  const chatsLeft = trial ? trial.chats_remaining : null;
  const reportsLeft = trial ? trial.reports_remaining : null;
  const daysLeft = trial ? trial.days_left : null;

  const urgent = trial && trial.active && (chatsLeft <= 1 || reportsLeft <= 1 || daysLeft <= 1);

  const overlay = document.createElement('div');
  overlay.id = 'upsellOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(20,20,35,0.45); z-index:9999;
    display:flex; align-items:flex-end; justify-content:center;
    animation:upsellFadeIn 0.2s ease-out;
  `;

  const sheet = document.createElement('div');
  sheet.style.cssText = `
    background:var(--card, #fff); width:100%; max-width:480px;
    border-radius:24px 24px 0 0; padding:24px 20px 28px;
    box-shadow:0 -10px 40px rgba(0,0,0,0.2);
    animation:upsellSlideUp 0.25s cubic-bezier(0.22,1,0.36,1);
  `;

  const headline = trial && trial.active
    ? (urgent
        ? 'Tumhara free trial khatam hone wala hai!'
        : 'Achha chal raha hai! 🎉')
    : 'Practice jaari rakhne ke liye plan lo';

  const sub = trial && trial.active
    ? `${chatsLeft} chat aur ${reportsLeft} report bache hain (${daysLeft} din baaki). Membership lo aur be-roktok practice karo.`
    : 'Tumhara free trial khatam ho chuka hai — Starter plan lo aur unlimited practice, reports, aur quizzes paao.';

  sheet.innerHTML = `
    <div style="width:36px;height:4px;background:var(--ink-dim,#8b8fa3);opacity:0.3;border-radius:99px;margin:0 auto 18px;"></div>
    <h2 style="font-size:1.15rem;font-weight:700;margin:0 0 6px;font-family:var(--font-display, inherit);">${headline}</h2>
    <p style="font-size:0.88rem;color:var(--ink-dim,#8b8fa3);margin:0 0 20px;line-height:1.45;">${sub}</p>
    <button id="upsellCta" style="width:100%;padding:14px;border:none;border-radius:14px;background:var(--accent,#6a63f1);color:#fff;font-weight:700;font-size:0.95rem;cursor:pointer;">
      Plans dekho — ₹99 se shuru
    </button>
    <button id="upsellDismiss" style="width:100%;padding:12px;border:none;background:none;color:var(--ink-dim,#8b8fa3);font-size:0.85rem;margin-top:6px;cursor:pointer;">
      Baad mein
    </button>
  `;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @keyframes upsellFadeIn { from{opacity:0} to{opacity:1} }
    @keyframes upsellSlideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
  `;
  document.head.appendChild(styleTag);

  function close() {
    overlay.remove();
    styleTag.remove();
    markDismissedThisPageLoad();
  }

  document.getElementById('upsellCta').addEventListener('click', () => {
    window.location.href = 'pricing.html';
  });
  document.getElementById('upsellDismiss').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}
