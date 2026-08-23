import { apiFetch } from './auth.js';
import { cachedFetch } from './api-cache.js';

// Fetches today's (IST) Commit Mode progress. Returns null on any error
// (network, not on Commit Mode, etc.) — callers should treat null as
// "don't show the banner", never as an error to surface to the user; this
// is a motivational nudge, not a security boundary (same fail-open
// philosophy as requireActivePlan() in shared/plan.js).
export async function getCommitModeProgress() {
  try {
    const { value: data } = await cachedFetch('commit_mode_today', () => apiFetch('/chat/commit-mode/today'), 30 * 1000);
    return data || null;
  } catch (e) {
    return null;
  }
}

function formatCountdown(ms) {
  if (ms <= 0) return 'resetting…';
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m tak`;
  return `${m}m tak`;
}

// Renders (or hides) the Commit Mode progress banner into `el`.
// `planStatus` is the object from getPlanStatus() (shared/plan.js) —
// passed in rather than re-fetched, since callers already have it.
// No-op (hides `el`) unless the user is actually on plan === 'commit_mode'.
export async function renderCommitModeBanner(el, planStatus) {
  if (!el) return;
  if (!planStatus || planStatus.plan !== 'commit_mode') {
    el.style.display = 'none';
    return;
  }

  const progress = await getCommitModeProgress();
  if (!progress) { el.style.display = 'none'; return; }

  const chatDone = progress.chat_requirement_met;
  const scenarioDone = progress.scenario_requirement_met;
  const bothDone = chatDone && scenarioDone;

  const chatMinsDone = Math.floor(progress.chat_seconds_done / 60);
  const chatMinsReq = Math.ceil(progress.chat_seconds_required / 60);

  el.innerHTML = '';
  el.style.display = 'flex';
  el.className = 'commit-mode-banner' + (bothDone ? ' commit-mode-done' : '');

  const chatChip = document.createElement('span');
  chatChip.className = 'commit-mode-chip' + (chatDone ? ' done' : '');
  chatChip.textContent = chatDone ? '✓ Chat' : `Chat ${chatMinsDone}/${chatMinsReq} min`;

  const scenarioChip = document.createElement('span');
  scenarioChip.className = 'commit-mode-chip' + (scenarioDone ? ' done' : '');
  scenarioChip.textContent = scenarioDone ? '✓ Scenario' : 'Scenario baaki';

  const countdown = document.createElement('span');
  countdown.className = 'commit-mode-countdown';
  countdown.textContent = bothDone
    ? 'Aaj ka Commit Mode complete ✓'
    : `Reset ${formatCountdown(progress.ms_until_reset)}`;

  el.appendChild(chatChip);
  el.appendChild(scenarioChip);
  el.appendChild(countdown);
}
