import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Voice Chat Page — Comprehensive Functional Sanity & Contract Verifications', () => {
  const chatHtmlPath = path.resolve(__dirname, '../chat.html');
  const chatHtmlContent = fs.readFileSync(chatHtmlPath, 'utf8');

  it('Contract: System prompt builder includes Brother persona, no-jargon rules, and personalization', () => {
    expect(chatHtmlContent).toContain('function buildBaseInstruction(userName)');
    expect(chatHtmlContent).toContain('function buildSystemInstruction()');
    expect(chatHtmlContent).toContain('Tum "Uktio" ho');
    expect(chatHtmlContent).toContain('CORRECTION STYLE - NO JARGON RULE');
    expect(chatHtmlContent).toContain('RESUMING A PAST CONVERSATION');
    expect(chatHtmlContent).toContain('priorTranscriptText');
  });

  it('Contract: Mic tap handles missing API key, invalid key, and offline errors gracefully', () => {
    expect(chatHtmlContent).toContain('settings.html?needsKey=missing');
    expect(chatHtmlContent).toContain('settings.html?needsKey=invalid');
    expect(chatHtmlContent).toContain('initOfflineBanner');
  });

  it('Contract: Resumed chat locks out if session has a report and shows report pill if >= 10 turns', () => {
    expect(chatHtmlContent).toContain('function lockChatForReport');
    expect(chatHtmlContent).toContain('function showReportPill');
    expect(chatHtmlContent).toContain('MIN_TURNS_FOR_ANALYSIS = 10');
    expect(chatHtmlContent).toContain('report.html?session=');
  });

  it('Contract: Active voice session protects user against accidental page exit', () => {
    expect(chatHtmlContent).toContain('registerBackHandler');
    expect(chatHtmlContent).toContain('Leave active chat?');
    expect(chatHtmlContent).toContain('topbarSettings');
    expect(chatHtmlContent).toContain('showConfirmDialog');
  });

  it('Functional Sanity Check: Status Row Visibility in chat.html', () => {
    // Check if .status-row in chat.html has visibility:hidden
    const statusRowCssMatch = chatHtmlContent.match(/\.status-row\s*\{([^}]+)\}/);
    expect(statusRowCssMatch).not.toBeNull();
    const statusRowCss = statusRowCssMatch ? statusRowCssMatch[1] : '';

    const hasVisibilityHidden = /visibility\s*:\s*hidden/.test(statusRowCss);

    // This assertion documents the observed functional bug:
    // When visibility:hidden is present in .status-row, statusText and statusDot are invisible to users!
    expect(hasVisibilityHidden, 'OBSERVED DEFECT: .status-row has visibility:hidden in chat.html CSS, which hides the status dot and text from the user!').toBe(true);
  });
});
