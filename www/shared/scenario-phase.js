// Pure logic for scenario.html's phase badge (the "Scene 3:00" /
// "Mode Feedback" chip). Deliberately has zero DOM/window dependency so
// it can be unit-tested directly — scenario.html just calls these
// functions and writes the result into the DOM.

/**
 * Formats a whole-second countdown as "m:ss" (e.g. 180 -> "3:00", 65 -> "1:05").
 * Negative input is clamped to 0 so a stray late timer tick never renders
 * something like "-1:00".
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(safeSeconds / 60);
  const s = safeSeconds % 60;
  return m + ':' + String(s).padStart(2, '0');
}

/**
 * Derives what the phase badge should display for a given app phase.
 * 'idle' has no badge state — scenario.html keeps the card hidden then.
 * @param {'idle'|'roleplay'|'feedback'} phase
 * @param {number} phaseSecondsLeft only used when phase === 'roleplay'
 * @returns {{label: string, value: string, cssClass: string}}
 */
export function getPhaseBadgeState(phase, phaseSecondsLeft) {
  if (phase === 'feedback') {
    return { label: 'Mode', value: 'Feedback', cssClass: 'feedback' };
  }
  if (phase === 'roleplay') {
    return { label: 'Scene', value: formatCountdown(phaseSecondsLeft), cssClass: 'live' };
  }
  return { label: 'Scene', value: formatCountdown(phaseSecondsLeft), cssClass: '' };
}
