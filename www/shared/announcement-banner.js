// Announcement banner — home.html only.
//
// Deliberately NOT merged into commit-mode-widget.js. Commit Mode's
// banner is data-driven (today's progress, resets daily) while this is
// editorial/marketing (a feature/news call-out, dismissed once and
// gone for good). Different purpose, different lifecycle — forcing
// them into one shared component would create a dependency chat.html
// doesn't need and this file doesn't want. Small duplication here is
// the intentional trade-off for zero risk to other pages.
//
// To announce something new, edit ANNOUNCEMENTS below. Only the first
// entry whose id hasn't been dismissed is shown.

const STORAGE_PREFIX = 'utkio_announcement_dismissed_';

const ANNOUNCEMENTS = [
  {
    id: 'practice-groups-2026-08',
    badge: 'New',
    title: 'Practice groups are here',
    desc: 'Join live group sessions with other learners.',
    link: null, // set a URL to make the whole banner tappable
  },
];

function isDismissed(id) {
  try {
    return localStorage.getItem(STORAGE_PREFIX + id) === '1';
  } catch {
    return false; // fail-open: if storage is blocked, just show it every time
  }
}

function markDismissed(id) {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, '1');
  } catch {
    // no-op — worst case the banner reappears next visit, not harmful
  }
}

// Renders into `container` if an active announcement exists; otherwise
// leaves it untouched/hidden. Safe to call even if container is null.
export function renderAnnouncementBanner(container) {
  if (!container) return;
  const item = ANNOUNCEMENTS.find(a => !isDismissed(a.id));
  if (!item) {
    container.style.display = 'none';
    return;
  }

  container.style.display = '';
  container.innerHTML = `
    <div class="announcement-banner-body">
      ${item.badge ? `<span class="announcement-banner-badge">${item.badge}</span>` : ''}
      <p class="announcement-banner-title">${item.title}</p>
      <p class="announcement-banner-desc">${item.desc}</p>
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
}
