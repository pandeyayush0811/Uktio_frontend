// Post-chat-session membership upsell — a lightweight bottom-sheet shown
// right after a session finishes syncing, ONLY to users who don't have an
// active paid plan yet (paying members never see this — no point nagging
// someone who already converted).
//
// Deliberately built as plain DOM here (no framework) so it can be reused
// from any page (chat.html today; report.html could import the
// same function later) with a single import + one function call.
//
// This is a soft nudge, NOT the paywall — it never blocks anything, it's
// dismissible, and it doesn't reappear again in the same page session
// once dismissed (see shouldShow below). The actual enforcement remains
// server-side (requirePlan middleware) exactly as before.
//
// Visual design (redesigned): a celebratory hero illustration band up top
// (reusing the "Hero/promo card" gradient pattern from STYLE_GUIDE — one
// per screen, orange, for the single most important action), a circular
// progress ring for trial users (reusing shared/score-ring.js's math —
// same component already used on report.html/mistakes.html, just a new
// score-ring.js consumer, not a modification of it), then headline/sub/CTA.
// This module still owns 100% of its own markup/CSS (injected inline, same
// pattern as before) — it does not touch any shared stylesheet rules, so
// nothing else on chat.html/history.html can be affected by this file.

import { buildScoreRingSvg, animateScoreRing } from './score-ring.js';
import { formatTrialTimeLeft } from './trial-time.js';

const SESSION_DISMISS_KEY = 'uktio_upsell_dismissed_this_pageload';
const HERO_IMAGE = 'assets/icons/upsell-momentum.webp';

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
  const chatLimit = trial ? trial.chat_limit : null;

  const urgent = trial && trial.active && (chatsLeft <= 1 || reportsLeft <= 1 || daysLeft <= 1);
  const showRing = trial && trial.active && Number.isFinite(chatLimit) && chatLimit > 0;

  const overlay = document.createElement('div');
  overlay.id = 'upsellOverlay';
  overlay.className = 'upsell-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const sheet = document.createElement('div');
  sheet.className = 'upsell-sheet';

  const headline = trial && trial.active
    ? (urgent
        ? 'Tumhara free trial khatam hone wala hai!'
        : 'Achha chal raha hai! 🎉')
    : 'Practice jaari rakhne ke liye plan lo';

  const sub = trial && trial.active
    ? `${chatsLeft} chat aur ${reportsLeft} report bache hain (${formatTrialTimeLeft(daysLeft)}). Membership lo aur be-roktok practice karo.`
    : 'Tumhara free trial khatam ho chuka hai — Starter plan lo aur unlimited practice, reports, aur quizzes paao.';

  // Ring shows chats-remaining-of-limit — the core constrained action —
  // scaled onto buildScoreRingSvg's 0-10 scale (it only cares about the
  // ratio, so this reuse is exact, no changes needed to score-ring.js).
  const ringFraction = showRing ? Math.max(0, Math.min(1, chatsLeft / chatLimit)) : 0;
  const ringSvg = showRing
    ? buildScoreRingSvg(ringFraction * 10, { radius: 38, center: 44, viewBoxSize: 88 })
    : '';

  sheet.innerHTML = `
    <div class="upsell-handle"></div>

    <div class="upsell-hero">
      <div class="upsell-hero-glow" aria-hidden="true"></div>
      <img class="upsell-hero-img" src="${HERO_IMAGE}" alt="" width="640" height="570">
    </div>

    ${showRing ? `
      <div class="upsell-ring-wrap">
        <div class="upsell-ring" id="upsellRing">
          ${ringSvg}
          <div class="upsell-ring-num">
            <span class="big">${chatsLeft}</span>
            <span class="small">chat${chatsLeft === 1 ? '' : 's'} left</span>
          </div>
        </div>
      </div>
    ` : ''}

    <h2 class="upsell-headline">${headline}</h2>
    <p class="upsell-sub">${sub}</p>

    <button id="upsellCta" class="upsell-cta">Plans dekho — ₹99 se shuru</button>
    <button id="upsellDismiss" class="upsell-dismiss">Baad mein</button>
  `;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    .upsell-overlay{
      position:fixed; inset:0; background:rgba(20,20,35,0.45); z-index:9999;
      display:flex; align-items:flex-end; justify-content:center;
      animation:upsellFadeIn 0.2s ease-out;
    }
    .upsell-sheet{
      background:var(--card, #fff); width:100%; max-width:480px;
      border-radius:24px 24px 0 0; padding:16px 20px 28px;
      box-shadow:0 -10px 40px rgba(0,0,0,0.2);
      animation:upsellSlideUp 0.25s cubic-bezier(0.22,1,0.36,1);
    }
    .upsell-handle{
      width:36px; height:4px; background:var(--ink-dim,#8b8fa3); opacity:0.3;
      border-radius:99px; margin:0 auto 16px;
    }

    /* ---- Hero band: same gradient recipe as STYLE_GUIDE's hero/promo
       card pattern, reused here rather than inventing a new one. ---- */
    .upsell-hero{
      position:relative; overflow:hidden; border-radius:20px;
      background:linear-gradient(135deg, var(--accent-orange), #c85a3d);
      box-shadow:0 14px 30px -14px rgba(217,105,75,0.55);
      padding:16px 16px 8px; margin-bottom:18px;
      display:flex; align-items:center; justify-content:center;
    }
    .upsell-hero-glow{
      position:absolute; top:-30%; left:50%; width:220px; height:220px;
      transform:translateX(-50%);
      background:radial-gradient(circle, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 70%);
      pointer-events:none;
    }
    .upsell-hero-img{
      width:56%; max-width:190px; height:auto; display:block; position:relative;
      animation: upsellFloat 3.2s ease-in-out infinite;
      filter:drop-shadow(0 8px 14px rgba(0,0,0,0.15));
    }
    @keyframes upsellFloat{
      0%, 100%{ transform:translateY(0); }
      50%{ transform:translateY(-7px); }
    }

    /* ---- Progress ring: reuses shared/score-ring.js's SVG builder,
       just recolored/resized for this card via scoped classes here. ---- */
    .upsell-ring-wrap{ display:flex; justify-content:center; margin:-4px 0 14px; }
    .upsell-ring{ position:relative; width:88px; height:88px; }
    .upsell-ring svg{ transform:rotate(-90deg); width:88px; height:88px; }
    .upsell-ring circle{ fill:none; stroke-width:7; }
    .upsell-ring .bg{ stroke:var(--line, #e7e8f4); }
    .upsell-ring .fg{
      stroke:var(--accent-orange); stroke-linecap:round;
      transition:stroke-dashoffset 0.9s cubic-bezier(.22,.9,.32,1);
    }
    .upsell-ring-num{
      position:absolute; inset:0; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
    }
    .upsell-ring-num .big{
      font-size:1.3rem; font-weight:800; line-height:1; color:var(--ink,#23263a);
    }
    .upsell-ring-num .small{
      font-size:0.58rem; color:var(--ink-dim,#8b8fa3); margin-top:2px;
      text-align:center; line-height:1.2;
    }

    .upsell-headline{
      font-family:var(--font-serif, Georgia, serif); font-weight:700;
      font-size:1.2rem; margin:0 0 6px; text-align:center; color:var(--ink,#23263a);
    }
    .upsell-sub{
      font-size:0.88rem; color:var(--ink-dim,#8b8fa3); margin:0 0 20px;
      line-height:1.45; text-align:center;
    }
    .upsell-cta{
      width:100%; padding:14px 20px; border:none; border-radius:12px;
      background:var(--accent-orange,#d9694b); color:#fff; font-weight:600;
      font-size:0.95rem; cursor:pointer; transition:transform 0.15s ease;
    }
    .upsell-cta:active{ transform:scale(0.98); }
    .upsell-dismiss{
      width:100%; padding:12px; border:none; background:none;
      color:var(--ink-dim,#8b8fa3); font-size:0.85rem; margin-top:6px; cursor:pointer;
    }

    @keyframes upsellFadeIn { from{opacity:0} to{opacity:1} }
    @keyframes upsellSlideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }

    @media (prefers-reduced-motion: reduce){
      .upsell-hero-img{ animation:none !important; }
    }
  `;
  document.head.appendChild(styleTag);

  if (showRing) {
    const ringRoot = document.getElementById('upsellRing');
    requestAnimationFrame(() => animateScoreRing(ringRoot));
  }

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
