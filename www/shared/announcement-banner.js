import { apiFetch } from './auth.js';
import { escapeHtml } from './sanitize.js';
import { cachedFetch } from './api-cache.js';

// Announcement banner — home.html only.
// Fetches dynamic active announcements from backend GET /announcements.
// Dismissed items are remembered in localStorage so a user only sees
// each announcement once unless a new one is published.

const STORAGE_PREFIX = 'utkio_announcement_dismissed_';

function isDismissed(id) {
  try {
    return localStorage.getItem(STORAGE_PREFIX + id) === '1';
  } catch {
    return false; // fail-open
  }
}

function markDismissed(id) {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, '1');
  } catch {
    // no-op
  }
}

export async function fetchAnnouncements() {
  try {
    const { value: data } = await cachedFetch('announcements', () => apiFetch('/announcements'), 5 * 60 * 1000);
    return (data && Array.isArray(data.announcements)) ? data.announcements : [];
  } catch {
    return []; // fail-open
  }
}

// Renders into `container` if an active announcement exists; otherwise
// leaves it untouched/hidden. Safe to call even if container is null.
export async function renderAnnouncementBanner(container) {
  if (!container) return;
  try {
    const list = await fetchAnnouncements();
    const item = list.find(a => a && a.id && !isDismissed(a.id));
    if (!item) {
      container.style.display = 'none';
      return;
    }

    container.style.display = '';
    container.innerHTML = `
      <div class="announcement-banner-body">
        ${item.badge ? `<span class="announcement-banner-badge">${escapeHtml(item.badge)}</span>` : ''}
        <p class="announcement-banner-title">${escapeHtml(item.title || '')}</p>
        <p class="announcement-banner-desc">${escapeHtml(item.desc || '')}</p>
      </div>
      <button type="button" class="announcement-banner-close" aria-label="Dismiss">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    container.querySelector('.announcement-banner-close').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      markDismissed(item.id);
      container.style.display = 'none';
    });

    if (item.link) {
      container.style.cursor = 'pointer';
      container.addEventListener('click', () => { window.location.href = item.link; });
    }
  } catch {
    container.style.display = 'none';
  }
}
