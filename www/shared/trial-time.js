// Pure formatting for "days left" in a trial. The backend sends
// `days_left` as a raw float (time-of-day-dependent — e.g. 2.9, 2.0,
// 0.4), which must NEVER be shown to the user as-is:
//   - 2.9 should read as "3 days left" (rounded, no decimal)
//   - 2.0 should read as "2 days left" (no trailing ".0")
//   - anything under 1 day should switch to hours, e.g. "18 hrs left",
//     since "0 days left" or "1 day left" would both be misleading/scary
//     when the trial actually still has most of a day on the clock.

/**
 * @param {number} daysLeft raw fractional days remaining, as sent by the backend
 * @returns {string} e.g. "3 days left", "1 day left", "18 hrs left", "Less than 1 hr left"
 */
export function formatTrialTimeLeft(daysLeft) {
  const safeDays = Math.max(0, Number(daysLeft) || 0);

  if (safeDays < 1) {
    const hours = Math.round(safeDays * 24);
    if (hours <= 0) return 'Less than 1 hr left';
    return `${hours} hr${hours !== 1 ? 's' : ''} left`;
  }

  const roundedDays = Math.round(safeDays);
  return `${roundedDays} day${roundedDays !== 1 ? 's' : ''} left`;
}
