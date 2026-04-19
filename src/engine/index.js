/**
 * Engine router — per-function routing between the mock engine and the real API.
 *
 * Wave 3 additions (2026-04-15):
 *   • Aminah chat is now wired via a single-shot → block-event adapter
 *     (`src/api/chat-adapter.js`). The streaming UI consumes the same
 *     event protocol in both MOCK (stubBackend) and LIVE (adapter)
 *     modes, so AminahChat / AminahSlideOver / ConversationalJEScreen
 *     don't branch on engine mode.
 *   • Journal entries write surface is LIVE in both the Manual JE
 *     composer (atomic POST on save) and the ConversationalJE
 *     recording path (POST /api/ai/confirm). The old per-keystroke
 *     mock mutators (createManualJEDraft, addLineToManualJE, etc.)
 *     are no longer on the active call path and have been removed
 *     from WRITE_THROW; the ManualJEComposer holds draft state locally.
 *   • `runAminahSession` is now an engine-level export (was a direct
 *     import from stubBackend in Wave 2).
 *
 * Wave 2 rewrite:
 *   Wave 1 routed exactly ONE function (`getHealth`) to the real API and
 *   threw for everything else in LIVE mode. Wave 2 widens the surface and
 *   adds a SAFE per-function declaration table:
 *
 *     • 'wired'         — LIVE mode hits the real Corporate API; MOCK mode
 *                         stays on mockEngine. Used for functions we have
 *                         actually wired up in this wave.
 *     • 'mock_fallback' — LIVE mode silently falls back to mockEngine with
 *                         a one-shot debug warning. Used for reads that have
 *                         no backend support yet but are called by landing
 *                         screens and would otherwise crash the app.
 *     • (unlisted)      — Anything not in the table falls back to mockEngine
 *                         in LIVE mode with a one-shot warning. This matches
 *                         'mock_fallback' and is the safe default. Write
 *                         operations that should NEVER silently succeed must
 *                         be added to the WRITE_THROW set below.
 *
 * Why the default is mock_fallback, not throw:
 *   Wave 1 threw on every unwired function in LIVE mode. That was correct
 *   for Wave 1 (loud failures, very small wired surface) but Wave 2 actually
 *   runs the dashboard against a live API — if any reader on the landing
 *   screen throws, the whole role view crashes. Fallback-to-mock-with-warn
 *   is safer for reads. Writes that could mutate a real tenant DB still
 *   throw via WRITE_THROW below.
 *
 * How callers use this module:
 *   Screens that have been migrated to Wave 2 import from `../../engine`
 *   instead of `../../engine/mockEngine`. All other screens still import
 *   from mockEngine directly and are unaffected by this file.
 */
import * as mockEngine from './mockEngine';
import { getHealth as realGetHealth } from '../api/health';
import * as chatApi from '../api/chat';
import { runLiveChatSession } from '../api/chat-adapter';
import * as journalEntriesApi from '../api/journal-entries';
import * as journalEntriesWriteApi from '../api/journal-entries-write';
import * as accountsApi from '../api/accounts';
import * as reportsApi from '../api/reports';
import * as reportVersionsApi from '../api/report-versions';
import * as dataInalterabilityApi from '../api/data-inalterability';
import * as monthlyCloseChecklistApi from '../api/monthly-close-checklist';
import * as settingsApi from '../api/settings';
import * as advisorPendingApi from '../api/advisor-pending';
import * as agingApi from '../api/aging';
import * as invoicesApi from '../api/invoices';
import * as billsApi from '../api/bills';
import * as disallowanceRulesApi from '../api/disallowance-rules';
import * as taxLodgementsApi from '../api/tax-lodgements';
import * as citAssessmentApi from '../api/cit-assessment';
import * as whtApi from '../api/wht';
import * as pettyCashApi from '../api/petty-cash';
import * as costAllocationApi from '../api/cost-allocation';
import * as relatedPartyApi from '../api/related-party';
import * as bulkReclassApi from '../api/bulk-reclassifications';
import * as migrationAuditApi from '../api/migration-audit';
import * as warrantyPolicyApi from '../api/warranty-provision-policy';
import * as bankFormatsApi from '../api/bank-formats';
import { runAminahSession as stubRunAminahSession } from './aminah/stubBackend';
import {
  listAdvisorPendingMock,
  deferAdvisorPendingMock,
  dismissAdvisorPendingMock,
  acknowledgeAdvisorPendingMock,
} from './aminah/advisor-pending-stub';

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';
export const ENGINE_MODE = useMocks ? 'MOCK' : 'LIVE';

/**
 * Per-function routing declaration. Each entry is either:
 *   'wired'         — real API in LIVE mode (needs an entry in REAL_IMPLS)
 *   'mock_fallback' — mockEngine in LIVE mode, with one-shot warn
 *
 * Functions NOT listed here default to mock_fallback (safe default).
 * See file-level comment above.
 */
const FUNCTION_ROUTING = {
  // Health
  getHealth: 'wired',

  // Aminah chat — Wave 3: the streaming UI now consumes the live adapter
  // that wraps POST /api/ai/chat into the block-event protocol the UI
  // already speaks. See `src/api/chat-adapter.js`.
  sendChatMessage: 'wired',
  confirmPendingAction: 'wired',
  listConversations: 'wired',
  getConversation: 'wired',
  getConversationMessages: 'wired',
  runAminahSession: 'wired',

  // Journal entries — Wave 2 reads + Wave 3 writes
  listJournalEntries: 'wired',
  getJournalEntry: 'wired',
  getManualJEs: 'wired',       // read list, shape-adapted
  getManualJEById: 'wired',    // read detail, shape-adapted
  createJournalEntry: 'wired',
  updateJournalEntryDraft: 'wired',
  postJournalEntry: 'wired',
  reverseJournalEntry: 'wired',
  voidJournalEntry: 'wired',

  // Chart of accounts
  getAccountsTree: 'wired',
  getAccountsFlat: 'wired',
  getSetupChartOfAccounts: 'wired', // shape-adapted for the existing Setup UI

  // Reports
  getTrialBalance: 'wired',
  getIncomeStatement: 'wired',
  getBalanceSheet: 'wired',
  getCashFlowStatement: 'wired',

  // Report versions (FN-244, Phase 4 Wave 1)
  publishReportVersion: 'wired',
  listReportVersions: 'wired',
  getReportVersion: 'wired',

  // Data inalterability composite (FN-226, Phase 4 Wave 1 Item 2)
  getDataInalterabilityReport: 'wired',

  // Monthly close checklist (FN-227, Phase 4 Wave 1 Item 3)
  createTemplateItem: 'wired',
  updateTemplateItem: 'wired',
  listTemplateItems: 'wired',
  openInstance: 'wired',
  listInstances: 'wired',
  getInstance: 'wired',
  markItemStatus: 'wired',
  signOffInstance: 'wired',
  reopenInstance: 'wired',

  // Auth / settings
  getTenantInfo: 'wired',
  getCurrentUser: 'wired',
  getUserProfile: 'wired', // shape-adapted for the existing Settings UI
  listMembers: 'wired',
  changePassword: 'wired',

  // Aminah advisor-pending (Wave 6B.3 Layer 3). These are NOT on
  // mockEngine's namespace, so the 'wired' entries here mostly exist
  // as documentation — the surface assignments below (both in
  // buildLiveSurface and buildMockExtras) are what route the calls.
  listAdvisorPending: 'wired',
  deferAdvisorPending: 'wired',
  dismissAdvisorPending: 'wired',
  acknowledgeAdvisorPending: 'wired',

  // Aging reports (Phase 4 Wave 1 Track B first wire — 2026-04-19).
  // Five of the eight AgingReportsScreen mocks are wirable against
  // shipped backends; the other three are blocked-on-backend and have
  // PHASE-4-BLOCKED-ON-BACKEND annotations in mockEngine.js. See
  // memory-bank/2026-04-19-phase4-breakdown.md §B-Tier 2 for coverage.
  getAgingReport: 'wired',
  getInvoiceDetail: 'wired',
  logPayment: 'wired',
  // createWriteOffJE: PHASE-4-BLOCKED-ON-BACKEND — demoted from 'wired'
  // per architect review 2026-04-19 (QA-reviewer surfaced the semantic
  // regression). The mock contract allows debiting ANY user-picked GL
  // account (Bad Debt Expense 8300, Goodwill, Legal Settlement, etc.);
  // the credit-note backend path is Revenue-only by design and silently
  // dropped the glAccount argument. No existing endpoint supports a
  // GL-flexible AR write-off. See HASEEB-068/069 for the backend
  // unblocker (GL-flexible write-off endpoint + Owner-approval task
  // emission). Stays on the engine as 'mock_fallback' until that ships.
  // getChartOfAccounts — route to the existing getAccountsFlat wiring
  // so the WriteOffModal's GL dropdown picks up real Expenses accounts
  // in LIVE mode. MOCK mode falls back to mockEngine.getChartOfAccounts
  // (which returns a different shape — category-vs-type — and the
  // modal's `a.type === 'Expenses'` filter is broken in MOCK — see
  // HASEEB-071 for the separate mock-shape fix).
  getChartOfAccounts: 'wired',
};

/**
 * Writes that must NEVER silently succeed via mock in LIVE mode. Anything in
 * this set throws a loud error if called in LIVE mode without explicit wiring.
 * Reads can be faked; writes cannot.
 */
/**
 * Wave 3 note: the old WRITE_THROW members for the manual-JE lifecycle
 * (createManualJEDraft, addLineToManualJE, updateLineInManualJE,
 * removeLineFromManualJE, updateManualJEDraft, postManualJE,
 * reverseManualJE, voidManualJE) have been removed from this set. The
 * ManualJEComposer was reshaped in Wave 3 to hold the full draft in
 * local React state and emit a single atomic POST /api/journal-entries
 * on save, so the per-keystroke mock functions are no longer part of
 * the write path — they remain in mockEngine for legacy callers but
 * nothing on the active composer path calls them.
 *
 * scheduleManualJE / postScheduledNow stay in WRITE_THROW because the
 * backend has no scheduling endpoint yet. The UI surfaces for those
 * are not exercised on the Wave 3 write path.
 */
const WRITE_THROW = new Set([
  // Still mock-only in Wave 3 (no backend support yet).
  'scheduleManualJE',
  'postScheduledNow',
  'createAccount',
  'updateAccount',
  'deactivateAccount',
  'bulkCategorizeTransactions',
  'bulkAssignTransactions',
]);

/**
 * Real API implementations by mockEngine function name.
 * Shape adapters live in the individual api/* modules.
 */
const REAL_IMPLS = {
  getHealth: realGetHealth,

  // Chat
  sendChatMessage: chatApi.sendChatMessage,
  confirmPendingAction: chatApi.confirmPendingAction,
  listConversations: chatApi.listConversations,
  getConversation: chatApi.getConversation,
  getConversationMessages: chatApi.getConversationMessages,
  runAminahSession: runLiveChatSession,

  // Journal entries — Wave 2 reads
  listJournalEntries: journalEntriesApi.listJournalEntries,
  getJournalEntry: journalEntriesApi.getJournalEntry,
  getManualJEs: journalEntriesApi.getManualJEs,
  getManualJEById: journalEntriesApi.getManualJEById,
  // Journal entries — Wave 3 writes
  createJournalEntry: journalEntriesWriteApi.createJournalEntry,
  updateJournalEntryDraft: journalEntriesWriteApi.updateJournalEntryDraft,
  postJournalEntry: journalEntriesWriteApi.postJournalEntry,
  reverseJournalEntry: journalEntriesWriteApi.reverseJournalEntry,
  voidJournalEntry: journalEntriesWriteApi.voidJournalEntry,

  // Accounts
  getAccountsTree: accountsApi.getAccountsTree,
  getAccountsFlat: accountsApi.getAccountsFlat,
  getSetupChartOfAccounts: accountsApi.getSetupChartOfAccounts,

  // Reports
  getTrialBalance: reportsApi.getTrialBalance,
  getIncomeStatement: reportsApi.getIncomeStatement,
  getBalanceSheet: reportsApi.getBalanceSheet,
  getCashFlowStatement: reportsApi.getCashFlow,

  // Report versions (FN-244)
  publishReportVersion: reportVersionsApi.publishReportVersion,
  listReportVersions: reportVersionsApi.listReportVersions,
  getReportVersion: reportVersionsApi.getReportVersion,

  // Data inalterability composite (FN-226)
  getDataInalterabilityReport: dataInalterabilityApi.getDataInalterabilityReport,

  // Monthly close checklist (FN-227)
  createTemplateItem: monthlyCloseChecklistApi.createTemplateItem,
  updateTemplateItem: monthlyCloseChecklistApi.updateTemplateItem,
  listTemplateItems: monthlyCloseChecklistApi.listTemplateItems,
  openInstance: monthlyCloseChecklistApi.openInstance,
  listInstances: monthlyCloseChecklistApi.listInstances,
  getInstance: monthlyCloseChecklistApi.getInstance,
  markItemStatus: monthlyCloseChecklistApi.markItemStatus,
  signOffInstance: monthlyCloseChecklistApi.signOffInstance,
  reopenInstance: monthlyCloseChecklistApi.reopenInstance,

  // Settings
  getTenantInfo: settingsApi.getTenantInfo,
  getCurrentUser: settingsApi.getCurrentUser,
  getUserProfile: settingsApi.getUserProfile,
  listMembers: settingsApi.listMembers,
  changePassword: settingsApi.changePassword,

  // Aminah advisor-pending (Wave 6B.3 Layer 3)
  listAdvisorPending: advisorPendingApi.listAdvisorPending,
  deferAdvisorPending: advisorPendingApi.deferAdvisorPending,
  dismissAdvisorPending: advisorPendingApi.dismissAdvisorPending,
  acknowledgeAdvisorPending: advisorPendingApi.acknowledgeAdvisorPending,

  // Aging reports (Phase 4 Wave 1 Track B first wire — 2026-04-19).
  getAgingReport: agingApi.getAgingReport,
  getInvoiceDetail: invoicesApi.getInvoice,
  getChartOfAccounts: accountsApi.getAccountsFlat,
  // logPayment: dispatch to AR (/api/invoices/:id/payment) or AP
  // (/api/bills/:id/payment) based on the invoice type carried alongside
  // the call. The mockEngine signature is
  //   logPayment(invoiceId, amount, date, method, reference, notes)
  // and LogPaymentModal passes `invoice.type` (AR|AP) via the extended
  // signature (Phase 4 wire — see LogPaymentModal.jsx).
  logPayment: async (invoiceId, amount, date, _method, reference, _notes, type, bankAccountId) => {
    const body = { amount, date, reference, bankAccountId };
    if (type === 'AP') {
      return billsApi.recordBillPayment(invoiceId, body);
    }
    return invoicesApi.recordInvoicePayment(invoiceId, body);
  },
  // createWriteOffJE: PHASE-4-BLOCKED-ON-BACKEND. See FUNCTION_ROUTING
  // comment block above. Falls through to mockEngine.createWriteOffJE
  // via the default mock_fallback wrapper until HASEEB-068/069 ship.

  // Disallowance rules (FN-222, Phase 4 Track A Wave 2 — 2026-04-19).
  // Backend 5/5 live; these are extras surfaced in both MOCK and LIVE
  // modes via buildLiveSurface / buildMockExtras (no mockEngine impl).
  listDisallowanceRules: disallowanceRulesApi.listDisallowanceRules,
  getDisallowanceRule: disallowanceRulesApi.getDisallowanceRule,
  createDisallowanceRule: disallowanceRulesApi.createDisallowanceRule,
  updateDisallowanceRule: disallowanceRulesApi.updateDisallowanceRule,
  deactivateDisallowanceRule: disallowanceRulesApi.deactivateDisallowanceRule,

  // Tax lodgements (FN-268, Phase 4 Track A Wave 2 — 2026-04-19).
  // Backend 5/5 live; extras pattern (no mockEngine impl).
  listTaxLodgements: taxLodgementsApi.listTaxLodgements,
  getTaxLodgement: taxLodgementsApi.getTaxLodgement,
  recordTaxLodgement: taxLodgementsApi.recordTaxLodgement,
  updateTaxLodgementStatus: taxLodgementsApi.updateTaxLodgementStatus,
  getTaxLodgementTieOut: taxLodgementsApi.getTaxLodgementTieOut,

  // CIT Assessment (FN-249, Phase 4 Track A Wave 2 — 2026-04-19).
  // Backend 10/10 live; extras pattern (no mockEngine impl).
  listCitAssessments: citAssessmentApi.listCitAssessments,
  getCitAssessment: citAssessmentApi.getCitAssessment,
  listApproachingStatute: citAssessmentApi.listApproachingStatute,
  createCitAssessment: citAssessmentApi.createCitAssessment,
  openCitAssessmentReview: citAssessmentApi.openCitAssessmentReview,
  recordCitAssessment: citAssessmentApi.recordCitAssessment,
  recordCitAssessmentObjection: citAssessmentApi.recordCitAssessmentObjection,
  finalizeCitAssessment: citAssessmentApi.finalizeCitAssessment,
  closeCitAssessment: citAssessmentApi.closeCitAssessment,
  markCitAssessmentStatuteExpired: citAssessmentApi.markCitAssessmentStatuteExpired,

  // WHT (FN-250, Phase 4 Track A Wave 2 — 2026-04-19).
  // Policy CRUD (6 endpoints) + certificate read-only (2). Certificate
  // creation is service-layer only via future AP-flow splice.
  listWhtConfigs: whtApi.listWhtConfigs,
  getActiveWhtConfig: whtApi.getActiveWhtConfig,
  getWhtConfig: whtApi.getWhtConfig,
  createWhtConfig: whtApi.createWhtConfig,
  updateWhtConfig: whtApi.updateWhtConfig,
  deactivateWhtConfig: whtApi.deactivateWhtConfig,
  listWhtCertificates: whtApi.listWhtCertificates,
  getWhtCertificate: whtApi.getWhtCertificate,

  // Petty cash (FN-275, Phase 4 Track A Tier 3 — 2026-04-19).
  // Multi-box imprest register; 7 endpoints live.
  listPettyCashBoxes: pettyCashApi.listPettyCashBoxes,
  getPettyCashBox: pettyCashApi.getPettyCashBox,
  createPettyCashBox: pettyCashApi.createPettyCashBox,
  deactivatePettyCashBox: pettyCashApi.deactivatePettyCashBox,
  recordPettyCashTx: pettyCashApi.recordPettyCashTx,
  listPettyCashTransactions: pettyCashApi.listPettyCashTransactions,
  reconcilePettyCashBox: pettyCashApi.reconcilePettyCashBox,

  // Cost allocation (FN-243, Phase 4 Track A Tier 3 — 2026-04-19).
  listCostAllocationRules: costAllocationApi.listCostAllocationRules,
  getCostAllocationRule: costAllocationApi.getCostAllocationRule,
  createCostAllocationRule: costAllocationApi.createCostAllocationRule,
  deactivateCostAllocationRule: costAllocationApi.deactivateCostAllocationRule,
  computeCostAllocation: costAllocationApi.computeCostAllocation,

  // Related-party register + report (FN-254, Phase 4 Track A Tier 3).
  listRelatedParties: relatedPartyApi.listRelatedParties,
  getRelatedParty: relatedPartyApi.getRelatedParty,
  createRelatedParty: relatedPartyApi.createRelatedParty,
  updateRelatedParty: relatedPartyApi.updateRelatedParty,
  deactivateRelatedParty: relatedPartyApi.deactivateRelatedParty,
  getRelatedPartyReport: relatedPartyApi.getRelatedPartyReport,
  listVendorsForRelatedParty: relatedPartyApi.listVendorsForRelatedParty,
  listCustomersForRelatedParty: relatedPartyApi.listCustomersForRelatedParty,

  // Bulk reclassifications (FN-239, Phase 4 Track A Tier 3 — 2026-04-19).
  listBulkReclassifications: bulkReclassApi.listBulkReclassifications,
  getBulkReclassification: bulkReclassApi.getBulkReclassification,
  createBulkReclassification: bulkReclassApi.createBulkReclassification,
  previewBulkReclassification: bulkReclassApi.previewBulkReclassification,
  approveBulkReclassification: bulkReclassApi.approveBulkReclassification,
  cancelBulkReclassification: bulkReclassApi.cancelBulkReclassification,
  getBulkReclassificationJeShape: bulkReclassApi.getBulkReclassificationJeShape,

  // Migration audit trail (FN-245, Phase 4 Track A Tier 5 — 2026-04-19).
  listMigrationAudits: migrationAuditApi.listMigrationAudits,
  getMigrationSchemaChain: migrationAuditApi.getMigrationSchemaChain,
  getMigrationAudit: migrationAuditApi.getMigrationAudit,

  // Warranty provision policy (FN-256, Phase 4 Track A Tier 5 — 2026-04-19).
  listWarrantyPolicies: warrantyPolicyApi.listWarrantyPolicies,
  getActiveWarrantyPolicy: warrantyPolicyApi.getActiveWarrantyPolicy,
  getWarrantyPolicy: warrantyPolicyApi.getWarrantyPolicy,
  createWarrantyPolicy: warrantyPolicyApi.createWarrantyPolicy,
  updateWarrantyPolicy: warrantyPolicyApi.updateWarrantyPolicy,
  deactivateWarrantyPolicy: warrantyPolicyApi.deactivateWarrantyPolicy,

  // Bank formats (FN-246, Phase 4 Track A Tier 5 — 2026-04-19).
  listBankFormats: bankFormatsApi.listBankFormats,
  getActiveBankFormat: bankFormatsApi.getActiveBankFormat,
  getBankFormat: bankFormatsApi.getBankFormat,
  createBankFormat: bankFormatsApi.createBankFormat,
  updateBankFormat: bankFormatsApi.updateBankFormat,
  deactivateBankFormat: bankFormatsApi.deactivateBankFormat,
};

// One-shot warning state so the console isn't spammed.
const _warned = new Set();
function _warnMockFallback(fnName) {
  if (_warned.has(fnName)) return;
  _warned.add(fnName);
  // eslint-disable-next-line no-console
  console.warn(
    `[engine] mock fallback for ${fnName}(); no API support yet. ` +
      `This call is returning mockEngine data even though VITE_USE_MOCKS=false.`
  );
}

/**
 * Build a LIVE-mode surface that mirrors mockEngine's shape.
 */
function buildLiveSurface() {
  const surface = {};

  for (const key of Object.keys(mockEngine)) {
    const routing = FUNCTION_ROUTING[key] || 'mock_fallback';
    const mockImpl = mockEngine[key];

    if (routing === 'wired') {
      const real = REAL_IMPLS[key];
      if (typeof real === 'function') {
        surface[key] = real;
        continue;
      }
      // Wired but no real impl — this is a dev bug in the routing table.
      // Fall back to mock with a loud warn so it doesn't crash the app.
      surface[key] = function missingWiring(...args) {
        // eslint-disable-next-line no-console
        console.error(
          `[engine] ${key}() is marked 'wired' but no REAL_IMPLS entry exists. ` +
            `Falling back to mock.`
        );
        return typeof mockImpl === 'function'
          ? mockImpl(...args)
          : Promise.resolve(mockImpl);
      };
      continue;
    }

    // Non-function exports pass through in either mode.
    if (typeof mockImpl !== 'function') {
      surface[key] = mockImpl;
      continue;
    }

    // Writes in LIVE mode without explicit wiring — throw loudly.
    if (WRITE_THROW.has(key)) {
      surface[key] = function writeBlocked() {
        throw new Error(
          `[engine] ${key}() is a write operation that has not been wired to ` +
            `the real Corporate API. Refusing to call mockEngine in LIVE mode ` +
            `because it would silently lie about a persisted change. ` +
            `Set VITE_USE_MOCKS=true for mock mode, or wire ${key} in Wave 3.`
        );
      };
      continue;
    }

    // Default: mock_fallback. Wrap to emit a one-shot warn.
    surface[key] = function mockFallback(...args) {
      _warnMockFallback(key);
      return mockImpl(...args);
    };
  }

  // Make sure getHealth is always available.
  if (!surface.getHealth) surface.getHealth = realGetHealth;

  // Extras — functions that are NOT in mockEngine's namespace but are
  // exposed by the engine surface. The router still picks MOCK vs LIVE
  // for each one.
  //
  // Wave 3 adds:
  //   • runAminahSession — MOCK uses the scripted stubBackend, LIVE uses
  //     the chat-adapter that wraps POST /api/ai/chat into the block
  //     event protocol.
  //   • Journal entries write surface (createJournalEntry, post,
  //     reverse, void, updateDraft) — no mock equivalent; these are
  //     LIVE-only and in MOCK mode they throw a clear error so that
  //     calling them against the mock engine is a visible bug.
  surface.runAminahSession = runLiveChatSession;
  // Chat helpers — live API wrappers. These are not on mockEngine's
  // namespace, so the Object.keys(mockEngine) loop above does not
  // pick them up; they must be assigned explicitly the same way
  // runAminahSession / getConversationMessages are.
  surface.sendChatMessage = chatApi.sendChatMessage;
  surface.confirmPendingAction = chatApi.confirmPendingAction;
  surface.listConversations = chatApi.listConversations;
  surface.getConversation = chatApi.getConversation;
  surface.getConversationMessages = chatApi.getConversationMessages;
  surface.createJournalEntry = journalEntriesWriteApi.createJournalEntry;
  surface.updateJournalEntryDraft = journalEntriesWriteApi.updateJournalEntryDraft;
  surface.postJournalEntry = journalEntriesWriteApi.postJournalEntry;
  surface.reverseJournalEntry = journalEntriesWriteApi.reverseJournalEntry;
  surface.voidJournalEntry = journalEntriesWriteApi.voidJournalEntry;

  // Aminah advisor-pending — Wave 6B.3 Layer 3. Not on mockEngine's
  // namespace, so assigned explicitly the same way the chat helpers are.
  surface.listAdvisorPending = advisorPendingApi.listAdvisorPending;
  surface.deferAdvisorPending = advisorPendingApi.deferAdvisorPending;
  surface.dismissAdvisorPending = advisorPendingApi.dismissAdvisorPending;
  surface.acknowledgeAdvisorPending = advisorPendingApi.acknowledgeAdvisorPending;

  // Report versions (FN-244, Phase 4 Wave 1). Not on mockEngine's namespace;
  // assigned explicitly here so both MOCK and LIVE surfaces expose the
  // same function names and screens don't have to branch.
  surface.publishReportVersion = reportVersionsApi.publishReportVersion;
  surface.listReportVersions = reportVersionsApi.listReportVersions;
  surface.getReportVersion = reportVersionsApi.getReportVersion;

  // Data inalterability composite (FN-226, Phase 4 Wave 1 Item 2).
  // getDataInalterabilityReport IS on mockEngine's namespace, so the
  // Object.keys(mockEngine) loop in buildLiveSurface already picks it
  // up via FUNCTION_ROUTING['getDataInalterabilityReport'] = 'wired'
  // + REAL_IMPLS. No explicit override needed here.

  // Disallowance rules (FN-222, Phase 4 Track A Wave 2). Not on
  // mockEngine's namespace — surfaced via extras the same way report
  // versions / advisor-pending are. Backend 5/5 live.
  surface.listDisallowanceRules = disallowanceRulesApi.listDisallowanceRules;
  surface.getDisallowanceRule = disallowanceRulesApi.getDisallowanceRule;
  surface.createDisallowanceRule = disallowanceRulesApi.createDisallowanceRule;
  surface.updateDisallowanceRule = disallowanceRulesApi.updateDisallowanceRule;
  surface.deactivateDisallowanceRule = disallowanceRulesApi.deactivateDisallowanceRule;

  // Tax lodgements (FN-268, Phase 4 Track A Wave 2). Extras pattern.
  surface.listTaxLodgements = taxLodgementsApi.listTaxLodgements;
  surface.getTaxLodgement = taxLodgementsApi.getTaxLodgement;
  surface.recordTaxLodgement = taxLodgementsApi.recordTaxLodgement;
  surface.updateTaxLodgementStatus = taxLodgementsApi.updateTaxLodgementStatus;
  surface.getTaxLodgementTieOut = taxLodgementsApi.getTaxLodgementTieOut;

  // CIT Assessment (FN-249, Phase 4 Track A Wave 2). Extras pattern.
  surface.listCitAssessments = citAssessmentApi.listCitAssessments;
  surface.getCitAssessment = citAssessmentApi.getCitAssessment;
  surface.listApproachingStatute = citAssessmentApi.listApproachingStatute;
  surface.createCitAssessment = citAssessmentApi.createCitAssessment;
  surface.openCitAssessmentReview = citAssessmentApi.openCitAssessmentReview;
  surface.recordCitAssessment = citAssessmentApi.recordCitAssessment;
  surface.recordCitAssessmentObjection = citAssessmentApi.recordCitAssessmentObjection;
  surface.finalizeCitAssessment = citAssessmentApi.finalizeCitAssessment;
  surface.closeCitAssessment = citAssessmentApi.closeCitAssessment;
  surface.markCitAssessmentStatuteExpired = citAssessmentApi.markCitAssessmentStatuteExpired;

  // WHT (FN-250, Phase 4 Track A Wave 2). Extras pattern.
  surface.listWhtConfigs = whtApi.listWhtConfigs;
  surface.getActiveWhtConfig = whtApi.getActiveWhtConfig;
  surface.getWhtConfig = whtApi.getWhtConfig;
  surface.createWhtConfig = whtApi.createWhtConfig;
  surface.updateWhtConfig = whtApi.updateWhtConfig;
  surface.deactivateWhtConfig = whtApi.deactivateWhtConfig;
  surface.listWhtCertificates = whtApi.listWhtCertificates;
  surface.getWhtCertificate = whtApi.getWhtCertificate;

  // Petty cash (FN-275, Phase 4 Track A Tier 3). Extras pattern.
  surface.listPettyCashBoxes = pettyCashApi.listPettyCashBoxes;
  surface.getPettyCashBox = pettyCashApi.getPettyCashBox;
  surface.createPettyCashBox = pettyCashApi.createPettyCashBox;
  surface.deactivatePettyCashBox = pettyCashApi.deactivatePettyCashBox;
  surface.recordPettyCashTx = pettyCashApi.recordPettyCashTx;
  surface.listPettyCashTransactions = pettyCashApi.listPettyCashTransactions;
  surface.reconcilePettyCashBox = pettyCashApi.reconcilePettyCashBox;

  // Cost allocation (FN-243, Phase 4 Track A Tier 3). Extras pattern.
  surface.listCostAllocationRules = costAllocationApi.listCostAllocationRules;
  surface.getCostAllocationRule = costAllocationApi.getCostAllocationRule;
  surface.createCostAllocationRule = costAllocationApi.createCostAllocationRule;
  surface.deactivateCostAllocationRule = costAllocationApi.deactivateCostAllocationRule;
  surface.computeCostAllocation = costAllocationApi.computeCostAllocation;

  // Related-party (FN-254). Extras pattern.
  surface.listRelatedParties = relatedPartyApi.listRelatedParties;
  surface.getRelatedParty = relatedPartyApi.getRelatedParty;
  surface.createRelatedParty = relatedPartyApi.createRelatedParty;
  surface.updateRelatedParty = relatedPartyApi.updateRelatedParty;
  surface.deactivateRelatedParty = relatedPartyApi.deactivateRelatedParty;
  surface.getRelatedPartyReport = relatedPartyApi.getRelatedPartyReport;
  surface.listVendorsForRelatedParty = relatedPartyApi.listVendorsForRelatedParty;
  surface.listCustomersForRelatedParty = relatedPartyApi.listCustomersForRelatedParty;

  // Bulk reclassifications (FN-239, Phase 4 Track A Tier 3). Extras pattern.
  surface.listBulkReclassifications = bulkReclassApi.listBulkReclassifications;
  surface.getBulkReclassification = bulkReclassApi.getBulkReclassification;
  surface.createBulkReclassification = bulkReclassApi.createBulkReclassification;
  surface.previewBulkReclassification = bulkReclassApi.previewBulkReclassification;
  surface.approveBulkReclassification = bulkReclassApi.approveBulkReclassification;
  surface.cancelBulkReclassification = bulkReclassApi.cancelBulkReclassification;
  surface.getBulkReclassificationJeShape = bulkReclassApi.getBulkReclassificationJeShape;

  // Migration audit trail (FN-245). Extras pattern.
  surface.listMigrationAudits = migrationAuditApi.listMigrationAudits;
  surface.getMigrationSchemaChain = migrationAuditApi.getMigrationSchemaChain;
  surface.getMigrationAudit = migrationAuditApi.getMigrationAudit;

  // Warranty provision policy (FN-256). Extras pattern.
  surface.listWarrantyPolicies = warrantyPolicyApi.listWarrantyPolicies;
  surface.getActiveWarrantyPolicy = warrantyPolicyApi.getActiveWarrantyPolicy;
  surface.getWarrantyPolicy = warrantyPolicyApi.getWarrantyPolicy;
  surface.createWarrantyPolicy = warrantyPolicyApi.createWarrantyPolicy;
  surface.updateWarrantyPolicy = warrantyPolicyApi.updateWarrantyPolicy;
  surface.deactivateWarrantyPolicy = warrantyPolicyApi.deactivateWarrantyPolicy;

  // Bank formats (FN-246). Extras pattern.
  surface.listBankFormats = bankFormatsApi.listBankFormats;
  surface.getActiveBankFormat = bankFormatsApi.getActiveBankFormat;
  surface.getBankFormat = bankFormatsApi.getBankFormat;
  surface.createBankFormat = bankFormatsApi.createBankFormat;
  surface.updateBankFormat = bankFormatsApi.updateBankFormat;
  surface.deactivateBankFormat = bankFormatsApi.deactivateBankFormat;

  return surface;
}

/**
 * MOCK-mode shim: functions exposed by the engine surface but not
 * present on mockEngine. These keep the same import in both modes so
 * screens don't need to branch.
 *
 *   • runAminahSession → the stub scripted generator.
 *   • getConversationMessages → [] (no server in mock mode).
 *   • createJournalEntry / updateJournalEntryDraft / postJournalEntry /
 *     reverseJournalEntry / voidJournalEntry → minimal client-side
 *     mock that fabricates a plausible response so the demo flows
 *     still work end-to-end without a backend. Not persisted to
 *     mockEngine's state store — the point of the reshape is that the
 *     composer holds draft state locally, so even in MOCK mode the
 *     round-trip is purely cosmetic.
 */
function buildMockExtras() {
  let _mockEntryCounter = 1000;
  const mockCreate = async (payload) => {
    await new Promise((r) => setTimeout(r, 120));
    const id = `MOCK-JE-${++_mockEntryCounter}`;
    return {
      id,
      entryNumber: _mockEntryCounter,
      date: payload?.date || new Date().toISOString(),
      description: payload?.description || '',
      reference: payload?.reference || null,
      status: (payload?.status || 'DRAFT').toUpperCase(),
      currency: payload?.currency || 'KWD',
      source: payload?.source || 'MANUAL',
      lines: payload?.lines || [],
      createdAt: new Date().toISOString(),
      _mock: true,
    };
  };
  const mockUpdate = async (id, payload) => {
    await new Promise((r) => setTimeout(r, 80));
    return { id, ...payload, _mock: true };
  };
  const mockPost = async (id) => {
    await new Promise((r) => setTimeout(r, 80));
    return { id, entryNumber: id, status: 'POSTED', _mock: true };
  };
  const mockReverse = async (id, reason) => {
    await new Promise((r) => setTimeout(r, 80));
    return { id: `REV-${id}`, reversalOf: id, reason, _mock: true };
  };
  const mockVoid = async (id, reason) => {
    await new Promise((r) => setTimeout(r, 80));
    return { id, status: 'VOID', reason, _mock: true };
  };
  // Mock chat helpers — the ConversationalJE write path expects a
  // promise-returning sendChatMessage with { message, pendingJournalEntry?,
  // confirmationId?, conversationId } shape. In MOCK mode we return a
  // plausible echo so the UI doesn't crash; no pendingJournalEntry is
  // emitted because the old scripted compound-entry flow is gone and
  // MOCK mode isn't on the active test path anyway (LIVE is Wave 3).
  const mockSendChat = async ({ message, conversationId } = {}) => {
    await new Promise((r) => setTimeout(r, 120));
    return {
      message: `(mock) received: ${message || ''}`,
      language: 'en',
      conversationId: conversationId || `mock-conv-${Date.now()}`,
      action: null,
      pendingJournalEntry: null,
      pendingInvoice: null,
      confirmationId: null,
      metadata: null,
      tool_uses: null,
      raw: null,
    };
  };
  const mockConfirm = async ({ confirmationId } = {}) => {
    await new Promise((r) => setTimeout(r, 80));
    return {
      message: '(mock) confirmed',
      language: 'en',
      success: true,
      journalEntry: null,
      ruleSuggestion: null,
      raw: { confirmationId },
    };
  };
  return {
    runAminahSession: stubRunAminahSession,
    sendChatMessage: mockSendChat,
    confirmPendingAction: mockConfirm,
    listConversations: async () => [],
    getConversation: async () => null,
    getConversationMessages: async () => [],
    createJournalEntry: mockCreate,
    updateJournalEntryDraft: mockUpdate,
    postJournalEntry: mockPost,
    reverseJournalEntry: mockReverse,
    voidJournalEntry: mockVoid,
    // Aminah advisor-pending — Wave 6B.3 Layer 3 MOCK stubs. Mutations
    // update the in-memory list in advisor-pending-stub.js so the UI
    // can round-trip on defer/dismiss/acknowledge without a backend.
    listAdvisorPending: listAdvisorPendingMock,
    deferAdvisorPending: deferAdvisorPendingMock,
    dismissAdvisorPending: dismissAdvisorPendingMock,
    acknowledgeAdvisorPending: acknowledgeAdvisorPendingMock,
    // Report versions (FN-244, Phase 4 Wave 1) — MOCK stubs. The real
    // feature depends on a backend that persists an immutable version
    // chain; MOCK mode just round-trips enough to keep the UI alive
    // without pretending to persist. list returns an empty array so the
    // drawer shows its empty state; publish fabricates a plausible DTO
    // so the modal doesn't error out.
    publishReportVersion: mockPublishReportVersion,
    listReportVersions: mockListReportVersions,
    getReportVersion: mockGetReportVersion,
    // NOTE: the FN-226 mock (getDataInalterabilityReport) lives in
    // mockEngine.js itself, so it is already picked up via the
    // `...mockEngine` spread above and does not need an override here.
    // Disallowance rules (FN-222) MOCK stubs — module-scoped store so
    // create/update/deactivate persist for the lifetime of the tab.
    listDisallowanceRules: mockListDisallowanceRules,
    getDisallowanceRule: mockGetDisallowanceRule,
    createDisallowanceRule: mockCreateDisallowanceRule,
    updateDisallowanceRule: mockUpdateDisallowanceRule,
    deactivateDisallowanceRule: mockDeactivateDisallowanceRule,
    // Tax lodgements (FN-268) MOCK stubs.
    listTaxLodgements: mockListTaxLodgements,
    getTaxLodgement: mockGetTaxLodgement,
    recordTaxLodgement: mockRecordTaxLodgement,
    updateTaxLodgementStatus: mockUpdateTaxLodgementStatus,
    getTaxLodgementTieOut: mockGetTaxLodgementTieOut,
    // CIT Assessment (FN-249) MOCK stubs.
    listCitAssessments: mockListCitAssessments,
    getCitAssessment: mockGetCitAssessment,
    listApproachingStatute: mockListApproachingStatute,
    createCitAssessment: mockCreateCitAssessment,
    openCitAssessmentReview: mockOpenCitAssessmentReview,
    recordCitAssessment: mockRecordCitAssessment,
    recordCitAssessmentObjection: mockRecordCitAssessmentObjection,
    finalizeCitAssessment: mockFinalizeCitAssessment,
    closeCitAssessment: mockCloseCitAssessment,
    markCitAssessmentStatuteExpired: mockMarkCitAssessmentStatuteExpired,
    // WHT (FN-250) MOCK stubs.
    listWhtConfigs: mockListWhtConfigs,
    getActiveWhtConfig: mockGetActiveWhtConfig,
    getWhtConfig: mockGetWhtConfig,
    createWhtConfig: mockCreateWhtConfig,
    updateWhtConfig: mockUpdateWhtConfig,
    deactivateWhtConfig: mockDeactivateWhtConfig,
    listWhtCertificates: mockListWhtCertificates,
    getWhtCertificate: mockGetWhtCertificate,
    // Petty cash (FN-275) MOCK stubs.
    listPettyCashBoxes: mockListPettyCashBoxes,
    getPettyCashBox: mockGetPettyCashBox,
    createPettyCashBox: mockCreatePettyCashBox,
    deactivatePettyCashBox: mockDeactivatePettyCashBox,
    recordPettyCashTx: mockRecordPettyCashTx,
    listPettyCashTransactions: mockListPettyCashTransactions,
    reconcilePettyCashBox: mockReconcilePettyCashBox,
    // Cost allocation (FN-243) MOCK stubs.
    listCostAllocationRules: mockListCostAllocationRules,
    getCostAllocationRule: mockGetCostAllocationRule,
    createCostAllocationRule: mockCreateCostAllocationRule,
    deactivateCostAllocationRule: mockDeactivateCostAllocationRule,
    computeCostAllocation: mockComputeCostAllocation,
    // Related-party (FN-254) MOCK stubs.
    listRelatedParties: mockListRelatedParties,
    getRelatedParty: mockGetRelatedParty,
    createRelatedParty: mockCreateRelatedParty,
    updateRelatedParty: mockUpdateRelatedParty,
    deactivateRelatedParty: mockDeactivateRelatedParty,
    getRelatedPartyReport: mockGetRelatedPartyReport,
    listVendorsForRelatedParty: async () => [],
    listCustomersForRelatedParty: async () => [],
    // Bulk reclassifications (FN-239) MOCK stubs.
    listBulkReclassifications: mockListBulkReclassifications,
    getBulkReclassification: mockGetBulkReclassification,
    createBulkReclassification: mockCreateBulkReclassification,
    previewBulkReclassification: mockPreviewBulkReclassification,
    approveBulkReclassification: mockApproveBulkReclassification,
    cancelBulkReclassification: mockCancelBulkReclassification,
    getBulkReclassificationJeShape: mockGetBulkReclassificationJeShape,
    // Migration audit (FN-245) MOCK stubs — empty; append-only trail
    // is backend-only territory, no in-app creation happens in MOCK.
    listMigrationAudits: async () => [],
    getMigrationSchemaChain: async () => [],
    getMigrationAudit: async () => null,
    // Warranty provision policy (FN-256) MOCK stubs.
    listWarrantyPolicies: mockListWarrantyPolicies,
    getActiveWarrantyPolicy: mockGetActiveWarrantyPolicy,
    getWarrantyPolicy: mockGetWarrantyPolicy,
    createWarrantyPolicy: mockCreateWarrantyPolicy,
    updateWarrantyPolicy: mockUpdateWarrantyPolicy,
    deactivateWarrantyPolicy: mockDeactivateWarrantyPolicy,
    // Bank formats (FN-246) MOCK stubs.
    listBankFormats: mockListBankFormats,
    getActiveBankFormat: mockGetActiveBankFormat,
    getBankFormat: mockGetBankFormat,
    createBankFormat: mockCreateBankFormat,
    updateBankFormat: mockUpdateBankFormat,
    deactivateBankFormat: mockDeactivateBankFormat,
  };
}

// ── Bank formats MOCK stubs (FN-246) ──
let _mockBankFormatCounter = 0;
const _mockBankFormats = [];
function _isBankFormatActive(r, asOfIso) {
  const asOf = new Date(asOfIso || new Date().toISOString().slice(0, 10));
  const from = new Date(r.effectiveFrom);
  if (asOf < from) return false;
  if (r.effectiveUntil) {
    const until = new Date(r.effectiveUntil);
    if (asOf > until) return false;
  }
  return true;
}
async function mockListBankFormats(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockBankFormats
    .filter((r) => !filters.bankCode || r.bankCode === filters.bankCode)
    .map((r) => ({ ...r, spec: { ...r.spec } }));
}
async function mockGetActiveBankFormat(query = {}) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockBankFormats.find(
    (r) =>
      r.bankCode === query.bankCode && _isBankFormatActive(r, query.asOf),
  );
  return row ? { ...row, spec: { ...row.spec } } : null;
}
async function mockGetBankFormat(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockBankFormats.find((r) => r.id === id);
  return row ? { ...row, spec: { ...row.spec } } : null;
}
async function mockCreateBankFormat(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockBankFormatCounter += 1;
  const row = {
    id: `mock-bankfmt-${_mockBankFormatCounter}`,
    bankCode: payload.bankCode || 'UNKNOWN',
    formatVersion: payload.formatVersion || 'v1',
    formatType: payload.formatType || 'CSV',
    spec: payload.spec ? { ...payload.spec } : {},
    effectiveFrom: payload.effectiveFrom || new Date().toISOString().slice(0, 10),
    effectiveUntil: payload.effectiveUntil ?? null,
    notes: payload.notes ?? null,
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _mock: true,
  };
  _mockBankFormats.unshift(row);
  return { ...row, spec: { ...row.spec } };
}
async function mockUpdateBankFormat(id, patch = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockBankFormats.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  _mockBankFormats[idx] = {
    ..._mockBankFormats[idx],
    effectiveUntil:
      patch.effectiveUntil !== undefined
        ? patch.effectiveUntil
        : _mockBankFormats[idx].effectiveUntil,
    notes: patch.notes ?? _mockBankFormats[idx].notes,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockBankFormats[idx], spec: { ..._mockBankFormats[idx].spec } };
}
async function mockDeactivateBankFormat(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockBankFormats.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  _mockBankFormats[idx] = {
    ..._mockBankFormats[idx],
    effectiveUntil: today,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockBankFormats[idx], spec: { ..._mockBankFormats[idx].spec } };
}

// ── Warranty provision policy MOCK stubs (FN-256) ──
let _mockWarrantyCounter = 0;
const _mockWarrantyPolicies = [];
function _isWarrantyActive(r, asOfIso) {
  const asOf = new Date(asOfIso || new Date().toISOString().slice(0, 10));
  const from = new Date(r.activeFrom);
  if (asOf < from) return false;
  if (r.activeUntil) {
    const until = new Date(r.activeUntil);
    if (asOf > until) return false;
  }
  return true;
}
async function mockListWarrantyPolicies(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockWarrantyPolicies
    .filter((r) => (filters.activeOnly ? _isWarrantyActive(r, filters.asOf) : true))
    .map((r) => ({ ...r }));
}
async function mockGetActiveWarrantyPolicy() {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockWarrantyPolicies.find((r) => _isWarrantyActive(r));
  return row ? { ...row } : null;
}
async function mockGetWarrantyPolicy(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockWarrantyPolicies.find((r) => r.id === id);
  return row ? { ...row } : null;
}
async function mockCreateWarrantyPolicy(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockWarrantyCounter += 1;
  const row = {
    id: `mock-warranty-${_mockWarrantyCounter}`,
    basis: payload.basis || 'REVENUE_PERCENT',
    ratePercent: payload.ratePercent ?? null,
    perUnitAmountKwd: payload.perUnitAmountKwd ?? null,
    plRoleCode: payload.plRoleCode || 'WARRANTY_EXPENSE',
    liabilityRoleCode: payload.liabilityRoleCode || 'WARRANTY_LIABILITY',
    notes: payload.notes ?? null,
    activeFrom: payload.activeFrom || new Date().toISOString().slice(0, 10),
    activeUntil: payload.activeUntil ?? null,
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _mock: true,
  };
  _mockWarrantyPolicies.unshift(row);
  return row;
}
async function mockUpdateWarrantyPolicy(id, patch = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockWarrantyPolicies.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  _mockWarrantyPolicies[idx] = {
    ..._mockWarrantyPolicies[idx],
    notes: patch.notes ?? _mockWarrantyPolicies[idx].notes,
    activeUntil:
      patch.activeUntil !== undefined
        ? patch.activeUntil
        : _mockWarrantyPolicies[idx].activeUntil,
    plRoleCode: patch.plRoleCode ?? _mockWarrantyPolicies[idx].plRoleCode,
    liabilityRoleCode:
      patch.liabilityRoleCode ?? _mockWarrantyPolicies[idx].liabilityRoleCode,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockWarrantyPolicies[idx] };
}
async function mockDeactivateWarrantyPolicy(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockWarrantyPolicies.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  _mockWarrantyPolicies[idx] = {
    ..._mockWarrantyPolicies[idx],
    activeUntil: today,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockWarrantyPolicies[idx] };
}

// ── Bulk reclassifications MOCK stubs (FN-239) ──
let _mockReclassCounter = 0;
const _mockReclassifications = [];
async function mockListBulkReclassifications(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockReclassifications
    .filter((p) => !filters.status || p.status === filters.status)
    .map((p) => ({ ...p, lines: p.lines ? p.lines.map((l) => ({ ...l })) : undefined }));
}
async function mockGetBulkReclassification(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockReclassifications.find((p) => p.id === id);
  return row
    ? { ...row, lines: row.lines ? row.lines.map((l) => ({ ...l })) : undefined }
    : null;
}
async function mockCreateBulkReclassification(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockReclassCounter += 1;
  const row = {
    id: `mock-reclass-${_mockReclassCounter}`,
    description: payload.description || '',
    fromAccountId: payload.fromAccountId || '',
    toAccountId: payload.toAccountId || '',
    dateFrom: payload.dateFrom ?? null,
    dateTo: payload.dateTo ?? null,
    descriptionContains: payload.descriptionContains ?? null,
    notes: payload.notes ?? null,
    status: 'DRAFT',
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lines: [],
    _mock: true,
  };
  _mockReclassifications.unshift(row);
  return { ...row, lines: [] };
}
async function mockPreviewBulkReclassification(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockReclassifications.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  // MOCK: fabricate 3 plausible preview lines totalling 1500 KWD debit.
  const lines = [
    {
      id: `mock-reclass-line-${id}-1`,
      reclassificationId: id,
      originJournalEntryLineId: 'mock-jel-1',
      originJournalEntryId: 'mock-je-1',
      originDate: new Date().toISOString().slice(0, 10),
      originDescription: 'Mock JE line 1',
      debit: '600.000',
      credit: '0.000',
    },
    {
      id: `mock-reclass-line-${id}-2`,
      reclassificationId: id,
      originJournalEntryLineId: 'mock-jel-2',
      originJournalEntryId: 'mock-je-2',
      originDate: new Date().toISOString().slice(0, 10),
      originDescription: 'Mock JE line 2',
      debit: '500.000',
      credit: '0.000',
    },
    {
      id: `mock-reclass-line-${id}-3`,
      reclassificationId: id,
      originJournalEntryLineId: 'mock-jel-3',
      originJournalEntryId: 'mock-je-3',
      originDate: new Date().toISOString().slice(0, 10),
      originDescription: 'Mock JE line 3',
      debit: '400.000',
      credit: '0.000',
    },
  ];
  _mockReclassifications[idx] = {
    ..._mockReclassifications[idx],
    status: 'PREVIEWED',
    lines,
    updatedAt: new Date().toISOString(),
  };
  return {
    ..._mockReclassifications[idx],
    lines: lines.map((l) => ({ ...l })),
  };
}
async function mockApproveBulkReclassification(id) {
  await new Promise((r) => setTimeout(r, 80));
  const idx = _mockReclassifications.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  if (_mockReclassifications[idx].status !== 'PREVIEWED') return null;
  _mockReclassifications[idx] = {
    ..._mockReclassifications[idx],
    status: 'APPROVED',
    updatedAt: new Date().toISOString(),
  };
  return {
    ..._mockReclassifications[idx],
    lines: _mockReclassifications[idx].lines
      ? _mockReclassifications[idx].lines.map((l) => ({ ...l }))
      : undefined,
  };
}
async function mockCancelBulkReclassification(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockReclassifications.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  if (
    _mockReclassifications[idx].status !== 'DRAFT' &&
    _mockReclassifications[idx].status !== 'PREVIEWED'
  ) {
    return null;
  }
  _mockReclassifications[idx] = {
    ..._mockReclassifications[idx],
    status: 'CANCELLED',
    updatedAt: new Date().toISOString(),
  };
  return {
    ..._mockReclassifications[idx],
    lines: _mockReclassifications[idx].lines
      ? _mockReclassifications[idx].lines.map((l) => ({ ...l }))
      : undefined,
  };
}
async function mockGetBulkReclassificationJeShape(id) {
  await new Promise((r) => setTimeout(r, 40));
  const row = _mockReclassifications.find((p) => p.id === id);
  if (!row) return null;
  if (row.status !== 'APPROVED' && row.status !== 'POSTED') return null;
  const totalDebit = (row.lines || []).reduce(
    (a, l) => a + Number(l.debit || 0),
    0,
  );
  const totalCredit = (row.lines || []).reduce(
    (a, l) => a + Number(l.credit || 0),
    0,
  );
  const net = totalDebit - totalCredit;
  const abs = Math.abs(net);
  const fromSide = net >= 0 ? 'CREDIT' : 'DEBIT';
  const toSide = net >= 0 ? 'DEBIT' : 'CREDIT';
  return {
    reclassificationId: id,
    fromAccountId: row.fromAccountId,
    toAccountId: row.toAccountId,
    totalMovedKwd: abs.toFixed(3),
    legs:
      abs === 0
        ? []
        : [
            {
              accountId: row.fromAccountId,
              side: fromSide,
              amountKwd: abs.toFixed(3),
              description: `Reclassify OUT: ${row.description}`,
            },
            {
              accountId: row.toAccountId,
              side: toSide,
              amountKwd: abs.toFixed(3),
              description: `Reclassify IN: ${row.description}`,
            },
          ],
    note:
      abs === 0
        ? 'net amount is zero — no JE required'
        : `${(row.lines || []).length} line(s) aggregated`,
  };
}

// ── Related-party MOCK stubs (FN-254) ──
let _mockRpCounter = 0;
const _mockRelatedParties = [];
function _isRpActive(r, asOfIso) {
  const asOf = new Date(asOfIso || new Date().toISOString().slice(0, 10));
  const from = new Date(r.activeFrom);
  if (asOf < from) return false;
  if (r.activeUntil) {
    const until = new Date(r.activeUntil);
    if (asOf > until) return false;
  }
  return true;
}
async function mockListRelatedParties(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockRelatedParties
    .filter((r) => {
      if (filters.counterpartyType && r.counterpartyType !== filters.counterpartyType) return false;
      if (filters.natureOfRelationship && r.natureOfRelationship !== filters.natureOfRelationship) return false;
      if (filters.activeOnly && !_isRpActive(r, filters.asOf)) return false;
      return true;
    })
    .map((r) => ({ ...r }));
}
async function mockGetRelatedParty(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockRelatedParties.find((r) => r.id === id);
  return row ? { ...row } : null;
}
async function mockCreateRelatedParty(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockRpCounter += 1;
  const row = {
    id: `mock-rp-${_mockRpCounter}`,
    counterpartyType: payload.counterpartyType || 'VENDOR',
    counterpartyVendorId: payload.counterpartyVendorId ?? null,
    counterpartyCustomerId: payload.counterpartyCustomerId ?? null,
    natureOfRelationship: payload.natureOfRelationship || 'OTHER',
    disclosureNote: payload.disclosureNote ?? null,
    activeFrom: payload.activeFrom || new Date().toISOString().slice(0, 10),
    activeUntil: payload.activeUntil ?? null,
    notes: payload.notes ?? null,
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _mock: true,
  };
  _mockRelatedParties.unshift(row);
  return row;
}
async function mockUpdateRelatedParty(id, patch = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockRelatedParties.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  _mockRelatedParties[idx] = {
    ..._mockRelatedParties[idx],
    natureOfRelationship:
      patch.natureOfRelationship ?? _mockRelatedParties[idx].natureOfRelationship,
    disclosureNote: patch.disclosureNote ?? _mockRelatedParties[idx].disclosureNote,
    activeUntil:
      patch.activeUntil !== undefined
        ? patch.activeUntil
        : _mockRelatedParties[idx].activeUntil,
    notes: patch.notes ?? _mockRelatedParties[idx].notes,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockRelatedParties[idx] };
}
async function mockDeactivateRelatedParty(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockRelatedParties.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  _mockRelatedParties[idx] = {
    ..._mockRelatedParties[idx],
    activeUntil: today,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockRelatedParties[idx] };
}
async function mockGetRelatedPartyReport(query = {}) {
  await new Promise((r) => setTimeout(r, 60));
  return {
    periodFrom: query.periodFrom || new Date().toISOString().slice(0, 10),
    periodTo: query.periodTo || new Date().toISOString().slice(0, 10),
    rows: [],
    totals: {
      purchasesKwd: '0.000',
      purchasePaymentsKwd: '0.000',
      salesKwd: '0.000',
      salesReceiptsKwd: '0.000',
      transactionCount: 0,
    },
  };
}

// ── Cost allocation MOCK stubs (FN-243) ──
let _mockAllocCounter = 0;
const _mockAllocRules = [];
function _isAllocActive(r, asOfIso) {
  const asOf = new Date(asOfIso || new Date().toISOString().slice(0, 10));
  const from = new Date(r.activeFrom);
  if (asOf < from) return false;
  if (r.activeUntil) {
    const until = new Date(r.activeUntil);
    if (asOf > until) return false;
  }
  return true;
}
async function mockListCostAllocationRules(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockAllocRules
    .filter((r) => {
      if (filters.activeOnly && !_isAllocActive(r, filters.asOf)) return false;
      if (filters.sourceAccountId && r.sourceAccountId !== filters.sourceAccountId) return false;
      return true;
    })
    .map((r) => ({ ...r, targets: r.targets.map((t) => ({ ...t })) }));
}
async function mockGetCostAllocationRule(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockAllocRules.find((r) => r.id === id);
  return row
    ? { ...row, targets: row.targets.map((t) => ({ ...t })) }
    : null;
}
async function mockCreateCostAllocationRule(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockAllocCounter += 1;
  const row = {
    id: `mock-alloc-${_mockAllocCounter}`,
    name: payload.name || `Rule ${_mockAllocCounter}`,
    description: payload.description ?? null,
    sourceAccountId: payload.sourceAccountId || '',
    driverType: payload.driverType || 'CUSTOM',
    targets: (payload.targets || []).map((t) => ({
      costCenterLabel: t.costCenterLabel,
      weight: String(t.weight),
    })),
    activeFrom: payload.activeFrom || new Date().toISOString().slice(0, 10),
    activeUntil: payload.activeUntil ?? null,
    notes: payload.notes ?? null,
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _mock: true,
  };
  _mockAllocRules.unshift(row);
  return { ...row, targets: row.targets.map((t) => ({ ...t })) };
}
async function mockDeactivateCostAllocationRule(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockAllocRules.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  _mockAllocRules[idx] = {
    ..._mockAllocRules[idx],
    activeUntil: today,
    updatedAt: new Date().toISOString(),
  };
  return {
    ..._mockAllocRules[idx],
    targets: _mockAllocRules[idx].targets.map((t) => ({ ...t })),
  };
}
async function mockComputeCostAllocation(id, body = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const rule = _mockAllocRules.find((r) => r.id === id);
  if (!rule) return null;
  // MOCK: pretend the source balance is 1000 KWD over the period.
  const sourceBalance = 1000;
  const totalWeight = rule.targets.reduce(
    (a, t) => a + Number(t.weight),
    0,
  );
  let residual = sourceBalance;
  const rows = rule.targets.map((t, i) => {
    const pct = totalWeight > 0 ? (Number(t.weight) / totalWeight) * 100 : 0;
    const amt =
      i === rule.targets.length - 1
        ? Number(residual.toFixed(3))
        : Number(((sourceBalance * Number(t.weight)) / (totalWeight || 1)).toFixed(3));
    if (i < rule.targets.length - 1) residual -= amt;
    return {
      costCenterLabel: t.costCenterLabel,
      weight: String(t.weight),
      weightPercent: pct.toFixed(4),
      amountKwd: amt.toFixed(3),
    };
  });
  const actualTotal = rows.reduce((a, r) => a + Number(r.amountKwd), 0);
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    periodFrom: body.periodFrom || new Date().toISOString().slice(0, 10),
    periodTo: body.periodTo || new Date().toISOString().slice(0, 10),
    sourceAccountId: rule.sourceAccountId,
    sourcePeriodBalanceKwd: sourceBalance.toFixed(3),
    totalWeight: totalWeight.toFixed(3),
    rows,
    roundingResidualKwd: (sourceBalance - actualTotal).toFixed(3),
    note: 'mock: source balance stubbed at 1000 KWD for preview',
  };
}

// ── Petty cash MOCK stubs (FN-275) ──
let _mockBoxCounter = 0;
let _mockPcTxCounter = 0;
const _mockBoxes = [];
const _mockPcTx = [];
async function mockListPettyCashBoxes() {
  await new Promise((r) => setTimeout(r, 40));
  return _mockBoxes.map((b) => ({ ...b }));
}
async function mockGetPettyCashBox(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockBoxes.find((b) => b.id === id);
  return row ? { ...row } : null;
}
async function mockCreatePettyCashBox(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockBoxCounter += 1;
  const row = {
    id: `mock-pc-box-${_mockBoxCounter}`,
    label: payload.label || 'Mock box',
    imprestAmountKwd: payload.imprestAmountKwd || '0.000',
    currentBalanceKwd: payload.imprestAmountKwd || '0.000',
    custodianUserId: payload.custodianUserId ?? null,
    isActive: true,
    notes: payload.notes ?? null,
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _mock: true,
  };
  _mockBoxes.unshift(row);
  return row;
}
async function mockDeactivatePettyCashBox(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockBoxes.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  _mockBoxes[idx] = {
    ..._mockBoxes[idx],
    isActive: false,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockBoxes[idx] };
}
async function mockRecordPettyCashTx(boxId, payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockPcTxCounter += 1;
  const amt = Number(payload.amountKwd || 0);
  const boxIdx = _mockBoxes.findIndex((b) => b.id === boxId);
  if (boxIdx >= 0) {
    const cur = Number(_mockBoxes[boxIdx].currentBalanceKwd || 0);
    const next =
      payload.type === 'EXPENSE'
        ? cur - amt
        : payload.type === 'REPLENISH'
        ? cur + amt
        : cur + amt; // ADJUSTMENT: signed externally; mock treats as add
    _mockBoxes[boxIdx] = {
      ..._mockBoxes[boxIdx],
      currentBalanceKwd: next.toFixed(3),
      updatedAt: new Date().toISOString(),
    };
  }
  const tx = {
    id: `mock-pc-tx-${_mockPcTxCounter}`,
    boxId,
    txDate: payload.txDate || new Date().toISOString().slice(0, 10),
    type: payload.type || 'EXPENSE',
    amountKwd: payload.amountKwd || '0.000',
    description: payload.description || '',
    receiptRef: payload.receiptRef ?? null,
    expenseAccountId: payload.expenseAccountId ?? null,
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    _mock: true,
  };
  _mockPcTx.unshift(tx);
  return tx;
}
async function mockListPettyCashTransactions(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockPcTx
    .filter((t) => {
      if (filters.boxId && t.boxId !== filters.boxId) return false;
      if (filters.type && t.type !== filters.type) return false;
      if (filters.dateFrom && t.txDate < filters.dateFrom) return false;
      if (filters.dateTo && t.txDate > filters.dateTo) return false;
      return true;
    })
    .map((t) => ({ ...t }));
}
async function mockReconcilePettyCashBox(id) {
  await new Promise((r) => setTimeout(r, 40));
  const box = _mockBoxes.find((b) => b.id === id);
  if (!box) return null;
  const imprest = Number(box.imprestAmountKwd);
  const current = Number(box.currentBalanceKwd);
  const lastReplenishIdx = _mockPcTx.findIndex(
    (t) => t.boxId === id && t.type === 'REPLENISH',
  );
  const expenses = _mockPcTx.filter(
    (t, i) =>
      t.boxId === id &&
      t.type === 'EXPENSE' &&
      (lastReplenishIdx < 0 || i < lastReplenishIdx),
  );
  const receipts = expenses.reduce(
    (a, t) => a + Number(t.amountKwd),
    0,
  );
  const shortfall = imprest - current;
  const countedVsImprest = current + receipts - imprest;
  const replenishRec = imprest - current;
  return {
    boxId: id,
    imprestAmountKwd: imprest.toFixed(3),
    currentBalanceKwd: current.toFixed(3),
    receiptsHeldKwd: receipts.toFixed(3),
    shortfallKwd: shortfall.toFixed(3),
    countedVsImprestKwd: countedVsImprest.toFixed(3),
    replenishRecommendedKwd: replenishRec.toFixed(3),
    note:
      Math.abs(countedVsImprest) < 0.001
        ? 'in balance'
        : countedVsImprest > 0
        ? `overage: ${countedVsImprest.toFixed(3)}`
        : `shortage: ${Math.abs(countedVsImprest).toFixed(3)}`,
  };
}

// ── WHT MOCK stubs (FN-250) ──
let _mockWhtConfigCounter = 0;
const _mockWhtConfigs = [];
const _mockWhtCerts = [];
function _isConfigActive(c, asOfIso) {
  const asOf = new Date(asOfIso || new Date().toISOString().slice(0, 10));
  const from = new Date(c.activeFrom);
  if (asOf < from) return false;
  if (c.activeUntil) {
    const until = new Date(c.activeUntil);
    if (asOf > until) return false;
  }
  return true;
}
async function mockListWhtConfigs(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockWhtConfigs
    .filter((c) => (filters.activeOnly ? _isConfigActive(c, filters.asOf) : true))
    .map((c) => ({ ...c }));
}
async function mockGetActiveWhtConfig() {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockWhtConfigs.find((c) => _isConfigActive(c));
  return row ? { ...row } : null;
}
async function mockGetWhtConfig(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockWhtConfigs.find((c) => c.id === id);
  return row ? { ...row } : null;
}
async function mockCreateWhtConfig(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockWhtConfigCounter += 1;
  const row = {
    id: `mock-wht-cfg-${_mockWhtConfigCounter}`,
    rateServicePercent: payload.rateServicePercent ?? null,
    rateProfessionalPercent: payload.rateProfessionalPercent ?? null,
    rateRentalPercent: payload.rateRentalPercent ?? null,
    rateInterestPercent: payload.rateInterestPercent ?? null,
    rateCustomPercent: payload.rateCustomPercent ?? null,
    minThresholdKwd: payload.minThresholdKwd ?? '0.000',
    notes: payload.notes ?? null,
    activeFrom: payload.activeFrom || new Date().toISOString().slice(0, 10),
    activeUntil: payload.activeUntil ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _mock: true,
  };
  _mockWhtConfigs.unshift(row);
  return row;
}
async function mockUpdateWhtConfig(id, patch = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockWhtConfigs.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const next = {
    ..._mockWhtConfigs[idx],
    notes: patch.notes ?? _mockWhtConfigs[idx].notes,
    activeUntil:
      patch.activeUntil !== undefined
        ? patch.activeUntil
        : _mockWhtConfigs[idx].activeUntil,
    updatedAt: new Date().toISOString(),
  };
  _mockWhtConfigs[idx] = next;
  return { ...next };
}
async function mockDeactivateWhtConfig(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockWhtConfigs.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  _mockWhtConfigs[idx] = {
    ..._mockWhtConfigs[idx],
    activeUntil: today,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockWhtConfigs[idx] };
}
async function mockListWhtCertificates(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockWhtCerts
    .filter((c) => {
      if (filters.vendorId && c.vendorId !== filters.vendorId) return false;
      if (filters.category && c.category !== filters.category) return false;
      if (filters.paymentDateFrom && c.paymentDate < filters.paymentDateFrom) return false;
      if (filters.paymentDateTo && c.paymentDate > filters.paymentDateTo) return false;
      return true;
    })
    .slice(0, filters.limit || 500)
    .map((c) => ({ ...c }));
}
async function mockGetWhtCertificate(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockWhtCerts.find((c) => c.id === id);
  return row ? { ...row } : null;
}

// ── CIT Assessment MOCK stubs (FN-249) ──
let _mockCitCounter = 0;
const _mockCitAssessments = [];
function _defaultStatute(fiscalYear) {
  const y = Number(fiscalYear) + 5;
  return `${y}-12-31`;
}
async function mockListCitAssessments(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockCitAssessments
    .filter((c) => {
      if (filters.status && c.status !== filters.status) return false;
      if (filters.fiscalYearFrom != null && c.fiscalYear < filters.fiscalYearFrom) return false;
      if (filters.fiscalYearTo != null && c.fiscalYear > filters.fiscalYearTo) return false;
      if (filters.openOnly && (c.status === 'CLOSED' || c.status === 'STATUTE_EXPIRED')) return false;
      return true;
    })
    .map((c) => ({ ...c }));
}
async function mockGetCitAssessment(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockCitAssessments.find((c) => c.id === id);
  return row ? { ...row } : null;
}
async function mockListApproachingStatute(query = {}) {
  await new Promise((r) => setTimeout(r, 40));
  const asOf = query.asOf ? new Date(query.asOf) : new Date();
  const withinDays = query.withinDays ?? 180;
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() + withinDays);
  return _mockCitAssessments
    .filter((c) => {
      if (c.status === 'CLOSED' || c.status === 'STATUTE_EXPIRED') return false;
      const exp = new Date(c.statuteExpiresOn);
      return exp <= cutoff;
    })
    .map((c) => ({ ...c }));
}
async function mockCreateCitAssessment(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockCitCounter += 1;
  const row = {
    id: `mock-cit-${_mockCitCounter}`,
    fiscalYear: Number(payload.fiscalYear) || new Date().getFullYear() - 1,
    filedAmountKwd: payload.filedAmountKwd || '0.000',
    filedOnDate: payload.filedOnDate || new Date().toISOString().slice(0, 10),
    authorityCaseNumber: payload.authorityCaseNumber ?? null,
    status: 'FILED',
    computationId: payload.computationId ?? null,
    assessedAmountKwd: null,
    assessedOnDate: null,
    varianceKwd: null,
    objectionFiledOn: null,
    finalAmountKwd: null,
    finalizedOnDate: null,
    statuteExpiresOn: payload.statuteExpiresOn || _defaultStatute(payload.fiscalYear),
    notes: payload.notes ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _mock: true,
  };
  _mockCitAssessments.unshift(row);
  return row;
}
async function _mockPatch(id, patch) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockCitAssessments.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  _mockCitAssessments[idx] = {
    ..._mockCitAssessments[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockCitAssessments[idx] };
}
async function mockOpenCitAssessmentReview(id, patch = {}) {
  return _mockPatch(id, {
    status: 'UNDER_REVIEW',
    authorityCaseNumber: patch.authorityCaseNumber ?? null,
  });
}
async function mockRecordCitAssessment(id, patch = {}) {
  const existing = _mockCitAssessments.find((c) => c.id === id);
  const filed = existing ? Number(existing.filedAmountKwd) : 0;
  const assessed = Number(patch.assessedAmountKwd);
  const variance = (assessed - filed).toFixed(3);
  return _mockPatch(id, {
    status: 'ASSESSED',
    assessedAmountKwd: patch.assessedAmountKwd,
    assessedOnDate: patch.assessedOnDate,
    varianceKwd: variance,
    authorityCaseNumber:
      patch.authorityCaseNumber ?? existing?.authorityCaseNumber ?? null,
    notes: patch.notes ?? existing?.notes ?? null,
  });
}
async function mockRecordCitAssessmentObjection(id, patch = {}) {
  return _mockPatch(id, {
    status: 'OBJECTED',
    objectionFiledOn: patch.objectionFiledOn,
    notes: patch.notes ?? null,
  });
}
async function mockFinalizeCitAssessment(id, patch = {}) {
  return _mockPatch(id, {
    status: 'FINAL',
    finalAmountKwd: patch.finalAmountKwd,
    finalizedOnDate: patch.finalizedOnDate,
    notes: patch.notes ?? null,
  });
}
async function mockCloseCitAssessment(id) {
  return _mockPatch(id, { status: 'CLOSED' });
}
async function mockMarkCitAssessmentStatuteExpired(id) {
  return _mockPatch(id, { status: 'STATUTE_EXPIRED' });
}

// ── Tax lodgements MOCK stubs (FN-268) ──
let _mockLodgementCounter = 0;
const _mockLodgements = [];
async function mockListTaxLodgements(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockLodgements
    .filter((l) => {
      if (filters.lodgementType && l.lodgementType !== filters.lodgementType) return false;
      if (filters.status && l.status !== filters.status) return false;
      if (filters.periodFrom && l.periodTo < filters.periodFrom) return false;
      if (filters.periodTo && l.periodFrom > filters.periodTo) return false;
      return true;
    })
    .map((l) => ({ ...l }));
}
async function mockGetTaxLodgement(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockLodgements.find((l) => l.id === id);
  return row ? { ...row } : null;
}
async function mockRecordTaxLodgement(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockLodgementCounter += 1;
  const row = {
    id: `mock-tl-${_mockLodgementCounter}`,
    lodgementType: payload.lodgementType || 'OTHER',
    filingReference: payload.filingReference || '',
    periodFrom: payload.periodFrom || new Date().toISOString().slice(0, 10),
    periodTo: payload.periodTo || new Date().toISOString().slice(0, 10),
    filedOnDate: payload.filedOnDate || new Date().toISOString().slice(0, 10),
    filedAmountKwd: payload.filedAmountKwd || '0.000',
    glAccountRole: payload.glAccountRole ?? null,
    upstreamEntityType: payload.upstreamEntityType ?? null,
    upstreamEntityId: payload.upstreamEntityId ?? null,
    notes: payload.notes ?? null,
    status: 'SUBMITTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _mock: true,
  };
  _mockLodgements.unshift(row);
  return row;
}
async function mockUpdateTaxLodgementStatus(id, patch = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockLodgements.findIndex((l) => l.id === id);
  if (idx < 0) return null;
  _mockLodgements[idx] = {
    ..._mockLodgements[idx],
    status: patch.status || _mockLodgements[idx].status,
    notes: patch.notes ?? _mockLodgements[idx].notes,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockLodgements[idx] };
}
async function mockGetTaxLodgementTieOut(id) {
  await new Promise((r) => setTimeout(r, 40));
  const row = _mockLodgements.find((l) => l.id === id);
  if (!row) return null;
  if (!row.glAccountRole) {
    return {
      lodgementId: row.id,
      lodgementType: row.lodgementType,
      filingReference: row.filingReference,
      periodFrom: row.periodFrom,
      periodTo: row.periodTo,
      filedAmountKwd: row.filedAmountKwd,
      glBalanceKwd: '0.000',
      varianceKwd: row.filedAmountKwd,
      status: 'SKIPPED',
      note: 'no glAccountRole set — tie-out skipped',
    };
  }
  return {
    lodgementId: row.id,
    lodgementType: row.lodgementType,
    filingReference: row.filingReference,
    periodFrom: row.periodFrom,
    periodTo: row.periodTo,
    filedAmountKwd: row.filedAmountKwd,
    glBalanceKwd: row.filedAmountKwd,
    varianceKwd: '0.000',
    status: 'TIE_OK',
    note: 'mock: tie-out stubbed TIE_OK (no GL in MOCK mode)',
  };
}

// ── Disallowance rules MOCK stubs (FN-222) ──
let _mockDisallowanceCounter = 0;
const _mockDisallowanceRules = [];
async function mockListDisallowanceRules(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  const asOf = filters.asOf ? new Date(filters.asOf) : new Date();
  return _mockDisallowanceRules
    .filter((rule) => {
      if (filters.ruleType && rule.ruleType !== filters.ruleType) return false;
      if (filters.activeOnly) {
        const from = new Date(rule.activeFrom);
        const until = rule.activeUntil ? new Date(rule.activeUntil) : null;
        if (asOf < from) return false;
        if (until && asOf > until) return false;
      }
      return true;
    })
    .map((r) => ({ ...r }));
}
async function mockGetDisallowanceRule(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockDisallowanceRules.find((v) => v.id === id);
  return row ? { ...row } : null;
}
async function mockCreateDisallowanceRule(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockDisallowanceCounter += 1;
  const row = {
    id: `mock-dr-${_mockDisallowanceCounter}`,
    name: payload.name || '',
    description: payload.description ?? null,
    ruleType: payload.ruleType || 'CUSTOM',
    disallowedPercent: Number(payload.disallowedPercent ?? 0),
    targetRole: payload.targetRole ?? null,
    targetAccountId: payload.targetAccountId ?? null,
    activeFrom: payload.activeFrom || new Date().toISOString().slice(0, 10),
    activeUntil: payload.activeUntil ?? null,
    notes: payload.notes ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _mock: true,
  };
  _mockDisallowanceRules.unshift(row);
  return row;
}
async function mockUpdateDisallowanceRule(id, patch = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockDisallowanceRules.findIndex((v) => v.id === id);
  if (idx < 0) return null;
  const next = {
    ..._mockDisallowanceRules[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  _mockDisallowanceRules[idx] = next;
  return { ...next };
}
async function mockDeactivateDisallowanceRule(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockDisallowanceRules.findIndex((v) => v.id === id);
  if (idx < 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  _mockDisallowanceRules[idx] = {
    ..._mockDisallowanceRules[idx],
    activeUntil: today,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockDisallowanceRules[idx] };
}

// ── Report versions MOCK stubs (module-scoped so state survives calls) ──
let _mockReportVersionCounter = 0;
const _mockReportVersions = [];
async function mockPublishReportVersion(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockReportVersionCounter += 1;
  const row = {
    id: `mock-rv-${_mockReportVersionCounter}`,
    tenantId: 'mock-tenant',
    reportType: payload.reportType || 'CUSTOM',
    reportKey: payload.reportKey || 'default',
    version: _mockReportVersionCounter,
    snapshotData: payload.snapshotData ?? null,
    asOfDate: payload.asOfDate || null,
    periodFrom: payload.periodFrom || null,
    periodTo: payload.periodTo || null,
    notes: payload.notes || null,
    publishedAt: new Date().toISOString(),
    publishedBy: 'mock-user',
    publishedByName: 'Mock User',
    supersedesId: payload.supersedesId || null,
    supersededAt: null,
    supersededBy: null,
    createdAt: new Date().toISOString(),
    _mock: true,
  };
  if (payload.supersedesId) {
    const prior = _mockReportVersions.find((v) => v.id === payload.supersedesId);
    if (prior) {
      prior.supersededAt = row.publishedAt;
      prior.supersededBy = row.id;
    }
  }
  _mockReportVersions.unshift(row);
  return row;
}
async function mockListReportVersions(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  let list = _mockReportVersions.filter((v) => {
    if (filters.reportType && v.reportType !== filters.reportType) return false;
    if (filters.reportKey && v.reportKey !== filters.reportKey) return false;
    if (filters.currentOnly && v.supersededAt) return false;
    return true;
  });
  if (filters.limit) list = list.slice(0, filters.limit);
  return list.map((v) => ({ ...v }));
}
async function mockGetReportVersion(id) {
  await new Promise((r) => setTimeout(r, 40));
  const row = _mockReportVersions.find((v) => v.id === id);
  return row ? { ...row } : null;
}

/**
 * Mock health fallback for when mockEngine itself does not export one.
 */
async function mockHealth() {
  return { ok: true, status: { status: 'ok', service: 'mock-engine', version: 'mock' } };
}

const surface = useMocks
  ? {
      ...mockEngine,
      getHealth: mockEngine.getHealth || mockHealth,
      ...buildMockExtras(),
    }
  : buildLiveSurface();

// Default export: the full namespace-like object.
export default surface;

// Named exports — every function on the surface, so screens can
// `import { getIncomeStatement } from '../../engine'` and the router
// picks the right impl for MOCK vs LIVE.
export const getHealth = surface.getHealth;

// Chat
export const sendChatMessage = surface.sendChatMessage;
export const confirmPendingAction = surface.confirmPendingAction;
export const listConversations = surface.listConversations;
export const getConversation = surface.getConversation;
export const getConversationMessages = surface.getConversationMessages;
export const runAminahSession = surface.runAminahSession;

// Journal entries — reads
export const listJournalEntries = surface.listJournalEntries;
export const getJournalEntry = surface.getJournalEntry;
export const getManualJEs = surface.getManualJEs;
export const getManualJEById = surface.getManualJEById;
// Journal entries — Wave 3 writes
export const createJournalEntry = surface.createJournalEntry;
export const updateJournalEntryDraft = surface.updateJournalEntryDraft;
export const postJournalEntry = surface.postJournalEntry;
export const reverseJournalEntry = surface.reverseJournalEntry;
export const voidJournalEntry = surface.voidJournalEntry;

// Accounts
export const getAccountsTree = surface.getAccountsTree;
export const getAccountsFlat = surface.getAccountsFlat;
export const getSetupChartOfAccounts = surface.getSetupChartOfAccounts;

// Reports
export const getTrialBalance = surface.getTrialBalance;
export const getIncomeStatement = surface.getIncomeStatement;
export const getBalanceSheet = surface.getBalanceSheet;
export const getCashFlowStatement = surface.getCashFlowStatement;

// Settings
export const getTenantInfo = surface.getTenantInfo;
export const getCurrentUser = surface.getCurrentUser;
export const getUserProfile = surface.getUserProfile;
export const listMembers = surface.listMembers;
export const changePassword = surface.changePassword;

// Aminah advisor-pending (Wave 6B.3 Layer 3)
export const listAdvisorPending = surface.listAdvisorPending;
export const deferAdvisorPending = surface.deferAdvisorPending;
export const dismissAdvisorPending = surface.dismissAdvisorPending;
export const acknowledgeAdvisorPending = surface.acknowledgeAdvisorPending;

// Report versions (FN-244, Phase 4 Wave 1)
export const publishReportVersion = surface.publishReportVersion;
export const listReportVersions = surface.listReportVersions;
export const getReportVersion = surface.getReportVersion;

// Data inalterability composite (FN-226, Phase 4 Wave 1 Item 2)
export const getDataInalterabilityReport = surface.getDataInalterabilityReport;

// Monthly close checklist (FN-227, Phase 4 Wave 1 Item 3). All 9 functions
// are on mockEngine's namespace (see FN-227 block near the bottom of
// mockEngine.js) and wired to the real API via FUNCTION_ROUTING +
// REAL_IMPLS above, so the `...mockEngine` / buildLiveSurface pipelines
// route to the right impl in either mode.
export const createTemplateItem = surface.createTemplateItem;
export const updateTemplateItem = surface.updateTemplateItem;
export const listTemplateItems = surface.listTemplateItems;
export const openInstance = surface.openInstance;
export const listInstances = surface.listInstances;
export const getInstance = surface.getInstance;
export const markItemStatus = surface.markItemStatus;
export const signOffInstance = surface.signOffInstance;
export const reopenInstance = surface.reopenInstance;

// Aging reports (Phase 4 Wave 1 Track B first wire — 2026-04-19).
// See memory-bank/2026-04-19-phase4-breakdown.md §B-Tier 2.
export const getAgingReport = surface.getAgingReport;
export const getInvoiceDetail = surface.getInvoiceDetail;
export const getChartOfAccounts = surface.getChartOfAccounts;
export const logPayment = surface.logPayment;

// Aging reports — still-mock surface (PHASE-4-BLOCKED-ON-BACKEND).
// Re-exported from the engine namespace so the modals can uniformly
// import from '../../engine' instead of mixing engine and mockEngine
// imports. In LIVE mode these fall through to the mock-fallback
// wrapper; in MOCK mode they behave identically to before.
export const sendAgingReminder = surface.sendAgingReminder;
export const markInvoiceDisputed = surface.markInvoiceDisputed;
export const scheduleVendorPayment = surface.scheduleVendorPayment;
// createWriteOffJE — demoted from wired in favour of mock_fallback;
// semantic mismatch with credit-note path (see FUNCTION_ROUTING block
// above + HASEEB-068/069).
export const createWriteOffJE = surface.createWriteOffJE;

// Disallowance rules (FN-222, Phase 4 Track A Wave 2 — 2026-04-19).
// Kuwait CIT disallowance-rule register. OWNER-only mutations; reads
// open to OWNER/ACCOUNTANT/VIEWER/AUDITOR. See src/api/disallowance-rules.js
// and memory-bank/2026-04-19-phase4-breakdown.md row 3.
export const listDisallowanceRules = surface.listDisallowanceRules;
export const getDisallowanceRule = surface.getDisallowanceRule;
export const createDisallowanceRule = surface.createDisallowanceRule;
export const updateDisallowanceRule = surface.updateDisallowanceRule;
export const deactivateDisallowanceRule = surface.deactivateDisallowanceRule;

// Tax lodgements (FN-268, Phase 4 Track A Wave 2 — 2026-04-19).
// Generic TaxLodgement register (CIT/WHT/VAT/KFAS/NLST/Zakat/OTHER)
// with GL tie-out endpoint. OWNER writes; OWNER/ACCOUNTANT/VIEWER/AUDITOR
// reads; VIEWER excluded from tie-out (reveals GL balances).
export const listTaxLodgements = surface.listTaxLodgements;
export const getTaxLodgement = surface.getTaxLodgement;
export const recordTaxLodgement = surface.recordTaxLodgement;
export const updateTaxLodgementStatus = surface.updateTaxLodgementStatus;
export const getTaxLodgementTieOut = surface.getTaxLodgementTieOut;

// CIT Assessment (FN-249, Phase 4 Track A Wave 2 — 2026-04-19).
// Per-fiscal-year Kuwait corporate income-tax case tracker with state
// machine FILED → UNDER_REVIEW → ASSESSED → (OBJECTED →) FINAL →
// CLOSED; STATUTE_EXPIRED terminal from any non-terminal state.
// Memo-only — no JE posting in this partial.
export const listCitAssessments = surface.listCitAssessments;
export const getCitAssessment = surface.getCitAssessment;
export const listApproachingStatute = surface.listApproachingStatute;
export const createCitAssessment = surface.createCitAssessment;
export const openCitAssessmentReview = surface.openCitAssessmentReview;
export const recordCitAssessment = surface.recordCitAssessment;
export const recordCitAssessmentObjection = surface.recordCitAssessmentObjection;
export const finalizeCitAssessment = surface.finalizeCitAssessment;
export const closeCitAssessment = surface.closeCitAssessment;
export const markCitAssessmentStatuteExpired = surface.markCitAssessmentStatuteExpired;

// WHT (FN-250, Phase 4 Track A Wave 2 — 2026-04-19).
// Per-tenant withholding-tax policy (effective-dated basis-point rates
// per category + minimum-threshold) + certificate read-only register.
// Certificate creation is service-layer only via a future AP-flow
// splice; no HTTP endpoint is exposed.
export const listWhtConfigs = surface.listWhtConfigs;
export const getActiveWhtConfig = surface.getActiveWhtConfig;
export const getWhtConfig = surface.getWhtConfig;
export const createWhtConfig = surface.createWhtConfig;
export const updateWhtConfig = surface.updateWhtConfig;
export const deactivateWhtConfig = surface.deactivateWhtConfig;
export const listWhtCertificates = surface.listWhtCertificates;
export const getWhtCertificate = surface.getWhtCertificate;

// Petty cash (FN-275, Phase 4 Track A Tier 3 — 2026-04-19).
// Multi-box imprest register + transaction ledger + reconciliation.
// OWNER-only box CRUD; OWNER/ACCOUNTANT on recordTx; reads open to
// OWNER/ACCOUNTANT/AUDITOR.
export const listPettyCashBoxes = surface.listPettyCashBoxes;
export const getPettyCashBox = surface.getPettyCashBox;
export const createPettyCashBox = surface.createPettyCashBox;
export const deactivatePettyCashBox = surface.deactivatePettyCashBox;
export const recordPettyCashTx = surface.recordPettyCashTx;
export const listPettyCashTransactions = surface.listPettyCashTransactions;
export const reconcilePettyCashBox = surface.reconcilePettyCashBox;

// Cost allocation (FN-243, Phase 4 Track A Tier 3 — 2026-04-19).
// Shared-overhead allocation rules with soft-label cost centers and
// normalized-weight compute. Memo-only; no JE posting in this partial.
export const listCostAllocationRules = surface.listCostAllocationRules;
export const getCostAllocationRule = surface.getCostAllocationRule;
export const createCostAllocationRule = surface.createCostAllocationRule;
export const deactivateCostAllocationRule = surface.deactivateCostAllocationRule;
export const computeCostAllocation = surface.computeCostAllocation;

// Related-party register + IAS 24 report (FN-254, Phase 4 Track A Tier 3
// — 2026-04-19). OWNER writes; OWNER/ACCOUNTANT/AUDITOR reads + report.
// Memo-only; no JE posting. Includes two helper listers for the modal's
// vendor/customer pickers so the modal doesn't need to import other
// API modules directly.
export const listRelatedParties = surface.listRelatedParties;
export const getRelatedParty = surface.getRelatedParty;
export const createRelatedParty = surface.createRelatedParty;
export const updateRelatedParty = surface.updateRelatedParty;
export const deactivateRelatedParty = surface.deactivateRelatedParty;
export const getRelatedPartyReport = surface.getRelatedPartyReport;
export const listVendorsForRelatedParty = surface.listVendorsForRelatedParty;
export const listCustomersForRelatedParty = surface.listCustomersForRelatedParty;

// Bulk reclassifications (FN-239, Phase 4 Track A Tier 3 — 2026-04-19).
// Proposal → Preview → Approve lifecycle. Per Sarah's audit-trail model,
// approval captures the line set and queues a future RECLASSIFICATION
// JE (posting ships in a follow-up backend dispatch). jeShape surfaces
// what the posting JE will look like for APPROVED / POSTED rows.
export const listBulkReclassifications = surface.listBulkReclassifications;
export const getBulkReclassification = surface.getBulkReclassification;
export const createBulkReclassification = surface.createBulkReclassification;
export const previewBulkReclassification = surface.previewBulkReclassification;
export const approveBulkReclassification = surface.approveBulkReclassification;
export const cancelBulkReclassification = surface.cancelBulkReclassification;
export const getBulkReclassificationJeShape = surface.getBulkReclassificationJeShape;

// Migration audit trail (FN-245, Phase 4 Track A Tier 5 — 2026-04-19).
// Read-only infrastructure trail. OWNER + AUDITOR only. Reads the
// append-only MigrationAudit register + computes per-row schema-hash
// chain-integrity (feeds FN-226 Data Inalterability Panel).
export const listMigrationAudits = surface.listMigrationAudits;
export const getMigrationSchemaChain = surface.getMigrationSchemaChain;
export const getMigrationAudit = surface.getMigrationAudit;

// Warranty provision policy (FN-256, Phase 4 Track A Tier 5 — 2026-04-19).
// Per-tenant effective-dated warranty-accrual policy. Two basis modes:
// REVENUE_PERCENT (bps of revenue) + PER_UNIT (KWD/unit). Consumed by
// a future period-end accrual runner (ships separately).
export const listWarrantyPolicies = surface.listWarrantyPolicies;
export const getActiveWarrantyPolicy = surface.getActiveWarrantyPolicy;
export const getWarrantyPolicy = surface.getWarrantyPolicy;
export const createWarrantyPolicy = surface.createWarrantyPolicy;
export const updateWarrantyPolicy = surface.updateWarrantyPolicy;
export const deactivateWarrantyPolicy = surface.deactivateWarrantyPolicy;

// Bank formats (FN-246, Phase 4 Track A Tier 5 — 2026-04-19).
// Per-bank statement-parsing format registry. Effective-dated specs.
// Consumed by the statement-upload parser pipeline.
export const listBankFormats = surface.listBankFormats;
export const getActiveBankFormat = surface.getActiveBankFormat;
export const getBankFormat = surface.getBankFormat;
export const createBankFormat = surface.createBankFormat;
export const updateBankFormat = surface.updateBankFormat;
export const deactivateBankFormat = surface.deactivateBankFormat;
