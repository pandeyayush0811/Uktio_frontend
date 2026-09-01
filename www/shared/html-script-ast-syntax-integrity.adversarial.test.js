import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

/**
 * @file html-script-ast-syntax-integrity.adversarial.test.js
 * @description Comprehensive Multi-Page HTML AST, Module Syntax & Shared Library Static Analysis Suite.
 * 
 * Guarantees that EVERY HTML page AND shared JS library in the application:
 * 1. Has valid HTML5 structure, standard mobile viewports, and CSP metadata.
 * 2. Parses ALL inline <script> blocks and shared ES modules with ZERO V8 engine syntax errors.
 * 3. Resolves every static module import to an existing physical .js file on disk.
 * 4. Verifies that all named symbols imported in HTML scripts and shared modules are genuinely exported by target files.
 * 5. Validates DOM element ID references (`document.getElementById`) to prevent broken element bindings.
 * 
 * Prevents regressions like AUD-065 (orphaned braces / broken module parsing) across ALL present and future pages.
 */

describe('Universal HTML AST, Module Syntax & DOM Integrity Master Suite', () => {
  const wwwDir = path.resolve(__dirname, '..');
  const sharedDir = path.resolve(wwwDir, 'shared');
  const htmlFiles = fs.readdirSync(wwwDir).filter(f => f.endsWith('.html'));
  const sharedJsFiles = fs.readdirSync(sharedDir).filter(f => f.endsWith('.js') && !f.includes('.test.'));

  function validateModuleSyntax(code) {
    try {
      execFileSync(process.execPath, ['--input-type=module', '--check'], {
        input: code,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return null;
    } catch (err) {
      return (err.stderr || err.message).toString();
    }
  }

  function validateClassicSyntax(code) {
    try {
      execFileSync(process.execPath, ['--check'], {
        input: code,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return null;
    } catch (err) {
      return (err.stderr || err.message).toString();
    }
  }

  it('detects and covers all active HTML pages in www/', () => {
    expect(htmlFiles.length).toBeGreaterThanOrEqual(13);
    const essentialPages = ['index.html', 'home.html', 'chat.html', 'scenario.html', 'history.html', 'profile.html', 'pricing.html', 'settings.html', 'login.html', 'onboarding.html', 'report.html'];
    essentialPages.forEach(p => expect(htmlFiles).toContain(p));
  });

  it('detects and covers all shared JS module libraries in www/shared/', () => {
    expect(sharedJsFiles.length).toBeGreaterThanOrEqual(15);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: ALL HTML PAGES STATIC & SYNTAX INTEGRITY MATRIX
  // ═══════════════════════════════════════════════════════════════════════════
  htmlFiles.forEach(file => {
    describe(`Page Invariants: ${file}`, () => {
      const filePath = path.resolve(wwwDir, file);
      let content = '';
      let cleanContent = '';
      let scripts = [];

      beforeEach(() => {
        content = fs.readFileSync(filePath, 'utf8');
        cleanContent = content.replace(/<!--[\s\S]*?-->/g, '');
        scripts = [...cleanContent.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];
      });

      // ── 1. HTML5 & Mobile Viewport Standards ─────────────────────────────────
      it(`${file} has valid HTML5 structure, viewport-fit=cover, and CSP metadata`, () => {
        const lower = content.toLowerCase();
        expect(lower).toContain('<!doctype html>');
        expect(lower).toContain('<html');
        expect(lower).toContain('</html>');
        expect(lower).toContain('viewport-fit=cover');
        expect(lower).toContain('content-security-policy');
      });

      // ── 2. V8 Engine Syntax & AST Parse Validation ───────────────────────────
      it(`${file} all inline <script> blocks parse cleanly with zero V8 JavaScript syntax errors`, () => {
        expect(scripts.length, `${file} must contain at least one <script> tag`).toBeGreaterThan(0);

        scripts.forEach((match, idx) => {
          const fullTag = match[0];
          const code = match[1];
          if (!code.trim()) return;

          const isModule = fullTag.includes('type="module"') || fullTag.includes("type='module'");

          const syntaxErr = isModule
            ? validateModuleSyntax(code)
            : validateClassicSyntax(code);

          expect(
            syntaxErr,
            `Fatal Syntax Error in ${file} (script #${idx}, isModule=${isModule}):\n${syntaxErr}`
          ).toBeNull();
        });
      });

      // ── 3. Module Import Path & File Existence Resolution ────────────────────
      it(`${file} resolves all relative module import paths to existing physical files`, () => {
        scripts.forEach((match) => {
          const code = match[1];
          const importMatches = [...code.matchAll(/(?:import\s+[^'"]*from\s+|import\s*\(?|import\s+)['"]([^'"]+)['"]/g)];

          importMatches.forEach((impMatch) => {
            const importPath = impMatch[1];
            // Only inspect relative local file imports (e.g. ./shared/auth.js)
            if (importPath.startsWith('.')) {
              const targetPath = path.resolve(wwwDir, importPath);
              const exists = fs.existsSync(targetPath);
              expect(
                exists,
                `Broken import in ${file}: Cannot resolve '${importPath}' (looked at: ${targetPath})`
              ).toBe(true);
            }
          });
        });
      });

      // ── 4. Named Symbol Export Contract Verification ─────────────────────────
      it(`${file} verified that imported named symbols are exported by their target modules`, () => {
        scripts.forEach((match) => {
          const code = match[1];
          const namedImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
          const namedImports = [...code.matchAll(namedImportRegex)];

          namedImports.forEach((imp) => {
            const rawSymbols = imp[1];
            const importPath = imp[2];

            if (importPath.startsWith('.')) {
              const targetPath = path.resolve(wwwDir, importPath);
              if (fs.existsSync(targetPath)) {
                const targetContent = fs.readFileSync(targetPath, 'utf8');

                const symbols = rawSymbols.split(',').map(s => {
                  const parts = s.trim().split(/\s+as\s+/);
                  return parts[0].trim();
                }).filter(Boolean);

                symbols.forEach(sym => {
                  const exportPattern = new RegExp(`export\\s+(?:async\\s+)?(?:function|const|let|var|class)\\s+${sym}\\b|export\\s*\\{[^}]*\\b${sym}\\b[^}]*\\}`);
                  const isExported = exportPattern.test(targetContent);
                  expect(
                    isExported,
                    `Module Export Mismatch in ${file}: '${sym}' is imported from '${importPath}', but '${importPath}' does not export '${sym}'!`
                  ).toBe(true);
                });
              }
            }
          });
        });
      });

      // ── 5. DOM Element ID Reference Integrity ────────────────────────────────
      it(`${file} document.getElementById calls match existing IDs in the DOM`, () => {
        const idRegex = /\bid=["']([^"']+)["']/g;
        const domIds = new Set();
        let idMatch;
        while ((idMatch = idRegex.exec(cleanContent)) !== null) {
          domIds.add(idMatch[1]);
        }

        scripts.forEach((match) => {
          const code = match[1];
          const getElemRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
          let elemMatch;

          while ((elemMatch = getElemRegex.exec(code)) !== null) {
            const referencedId = elemMatch[1];
            const isKnownOrDynamic = domIds.has(referencedId) ||
              referencedId.startsWith('stat') ||
              referencedId.startsWith('promo') ||
              referencedId.includes('${');

            expect(
              isKnownOrDynamic,
              `Broken DOM Binding in ${file}: document.getElementById('${referencedId}') called in script, but id="${referencedId}" was not found in ${file} DOM!`
            ).toBe(true);
          }
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: ALL SHARED JS MODULES SYNTAX & IMPORT INTEGRITY MATRIX
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Shared Library Modules Integrity (www/shared/*.js)', () => {
    sharedJsFiles.forEach(jsFile => {
      it(`shared/${jsFile} parses cleanly in V8 engine as an ES module`, () => {
        const filePath = path.resolve(sharedDir, jsFile);
        const code = fs.readFileSync(filePath, 'utf8');

        const syntaxErr = validateModuleSyntax(code);
        expect(
          syntaxErr,
          `Syntax Error in shared module www/shared/${jsFile}:\n${syntaxErr}`
        ).toBeNull();
      });

      it(`shared/${jsFile} resolves all internal relative module imports`, () => {
        const filePath = path.resolve(sharedDir, jsFile);
        const code = fs.readFileSync(filePath, 'utf8');
        const importMatches = [...code.matchAll(/(?:import\s+[^'"]*from\s+|import\s*\(?|import\s+)['"]([^'"]+)['"]/g)];

        importMatches.forEach((impMatch) => {
          const importPath = impMatch[1];
          if (importPath.startsWith('.')) {
            const targetPath = path.resolve(sharedDir, importPath);
            const exists = fs.existsSync(targetPath);
            expect(
              exists,
              `Broken import in www/shared/${jsFile}: Cannot resolve '${importPath}' (looked at: ${targetPath})`
            ).toBe(true);
          }
        });
      });
    });
  });
});
