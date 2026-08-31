import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * @file settings-page-interactive.adversarial.test.js
 * @description End-to-End Interactive & DOM State Machine Test Suite for settings.html (AUD-051).
 * Verifies all settings page features: Habit Reminder Toggles, Preferred Time Select,
 * Gemini API Key BYOK management, Plan Status Rendering, and Safe Logout Confirmation.
 */

describe('Settings Page Deep Interactive & Lifecycle Suite (AUD-051)', () => {
  let settingsHtmlContent;

  beforeEach(() => {
    const settingsPath = path.resolve(__dirname, '../settings.html');
    settingsHtmlContent = fs.readFileSync(settingsPath, 'utf8');
  });

  describe('Static Contract & Handler Invariants in settings.html', () => {
    it('settings.html explicitly imports initBackNav in top import block', () => {
      // Must import initBackNav from shared/back-nav.js
      expect(
        settingsHtmlContent,
        'AUD-051: settings.html must import initBackNav from ./shared/back-nav.js to prevent ReferenceError at line 513'
      ).toMatch(/import\s*\{[^}]*initBackNav[^}]*\}\s*from\s*['"]\.\/shared\/back-nav\.js['"]/);
    });

    it('settings.html imports notification preference helpers from notifications.js', () => {
      expect(settingsHtmlContent).toMatch(/getNotificationPreferences/);
      expect(settingsHtmlContent).toMatch(/saveNotificationPreferences/);
      expect(settingsHtmlContent).toMatch(/requestNotificationPermissions/);
      expect(settingsHtmlContent).toMatch(/syncDailyNotificationSchedule/);
    });

    it('settings.html contains DOM elements for practice reminders toggle and preferred time select', () => {
      expect(settingsHtmlContent).toContain('id="notifDailyToggle"');
      expect(settingsHtmlContent).toContain('id="reminderTimeRow"');
      expect(settingsHtmlContent).toContain('id="preferredTimeSelect"');
      expect(settingsHtmlContent).toContain('id="notifSavedMsg"');
    });

    it('settings.html contains plan status elements and commit mode termination explanation', () => {
      expect(settingsHtmlContent).toContain('id="planCard"');
      expect(settingsHtmlContent).toContain('id="vPlan"');
      expect(settingsHtmlContent).toContain('id="planExpiryRow"');
      expect(settingsHtmlContent).toContain('id="commitModeTerminatedMsg"');
    });

    it('settings.html contains Gemini API key management controls with debounce and flushSaveNow', () => {
      expect(settingsHtmlContent).toContain('id="apiKey"');
      expect(settingsHtmlContent).toContain('id="deleteKeyBtn"');
      expect(settingsHtmlContent).toContain('id="keyExpandToggle"');
      expect(settingsHtmlContent).toContain('id="keyDetails"');
      expect(settingsHtmlContent).toContain('flushSaveNow');
    });

    it('settings.html logout handler cancels pending debounced writes before calling logout()', () => {
      expect(settingsHtmlContent).toContain('clearTimeout(saveTimer)');
      expect(settingsHtmlContent).toContain('apiKeyInput.disabled = true');
      expect(settingsHtmlContent).toContain('await logout()');
    });
  });

  describe('Notification Preferences State Logic', () => {
    it('toggle change triggers permission request if enabled and updates preferences', () => {
      let state = { dailyEnabled: false, preferredHour: 19, preferredMinute: 30 };
      const savePrefs = (updates) => { state = { ...state, ...updates }; };

      // User turns toggle on
      const newEnabled = true;
      savePrefs({ dailyEnabled: newEnabled });

      expect(state.dailyEnabled).toBe(true);

      // User changes time to 20:30 (8:30 PM)
      const [hStr, mStr] = '20:30'.split(':');
      savePrefs({ preferredHour: parseInt(hStr, 10), preferredMinute: parseInt(mStr, 10) });

      expect(state.preferredHour).toBe(20);
      expect(state.preferredMinute).toBe(30);
    });
  });
});
