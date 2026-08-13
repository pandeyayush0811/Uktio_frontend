import { apiFetch, getCachedProfileBasic, setCachedProfileBasic } from './auth.js';

// Mounts the hamburger drawer into the page and wires it to `triggerEl`.
// activePage: 'profile' | 'chats' | 'scenario' | null — highlights the matching nav item.
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div>
          <div class="drawer-user-name" id="drawerUserName">...</div>
          <div class="drawer-user-email" id="drawerUserEmail">...</div>
        </div>
      </div>
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
          <div style="width:18px;height:18px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--accent);animation:spin 0.75s linear infinite;flex-shrink:0;"></div>
          <span style="font-size:0.8rem;color:var(--ink-dim);">Loading chats…</span>
        </div>
      </div>
      <div class="drawer-more" id="drawerMore">
        More chats
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const open = () => overlay.classList.add('open');
  const close = () => overlay.classList.remove('open');
  triggerEl.addEventListener('click', open);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.drawer-close').addEventListener('click', close);
  overlay.querySelector('#drawerMore').addEventListener('click', () => window.location.href = 'history.html');

  // Cache-first: show the last-known name/email INSTANTLY (no network
  // wait) if we have it, then quietly refetch in the background below
  // and correct it if anything changed. This is why the drawer used to
  // feel slow to open — it was always waiting on a fresh network call
  // just to show your own name.
  const cached = getCachedProfileBasic();
  if (cached) {
    overlay.querySelector('#drawerUserName').textContent = cached.name || cached.email || 'User';
    overlay.querySelector('#drawerUserEmail').textContent = cached.email || '';
  }

  // Fill in user + recent chats lazily, after the drawer is already visible/openable.
  try {
    const me = await apiFetch('/users/me');
    const name = (me.profile && me.profile.name) || me.email || 'User';
    overlay.querySelector('#drawerUserName').textContent = name;
    overlay.querySelector('#drawerUserEmail').textContent = me.email || '';
    setCachedProfileBasic({ name, email: me.email || '' }); // update cache for next time
  } catch (e) { /* silent — cache (if any) already covered this, drawer still works without it */ }

  try {
    const data = await apiFetch('/chat/sessions');
    const recent = (data.sessions || []).slice(0, 5);
    const recentEl = overlay.querySelector('#drawerRecent');
    if (!recent.length) {
      recentEl.innerHTML = '<div class="status-msg" style="font-size:0.8rem;">No chats yet.</div>';
    } else {
      recentEl.innerHTML = '';
      recent.forEach(s => {
        const d = new Date(s.started_at);
        const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const item = document.createElement('div');
        item.className = 'drawer-recent-item';
        item.innerHTML = `
          <div class="drawer-recent-avatar">${s.turn_count}</div>
          <div class="drawer-recent-text">
            <div class="drawer-recent-title">${dateStr}</div>
            <div class="drawer-recent-preview">${s.turn_count} turns</div>
          </div>
          <div class="drawer-recent-time">${timeStr}</div>`;
        item.addEventListener('click', () => window.location.href = 'chat.html?resume=' + s.id);
        recentEl.appendChild(item);
      });
    }
  } catch (e) {
    overlay.querySelector('#drawerRecent').innerHTML = '<div class="status-msg err" style="font-size:0.8rem;">Could not load chats.</div>';
  }

  return { open, close };
}
