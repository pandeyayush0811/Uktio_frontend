// Pure logic for bucketing chat-history sessions into date groups
// (Today / Yesterday / This week / Earlier) for history.html's list.
// Zero DOM/window dependency — `now` is passed in explicitly so this
// is deterministically testable (no real-clock flakiness), same
// pattern as trial-time.js / scenario-phase.js.

/**
 * @param {Array<{started_at: string}>} sessions Raw sessions from
 *   GET /chat/sessions, assumed already sorted newest-first (matches
 *   backend order — this function does not re-sort).
 * @param {Date} [now] Injected "current time" for deterministic tests.
 *   Defaults to `new Date()` for real usage.
 * @returns {Array<{label: string, items: Array}>} Only non-empty
 *   buckets are returned, in Today → Yesterday → This week → Earlier
 *   order. A session with an unparseable `started_at` is placed in
 *   "Earlier" rather than dropped, so no session ever silently
 *   disappears from the list.
 */
export function groupSessionsByDate(sessions, now = new Date()) {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const todayStart = startOfDay(now);

  const buckets = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This week', items: [] },
    { label: 'Earlier', items: [] },
  ];

  for (const session of sessions) {
    const started = new Date(session.started_at);
    if (isNaN(started.getTime())) {
      buckets[3].items.push(session);
      continue;
    }
    const diffDays = Math.floor((todayStart - startOfDay(started)) / ONE_DAY_MS);
    if (diffDays <= 0) buckets[0].items.push(session);
    else if (diffDays === 1) buckets[1].items.push(session);
    else if (diffDays <= 7) buckets[2].items.push(session);
    else buckets[3].items.push(session);
  }

  return buckets.filter((b) => b.items.length > 0);
}
