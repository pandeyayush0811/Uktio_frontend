/**
 * Formats the duration between two ISO timestamp strings or Date objects.
 * Example: "3 min 20 sec" or "45 sec".
 */
export function formatDuration(startedAt, endedAt) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const totalSec = Math.max(0, Math.round((end - start) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min} min ${sec} sec` : `${sec} sec`;
}

/**
 * Fast client-side sanity check for a 10-digit Indian mobile number starting with 6-9.
 */
export function looksLikeIndianMobile(raw) {
  const digits = (raw || '').trim().replace(/[\s-]/g, '');
  return /^[6-9]\d{9}$/.test(digits);
}
