import { registerBackHandler } from './back-nav.js';	/*** Shows a brand-styled confirmation modal adhering to the Bold Editorial design system.* Returns a Promise<boolean> that resolves to true (confirmed) or false (cancelled).*/
export function showConfirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false
} = {}) {
  return new Promise((resolve) => {
    const existing = document.querySelector('.confirm-dialog-overlay');
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'confirmDialogTitle');
    overlay.setAttribute('aria-describedby', 'confirmDialogMsg');

    const card = document.createElement('div');
    card.className = 'confirm-dialog-card';

    const titleEl = document.createElement('h2');
    titleEl.id = 'confirmDialogTitle';
    titleEl.className = 'confirm-dialog-title';
    titleEl.textContent = title;

    const msgEl = document.createElement('p');
    msgEl.id = 'confirmDialogMsg';
    msgEl.className = 'confirm-dialog-msg';
    msgEl.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'confirm-dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'confirm-dialog-btn secondary';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'confirm-dialog-btn primary' + (destructive ? ' destructive' : '');
    confirmBtn.textContent = confirmText;

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    card.appendChild(titleEl);
    if (message) card.appendChild(msgEl);
    card.appendChild(actions);
    overlay.appendChild(card);

    let unregisterBack = null;

    function cleanup(result) {
      if (unregisterBack) {
        unregisterBack();
        unregisterBack = null;
      }
      window.removeEventListener('keydown', onKeyDown);
      overlay.classList.add('closing');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 150);
      resolve(result);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(false);
      }
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup(false);
      }
    });

    cancelBtn.addEventListener('click', () => cleanup(false));
    confirmBtn.addEventListener('click', () => cleanup(true));
    window.addEventListener('keydown', onKeyDown);

    unregisterBack = registerBackHandler(() => {
      cleanup(false);
      return true;
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      confirmBtn.focus();
    });
  });
}
