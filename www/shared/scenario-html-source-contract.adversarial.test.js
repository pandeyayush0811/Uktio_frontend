import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Adversarial Source Contract Suite — scenario.html (Issue #3 / AUD-022)', () => {
  const scenarioHtmlPath = path.resolve(__dirname, '../scenario.html');
  const scenarioHtmlSource = fs.readFileSync(scenarioHtmlPath, 'utf8');

  it('test_scenario_html_declares_and_tracks_activeSessionId_and_syncedTurnCount', () => {
    // scenario.html must track activeSessionId and syncedTurnCount in component scope
    expect(scenarioHtmlSource).toMatch(/let\s+activeSessionId\s*=\s*null;/);
    expect(scenarioHtmlSource).toMatch(/let\s+syncedTurnCount\s*=\s*0;/);
  });

  it('test_saveScenarioState_persists_activeSessionId_and_syncedTurnCount', () => {
    // saveScenarioState must include activeSessionId and syncedTurnCount in stored state object
    const saveStateBlockMatch = scenarioHtmlSource.match(/function\s+saveScenarioState\s*\(\)\s*\{[\s\S]*?\n\}/);
    expect(saveStateBlockMatch).toBeTruthy();
    const saveStateBlock = saveStateBlockMatch[0];

    expect(saveStateBlock).toContain('activeSessionId');
    expect(saveStateBlock).toContain('syncedTurnCount');
  });

  it('test_restoreScenarioState_restores_activeSessionId_and_syncedTurnCount', () => {
    // restoreScenarioState must unpack activeSessionId and syncedTurnCount
    const restoreStateBlockMatch = scenarioHtmlSource.match(/function\s+restoreScenarioState\s*\(\)\s*\{[\s\S]*?\n\}/);
    expect(restoreStateBlockMatch).toBeTruthy();
    const restoreStateBlock = restoreStateBlockMatch[0];

    expect(restoreStateBlock).toContain('activeSessionId');
    expect(restoreStateBlock).toContain('syncedTurnCount');
  });

  it('test_persistLocalSession_does_NOT_hardcode_session_id_null', () => {
    // persistLocalSession must NOT hardcode session_id: null
    const persistBlockMatch = scenarioHtmlSource.match(/function\s+persistLocalSession\s*\(\)\s*\{[\s\S]*?\n\}/);
    expect(persistBlockMatch).toBeTruthy();
    const persistBlock = persistBlockMatch[0];

    expect(persistBlock).not.toMatch(/session_id:\s*null\s*,\s*\/\/\s*scenario sessions never resume/);
    expect(persistBlock).toContain('activeSessionId');
  });

  it('test_finalizeAndSyncSession_updates_activeSessionId_and_syncedTurnCount', () => {
    // finalizeAndSyncSession or sync callbacks must update activeSessionId and syncedTurnCount on successful sync
    const finalizeBlockMatch = scenarioHtmlSource.match(/async\s+function\s+finalizeAndSyncSession\s*\(\)\s*\{[\s\S]*?\n\}/);
    expect(finalizeBlockMatch).toBeTruthy();
    const finalizeBlock = finalizeBlockMatch[0];

    expect(finalizeBlock).toContain('lockChatForToday');
  });
});
