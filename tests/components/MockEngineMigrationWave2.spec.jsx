/**
 * HASEEB-280 — mockEngine migration Wave 2 wiring regression.
 *
 * Guards the imports added by the Wave 2 dispatch. Wave 2 swapped the
 * remaining 11 mock-importing screens from `../../engine/mockEngine`
 * to `../../engine`, completing the originally-flagged 19-screen set
 * (Wave 1 was 8; Wave 2 finishes the other 11). The engine router
 * re-exports every mockEngine function as a named export
 * (`export const foo = surface.foo`) so destructure-imports resolve;
 * when a backend endpoint exists the router points to the real
 * wrapper, otherwise LIVE mode falls back to mockEngine with a
 * one-shot warn (same pattern as Wave 1).
 *
 * Two assertions per screen:
 *   (a) every name the screen imports is defined as a function on the
 *       engine surface (runtime-callable).
 *   (b) the screen file itself no longer contains a direct import from
 *       `../../engine/mockEngine` — guards against regressions that
 *       re-introduce the bypass.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as engine from '../../src/engine';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

// Per-screen: (relative path, list of names the screen imports from
// the engine router). Derived from inspection of each screen's import
// block as-of the HASEEB-280 feature commit.
const SCREEN_IMPORTS = {
  // Data screens (8)
  'src/screens/cfo/ForecastScreen.jsx': [
    'getForecast',
    'recalculateForecast',
    'getSavedForecastScenarios',
    'getForecastNarration',
  ],
  'src/screens/cfo/RulesScreen.jsx': [
    'getCategorizationRules',
    'getRoutingRules',
    'getSuggestedCategorizationRules',
    'getSuggestedRoutingRules',
    'muteCategorizationRule',
    'unmuteCategorizationRule',
    'deleteCategorizationRule',
    'muteRoutingRule',
    'unmuteRoutingRule',
    'deleteRoutingRule',
    'acceptSuggestedRule',
    'dismissSuggestedRule',
    'isSuggestionDismissed',
  ],
  'src/screens/cfo/VarianceAnalysisScreen.jsx': [
    'getVarianceAnalysis',
    'getVarianceNarration',
    'exportVarianceReport',
  ],
  'src/screens/junior/MyResponsibilitiesScreen.jsx': [
    'getRoutingRules',
    'getJuniorDomainStats',
  ],
  'src/screens/owner/AuditBridgeScreen.jsx': [
    'listAuditEngagements',
    'getAuditEngagement',
    'createAuditEngagement',
    'createSnapshot',
    'runAuditCheck',
    'runAllAuditChecks',
    'generateAuditPackage',
    'listClarifications',
    'addClarificationMessage',
    'resolveClarification',
  ],
  'src/screens/shared/ProfileScreen.jsx': [
    'getUserProfile',
    'getUserStats',
    'getUserResponsibilities',
    'getUserRecentActivity',
    'getUserNotes',
    'updateUserNotes',
  ],
  // SetupScreen — ten residual config/integration helpers. Everything
  // else this screen imports was already on the engine router.
  'src/screens/cfo/SetupScreen.jsx': [
    'getFiscalYearConfig',
    'getTaxConfiguration',
    'updateTaxConfiguration',
    'getCurrencyConfig',
    'updateCurrencyConfig',
    'updateExchangeRates',
    'getIntegrationStatus',
    'forceSyncIntegration',
    'getIntegrationSyncLogs',
    'getEngineConfiguration',
  ],
  // YearEndCloseScreen — single residual (exportStatement). The rest
  // was already LIVE-wired under AUDIT-ACC-003.
  'src/screens/cfo/YearEndCloseScreen.jsx': [
    'exportStatement',
  ],

  // Dispatcher screens (3)
  'src/screens/cfo/CFOView.jsx': [
    'getOpenTaskCount',
    'getOpenApprovalCount',
  ],
  'src/screens/junior/JuniorView.jsx': [
    'getSaraTaskStats',
  ],
  'src/screens/owner/OwnerView.jsx': [
    'getOpenTaskCount',
    'getOpenApprovalCount',
  ],
};

describe('HASEEB-280 — mockEngine migration Wave 2 wiring', () => {
  for (const [screenPath, names] of Object.entries(SCREEN_IMPORTS)) {
    describe(screenPath, () => {
      it('every imported name resolves to a function on the engine surface', () => {
        for (const name of names) {
          const value = engine[name];
          expect(
            typeof value,
            `engine.${name} should be a function (imported by ${screenPath})`,
          ).toBe('function');
        }
      });

      it('does not import directly from engine/mockEngine', () => {
        const abs = resolve(repoRoot, screenPath);
        const src = readFileSync(abs, 'utf8');
        // Direct imports look like: from '../../engine/mockEngine'
        // (single OR double quotes; allow whitespace).
        const pattern = /from\s+['"][^'"]*engine\/mockEngine['"]/;
        expect(
          pattern.test(src),
          `${screenPath} should not import directly from engine/mockEngine`,
        ).toBe(false);
      });
    });
  }
});
