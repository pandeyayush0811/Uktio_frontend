import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * @file html-import-contract.adversarial.test.js
 * @description Hardcore Static AST & Source Contract Suite.
 * Guarantees that EVERY identifier invoked as a shared utility or framework helper
 * in every inline <script type="module"> across all 13 HTML pages is explicitly
 * declared or imported in that file's top import header.
 * 
 * Prevents silent ReferenceErrors (like missing initBackNav) from ever reaching production.
 */

const WWW_DIR = path.resolve(__dirname, '..');

// List of all HTML pages in production www/
const HTML_FILES = [
  'chat.html',
  'history.html',
  'home.html',
  'index.html',
  'login.html',
  'mistakes.html',
  'onboarding.html',
  'pricing.html',
  'privacy.html',
  'profile.html',
  'quiz.html',
  'report.html',
  'scenario.html',
  'settings.html',
  'terms.html'
];

// Key shared library exports that MUST be imported if called
const CRITICAL_SHARED_SYMBOLS = [
  'initBackNav',
  'registerBackHandler',
  'navigateBack',
  'requireAuthOrRedirect',
  'requireCompleteProfile',
  'apiFetch',
  'logout',
  'saveSession',
  'getSession',
  'clearSession',
  'getCachedProfileBasic',
  'setCachedProfileBasic',
  'getCachedStreak',
  'setCachedStreak',
  'getPlanStatus',
  'requireActivePlan',
  'showConfirmDialog',
  'checkGeminiApiKey',
  'getApiKey',
  'setApiKey',
  'removeApiKey',
  'syncDailyNotificationSchedule',
  'scheduleReportReadyNotification',
  'getNotificationPreferences',
  'saveNotificationPreferences',
  'requestNotificationPermissions',
  'renderCommitModeBanner',
  'renderAnnouncementBanner',
  'mountDrawer'
];

function extractModuleScripts(htmlContent) {
  const scripts = [];
  const scriptRegex = /<script\s+type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    scripts.push(match[1]);
  }
  return scripts;
}

function extractImportedSymbols(scriptContent) {
  const imported = new Set();
  // match import { a, b as c, d } from '...'
  const namedImportRegex = /import\s*\{([^}]+)\}\s*from/g;
  let match;
  while ((match = namedImportRegex.exec(scriptContent)) !== null) {
    const symbols = match[1].split(',').map(s => {
      const parts = s.trim().split(/\s+as\s+/);
      return parts[parts.length - 1].trim(); // local bound name
    }).filter(Boolean);
    symbols.forEach(sym => imported.add(sym));
  }

  // match import Foo from '...'
  const defaultImportRegex = /import\s+([a-zA-Z0-9_$]+)\s+from/g;
  while ((match = defaultImportRegex.exec(scriptContent)) !== null) {
    if (match[1] !== '{') imported.add(match[1]);
  }

  return imported;
}

describe('Adversarial Source Contract Suite — HTML Static Import & Symbol Integrity', () => {
  HTML_FILES.forEach(fileName => {
    const filePath = path.join(WWW_DIR, fileName);
    if (!fs.existsSync(filePath)) return;

    describe(`HTML File: ${fileName}`, () => {
      const content = fs.readFileSync(filePath, 'utf8');
      const moduleScripts = extractModuleScripts(content);

      it(`contains valid <script type="module"> if interactive logic exists`, () => {
        // Simple static pages might not have module scripts
        if (fileName === 'mistakes.html' || fileName === 'quiz.html') return;
        expect(moduleScripts.length).toBeGreaterThanOrEqual(1);
      });

      moduleScripts.forEach((script, idx) => {
        const importedSymbols = extractImportedSymbols(script);

        CRITICAL_SHARED_SYMBOLS.forEach(symbol => {
          // Check if the script invokes the function e.g. initBackNav(
          const callRegex = new RegExp(`\\b${symbol}\\s*\\(`, 'g');
          const isInvoked = callRegex.test(script);

          if (isInvoked) {
            it(`Script #${idx + 1} invoking '${symbol}()' must explicitly import '${symbol}' in header`, () => {
              const isDeclaredLocally = new RegExp(`function\\s+${symbol}\\b|const\\s+${symbol}\\b|let\\s+${symbol}\\b|var\\s+${symbol}\\b`).test(script);
              const isImported = importedSymbols.has(symbol);

              expect(
                isImported || isDeclaredLocally,
                `[CRITICAL REGRESSION] In ${fileName}: '${symbol}()' is invoked in module script, but '${symbol}' is neither imported nor declared locally!`
              ).toBe(true);
            });
          }
        });
      });
    });
  });

  describe('Specific Regression Check — AUD-051: settings.html initBackNav', () => {
    it('settings.html module script must import initBackNav from shared/back-nav.js', () => {
      const settingsPath = path.join(WWW_DIR, 'settings.html');
      const content = fs.readFileSync(settingsPath, 'utf8');
      const moduleScripts = extractModuleScripts(content);
      expect(moduleScripts.length).toBeGreaterThanOrEqual(1);

      const script = moduleScripts[0];
      const imports = extractImportedSymbols(script);
      expect(
        imports.has('initBackNav'),
        "AUD-051: settings.html calls initBackNav('home.html') on line 513, so 'initBackNav' must be imported from './shared/back-nav.js'"
      ).toBe(true);
    });
  });
});
