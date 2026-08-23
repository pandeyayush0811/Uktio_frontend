import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showConfirmDialog } from './confirm-dialog.js';

class MockElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.className = '';
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c) || (this.className && this.className.includes(c))
    };
    this.textContent = '';
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.eventListeners = {};
  }

  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  addEventListener(event, handler) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(h => h !== handler);
    }
  }

  click() {
    if (this.eventListeners['click']) {
      for (const h of this.eventListeners['click']) {
        h({ target: this });
      }
    }
  }

  focus() {
    this.isFocused = true;
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (selector.startsWith('.')) {
        const classes = selector.split('.').filter(Boolean);
        const matches = classes.every(c => child.classList.contains(c) || (child.className && child.className.includes(c)));
        if (matches) return child;
      }
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
}

function generateMockEnv() {
  globalThis.MockElement = MockElement;
  globalThis.document = {
    body: new MockElement('body'),
    createElement: (tag) => new MockElement(tag),
    querySelector: (sel) => globalThis.document.body.querySelector(sel)
  };
  globalThis.window = {
    eventListeners: {},
    addEventListener: (ev, h) => {
      if (!globalThis.window.eventListeners[ev]) globalThis.window.eventListeners[ev] = [];
      globalThis.window.eventListeners[ev].push(h);
    },
    removeEventListener: (ev, h) => {
      if (globalThis.window.eventListeners[ev]) {
        globalThis.window.eventListeners[ev] = globalThis.window.eventListeners[ev].filter(x => x !== h);
      }
    },
    dispatchEvent: (evEntry) => {
      if (globalThis.window.eventListeners[evEntry.type]) {
        for (const h of globalThis.window.eventListeners[evEntry.type]) {
          h(evEntry);
        }
      }
    }
  };
  globalThis.requestAnimationFrame = (cb) => cb();
}

describe('showConfirmDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    generateMockEnv();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves true on confirm', async () => {
    const promise = showConfirmDialog({
      title: 'Confirm Title',
      message: 'Test explanation message',
      confirmText: 'Yes, Proceed',
      cancelText: 'No, Stay',
      destructive: true
    });

    const overlay = document.querySelector('.confirm-dialog-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('.confirm-dialog-title').textContent).toBe('Confirm Title');
    expect(overlay.querySelector('.confirm-dialog-msg').textContent).toBe('Test explanation message');

    const cancelBtn = overlay.querySelector('.confirm-dialog-btn.secondary');
    const confirmBtn = overlay.querySelector('.confirm-dialog-btn.primary');
    expect(cancelBtn.textContent).toBe('No, Stay');
    expect(confirmBtn.textContent).toBe('Yes, Proceed');
    expect(confirmBtn.className).toContain('destructive');

    confirmBtn.click();
    vi.advanceTimersByTime(200);

    const result = await promise;
    expect(result).toBe(true);
    expect(document.querySelector('.confirm-dialog-overlay')).toBeNull();
  });

  it('resolves false when cancel button is clicked', async () => {
    const promise = showConfirmDialog({
      title: 'Delete Item?',
      confirmText: 'Delete',
      cancelText: 'Keep'
    });

    const cancelBtn = document.querySelector('.confirm-dialog-btn.secondary');
    cancelBtn.click();
    vi.advanceTimersByTime(200);

    const result = await promise;
    expect(result).toBe(false);
    expect(document.querySelector('.confirm-dialog-overlay')).toBeNull();
  });

  it('resolves false when backdrop scrim is clicked', async () => {
    const promise = showConfirmDialog({ title: 'Leave?' });
    const overlay = document.querySelector('.confirm-dialog-overlay');

    overlay.click();
    vi.advanceTimersByTime(200);

    const result = await promise;
    expect(result).toBe(false);
    expect(document.querySelector('.confirm-dialog-overlay')).toBeNull();
  });

  it('resolves false when Escape key is pressed', async () => {
    const promise = showConfirmDialog({ title: 'Discard Changes?' });

    window.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault: () => {} });
    vi.advanceTimersByTime(200);

    const result = await promise;
    expect(result).toBe(false);
    expect(document.querySelector('.confirm-dialog-overlay')).toBeNull();
  });
});
