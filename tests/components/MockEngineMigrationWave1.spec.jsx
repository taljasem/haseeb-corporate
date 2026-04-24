/**
 * HASEEB-278 — mockEngine migration Wave 1 wiring regression.
 *
 * Guards the imports added by the Wave 1 dispatch on 2026-04-22. The
 * dispatch swapped 8 screens' `from '../../engine/mockEngine'` imports
 * to `from '../../engine'`. The engine router re-exports every
 * mockEngine function as a named export (`export const foo =
 * surface.foo`) so the destructure-imports resolve; if the export
 * table ever slips out of sync with what the screens consume, this
 * test surfaces the regression before build / runtime.
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
// block as-of 2026-04-22 (HASEEB-278 feature commit).
const SCREEN_IMPORTS = {
  'src/screens/owner/OwnerTodayScreen.jsx': [
    'getBusinessPulse',
    'getOpenApprovalCount',
    'getAuditChecks',
    'getCloseStatus',
    'getOwnerTopInsightDynamic',
    'getBudgetVarianceByDepartment',
  ],
  'src/screens/junior/JuniorTodayScreen.jsx': [
    'getTaskbox',
    'getSaraWorkQueue',
    'getSaraActivityLog',
    'getSaraAminahNotes',
    'getRoutingRules',
  ],
  'src/screens/cfo/BankTransactionsScreen.jsx': [
    'getBankTransactionsPending',
    'getFilteredBankTransactions',
    'getSuggestedCategorizationRules',
    'getBankTransactionsSorted',
    'bulkCategorizeTransactions',
    'bulkAssignTransactions',
    'bulkMarkTransactionsReviewed',
    'exportBankTransactionsCSV',
    'createRuleFromTransactions',
    'getChartOfAccounts',
    'getTeamMembers',
  ],
  // HASEEB-398 B11 (2026-04-24, path (b)): the legacy integrations
  // triplet (getIntegrations / addIntegration / removeIntegration) was
  // removed from SettingsScreen along with the dead-code
  // IntegrationsSection. AdministrationScreen is the sole consumer of
  // the integrations surface going forward via the already-wired
  // listAdminIntegrations / addAdminIntegration / removeAdminIntegration.
  'src/screens/shared/SettingsScreen.jsx': [
    'getUserProfile',
    'getNotificationPreferences',
    'updateNotificationPreferences',
    'getActiveSessions',
    'signOutSession',
    'signOutAllOtherSessions',
    'getTwoFactorStatus',
    'disableTwoFactor',
    'getMyActivity',
  ],
  'src/screens/cfo/ManualJEScreen.jsx': [
    'getManualJEs',
    'getManualJEById',
    'createJournalEntry',
    'updateJournalEntryDraft',
    'postJournalEntry',
    'reverseJournalEntry',
    'listRecurringEntries',
    'getRecurringEntry',
    'createRecurringEntry',
    'updateRecurringEntry',
    'deleteRecurringEntry',
    'fireRecurringEntryNow',
    'listRecurringEntryInstances',
    'getChartOfAccounts',
    'searchChartOfAccounts',
    'checkPeriodStatus',
    'attachJEFile',
    'removeJEAttachment',
    'getJEAttachments',
    'shareJETemplate',
  ],
  'src/screens/shared/MonthEndCloseScreen.jsx': [
    'getMonthEndCloseTasks',
    'getCloseStatusDetail',
    'markCloseItemComplete',
    'runPreCloseValidations',
    'approveCloseAndSyncTask',
    'getCloseSummary',
    'exportClosePackage',
    'reopenPeriodClose',
    'recalculateCloseChecks',
    'overrideCloseCheck',
    'addCloseCheckNote',
    'getCloseCheckNotes',
    'attachCloseCheckFile',
    'getCloseCheckAttachments',
  ],
  'src/screens/shared/FinancialStatementsScreen.jsx': [
    'getIncomeStatement',
    'getBalanceSheet',
    'getCashFlowStatement',
    'listReportVersions',
    'getStatementOfChangesInEquity',
    'getDisclosureNotes',
    'getAdjustingEntries',
    'getLineNotes',
    'exportStatement',
  ],
  'src/screens/owner/TeamScreen.jsx': [
    'getTeamMembersWithResponsibilities',
    'addTeamMember',
    'removeTeamMember',
    'getTeamActivityLog',
  ],
};

describe('HASEEB-278 — mockEngine migration Wave 1 wiring', () => {
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
