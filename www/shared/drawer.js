import { apiFetch, getCachedProfileBasic, setCachedProfileBasic, getRecentChatSessions, getCachedRecentChats } from './auth.js';
import { registerBackHandler } from './back-nav.js';
import { cachedFetch } from './api-cache.js';
import { formatDuration } from './formatters.js';

// Mounts the hamburger drawer into the page and wires it to `triggerEl`.
// activePage: 'home' | 'profile' | 'chats' | 'scenario' | null — highlights the matching nav item.
export async function mountDrawer(triggerEl, activePage){
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.innerHTML = `
    <div class="drawer-panel">
      <button class="drawer-close" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="drawer-user">
        <div class="drawer-avatar">
          <span class="drawer-avatar-initial" id="drawerAvatarInitial" style="display:none;font-weight:700;font-size:1.1rem;color:var(--ink);"></span>
          <span class="drawer-avatar-fallback" id="drawerAvatarFallback">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </span>
        </div>
        <div>
          <div class="drawer-user-name" id="drawerUserName">...</div>
          <div class="drawer-user-email" id="drawerUserEmail">...</div>
        </div>
      </div>
      <a class="drawer-nav-item ${activePage === 'home' ? 'active' : ''}" href="home.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Home
      </a>
      <a class="drawer-nav-item ${activePage === 'profile' ? 'active' : ''}" href="profile.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Profile
      </a>
      <a class="drawer-nav-item ${activePage === 'chats' ? 'active' : ''}" href="history.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Chats
      </a>
      <a class="drawer-nav-item ${activePage === 'scenario' ? 'active' : ''}" href="scenario.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Today's Scenario
      </a>
      <a class="drawer-nav-item" id="drawerNewChat" href="chat.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New chat
      </a>
      <div class="drawer-divider"></div>
      <div class="drawer-section-label">Recent chats</div>
      <div id="drawerRecent">
        <div style="display:flex;align-items:center;gap:10px;padding:12px 10px;">
          <div style="width:18px;height:18px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--accent-orange);animation:spin 0.75s linear infinite;flex-shrink:0;"></div>
          <span style="font-size:0.8rem;color:var(--ink-dim);">Loading chats…</span>
        </div>
      </div>
      <div class="drawer-more" id="drawerMore">
        More chats
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  function updateAvatarInitial(name) {
    const initialEl = overlay.querySelector('#drawerAvatarInitial');
    const fallbackEl = overlay.querySelector('#drawerAvatarFallback');
    if (!initialEl || !fallbackEl) return;
    const trimmed = (name || '').trim();
    if (trimmed) {
      initialEl.textContent = trimmed.charAt(0).toUpperCase();
      initialEl.style.display = 'inline-block';
      fallbackEl.style.display = 'none';
    } else {
      initialEl.style.display = 'none';
      fallbackEl.style.display = 'inline-block';
    }
  }

  function renderRecentChatsList(sessions) {
    const recentEl = overlay.querySelector('#drawerRecent');
    if (!recentEl) return;
    const recent = (sessions || []).slice(0, 5);
    if (!recent.length) {
      recentEl.innerHTML = '<div class="status-msg" style="font-size:0.8rem;">No chats yet.</div>';
      return;
    }
    recentEl.innerHTML = '';
    recent.forEach(s => {
      const isScenario = s.session_type === 'scenario';
      const d = new Date(s.started_at);
      const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const duration = formatDuration(s.started_at, s.ended_at);
      const item = document.createElement('div');
      item.className = 'drawer-recent-item';
      item.innerHTML = `
        <div class="drawer-recent-avatar">${s.turn_count}</div>
        <div class="drawer-recent-text">
          <div class="drawer-recent-title">${dateStr}${isScenario ? ' (Scenario)' : ''}</div>
          <div class="drawer-recent-preview">${duration} · ${s.turn_count} turns</div>
        </div>
        <div class="drawer-recent-time">${timeStr}</div>`;
      item.addEventListener('click', () => {
        if (isScenario) {
          if (s.is_completed === false && !s.has_report) {
            window.location.href = 'scenario.html';
          } else {
            window.location.href = 'report.html?session=' + s.id;
          }
        } else {
          window.location.href = 'chat.html?resume=' + s.id;
        }
      });
      recentEl.appendChild(item);
    });
  }

  // Cache-first: show the last-known name/email INSTANTLY (no network wait)
  const cached = getCachedProfileBasic();
  if (cached) {
    const displayName = cached.name || cached.email || 'User';
    overlay.querySelector('#drawerUserName').textContent = displayName;
    overlay.querySelector('#drawerUserEmail').textContent = cached.email || '';
    updateAvatarInitial(cached.name || '');
  }

  // Frame-0: Render cached recent chats instantly (0ms) without showing loading spinner
  const cachedRecent = getCachedRecentChats();
  if (cachedRecent && cachedRecent.length) {
    renderRecentChatsList(cachedRecent);
  }

  let drawerDataLoaded = false;
  async function lazyLoadDrawerData() {
    if (drawerDataLoaded) return;
    drawerDataLoaded = true;

    try {
      const { value: me } = await cachedFetch('profile_me', () => apiFetch('/users/me'), 60 * 1000);
      if (me) {
        const name = (me.profile && me.profile.name) || me.email || 'User';
        overlay.querySelector('#drawerUserName').textContent = name;
        overlay.querySelector('#drawerUserEmail').textContent = me.email || '';
        updateAvatarInitial((me.profile && me.profile.name) || '');
        setCachedProfileBasic({ name, email: me.email || '' }); // update cache for next time
      }
    } catch (e) { /* silent — cache (if any) already covered this, drawer still works without it */ }

    try {
      // AUD-060: Fetch only 5 recent sessions for compact navigation
      const data = await getRecentChatSessions({ limit: 5 });
      const recent = (data.sessions || []).slice(0, 5);
      renderRecentChatsList(recent);
    } catch (e) {
      // Resilient offline handling: if items already rendered from cache, keep them
      const recentEl = overlay.querySelector('#drawerRecent');
      const hasRenderedItems = recentEl && recentEl.querySelectorAll('.drawer-recent-item').length > 0;
      if (!hasRenderedItems) {
        recentEl.innerHTML = '<div class="status-msg" style="font-size:0.8rem;">Offline — showing saved chats when available.</div>';
      }
    }
  }

  let unregisterBack = null;
  const open = () => {
    overlay.classList.add('open');
    lazyLoadDrawerData();
    if (!unregisterBack) {
      unregisterBack = registerBackHandler(() => {
        close();
        return true;
      });
    }
  };
  const close = () => {
    overlay.classList.remove('open');
    if (unregisterBack) {
      unregisterBack();
      unregisterBack = null;
    }
  };
  triggerEl.addEventListener('click', open);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.drawer-close').addEventListener('click', close);
  overlay.querySelector('#drawerMore').addEventListener('click', () => window.location.href = 'history.html');

  return { open, close };
}
