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
import * as leaveProvisionApi from '../api/leave-provision';
import * as cbkRatesApi from '../api/cbk-rates';
import * as boardPackApi from '../api/board-pack';
import * as ocrGatingApi from '../api/ocr-gating';
import * as inventoryCountApi from '../api/inventory-count';
import * as spinoffApi from '../api/spinoff';
import * as islamicFinanceApi from '../api/islamic-finance';
import * as purchaseOrdersApi from '../api/purchase-orders';
import * as tenantFlagsApi from '../api/tenant-flags';
import * as inventoryNrvApi from '../api/inventory-nrv';
import * as cfoTodayApi from '../api/cfo-today';
import * as rulesApi from '../api/rules';
import * as adminIntegrationsApi from '../api/admin-integrations';
import * as adminAuditLogApi from '../api/admin-audit-log';
import * as bankAccountsApi from '../api/bank-accounts';
import * as reconciliationApi from '../api/reconciliation';
import * as budgetsApi from '../api/budgets';
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

  // CFO TodayScreen composite reads (Track B Dispatch 3a+3b, 2026-04-20).
  // Four endpoints under /api/cfo/* + rule-suggestions under /api/rules.
  // All four cfo-today hooks are open to every authenticated role on the
  // backend; rules.suggestions is OWNER + ACCOUNTANT only (handled at
  // the endpoint — 403 silently-degrades in the frontend).
  getCFOTodayQueue: 'wired',
  getCloseStatus: 'wired',
  getCFOAminahNotes: 'wired',
  getTeamActivity: 'wired',
  getEngineStatus: 'wired',
  getSuggestedCategorizationRules: 'wired',
  getSuggestedRoutingRules: 'wired',

  // Settings — personal surface (Track B Dispatch 2 wire 3, 2026-04-20).
  // getMyActivity is an extras name (not on mockEngine). The other seven
  // collide with mockEngine names; buildMockExtras overrides the MOCK
  // impls to match the live no-role-arg shape.
  getNotificationPreferences: 'wired',
  updateNotificationPreferences: 'wired',
  getActiveSessions: 'wired',
  signOutSession: 'wired',
  signOutAllOtherSessions: 'wired',
  getTwoFactorStatus: 'wired',
  disableTwoFactor: 'wired',
  getMyActivity: 'wired',

  // Banking — bank accounts surface (Track B Dispatch 4 wire 4, 2026-04-20).
  // listBankAccounts / getBankAccountStatement are "extras" names NOT on
  // mockEngine's namespace — they are wired via buildLiveSurface direct
  // assignment + buildMockExtras MOCK adapters below (and MUST be named-
  // exported from this module for screens to consume). getBankAccountSummary
  // collides with a mockEngine function of the same name; buildMockExtras
  // overrides it so the UI's { range, from, to } options shape works in
  // both MOCK and LIVE modes (mock took a single `period` positional).
  getBankAccountSummary: 'wired',
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

  // Leave provision (FN-255, Phase 4 Track A Tier 5 — 2026-04-19).
  listLeavePolicies: leaveProvisionApi.listLeavePolicies,
  getActiveLeavePolicy: leaveProvisionApi.getActiveLeavePolicy,
  createLeavePolicy: leaveProvisionApi.createLeavePolicy,
  updateLeavePolicy: leaveProvisionApi.updateLeavePolicy,
  listLeaveBalances: leaveProvisionApi.listLeaveBalances,
  getLeaveBalance: leaveProvisionApi.getLeaveBalance,
  upsertLeaveBalance: leaveProvisionApi.upsertLeaveBalance,
  getLeaveProvisionSummary: leaveProvisionApi.getLeaveProvisionSummary,
  getLeaveProvisionForEmployee: leaveProvisionApi.getLeaveProvisionForEmployee,

  // CBK rates (FN-238, Phase 4 Track A Tier 5 — 2026-04-19).
  listCbkRates: cbkRatesApi.listCbkRates,
  getCbkRate: cbkRatesApi.getCbkRate,
  lookupCbkRateForDate: cbkRatesApi.lookupCbkRateForDate,
  lookupLatestCbkRate: cbkRatesApi.lookupLatestCbkRate,
  getCbkRateStaleness: cbkRatesApi.getCbkRateStaleness,
  upsertCbkRate: cbkRatesApi.upsertCbkRate,
  deleteCbkRate: cbkRatesApi.deleteCbkRate,

  // Board pack (FN-258, Phase 4 Track A Tier 5 — 2026-04-19).
  getBoardPack: boardPackApi.getBoardPack,

  // OCR gating (FN-224, Phase 4 Track A Tier 5 — 2026-04-19).
  listOcrExtractions: ocrGatingApi.listOcrExtractions,
  getOcrExtraction: ocrGatingApi.getOcrExtraction,
  recordOcrExtraction: ocrGatingApi.recordOcrExtraction,
  correctOcrField: ocrGatingApi.correctOcrField,
  approveOcrExtraction: ocrGatingApi.approveOcrExtraction,
  rejectOcrExtraction: ocrGatingApi.rejectOcrExtraction,

  // Inventory count (FN-263, Phase 4 Track A Tier 4 — 2026-04-19).
  listInventoryCounts: inventoryCountApi.listInventoryCounts,
  getInventoryCount: inventoryCountApi.getInventoryCount,
  createInventoryCount: inventoryCountApi.createInventoryCount,
  snapshotInventoryCount: inventoryCountApi.snapshotInventoryCount,
  recordInventoryCountLine: inventoryCountApi.recordInventoryCountLine,
  reconcileInventoryCount: inventoryCountApi.reconcileInventoryCount,
  cancelInventoryCount: inventoryCountApi.cancelInventoryCount,
  getInventoryCountVarianceJeShape: inventoryCountApi.getInventoryCountVarianceJeShape,

  // Spinoff (FN-242, Phase 4 Track A Tier 4 — 2026-04-19).
  listSpinoffEvents: spinoffApi.listSpinoffEvents,
  getSpinoffEvent: spinoffApi.getSpinoffEvent,
  createSpinoffEvent: spinoffApi.createSpinoffEvent,
  addSpinoffTransfer: spinoffApi.addSpinoffTransfer,
  removeSpinoffTransfer: spinoffApi.removeSpinoffTransfer,
  validateSpinoffEvent: spinoffApi.validateSpinoffEvent,
  approveSpinoffEvent: spinoffApi.approveSpinoffEvent,
  cancelSpinoffEvent: spinoffApi.cancelSpinoffEvent,
  getSpinoffBalanceCheck: spinoffApi.getSpinoffBalanceCheck,

  // Islamic Finance (FN-247, Phase 4 Track A Tier 4 — 2026-04-19).
  listIslamicArrangements: islamicFinanceApi.listIslamicArrangements,
  getIslamicArrangement: islamicFinanceApi.getIslamicArrangement,
  createIslamicArrangement: islamicFinanceApi.createIslamicArrangement,
  transitionIslamicStatus: islamicFinanceApi.transitionIslamicStatus,
  generateIslamicSchedule: islamicFinanceApi.generateIslamicSchedule,
  markIslamicInstallmentPaid: islamicFinanceApi.markIslamicInstallmentPaid,
  getIslamicPosition: islamicFinanceApi.getIslamicPosition,

  // Purchase Orders + Goods Receipts + 3-way match (FN-217+218, Phase 4 Tier 4).
  listPurchaseOrders: purchaseOrdersApi.listPurchaseOrders,
  getPurchaseOrder: purchaseOrdersApi.getPurchaseOrder,
  createPurchaseOrder: purchaseOrdersApi.createPurchaseOrder,
  transitionPurchaseOrderStatus: purchaseOrdersApi.transitionPurchaseOrderStatus,
  createGoodsReceipt: purchaseOrdersApi.createGoodsReceipt,
  runThreeWayMatch: purchaseOrdersApi.runThreeWayMatch,
  predictiveBillMatch: purchaseOrdersApi.predictiveBillMatch,

  // Tenant Flags (Track B Dispatch 1, 2026-04-20 — backend live at fba2896).
  getTenantFlags: tenantFlagsApi.getTenantFlags,
  updateTenantFlags: tenantFlagsApi.updateTenantFlags,

  // Inventory NRV (FN-264, Phase 4 Track A Tier 4).
  createNrvPolicy: inventoryNrvApi.createNrvPolicy,
  deactivateNrvPolicy: inventoryNrvApi.deactivateNrvPolicy,
  getActiveNrvPolicy: inventoryNrvApi.getActiveNrvPolicy,
  listNrvPolicies: inventoryNrvApi.listNrvPolicies,
  getNrvAssessment: inventoryNrvApi.getNrvAssessment,

  // CFO TodayScreen composite reads (Track B Dispatch 3a+3b, 2026-04-20).
  // Hook → endpoint mapping:
  //   getCFOTodayQueue              → GET /api/cfo/today-queue
  //   getCloseStatus                → GET /api/cfo/today-queue (closeStatus sub-field)
  //   getCFOAminahNotes             → GET /api/cfo/aminah-insights
  //   getTeamActivity               → GET /api/cfo/team-activity
  //   getEngineStatus               → GET /api/cfo/engine-status
  //   getSuggestedCategorizationRules → GET /api/rules/suggestions?type=categorization
  //   getSuggestedRoutingRules      → GET /api/rules/suggestions?type=routing
  getCFOTodayQueue: cfoTodayApi.getCFOTodayQueue,
  getCloseStatus: cfoTodayApi.getCloseStatus,
  getCFOAminahNotes: cfoTodayApi.getCFOAminahNotes,
  getTeamActivity: cfoTodayApi.getTeamActivity,
  getEngineStatus: cfoTodayApi.getEngineStatus,
  getSuggestedCategorizationRules: rulesApi.getSuggestedCategorizationRules,
  getSuggestedRoutingRules: rulesApi.getSuggestedRoutingRules,

  // Settings — personal surface (Track B Dispatch 2 wire 3, 2026-04-20).
  // Role is derived from JWT on the backend; these wrappers do not take
  // a role argument. The corresponding mockEngine functions do — the UI
  // has been rewired to stop passing it. See buildMockExtras below for
  // the MOCK-mode adapter that swallows the legacy role arg.
  // NOT on mockEngine's namespace under these EXACT names (getMyActivity
  // is a NEW personal-scope name; the tenant-wide listAdminAuditLog wire
  // already shipped in Dispatch 2 and is a different endpoint). The other
  // seven names (getNotificationPreferences / updateNotificationPreferences
  // / getActiveSessions / signOutSession / signOutAllOtherSessions /
  // getTwoFactorStatus / disableTwoFactor) collide with mockEngine
  // functions of the same name but different signatures (role-arg vs no
  // role-arg); buildMockExtras overrides them so MOCK mode and LIVE mode
  // both accept the no-role-arg call shape.
  getNotificationPreferences: settingsApi.getNotificationPreferences,
  updateNotificationPreferences: settingsApi.updateNotificationPreferences,
  getActiveSessions: settingsApi.getActiveSessions,
  signOutSession: settingsApi.signOutSession,
  signOutAllOtherSessions: settingsApi.signOutAllOtherSessions,
  getTwoFactorStatus: settingsApi.getTwoFactorStatus,
  disableTwoFactor: settingsApi.disableTwoFactor,
  getMyActivity: settingsApi.getMyActivity,

  // Banking — bank accounts surface (Track B Dispatch 4 wire 4, 2026-04-20).
  // getBankAccountSummary collides with mockEngine; the live impl takes
  // { range, from, to } instead of the mock's positional `period`.
  getBankAccountSummary: bankAccountsApi.getBankAccountSummary,
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

  // Leave provision (FN-255). Extras pattern.
  surface.listLeavePolicies = leaveProvisionApi.listLeavePolicies;
  surface.getActiveLeavePolicy = leaveProvisionApi.getActiveLeavePolicy;
  surface.createLeavePolicy = leaveProvisionApi.createLeavePolicy;
  surface.updateLeavePolicy = leaveProvisionApi.updateLeavePolicy;
  surface.listLeaveBalances = leaveProvisionApi.listLeaveBalances;
  surface.getLeaveBalance = leaveProvisionApi.getLeaveBalance;
  surface.upsertLeaveBalance = leaveProvisionApi.upsertLeaveBalance;
  surface.getLeaveProvisionSummary = leaveProvisionApi.getLeaveProvisionSummary;
  surface.getLeaveProvisionForEmployee = leaveProvisionApi.getLeaveProvisionForEmployee;

  // CBK rates (FN-238). Extras pattern.
  surface.listCbkRates = cbkRatesApi.listCbkRates;
  surface.getCbkRate = cbkRatesApi.getCbkRate;
  surface.lookupCbkRateForDate = cbkRatesApi.lookupCbkRateForDate;
  surface.lookupLatestCbkRate = cbkRatesApi.lookupLatestCbkRate;
  surface.getCbkRateStaleness = cbkRatesApi.getCbkRateStaleness;
  surface.upsertCbkRate = cbkRatesApi.upsertCbkRate;
  surface.deleteCbkRate = cbkRatesApi.deleteCbkRate;

  // Board pack (FN-258). Extras pattern.
  surface.getBoardPack = boardPackApi.getBoardPack;

  // OCR gating (FN-224). Extras pattern.
  surface.listOcrExtractions = ocrGatingApi.listOcrExtractions;
  surface.getOcrExtraction = ocrGatingApi.getOcrExtraction;
  surface.recordOcrExtraction = ocrGatingApi.recordOcrExtraction;
  surface.correctOcrField = ocrGatingApi.correctOcrField;
  surface.approveOcrExtraction = ocrGatingApi.approveOcrExtraction;
  surface.rejectOcrExtraction = ocrGatingApi.rejectOcrExtraction;

  // Inventory count (FN-263). Extras pattern.
  surface.listInventoryCounts = inventoryCountApi.listInventoryCounts;
  surface.getInventoryCount = inventoryCountApi.getInventoryCount;
  surface.createInventoryCount = inventoryCountApi.createInventoryCount;
  surface.snapshotInventoryCount = inventoryCountApi.snapshotInventoryCount;
  surface.recordInventoryCountLine = inventoryCountApi.recordInventoryCountLine;
  surface.reconcileInventoryCount = inventoryCountApi.reconcileInventoryCount;
  surface.cancelInventoryCount = inventoryCountApi.cancelInventoryCount;
  surface.getInventoryCountVarianceJeShape = inventoryCountApi.getInventoryCountVarianceJeShape;

  // Spinoff (FN-242). Extras pattern.
  surface.listSpinoffEvents = spinoffApi.listSpinoffEvents;
  surface.getSpinoffEvent = spinoffApi.getSpinoffEvent;
  surface.createSpinoffEvent = spinoffApi.createSpinoffEvent;
  surface.addSpinoffTransfer = spinoffApi.addSpinoffTransfer;
  surface.removeSpinoffTransfer = spinoffApi.removeSpinoffTransfer;
  surface.validateSpinoffEvent = spinoffApi.validateSpinoffEvent;
  surface.approveSpinoffEvent = spinoffApi.approveSpinoffEvent;
  surface.cancelSpinoffEvent = spinoffApi.cancelSpinoffEvent;
  surface.getSpinoffBalanceCheck = spinoffApi.getSpinoffBalanceCheck;

  surface.listIslamicArrangements = islamicFinanceApi.listIslamicArrangements;
  surface.getIslamicArrangement = islamicFinanceApi.getIslamicArrangement;
  surface.createIslamicArrangement = islamicFinanceApi.createIslamicArrangement;
  surface.transitionIslamicStatus = islamicFinanceApi.transitionIslamicStatus;
  surface.generateIslamicSchedule = islamicFinanceApi.generateIslamicSchedule;
  surface.markIslamicInstallmentPaid =
    islamicFinanceApi.markIslamicInstallmentPaid;
  surface.getIslamicPosition = islamicFinanceApi.getIslamicPosition;

  surface.listPurchaseOrders = purchaseOrdersApi.listPurchaseOrders;
  surface.getPurchaseOrder = purchaseOrdersApi.getPurchaseOrder;
  surface.createPurchaseOrder = purchaseOrdersApi.createPurchaseOrder;
  surface.transitionPurchaseOrderStatus =
    purchaseOrdersApi.transitionPurchaseOrderStatus;
  surface.createGoodsReceipt = purchaseOrdersApi.createGoodsReceipt;
  surface.runThreeWayMatch = purchaseOrdersApi.runThreeWayMatch;
  surface.predictiveBillMatch = purchaseOrdersApi.predictiveBillMatch;

  surface.getTenantFlags = tenantFlagsApi.getTenantFlags;
  surface.updateTenantFlags = tenantFlagsApi.updateTenantFlags;

  surface.createNrvPolicy = inventoryNrvApi.createNrvPolicy;
  surface.deactivateNrvPolicy = inventoryNrvApi.deactivateNrvPolicy;
  surface.getActiveNrvPolicy = inventoryNrvApi.getActiveNrvPolicy;
  surface.listNrvPolicies = inventoryNrvApi.listNrvPolicies;
  surface.getNrvAssessment = inventoryNrvApi.getNrvAssessment;

  // CFO TodayScreen Aminah insights — Track B Dispatch 3b. Not on
  // mockEngine's namespace (it's a net-new structured surface beyond
  // the legacy getCFOAminahNotes); assigned explicitly as an extras
  // call so screens that want the full {suggestedAction, supportingData,
  // lowConfidence, totalAvailable, suppressedCount, generatedAt} shape
  // can import it uniformly.
  surface.getAminahInsights = cfoTodayApi.getAminahInsights;

  // Administration — Track B Dispatch 2 (2026-04-20). Tenant-wide admin
  // surface backed by corporate-api. NOT on mockEngine's namespace;
  // these are new names that replace the legacy
  // getIntegrations/addIntegration/removeIntegration/getAccountAuditLog
  // mock trio on the AdministrationScreen consumer path. Credentials
  // are write-only on addAdminIntegration; server strips them from
  // every response.
  //
  // Mock → live mapping (for reference, enforced in the screen rewire):
  //   getIntegrations       → listAdminIntegrations
  //   addIntegration        → addAdminIntegration
  //   removeIntegration     → removeAdminIntegration
  //   getAccountAuditLog    → listAdminAuditLog (tenant-wide scope)
  surface.listAdminIntegrations = adminIntegrationsApi.listAdminIntegrations;
  surface.addAdminIntegration = adminIntegrationsApi.addAdminIntegration;
  surface.removeAdminIntegration = adminIntegrationsApi.removeAdminIntegration;
  surface.listAdminAuditLog = adminAuditLogApi.listAdminAuditLog;

  // Settings — personal surface (Track B Dispatch 2 wire 3, 2026-04-20).
  // Seven of these collide with mockEngine names and are already routed
  // via FUNCTION_ROUTING + the Object.keys(mockEngine) loop above; the
  // assignments below are belt-and-braces to make the wiring explicit
  // (matches the pattern used by getTenantFlags). getMyActivity is NEW
  // surface not on mockEngine's namespace and MUST be assigned here or
  // the named export below is undefined.
  surface.getNotificationPreferences = settingsApi.getNotificationPreferences;
  surface.updateNotificationPreferences = settingsApi.updateNotificationPreferences;
  surface.getActiveSessions = settingsApi.getActiveSessions;
  surface.signOutSession = settingsApi.signOutSession;
  surface.signOutAllOtherSessions = settingsApi.signOutAllOtherSessions;
  surface.getTwoFactorStatus = settingsApi.getTwoFactorStatus;
  surface.disableTwoFactor = settingsApi.disableTwoFactor;
  surface.getMyActivity = settingsApi.getMyActivity;

  // Banking — bank accounts (Track B Dispatch 4 wire 4, 2026-04-20).
  // listBankAccounts + getBankAccountStatement are NEW engine surface
  // names NOT on mockEngine's namespace (mockEngine has getBankAccounts /
  // getBankStatement under the old names). getBankAccountSummary is
  // routed via FUNCTION_ROUTING + REAL_IMPLS above but we also assign
  // here for belt-and-braces / grep-ability.
  surface.listBankAccounts = bankAccountsApi.listBankAccounts;
  surface.getBankAccountStatement = bankAccountsApi.getBankAccountStatement;
  surface.getBankAccountSummary = bankAccountsApi.getBankAccountSummary;

  // Reconciliation — Track B Dispatch 5 + 5a/5b/5c wire 5 (2026-04-20).
  //
  // The mockEngine has same-named functions for most of these (e.g.
  // `getReconciliationDashboard`, `reopenReconciliation`, etc.). The
  // mock shapes + signatures do NOT align with the live backend in
  // several cases — notably the dashboard `[]` vs backend's `{period,rows}`,
  // and the rich getById vs backend's `{reconciliation,matches,unmatched*}`.
  //
  // To avoid breaking existing mock-mode consumers while bringing up the
  // live action endpoints, we expose the 12 wrappers under DISTINCT
  // canonical names (`*Live` suffix where the mock has the non-suffixed
  // name; plain names for brand-new surface). Screens that opt into the
  // live path swap their imports explicitly.
  //
  // 11 endpoints / 12 wrappers:
  //   1. GET  /api/reconciliation/dashboard              → getReconciliationDashboardLive
  //   2. GET  /api/accounts/primary-operating             → getPrimaryOperatingAccountLive
  //   3. GET  /api/fiscal-periods/:y/:m/status            → getFiscalPeriodStatus
  //   4. POST /api/reconciliation/:id/reopen              → reopenReconciliationLive
  //   5. POST /api/reconciliation/:id/lock                → lockReconciliationLive
  //   6. POST /api/reconciliation/:id/import-statement    → importStatementLive
  //   7. GET  /api/reconciliation/:id/export              → exportReconciliationCsv
  //   8. POST /api/reconciliation/:id/exceptions/:excId/resolve → resolveExceptionLive
  //   9. POST /api/reconciliation/:id/suggestions/:suggId/confirm → confirmSuggestionLive
  //   10. POST /api/reconciliation/:id/suggestions/:suggId/dismiss → dismissSuggestionLive
  //   11. POST /api/reconciliation/:id/create-journal-entry → createReconciliationJournalEntry
  //   12. POST /api/reconciliation/parse-statement        → parseStatementLive
  //
  // (Counted as 11 line-items per Checkpoint A — reopen + lock bundle.)
  surface.getReconciliationDashboardLive = reconciliationApi.getReconciliationDashboard;
  surface.getPrimaryOperatingAccountLive = reconciliationApi.getPrimaryOperatingAccount;
  surface.getFiscalPeriodStatus = reconciliationApi.getFiscalPeriodStatus;
  surface.reopenReconciliationLive = reconciliationApi.reopenReconciliation;
  surface.lockReconciliationLive = reconciliationApi.lockReconciliation;
  surface.importStatementLive = reconciliationApi.importStatement;
  surface.exportReconciliationCsv = reconciliationApi.exportReconciliationCsv;
  surface.resolveExceptionLive = reconciliationApi.resolveException;
  surface.confirmSuggestionLive = reconciliationApi.confirmSuggestion;
  surface.dismissSuggestionLive = reconciliationApi.dismissSuggestion;
  surface.createReconciliationJournalEntry = reconciliationApi.createReconciliationJournalEntry;
  surface.parseStatementLive = reconciliationApi.parseStatement;

  // Budgets — Track B Dispatch 6 wire 6 (2026-04-20). 16 endpoints wrapped
  // as canonical engine names. The BudgetScreen's existing rich mockEngine
  // surface (getBudgetById, getAllBudgets, getActiveBudgetSummary,
  // getBudgetVarianceByDepartment, getBudgetVarianceByLineItem,
  // getBudgetWorkflowSummary, submitDepartment, approveDepartment,
  // requestDepartmentRevision, delegateBudget, submitBudgetForApproval,
  // approveBudget, requestBudgetChanges, updateBudgetLineItemValue,
  // createBudgetLine, updateBudgetLine, deleteBudgetLine,
  // addBudgetLineComment, getBudgetLineComments, deleteBudgetLineComment,
  // getBudgetApprovalState, getBudgetForYear, getTeamMembers) is LEFT on
  // mockEngine because the live DTO shape diverges significantly — see
  // src/api/budgets.js file header for the full flagged-shape-delta list.
  // LIVE mode falls back to mockEngine with a one-shot warn for those.
  //
  // The 16 live wrappers below are exposed as ENGINE EXTRAS under
  // canonical backend-aligned names (get*Live where the mockEngine has
  // a colliding legacy name, plain names otherwise). Future wires that
  // reshape the screen to the live DTO can swap imports one at a time.
  surface.getBudgetSummaryLive = budgetsApi.getBudgetSummary;
  surface.getBudgetVarianceLive = budgetsApi.getBudgetVariance;
  surface.getBudgetForYearLive = budgetsApi.getBudgetForYear;
  surface.createBudgetLineLive = budgetsApi.createBudgetLine;
  surface.updateBudgetLineLive = budgetsApi.updateBudgetLine;
  surface.deleteBudgetLineLive = budgetsApi.deleteBudgetLine;
  surface.submitBudgetForApprovalLive = budgetsApi.submitBudgetForApproval;
  surface.delegateBudgetLive = budgetsApi.delegateBudget;
  surface.approveBudgetDepartmentLive = budgetsApi.approveBudgetDepartment;
  surface.requestDepartmentRevisionLive = budgetsApi.requestDepartmentRevision;
  surface.requestBudgetChangesLive = budgetsApi.requestBudgetChanges;
  surface.addBudgetLineCommentLive = budgetsApi.addBudgetLineComment;
  surface.listBudgetLineCommentsLive = budgetsApi.listBudgetLineComments;
  surface.deleteBudgetLineCommentLive = budgetsApi.deleteBudgetLineComment;
  surface.getBudgetApprovalStateLive = budgetsApi.getBudgetApprovalState;
  surface.listTeamMembersLive = budgetsApi.listTeamMembers;

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
    // Leave provision (FN-255) MOCK stubs.
    listLeavePolicies: mockListLeavePolicies,
    getActiveLeavePolicy: mockGetActiveLeavePolicy,
    createLeavePolicy: mockCreateLeavePolicy,
    updateLeavePolicy: mockUpdateLeavePolicy,
    listLeaveBalances: async () => [],
    getLeaveBalance: async () => null,
    upsertLeaveBalance: async (p) => ({ ...p }),
    getLeaveProvisionSummary: mockLeaveSummary,
    getLeaveProvisionForEmployee: async () => null,
    // CBK rates (FN-238) MOCK stubs.
    listCbkRates: mockListCbkRates,
    getCbkRate: mockGetCbkRate,
    lookupCbkRateForDate: mockLookupCbkRateForDate,
    lookupLatestCbkRate: mockLookupLatestCbkRate,
    getCbkRateStaleness: mockGetCbkRateStaleness,
    upsertCbkRate: mockUpsertCbkRate,
    deleteCbkRate: mockDeleteCbkRate,
    // OCR gating (FN-224) MOCK stubs — empty queue.
    listOcrExtractions: async () => [],
    getOcrExtraction: async () => null,
    recordOcrExtraction: async (p) => ({ ...p, id: 'mock-ocr-1', status: 'PENDING_REVIEW' }),
    correctOcrField: async () => null,
    approveOcrExtraction: async () => null,
    rejectOcrExtraction: async () => null,
    // Inventory count (FN-263) MOCK stubs.
    listInventoryCounts: mockListInventoryCounts,
    getInventoryCount: mockGetInventoryCount,
    createInventoryCount: mockCreateInventoryCount,
    snapshotInventoryCount: mockSnapshotInventoryCount,
    recordInventoryCountLine: mockRecordInventoryCountLine,
    reconcileInventoryCount: mockReconcileInventoryCount,
    cancelInventoryCount: mockCancelInventoryCount,
    getInventoryCountVarianceJeShape: mockInventoryCountVarianceShape,
    // Spinoff (FN-242) MOCK stubs.
    listSpinoffEvents: mockListSpinoffEvents,
    getSpinoffEvent: mockGetSpinoffEvent,
    createSpinoffEvent: mockCreateSpinoffEvent,
    addSpinoffTransfer: mockAddSpinoffTransfer,
    removeSpinoffTransfer: mockRemoveSpinoffTransfer,
    validateSpinoffEvent: mockValidateSpinoffEvent,
    approveSpinoffEvent: mockApproveSpinoffEvent,
    cancelSpinoffEvent: mockCancelSpinoffEvent,
    getSpinoffBalanceCheck: mockSpinoffBalanceCheck,
    // Islamic Finance (FN-247) MOCK stubs.
    listIslamicArrangements: mockListIslamicArrangements,
    getIslamicArrangement: mockGetIslamicArrangement,
    createIslamicArrangement: mockCreateIslamicArrangement,
    transitionIslamicStatus: mockTransitionIslamicStatus,
    generateIslamicSchedule: mockGenerateIslamicSchedule,
    markIslamicInstallmentPaid: mockMarkIslamicInstallmentPaid,
    getIslamicPosition: mockGetIslamicPosition,
    // Purchase Orders + GR + 3-way match (FN-217+218) MOCK stubs.
    listPurchaseOrders: mockListPurchaseOrders,
    getPurchaseOrder: mockGetPurchaseOrder,
    createPurchaseOrder: mockCreatePurchaseOrder,
    transitionPurchaseOrderStatus: mockTransitionPurchaseOrderStatus,
    createGoodsReceipt: mockCreateGoodsReceipt,
    runThreeWayMatch: mockRunThreeWayMatch,
    predictiveBillMatch: mockPredictiveBillMatch,
    // Tenant Flags — in MOCK mode, go to localStorage fallback directly.
    getTenantFlags: tenantFlagsApi.getTenantFlags,
    updateTenantFlags: tenantFlagsApi.updateTenantFlags,
    // Inventory NRV (FN-264) MOCK stubs.
    createNrvPolicy: mockCreateNrvPolicy,
    deactivateNrvPolicy: mockDeactivateNrvPolicy,
    getActiveNrvPolicy: mockGetActiveNrvPolicy,
    listNrvPolicies: mockListNrvPolicies,
    getNrvAssessment: mockGetNrvAssessment,
    // CFO TodayScreen Aminah insights — Track B Dispatch 3b MOCK stub.
    // The full-structured payload is new surface beyond the legacy
    // getCFOAminahNotes (which IS on mockEngine's namespace and remains
    // the mock source for the flat `text` rows). The structured shape
    // has no mock backing; return an empty payload so the UI renders
    // its empty state in MOCK mode rather than pretending to have
    // structured narrations.
    getAminahInsights: async () => ({
      insights: [],
      totalAvailable: 0,
      suppressedCount: 0,
      generatedAt: new Date().toISOString(),
    }),
    // Administration — Track B Dispatch 2 MOCK shims. The live endpoints
    // are NOT on mockEngine's namespace under these new names, so MOCK
    // mode delegates to the legacy mockEngine functions that still
    // exist under their original names. The screen consumes the new
    // engine exports uniformly in both modes.
    listAdminIntegrations: (...args) => mockEngine.getIntegrations(...args),
    addAdminIntegration: async (payload) => {
      const id = typeof payload === 'string' ? payload : payload?.id;
      const integration = await mockEngine.addIntegration(id);
      return { integration, connected: !!integration };
    },
    removeAdminIntegration: async (id) => {
      await mockEngine.removeIntegration(id);
      return { deleted: true };
    },
    listAdminAuditLog: (opts = {}) =>
      mockEngine.getAccountAuditLog({ action: opts.action || 'all' }),
    // Settings — personal surface (Track B Dispatch 2 wire 3). The live
    // endpoints derive role from JWT and take no role argument. The
    // legacy mockEngine functions of the same name take a role arg — we
    // adapt here so the screen's no-role-arg calls work in both modes.
    //
    // For notifications we can't recover the caller's role without the
    // UI passing it (it doesn't, after the rewire), so MOCK defaults to
    // CFO — matches mockEngine's own fallback branch.
    getNotificationPreferences: async () =>
      mockEngine.getNotificationPreferences('CFO'),
    updateNotificationPreferences: async (prefs) =>
      mockEngine.updateNotificationPreferences('CFO', prefs),
    getActiveSessions: (...args) => mockEngine.getActiveSessions(...args),
    signOutSession: (...args) => mockEngine.signOutSession(...args),
    signOutAllOtherSessions: (...args) =>
      mockEngine.signOutAllOtherSessions(...args),
    getTwoFactorStatus: (...args) => mockEngine.getTwoFactorStatus(...args),
    // Mock disableTwoFactor returns { success, error } shape. Live
    // returns 400/503 on unenabled/primitive-pending paths. Keep MOCK
    // behavior unchanged; the UI's toast handling works on either.
    disableTwoFactor: (...args) => mockEngine.disableTwoFactor(...args),
    // getMyActivity is a NEW name not on mockEngine. Delegate to the
    // existing getAccountAuditLog mock (same entry shape) so MOCK mode
    // keeps working without changes.
    getMyActivity: (opts = {}) =>
      mockEngine.getAccountAuditLog({ action: opts.action || 'all' }),

    // Banking — bank accounts (Track B Dispatch 4 wire 4, 2026-04-20).
    // The live surface uses canonical names listBankAccounts /
    // getBankAccountStatement / getBankAccountSummary with an options-
    // object signature. mockEngine's legacy names are getBankAccounts /
    // getBankStatement / getBankAccountSummary with positional args. We
    // adapt here so the screen calls the same engine surface in both
    // modes. The live range vocabulary is calendar-based (month | quarter
    // | year | all) per HASEEB-148; mockEngine only understands today |
    // week | month | all, so for quarter/year we widen to the mock's 'all'
    // (which returns the full 30-day synthetic history — close enough for
    // MOCK demos where the dataset is shallow).
    listBankAccounts: async () => {
      const accs = await mockEngine.getBankAccounts();
      // Match the live-mode shape (mtdInflow/mtdOutflow already present
      // on the mock rows, so this is a pass-through). Kept as an async
      // wrapper so the return type is stable across modes.
      return accs;
    },
    getBankAccountStatement: async (id, opts = {}) => {
      const range = opts?.range;
      const mockRange =
        range === 'quarter' || range === 'year' ? 'all' : (range || 'month');
      return mockEngine.getBankStatement(id, mockRange);
    },
    getBankAccountSummary: async (id, opts = {}) => {
      const range = opts?.range;
      const mockPeriod =
        range === 'quarter' || range === 'year' ? 'all' : (range || 'month');
      return mockEngine.getBankAccountSummary(id, mockPeriod);
    },

    // Reconciliation — Track B Dispatch 5 + 5a/5b/5c wire 5 (2026-04-20).
    // The MOCK adapters below map the canonical `*Live` engine names back
    // to the legacy mockEngine functions so screens can call the live
    // surface in both modes without branching. Signature shapes match the
    // live API wrappers (options-object args).
    getReconciliationDashboardLive: async () => {
      // mockEngine.getReconciliationDashboard() returns the rich array.
      // Live returns { period, rows }. Adapt to a parallel shape for
      // the screen that picks it up — we mirror the live shape to keep
      // the wrapped-mode consumer consistent.
      const rows = await mockEngine.getReconciliationDashboard();
      const now = new Date();
      const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      return { period, rows };
    },
    getPrimaryOperatingAccountLive: async () => {
      const acc = await mockEngine.getPrimaryOperatingAccount();
      // Mock returns { accountId, label }. Live shape is richer.
      return acc
        ? {
            accountId: acc.accountId || acc.id || null,
            accountCode: acc.accountCode || null,
            accountName: acc.label || acc.accountName || '',
            bankAccountId: null,
            bankName: null,
            accountNumberMasked: null,
            accentColor: null,
          }
        : null;
    },
    getFiscalPeriodStatus: async (year, month) => {
      const date = new Date(year, month - 1, 15);
      const ps = await mockEngine.checkPeriodStatus(date);
      const status = ps?.status || 'open';
      const canEditReconciliations = status === 'open' || status === 'soft-closed';
      const isApprovalRequired = status === 'hard-closed' || status === 'locked';
      return { year, month, status, canEditReconciliations, isApprovalRequired };
    },
    reopenReconciliationLive: async (id, { reason } = {}) => {
      const r = await mockEngine.reopenReconciliation(id, 'cfo', reason);
      return { reconciliation: r, status: 'in-progress' };
    },
    lockReconciliationLive: async (id, { reason } = {}) => {
      const r = await mockEngine.lockReconciliation(id);
      return { reconciliation: r, lock: { reason }, status: 'locked' };
    },
    importStatementLive: async (id, { items, filename } = {}) => {
      const rec = await mockEngine.importUploadedStatement(id, items || [], filename || 'mock.csv', 'cfo');
      return { imported: (items || []).length, duplicateSkipped: 0, reconciliation: rec };
    },
    exportReconciliationCsv: async (id) => {
      // mockEngine.exportReconciliationCSV already returns {csvText,filename,rowCount}
      return mockEngine.exportReconciliationCSV(id);
    },
    resolveExceptionLive: async (id, excId, { resolution } = {}) => {
      return mockEngine.resolveException(id, excId, resolution, 'cfo');
    },
    confirmSuggestionLive: async (id, suggId) => {
      const r = await mockEngine.confirmSuggestion(id, suggId, 'cfo');
      return { suggestion: null, confirmed: true, match: r };
    },
    dismissSuggestionLive: async (id, suggId, { reason } = {}) => {
      const r = await mockEngine.dismissSuggestion(id, suggId, 'cfo');
      return { suggestion: r, dismissed: true, reason: reason || null };
    },
    createReconciliationJournalEntry: async (
      id,
      { bankItemId, debitRole, creditRole, amountKwd, memo, exceptionId } = {},
    ) => {
      // Map the live AccountRole + DecimalString shape back to the
      // mockEngine's freeform debit/credit label + numeric amount.
      const amount = Number(amountKwd);
      const r = await mockEngine.createMissingJournalEntry(
        id,
        bankItemId,
        debitRole,
        creditRole,
        amount,
        'cfo',
      );
      return {
        journalEntryId: r?.journalEntryId || `MOCK-JE-${Date.now()}`,
        journalEntry: r,
        exception: exceptionId ? { id: exceptionId, resolved: true } : undefined,
        memo: memo || null,
      };
    },
    parseStatementLive: async ({ csvText, bankFormatId } = {}) => {
      const r = await mockEngine.parseBankStatementCSV(csvText, { bankFormatId });
      return {
        items: r?.items || [],
        warnings: r?.warnings || [],
        errors: r?.errors || [],
        formatUsed: { id: bankFormatId || 'mock', bankCode: 'MOCK', bankName: 'Mock Bank', formatVersion: 1 },
      };
    },

    // Budgets — Track B Dispatch 6 wire 6 (2026-04-20). MOCK adapters for
    // the 16 `*Live` canonical surface names. These map back to the
    // legacy mockEngine functions where a reasonable translation exists,
    // and return shape-aligned payloads elsewhere so screens that opt
    // into the *Live surface work in both modes.
    getBudgetSummaryLive: async (id) => {
      // mockEngine exposes getActiveBudgetSummary (no id arg) for the
      // current active budget only. Widen to an id-aware variant by
      // loading the full budget.
      const b = await mockEngine.getBudgetById(id);
      if (!b) return null;
      return {
        budgetId: b.id,
        fiscalYear: b.period?.fiscalYear ?? null,
        totalRevenueKwd: String((b.totalRevenue ?? 0).toFixed(3)),
        totalExpensesKwd: String((b.totalExpenses ?? 0).toFixed(3)),
        netIncomeKwd: String((b.netIncome ?? 0).toFixed(3)),
        departmentCount: (b.departments || []).length,
        marginPercent:
          b.totalRevenue > 0
            ? Number(((b.netIncome / b.totalRevenue) * 100).toFixed(1))
            : 0,
      };
    },
    getBudgetVarianceLive: async (id /* , opts */) => {
      // mockEngine.getBudgetVarianceByDepartment() is active-budget only
      // and returns the mock-shape rows; adapt to the live-shape.
      const rows = await mockEngine.getBudgetVarianceByDepartment(id);
      return (rows || []).map((r) => ({
        departmentId: r.id,
        departmentName: r.name,
        category: r.category === 'revenue' ? 'Revenue' : 'Expense',
        budgetAnnualKwd: String((r.budgetAnnual ?? 0).toFixed(3)),
        actualYtdKwd: String((r.actualYtd ?? 0).toFixed(3)),
        varianceKwd: String((r.varianceAmount ?? 0).toFixed(3)),
        variancePercent: r.variancePercent ?? 0,
        status: r.status || 'on-track',
      }));
    },
    getBudgetForYearLive: (year) => mockEngine.getBudgetForYear(year),
    createBudgetLineLive: async (id, payload) => {
      // Mock's createBudgetLine(budgetId, {departmentId, amount|annual, ...})
      // — best-effort shape pass-through.
      return mockEngine.createBudgetLine(id, {
        ...payload,
        annual: Number(payload?.amountKwd ?? payload?.annual ?? 0),
      });
    },
    updateBudgetLineLive: async (_id, lineId, updates) => {
      // Mock's signature is (lineId, updates) without budgetId.
      const annual =
        updates?.amountKwd != null
          ? Number(updates.amountKwd)
          : updates?.annual;
      return mockEngine.updateBudgetLine(lineId, {
        ...updates,
        annual,
      });
    },
    deleteBudgetLineLive: async (_id, lineId) =>
      mockEngine.deleteBudgetLine(lineId),
    submitBudgetForApprovalLive: (id) =>
      mockEngine.submitBudgetForApproval(id),
    delegateBudgetLive: async (id, { delegations } = {}) => {
      // Live shape uses assignToUserId; mock expects juniorUserId.
      const mapped = (delegations || []).map((d) => ({
        departmentId: d.departmentId,
        juniorUserId: d.assignToUserId || d.juniorUserId,
        notes: d.notes || null,
      }));
      return mockEngine.delegateBudget(id, mapped);
    },
    approveBudgetDepartmentLive: (id, deptId) =>
      mockEngine.approveDepartment(id, deptId),
    requestDepartmentRevisionLive: (id, deptId, { notes } = {}) =>
      mockEngine.requestDepartmentRevision(id, deptId, notes),
    requestBudgetChangesLive: (id, { notes } = {}) =>
      mockEngine.requestBudgetChanges(id, notes),
    addBudgetLineCommentLive: async (_id, lineId, { content } = {}) => {
      const c = await mockEngine.addBudgetLineComment(lineId, content, 'cfo');
      return c
        ? {
            id: c.id,
            authorUserId: c.author,
            authorName: c.authorRole,
            authorRole: c.authorRole,
            content: c.content,
            createdAt: c.createdAt,
          }
        : null;
    },
    listBudgetLineCommentsLive: async (_id, lineId) => {
      const rows = await mockEngine.getBudgetLineComments(lineId);
      return (rows || []).map((c) => ({
        id: c.id,
        authorUserId: c.author,
        authorName: c.authorRole,
        authorRole: c.authorRole,
        content: c.content,
        createdAt: c.createdAt,
      }));
    },
    deleteBudgetLineCommentLive: (_id, lineId, commentId) =>
      mockEngine.deleteBudgetLineComment(lineId, commentId),
    getBudgetApprovalStateLive: async (id) => {
      const s = await mockEngine.getBudgetApprovalState(id);
      if (!s) return null;
      return {
        budgetStatus: s.status,
        nextAction: s.nextAction || '',
        reviewers: (s.reviewers || []).map((r) => ({
          role: r.role,
          userId: r.userId || null,
          userName: r.userName || r.role,
          status: r.status || 'pending',
          decidedAt: r.decidedAt || null,
        })),
        history: (s.history || []).map((h) => ({
          action: h.toState || h.action || '',
          actor: h.byUserId || h.actor || '',
          timestamp: h.timestamp,
          notes: h.note || h.notes || null,
        })),
      };
    },
    listTeamMembersLive: async () => {
      // mockEngine.getTeamMembers returns { id, name, role, initials, color };
      // live shape is { id, name, email, role }.
      const members = await mockEngine.getTeamMembers();
      return (members || []).map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email || `${m.id}@example.kw`,
        role: m.role,
      }));
    },

    // Board pack (FN-258) MOCK stub — empty pack in MOCK mode.
    getBoardPack: async (q = {}) => ({
      fiscalYear: q.fiscalYear || new Date().getFullYear() - 1,
      priorFiscalYear: (q.fiscalYear || new Date().getFullYear() - 1) - 1,
      generatedAt: new Date().toISOString(),
      currentReportVersions: [],
      priorReportVersions: [],
      yoyComparisons: [],
      disclosureSummaries: [],
      warnings: ['mock: no published report versions in MOCK mode'],
    }),
  };
}

// ── CBK rates MOCK stubs (FN-238) ──
let _mockCbkCounter = 0;
const _mockCbkRates = [];
async function mockListCbkRates(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockCbkRates
    .filter((r) => {
      if (filters.currency && r.currency !== filters.currency) return false;
      if (filters.rateDateFrom && r.rateDate < filters.rateDateFrom) return false;
      if (filters.rateDateTo && r.rateDate > filters.rateDateTo) return false;
      return true;
    })
    .slice(0, filters.limit || 500)
    .map((r) => ({ ...r }));
}
async function mockGetCbkRate(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockCbkRates.find((r) => r.id === id);
  return row ? { ...row } : null;
}
async function mockLookupCbkRateForDate(query = {}) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockCbkRates.find(
    (r) =>
      r.currency === query.currency &&
      r.rateDate === (query.asOf || new Date().toISOString().slice(0, 10)),
  );
  return row ? { ...row } : null;
}
async function mockLookupLatestCbkRate(query = {}) {
  await new Promise((r) => setTimeout(r, 20));
  const asOf = query.asOf || new Date().toISOString().slice(0, 10);
  const candidates = _mockCbkRates
    .filter((r) => r.currency === query.currency && r.rateDate <= asOf)
    .sort((a, b) => (a.rateDate < b.rateDate ? 1 : -1));
  return candidates[0] ? { ...candidates[0] } : null;
}
async function mockGetCbkRateStaleness(query = {}) {
  await new Promise((r) => setTimeout(r, 30));
  const asOfIso = query.asOf || new Date().toISOString().slice(0, 10);
  const threshold = query.staleThresholdDays ?? 7;
  const latest = await mockLookupLatestCbkRate({
    currency: query.currency,
    asOf: asOfIso,
  });
  if (!latest) {
    return {
      currency: query.currency,
      asOf: asOfIso,
      latestRate: null,
      ageInDays: null,
      staleThresholdDays: threshold,
      isStale: true,
      note: 'mock: no rate recorded',
    };
  }
  const ageInDays = Math.round(
    (new Date(asOfIso) - new Date(latest.rateDate)) / 86400000,
  );
  return {
    currency: query.currency,
    asOf: asOfIso,
    latestRate: latest,
    ageInDays,
    staleThresholdDays: threshold,
    isStale: ageInDays > threshold,
    note: `mock: latest rate is ${ageInDays}d old`,
  };
}
async function mockUpsertCbkRate(payload = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const existingIdx = _mockCbkRates.findIndex(
    (r) => r.currency === payload.currency && r.rateDate === payload.rateDate,
  );
  if (existingIdx >= 0) {
    _mockCbkRates[existingIdx] = {
      ..._mockCbkRates[existingIdx],
      rateKwd: payload.rateKwd,
      source: payload.source || 'MANUAL',
      notes: payload.notes ?? null,
      updatedAt: new Date().toISOString(),
    };
    return { ..._mockCbkRates[existingIdx] };
  }
  _mockCbkCounter += 1;
  const row = {
    id: `mock-cbk-${_mockCbkCounter}`,
    currency: payload.currency || 'USD',
    rateDate: payload.rateDate || new Date().toISOString().slice(0, 10),
    rateKwd: payload.rateKwd || '0.30600',
    source: payload.source || 'MANUAL',
    notes: payload.notes ?? null,
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _mock: true,
  };
  _mockCbkRates.unshift(row);
  return { ...row };
}
async function mockDeleteCbkRate(id) {
  await new Promise((r) => setTimeout(r, 40));
  const idx = _mockCbkRates.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const [removed] = _mockCbkRates.splice(idx, 1);
  return { ...removed };
}

// ── Leave provision MOCK stubs (FN-255) ──
let _mockLeaveCounter = 0;
const _mockLeavePolicies = [];
async function mockListLeavePolicies() {
  await new Promise((r) => setTimeout(r, 40));
  return _mockLeavePolicies.map((r) => ({ ...r }));
}
async function mockGetActiveLeavePolicy() {
  await new Promise((r) => setTimeout(r, 20));
  const today = new Date().toISOString().slice(0, 10);
  const row = _mockLeavePolicies.find(
    (r) =>
      r.activeFrom <= today &&
      (!r.activeUntil || r.activeUntil >= today),
  );
  return row ? { ...row } : null;
}
async function mockCreateLeavePolicy(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockLeaveCounter += 1;
  const row = {
    id: `mock-leave-${_mockLeaveCounter}`,
    accrualDaysPerMonth: payload.accrualDaysPerMonth || '2.5',
    qualifyingMonthsBeforeAccrual: payload.qualifyingMonthsBeforeAccrual ?? 3,
    maxCarryForwardDays: payload.maxCarryForwardDays ?? 30,
    plRoleCode: payload.plRoleCode || 'LEAVE_EXPENSE',
    liabilityRoleCode: payload.liabilityRoleCode || 'LEAVE_LIABILITY',
    notes: payload.notes ?? null,
    activeFrom: payload.activeFrom || new Date().toISOString().slice(0, 10),
    activeUntil: payload.activeUntil ?? null,
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _mock: true,
  };
  _mockLeavePolicies.unshift(row);
  return row;
}
async function mockUpdateLeavePolicy(id, patch = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockLeavePolicies.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  _mockLeavePolicies[idx] = {
    ..._mockLeavePolicies[idx],
    notes: patch.notes ?? _mockLeavePolicies[idx].notes,
    activeUntil:
      patch.activeUntil !== undefined
        ? patch.activeUntil
        : _mockLeavePolicies[idx].activeUntil,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockLeavePolicies[idx] };
}
async function mockLeaveSummary(query = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return {
    asOf: query.asOf || new Date().toISOString().slice(0, 10),
    employeeCount: 0,
    totalAccruedDays: '0.0000',
    totalTakenDays: '0.0000',
    netOutstandingDays: '0.0000',
    estimatedLiabilityKwd: '0.000',
    note: 'mock: no employee balances in MOCK mode',
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

// ── Inventory count MOCK stubs (FN-263) ──
let _mockCountCounter = 0;
let _mockCountLineCounter = 0;
const _mockCounts = [];
// Minimal fake item catalog for MOCK mode snapshots.
const _mockInventoryItems = [
  { id: 'mock-item-1', itemCode: 'WIDGET-01', itemName: 'Widget A', qty: '100.00', unitCost: '2.500' },
  { id: 'mock-item-2', itemCode: 'WIDGET-02', itemName: 'Widget B', qty: '50.00', unitCost: '5.000' },
  { id: 'mock-item-3', itemCode: 'GADGET-01', itemName: 'Gadget X', qty: '25.00', unitCost: '12.750' },
];
async function mockListInventoryCounts(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockCounts
    .filter((c) => {
      if (filters.status && c.status !== filters.status) return false;
      if (filters.countDateFrom && c.countDate < filters.countDateFrom) return false;
      if (filters.countDateTo && c.countDate > filters.countDateTo) return false;
      return true;
    })
    .map((c) => ({ ...c, lines: undefined }));
}
async function mockGetInventoryCount(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockCounts.find((c) => c.id === id);
  return row
    ? { ...row, lines: (row.lines || []).map((l) => ({ ...l })) }
    : null;
}
async function mockCreateInventoryCount(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockCountCounter += 1;
  const row = {
    id: `mock-count-${_mockCountCounter}`,
    countDate: payload.countDate || new Date().toISOString().slice(0, 10),
    locationLabel: payload.locationLabel ?? null,
    status: 'DRAFT',
    notes: payload.notes ?? null,
    snapshottedAt: null,
    reconciledAt: null,
    reconciledBy: null,
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lines: [],
    _mock: true,
  };
  _mockCounts.unshift(row);
  return { ...row, lines: [] };
}
async function mockSnapshotInventoryCount(id) {
  await new Promise((r) => setTimeout(r, 80));
  const idx = _mockCounts.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  if (_mockCounts[idx].status !== 'DRAFT') return null;
  const lines = _mockInventoryItems.map((item) => {
    _mockCountLineCounter += 1;
    return {
      id: `mock-count-line-${_mockCountLineCounter}`,
      countId: id,
      itemId: item.id,
      itemName: item.itemName,
      itemCode: item.itemCode,
      systemQuantity: item.qty,
      snapshotUnitCost: item.unitCost,
      countedQuantity: null,
      varianceQuantity: null,
      varianceValueKwd: null,
      notes: null,
    };
  });
  _mockCounts[idx] = {
    ..._mockCounts[idx],
    status: 'COUNTING',
    snapshottedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lines,
  };
  return {
    ..._mockCounts[idx],
    lines: _mockCounts[idx].lines.map((l) => ({ ...l })),
  };
}
async function mockRecordInventoryCountLine(lineId, payload = {}) {
  await new Promise((r) => setTimeout(r, 40));
  for (const count of _mockCounts) {
    const lineIdx = (count.lines || []).findIndex((l) => l.id === lineId);
    if (lineIdx >= 0) {
      count.lines[lineIdx] = {
        ...count.lines[lineIdx],
        countedQuantity: payload.countedQuantity,
        notes: payload.notes ?? count.lines[lineIdx].notes,
      };
      count.updatedAt = new Date().toISOString();
      return { ...count.lines[lineIdx] };
    }
  }
  return null;
}
async function mockReconcileInventoryCount(id) {
  await new Promise((r) => setTimeout(r, 80));
  const idx = _mockCounts.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  if (_mockCounts[idx].status !== 'COUNTING') return null;
  const reconciledLines = (_mockCounts[idx].lines || []).map((line) => {
    const counted = Number(line.countedQuantity || 0);
    const system = Number(line.systemQuantity || 0);
    const unitCost = Number(line.snapshotUnitCost || 0);
    const varianceQty = counted - system;
    const varianceValue = varianceQty * unitCost;
    return {
      ...line,
      countedQuantity: line.countedQuantity || '0.00',
      varianceQuantity: varianceQty.toFixed(2),
      varianceValueKwd: varianceValue.toFixed(3),
    };
  });
  _mockCounts[idx] = {
    ..._mockCounts[idx],
    status: 'RECONCILED',
    reconciledAt: new Date().toISOString(),
    reconciledBy: 'mock-user',
    updatedAt: new Date().toISOString(),
    lines: reconciledLines,
  };
  return {
    ..._mockCounts[idx],
    lines: _mockCounts[idx].lines.map((l) => ({ ...l })),
  };
}
async function mockCancelInventoryCount(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockCounts.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  if (_mockCounts[idx].status !== 'DRAFT' && _mockCounts[idx].status !== 'COUNTING') return null;
  _mockCounts[idx] = {
    ..._mockCounts[idx],
    status: 'CANCELLED',
    updatedAt: new Date().toISOString(),
  };
  return {
    ..._mockCounts[idx],
    lines: (_mockCounts[idx].lines || []).map((l) => ({ ...l })),
  };
}
async function mockInventoryCountVarianceShape(id) {
  await new Promise((r) => setTimeout(r, 40));
  const count = _mockCounts.find((c) => c.id === id);
  if (!count) return null;
  if (count.status !== 'RECONCILED' && count.status !== 'POSTED') return null;
  const lines = count.lines || [];
  let totalAbs = 0;
  let net = 0;
  const legs = [];
  for (const l of lines) {
    const vv = Number(l.varianceValueKwd || 0);
    if (Math.abs(vv) < 0.001) continue;
    totalAbs += Math.abs(vv);
    net += vv;
    const gain = vv > 0;
    // Gain: DR Inventory / CR Variance (asset up, P&L credit)
    // Loss: DR Variance / CR Inventory (P&L debit, asset down)
    legs.push({
      accountRole: 'INVENTORY',
      side: gain ? 'DEBIT' : 'CREDIT',
      amountKwd: Math.abs(vv).toFixed(3),
      description: `${l.itemCode || l.itemId}: ${gain ? 'gain' : 'loss'}`,
    });
    legs.push({
      accountRole: 'INVENTORY_VARIANCE',
      side: gain ? 'CREDIT' : 'DEBIT',
      amountKwd: Math.abs(vv).toFixed(3),
      description: `${l.itemCode || l.itemId}: offset`,
    });
  }
  return {
    countId: id,
    totalAbsoluteVarianceKwd: totalAbs.toFixed(3),
    netVarianceKwd: net.toFixed(3),
    legs,
    note:
      totalAbs < 0.001
        ? 'no variance — no JE needed'
        : `${legs.length / 2} line(s) with variance`,
  };
}

// ── Spinoff MOCK stubs (FN-242) ──
let _mockSpinoffCounter = 0;
let _mockTransferCounter = 0;
const _mockSpinoffEvents = [];
async function mockListSpinoffEvents(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockSpinoffEvents
    .filter((e) => !filters.status || e.status === filters.status)
    .map((e) => ({ ...e, transfers: undefined }));
}
async function mockGetSpinoffEvent(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockSpinoffEvents.find((e) => e.id === id);
  return row
    ? { ...row, transfers: (row.transfers || []).map((t) => ({ ...t })) }
    : null;
}
async function mockCreateSpinoffEvent(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockSpinoffCounter += 1;
  const row = {
    id: `mock-spinoff-${_mockSpinoffCounter}`,
    targetEntityLabel: payload.targetEntityLabel || '',
    effectiveDate: payload.effectiveDate || new Date().toISOString().slice(0, 10),
    description: payload.description || '',
    status: 'DRAFT',
    notes: payload.notes ?? null,
    validatedAt: null,
    approvedAt: null,
    approvedBy: null,
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    transfers: [],
    _mock: true,
  };
  _mockSpinoffEvents.unshift(row);
  return { ...row, transfers: [] };
}
async function mockAddSpinoffTransfer(eventId, payload = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockSpinoffEvents.findIndex((e) => e.id === eventId);
  if (idx < 0) return null;
  if (
    _mockSpinoffEvents[idx].status !== 'DRAFT' &&
    _mockSpinoffEvents[idx].status !== 'VALIDATED'
  ) {
    return null;
  }
  _mockTransferCounter += 1;
  const transfer = {
    id: `mock-spinoff-tr-${_mockTransferCounter}`,
    eventId,
    sourceAccountId: payload.sourceAccountId || '',
    amountKwd: payload.amountKwd || '0.000',
    classification: payload.classification || 'ASSET',
    notes: payload.notes ?? null,
    createdAt: new Date().toISOString(),
  };
  _mockSpinoffEvents[idx] = {
    ..._mockSpinoffEvents[idx],
    transfers: [...(_mockSpinoffEvents[idx].transfers || []), transfer],
    // Re-validation required after transfer change.
    status:
      _mockSpinoffEvents[idx].status === 'VALIDATED'
        ? 'DRAFT'
        : _mockSpinoffEvents[idx].status,
    validatedAt:
      _mockSpinoffEvents[idx].status === 'VALIDATED'
        ? null
        : _mockSpinoffEvents[idx].validatedAt,
    updatedAt: new Date().toISOString(),
  };
  return { ...transfer };
}
async function mockRemoveSpinoffTransfer(transferId) {
  await new Promise((r) => setTimeout(r, 40));
  for (const event of _mockSpinoffEvents) {
    const tIdx = (event.transfers || []).findIndex((t) => t.id === transferId);
    if (tIdx >= 0) {
      if (event.status !== 'DRAFT' && event.status !== 'VALIDATED') return null;
      event.transfers.splice(tIdx, 1);
      event.status = 'DRAFT';
      event.validatedAt = null;
      event.updatedAt = new Date().toISOString();
      return { ok: true };
    }
  }
  return null;
}
async function mockValidateSpinoffEvent(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockSpinoffEvents.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  const event = _mockSpinoffEvents[idx];
  if (event.status !== 'DRAFT' && event.status !== 'VALIDATED') return null;
  const check = await mockSpinoffBalanceCheck(id);
  if (check && check.isBalanced) {
    _mockSpinoffEvents[idx] = {
      ...event,
      status: 'VALIDATED',
      validatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    event: {
      ..._mockSpinoffEvents[idx],
      transfers: (_mockSpinoffEvents[idx].transfers || []).map((t) => ({ ...t })),
    },
    check,
  };
}
async function mockApproveSpinoffEvent(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockSpinoffEvents.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  if (_mockSpinoffEvents[idx].status !== 'VALIDATED') return null;
  _mockSpinoffEvents[idx] = {
    ..._mockSpinoffEvents[idx],
    status: 'APPROVED',
    approvedAt: new Date().toISOString(),
    approvedBy: 'mock-user',
    updatedAt: new Date().toISOString(),
  };
  return {
    ..._mockSpinoffEvents[idx],
    transfers: (_mockSpinoffEvents[idx].transfers || []).map((t) => ({ ...t })),
  };
}
async function mockCancelSpinoffEvent(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockSpinoffEvents.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  if (
    _mockSpinoffEvents[idx].status !== 'DRAFT' &&
    _mockSpinoffEvents[idx].status !== 'VALIDATED'
  ) {
    return null;
  }
  _mockSpinoffEvents[idx] = {
    ..._mockSpinoffEvents[idx],
    status: 'CANCELLED',
    updatedAt: new Date().toISOString(),
  };
  return {
    ..._mockSpinoffEvents[idx],
    transfers: (_mockSpinoffEvents[idx].transfers || []).map((t) => ({ ...t })),
  };
}
async function mockSpinoffBalanceCheck(id) {
  await new Promise((r) => setTimeout(r, 30));
  const event = _mockSpinoffEvents.find((e) => e.id === id);
  if (!event) return null;
  let assets = 0;
  let liabs = 0;
  let equity = 0;
  for (const t of event.transfers || []) {
    const amt = Number(t.amountKwd || 0);
    if (t.classification === 'ASSET') assets += amt;
    else if (t.classification === 'LIABILITY') liabs += amt;
    else equity += amt;
  }
  const right = liabs + equity;
  const diff = assets - right;
  const isBalanced = Math.abs(diff) <= 0.001;
  return {
    assetsKwd: assets.toFixed(3),
    liabilitiesKwd: liabs.toFixed(3),
    equityKwd: equity.toFixed(3),
    leftSideKwd: assets.toFixed(3),
    rightSideKwd: right.toFixed(3),
    differenceKwd: diff.toFixed(3),
    isBalanced,
    note: isBalanced
      ? 'balanced: assets = liabilities + equity within 0.001 KWD tolerance'
      : `unbalanced: ${Math.abs(diff).toFixed(3)} KWD gap (assets ${assets.toFixed(3)} vs L+E ${right.toFixed(3)})`,
  };
}

// ── Islamic Finance (FN-247) MOCK stubs. profitRatePercent stored as
//    basis-points ×100 integer (500 = 5.00%) matching wire format. ──
let _mockIslamicCounter = 0;
let _mockIslamicScheduleCounter = 0;
const _mockIslamicArrangements = [];

function _mockIslamicScheduleRow(arrangementId, n, due, principal, profit, outstanding) {
  _mockIslamicScheduleCounter += 1;
  return {
    id: `mock-ifs-${_mockIslamicScheduleCounter}`,
    arrangementId,
    installmentNumber: n,
    dueDate: due,
    principalPortionKwd: principal.toFixed(3),
    profitPortionKwd: profit.toFixed(3),
    totalPortionKwd: (principal + profit).toFixed(3),
    outstandingAfterKwd: outstanding.toFixed(3),
    status: 'SCHEDULED',
    paidDate: null,
    paidAmountKwd: null,
    notes: null,
  };
}

async function mockListIslamicArrangements(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockIslamicArrangements.filter((a) => {
    if (filters.arrangementType && a.arrangementType !== filters.arrangementType) return false;
    if (filters.direction && a.direction !== filters.direction) return false;
    if (filters.status && a.status !== filters.status) return false;
    if (filters.counterpartyBank && a.counterpartyBank !== filters.counterpartyBank) return false;
    return true;
  });
}
async function mockGetIslamicArrangement(id) {
  await new Promise((r) => setTimeout(r, 30));
  return _mockIslamicArrangements.find((a) => a.id === id) || null;
}
async function mockCreateIslamicArrangement(payload) {
  await new Promise((r) => setTimeout(r, 60));
  _mockIslamicCounter += 1;
  const row = {
    id: `mock-ifa-${_mockIslamicCounter}`,
    arrangementNumber: payload.arrangementNumber,
    arrangementType: payload.arrangementType,
    sourceTermLabel: payload.sourceTermLabel,
    counterpartyBank: payload.counterpartyBank,
    counterpartyReference: payload.counterpartyReference || null,
    direction: payload.direction,
    originalFacilityAmountKwd: Number(payload.originalFacilityAmountKwd).toFixed(3),
    profitRatePercent: payload.profitRatePercent,
    profitComputationMethod: payload.profitComputationMethod,
    contractDate: payload.contractDate,
    maturityDate: payload.maturityDate,
    installmentCount: payload.installmentCount,
    balanceSheetRoleCode: payload.balanceSheetRoleCode || 'MURABAHA_PAYABLE',
    profitPlRoleCode: payload.profitPlRoleCode || 'MURABAHA_PROFIT_EXPENSE',
    status: 'ACTIVE',
    notes: payload.notes || null,
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schedule: [],
  };
  _mockIslamicArrangements.unshift(row);
  return row;
}
async function mockTransitionIslamicStatus(id, status) {
  await new Promise((r) => setTimeout(r, 40));
  const a = _mockIslamicArrangements.find((x) => x.id === id);
  if (!a) throw new Error('arrangement not found');
  if ((a.status === 'SETTLED' || a.status === 'CANCELLED') && status !== a.status) {
    throw new Error(`cannot transition from terminal status ${a.status}.`);
  }
  a.status = status;
  a.updatedAt = new Date().toISOString();
  return a;
}
async function mockGenerateIslamicSchedule(id, opts = {}) {
  await new Promise((r) => setTimeout(r, 80));
  const a = _mockIslamicArrangements.find((x) => x.id === id);
  if (!a) throw new Error('arrangement not found');
  if (a.schedule.length > 0 && !opts.regenerate) {
    throw new Error(`schedule already exists (${a.schedule.length} rows); pass regenerate=true to replace.`);
  }
  a.schedule = [];
  const facility = Number(a.originalFacilityAmountKwd);
  const ratePerYear = a.profitRatePercent / 10000;
  const N = a.installmentCount;
  const contractMs = new Date(a.contractDate).getTime();
  const maturityMs = new Date(a.maturityDate).getTime();
  const totalDays = Math.max(1, Math.floor((maturityMs - contractMs) / 86_400_000));
  const daysPerInst = Math.max(1, Math.round(totalDays / N));
  const yearsTotal = totalDays / 365;
  const rows = [];
  if (a.profitComputationMethod === 'DIMINISHING') {
    const principalEach = facility / N;
    const periodRate = ratePerYear * (daysPerInst / 365);
    let outstanding = facility;
    for (let i = 1; i <= N; i++) {
      const profit = outstanding * periodRate;
      const principalForThis = i === N ? outstanding : principalEach;
      outstanding = outstanding - principalForThis;
      const due = new Date(contractMs + daysPerInst * i * 86_400_000).toISOString().slice(0, 10);
      rows.push(_mockIslamicScheduleRow(id, i, due, principalForThis, profit, Math.max(0, outstanding)));
    }
  } else {
    const totalProfit = facility * ratePerYear * yearsTotal;
    const principalEach = facility / N;
    const profitEach = totalProfit / N;
    let outstanding = facility;
    let profitAllocated = 0;
    for (let i = 1; i <= N; i++) {
      const principalForThis = i === N ? outstanding : principalEach;
      outstanding = outstanding - principalForThis;
      const profitForThis = i === N ? totalProfit - profitAllocated : profitEach;
      profitAllocated += profitForThis;
      const due = new Date(contractMs + daysPerInst * i * 86_400_000).toISOString().slice(0, 10);
      rows.push(_mockIslamicScheduleRow(id, i, due, principalForThis, profitForThis, Math.max(0, outstanding)));
    }
  }
  a.schedule = rows;
  a.updatedAt = new Date().toISOString();
  return rows;
}
async function mockMarkIslamicInstallmentPaid(rowId, payload) {
  await new Promise((r) => setTimeout(r, 40));
  for (const a of _mockIslamicArrangements) {
    const row = a.schedule.find((s) => s.id === rowId);
    if (row) {
      if (row.status === 'PAID') throw new Error('installment already marked PAID.');
      const amt = Number(payload.paidAmountKwd);
      if (!(amt > 0)) throw new Error('paidAmountKwd must be > 0.');
      row.status = 'PAID';
      row.paidDate = payload.paidDate;
      row.paidAmountKwd = amt.toFixed(3);
      a.updatedAt = new Date().toISOString();
      return row;
    }
  }
  throw new Error('schedule row not found');
}
function _mockLabelPair(type, direction) {
  const fin = direction === 'FINANCING_RECEIVED';
  const map = {
    MURABAHA: fin
      ? { aaoifiLabel: 'Murabaha Profit Expense', ifrsLabel: 'Finance Cost' }
      : { aaoifiLabel: 'Murabaha Profit Income', ifrsLabel: 'Finance Income' },
    IJARA: fin
      ? { aaoifiLabel: 'Ijara Rent Expense', ifrsLabel: 'Lease Expense' }
      : { aaoifiLabel: 'Ijara Rent Income', ifrsLabel: 'Lease Income' },
    MUDARABA: fin
      ? { aaoifiLabel: 'Mudaraba Profit Share (Mudarib)', ifrsLabel: 'Finance Cost' }
      : { aaoifiLabel: 'Mudaraba Profit Share (Rab al-Maal)', ifrsLabel: 'Investment Income' },
    MUSHARAKA: fin
      ? { aaoifiLabel: 'Musharaka Profit Share Paid', ifrsLabel: 'Finance Cost' }
      : { aaoifiLabel: 'Musharaka Profit Share Received', ifrsLabel: 'Investment Income' },
    WAKALA: fin
      ? { aaoifiLabel: 'Wakala Agency Fee Expense', ifrsLabel: 'Finance Cost' }
      : { aaoifiLabel: 'Wakala Agency Fee Income', ifrsLabel: 'Investment Income' },
    SUKUK: fin
      ? { aaoifiLabel: 'Sukuk Profit Expense', ifrsLabel: 'Finance Cost (Bond Coupon)' }
      : { aaoifiLabel: 'Sukuk Profit Income', ifrsLabel: 'Investment Income (Bond Coupon)' },
    CUSTOM: fin
      ? { aaoifiLabel: 'Islamic Finance Profit Expense', ifrsLabel: 'Finance Cost' }
      : { aaoifiLabel: 'Islamic Finance Profit Income', ifrsLabel: 'Investment Income' },
  };
  return map[type] || map.CUSTOM;
}
async function mockGetIslamicPosition(id, asOf = null) {
  await new Promise((r) => setTimeout(r, 40));
  const a = _mockIslamicArrangements.find((x) => x.id === id);
  if (!a) throw new Error('arrangement not found');
  const asOfDate = asOf ? new Date(asOf) : new Date();
  let outstanding = Number(a.originalFacilityAmountKwd);
  let profitAccrued = 0;
  let profitPaid = 0;
  let profitUnearned = 0;
  let paidCount = 0;
  let overdueCount = 0;
  for (const row of a.schedule) {
    const profit = Number(row.profitPortionKwd);
    const principal = Number(row.principalPortionKwd);
    if (new Date(row.dueDate) <= asOfDate) {
      profitAccrued += profit;
      outstanding -= principal;
      if (row.status === 'PAID') {
        paidCount++;
        profitPaid += profit;
      } else {
        overdueCount++;
      }
    } else {
      profitUnearned += profit;
    }
  }
  return {
    arrangementId: a.id,
    asOf: asOfDate.toISOString(),
    outstandingPrincipalKwd: outstanding.toFixed(3),
    profitAccruedToDateKwd: profitAccrued.toFixed(3),
    profitPaidToDateKwd: profitPaid.toFixed(3),
    profitUnearnedKwd: profitUnearned.toFixed(3),
    installmentsPaidCount: paidCount,
    installmentsOverdueCount: overdueCount,
    labelPair: _mockLabelPair(a.arrangementType, a.direction),
  };
}

// ── Purchase Orders + Goods Receipts (FN-217+218) MOCK stubs. ──
let _mockPoCounter = 0;
let _mockPoLineCounter = 0;
let _mockGrCounter = 0;
let _mockGrLineCounter = 0;
const _mockPurchaseOrders = [];
const _mockGoodsReceipts = [];

async function mockListPurchaseOrders(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _mockPurchaseOrders.filter((p) => {
    if (filters.vendorId && p.vendorId !== filters.vendorId) return false;
    if (filters.status && p.status !== filters.status) return false;
    return true;
  });
}
async function mockGetPurchaseOrder(id) {
  await new Promise((r) => setTimeout(r, 30));
  const p = _mockPurchaseOrders.find((x) => x.id === id);
  if (!p) return null;
  const receipts = _mockGoodsReceipts
    .filter((g) => g.purchaseOrderId === id)
    .map((g) => ({ ...g, lines: g.lines.slice() }));
  return { ...p, lines: p.lines.slice(), receipts };
}
async function mockCreatePurchaseOrder(payload) {
  await new Promise((r) => setTimeout(r, 80));
  _mockPoCounter += 1;
  let total = 0;
  const lines = (payload.lines || []).map((l) => {
    _mockPoLineCounter += 1;
    const q = Number(l.quantity);
    const p = Number(l.unitPriceKwd);
    total += q * p;
    return {
      id: `mock-pol-${_mockPoLineCounter}`,
      purchaseOrderId: `mock-po-${_mockPoCounter}`,
      inventoryItemId: l.inventoryItemId || null,
      description: l.description,
      quantity: q.toFixed(2),
      unitPriceKwd: p.toFixed(3),
      lineTotalKwd: (q * p).toFixed(3),
    };
  });
  const row = {
    id: `mock-po-${_mockPoCounter}`,
    poNumber: payload.poNumber,
    vendorId: payload.vendorId,
    orderDate: payload.orderDate,
    expectedDeliveryDate: payload.expectedDeliveryDate || null,
    status: 'DRAFT',
    totalAmountKwd: total.toFixed(3),
    notes: payload.notes || null,
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lines,
  };
  _mockPurchaseOrders.unshift(row);
  return row;
}
async function mockTransitionPurchaseOrderStatus(id, status) {
  await new Promise((r) => setTimeout(r, 40));
  const p = _mockPurchaseOrders.find((x) => x.id === id);
  if (!p) throw new Error('purchase order not found');
  if ((p.status === 'CLOSED' || p.status === 'CANCELLED') && status !== p.status) {
    throw new Error(`cannot transition from ${p.status}.`);
  }
  p.status = status;
  p.updatedAt = new Date().toISOString();
  return p;
}
async function mockCreateGoodsReceipt(payload) {
  await new Promise((r) => setTimeout(r, 60));
  const po = _mockPurchaseOrders.find((p) => p.id === payload.purchaseOrderId);
  if (!po) throw new Error('purchase order not found');
  const poLineIds = new Set(po.lines.map((l) => l.id));
  for (const l of payload.lines || []) {
    if (!poLineIds.has(l.purchaseOrderLineId)) {
      throw new Error(`purchaseOrderLineId ${l.purchaseOrderLineId} does not belong to this PO.`);
    }
    if (!(Number(l.quantityReceived) > 0)) {
      throw new Error('quantityReceived must be > 0.');
    }
  }
  _mockGrCounter += 1;
  const lines = (payload.lines || []).map((l) => {
    _mockGrLineCounter += 1;
    return {
      id: `mock-grl-${_mockGrLineCounter}`,
      goodsReceiptId: `mock-gr-${_mockGrCounter}`,
      purchaseOrderLineId: l.purchaseOrderLineId,
      quantityReceived: Number(l.quantityReceived).toFixed(2),
      notes: l.notes || null,
    };
  });
  const gr = {
    id: `mock-gr-${_mockGrCounter}`,
    receiptNumber: payload.receiptNumber,
    purchaseOrderId: payload.purchaseOrderId,
    receivedDate: payload.receivedDate,
    receivedBy: 'mock-user',
    notes: payload.notes || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lines,
  };
  _mockGoodsReceipts.unshift(gr);
  return gr;
}

async function mockRunThreeWayMatch(input) {
  await new Promise((r) => setTimeout(r, 60));
  const po = _mockPurchaseOrders.find((p) => p.id === input.purchaseOrderId);
  if (!po) throw new Error('purchase order not found');
  const receipts = _mockGoodsReceipts.filter((g) => g.purchaseOrderId === input.purchaseOrderId);
  const receivedByLine = new Map();
  for (const g of receipts) {
    for (const rl of g.lines) {
      receivedByLine.set(
        rl.purchaseOrderLineId,
        (receivedByLine.get(rl.purchaseOrderLineId) || 0) + Number(rl.quantityReceived),
      );
    }
  }
  const billedByLine = new Map();
  if (input.billedQuantitiesByPoLine) {
    for (const [k, v] of Object.entries(input.billedQuantitiesByPoLine)) {
      billedByLine.set(k, Number(v));
    }
  }
  const discrepancies = [];
  let receivedValue = 0;
  let matchedLines = 0;
  for (const l of po.lines) {
    const ordered = Number(l.quantity);
    const received = receivedByLine.get(l.id) || 0;
    const billed = input.billId ? billedByLine.get(l.id) || 0 : null;
    receivedValue += received * Number(l.unitPriceKwd);
    let status;
    let note;
    if (received > ordered) {
      status = 'OVER_RECEIVED';
      note = `received ${received.toFixed(2)} > ordered ${ordered.toFixed(2)}`;
    } else if (received < ordered) {
      status = 'UNDER_RECEIVED';
      note = `received ${received.toFixed(2)} < ordered ${ordered.toFixed(2)}`;
    } else if (billed === null) {
      status = 'OK';
      note = 'PO↔GR match; no bill reference supplied';
      matchedLines++;
    } else if (billed === 0 && received > 0) {
      status = 'NOT_BILLED';
      note = 'received but not yet billed';
    } else if (billed > received) {
      status = 'OVER_BILLED';
      note = `billed ${billed.toFixed(2)} > received ${received.toFixed(2)}`;
    } else if (billed < received) {
      status = 'UNDER_BILLED';
      note = `billed ${billed.toFixed(2)} < received ${received.toFixed(2)}`;
    } else {
      status = 'OK';
      note = 'PO↔GR↔Bill match';
      matchedLines++;
    }
    discrepancies.push({
      purchaseOrderLineId: l.id,
      description: l.description,
      orderedQty: ordered.toFixed(2),
      receivedQty: received.toFixed(2),
      billedQty: billed == null ? null : billed.toFixed(2),
      unitPriceKwd: l.unitPriceKwd,
      qtyMatchStatus: status,
      note,
    });
  }
  const totalLines = po.lines.length;
  const confidence = totalLines > 0 ? Math.round((matchedLines / totalLines) * 100) : 100;
  const overallStatus = discrepancies.every((d) => d.qtyMatchStatus === 'OK')
    ? 'MATCHED'
    : 'DISCREPANCIES';
  return {
    purchaseOrderId: po.id,
    vendorId: po.vendorId,
    billId: input.billId || null,
    poTotalKwd: po.totalAmountKwd,
    receivedValueKwd: receivedValue.toFixed(3),
    billedAmountKwd: input.billedAmountKwd != null ? Number(input.billedAmountKwd).toFixed(3) : null,
    lineDiscrepancies: discrepancies,
    overallStatus,
    confidenceScore: confidence,
    note:
      overallStatus === 'MATCHED'
        ? `all ${totalLines} line(s) matched (${confidence}% confidence)`
        : `${discrepancies.filter((d) => d.qtyMatchStatus !== 'OK').length} discrepancy line(s) of ${totalLines} (${confidence}% confidence)`,
  };
}
async function mockPredictiveBillMatch(input) {
  await new Promise((r) => setTimeout(r, 50));
  const lookBack = input.lookBackDays ?? 120;
  const billDate = new Date(input.billDate);
  const earliest = new Date(billDate);
  earliest.setUTCDate(earliest.getUTCDate() - lookBack);
  const pos = _mockPurchaseOrders.filter(
    (p) =>
      p.vendorId === input.vendorId &&
      (p.status === 'OPEN' || p.status === 'PARTIALLY_RECEIVED') &&
      new Date(p.orderDate) >= earliest &&
      new Date(p.orderDate) <= billDate,
  );
  const billAmt = Number(input.billAmountKwd);
  const candidates = pos.map((po) => {
    const poTotal = Number(po.totalAmountKwd);
    const delta = billAmt - poTotal;
    const deltaPct = poTotal === 0 ? 100 : Math.abs(delta / poTotal) * 100;
    const dateDelta = Math.floor(
      (billDate.getTime() - new Date(po.orderDate).getTime()) / 86_400_000,
    );
    let score = 50;
    if (deltaPct <= 1) score += 30;
    else if (deltaPct <= 5) score += 20;
    else if (deltaPct <= 20) score += 10;
    if (dateDelta <= 14 && dateDelta >= 0) score += 15;
    else if (dateDelta <= 60 && dateDelta >= 0) score += 5;
    return {
      purchaseOrderId: po.id,
      poNumber: po.poNumber,
      vendorMatch: true,
      amountDeltaKwd: delta.toFixed(3),
      amountDeltaPercent: deltaPct.toFixed(2),
      dateDeltaDays: dateDelta,
      score,
      note: `Δamount ${delta.toFixed(3)} KWD (${deltaPct.toFixed(2)}%); Δdate ${dateDelta}d; score ${score}`,
    };
  });
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// ── Inventory NRV (FN-264) MOCK stubs. writedownPercent stored as
//    basis-points ×100 integer (500 = 5.00%) matching wire format. ──
let _mockNrvPolicyCounter = 0;
let _mockNrvBandCounter = 0;
const _mockNrvPolicies = [];

async function mockCreateNrvPolicy(payload) {
  await new Promise((r) => setTimeout(r, 60));
  _mockNrvPolicyCounter += 1;
  const id = `mock-nrvp-${_mockNrvPolicyCounter}`;
  const bands = (payload.bands || []).map((b) => {
    _mockNrvBandCounter += 1;
    return {
      id: `mock-nrvb-${_mockNrvBandCounter}`,
      policyId: id,
      minAgeDays: b.minAgeDays,
      maxAgeDays: b.maxAgeDays ?? null,
      writedownPercent: b.writedownPercent,
      label: b.label,
    };
  });
  const row = {
    id,
    plRoleCode: payload.plRoleCode || 'INVENTORY_OBSOLESCENCE_EXPENSE',
    liabilityRoleCode: payload.liabilityRoleCode || 'INVENTORY_OBSOLESCENCE_PROVISION',
    notes: payload.notes || null,
    activeFrom: payload.activeFrom,
    activeUntil: payload.activeUntil || null,
    createdBy: 'mock-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    bands,
  };
  _mockNrvPolicies.unshift(row);
  return row;
}
async function mockDeactivateNrvPolicy(id) {
  await new Promise((r) => setTimeout(r, 40));
  const p = _mockNrvPolicies.find((x) => x.id === id);
  if (!p) throw new Error('policy not found');
  const now = new Date().toISOString().slice(0, 10);
  if (now <= p.activeFrom) throw new Error('activeUntil must be strictly after activeFrom.');
  p.activeUntil = now;
  p.updatedAt = new Date().toISOString();
  return p;
}
async function mockGetActiveNrvPolicy(asOf = null) {
  await new Promise((r) => setTimeout(r, 30));
  const asOfStr = asOf || new Date().toISOString().slice(0, 10);
  const active = _mockNrvPolicies.find(
    (p) => p.activeFrom <= asOfStr && (!p.activeUntil || p.activeUntil > asOfStr),
  );
  return active || null;
}
async function mockListNrvPolicies() {
  await new Promise((r) => setTimeout(r, 30));
  return _mockNrvPolicies.slice();
}
function _mockPickNrvBand(bands, ageDays) {
  const eligible = bands.filter(
    (b) => ageDays > b.minAgeDays && (b.maxAgeDays === null || ageDays <= b.maxAgeDays),
  );
  if (eligible.length === 0) return null;
  return eligible.sort((a, b) => b.writedownPercent - a.writedownPercent)[0];
}
async function mockGetNrvAssessment(asOf = null) {
  await new Promise((r) => setTimeout(r, 60));
  const asOfStr = asOf || new Date().toISOString().slice(0, 10);
  const policy = await mockGetActiveNrvPolicy(asOfStr);
  if (!policy) {
    return {
      asOf: new Date(asOfStr).toISOString(),
      policyId: null,
      totalGrossKwd: '0.000',
      totalWritedownKwd: '0.000',
      totalNrvKwd: '0.000',
      rows: [],
      warnings: ['no active InventoryNrvPolicy at asOf'],
    };
  }
  // Mock items with synthetic ages.
  const items = [
    { id: 'mock-inv-1', sku: 'SKU-001', qty: 100, cost: 1.5, ageDays: 20 },
    { id: 'mock-inv-2', sku: 'SKU-002', qty: 50, cost: 2.25, ageDays: 95 },
    { id: 'mock-inv-3', sku: 'SKU-003', qty: 30, cost: 10.0, ageDays: 220 },
    { id: 'mock-inv-4', sku: 'SKU-004', qty: 10, cost: 50.0, ageDays: 400 },
    { id: 'mock-inv-5', sku: 'SKU-005', qty: 0, cost: 5.0, ageDays: null },
    { id: 'mock-inv-6', sku: 'SKU-006', qty: 8, cost: 12.5, ageDays: null },
  ];
  let totalGross = 0;
  let totalWritedown = 0;
  let totalNrv = 0;
  const warnings = [];
  const rows = items.map((it) => {
    const gross = it.qty * it.cost;
    if (it.qty <= 0) {
      totalGross += gross;
      totalNrv += gross;
      return {
        itemId: it.id,
        sku: it.sku,
        ageDays: null,
        matchedBandLabel: null,
        matchedBandPercent: 0,
        currentQuantity: it.qty.toFixed(2),
        currentAvgCost: it.cost.toFixed(3),
        grossValueKwd: gross.toFixed(3),
        writedownKwd: '0.000',
        nrvKwd: gross.toFixed(3),
        note: 'no on-hand quantity',
      };
    }
    if (it.ageDays == null) {
      warnings.push(`item ${it.sku}: no stock movements — age unknown, no writedown applied`);
      totalGross += gross;
      totalNrv += gross;
      return {
        itemId: it.id,
        sku: it.sku,
        ageDays: null,
        matchedBandLabel: null,
        matchedBandPercent: 0,
        currentQuantity: it.qty.toFixed(2),
        currentAvgCost: it.cost.toFixed(3),
        grossValueKwd: gross.toFixed(3),
        writedownKwd: '0.000',
        nrvKwd: gross.toFixed(3),
        note: 'no movements',
      };
    }
    const band = _mockPickNrvBand(policy.bands, it.ageDays);
    const bandPct = band ? band.writedownPercent : 0;
    const writedown = (gross * bandPct) / 10000;
    const nrv = gross - writedown;
    totalGross += gross;
    totalWritedown += writedown;
    totalNrv += nrv;
    return {
      itemId: it.id,
      sku: it.sku,
      ageDays: it.ageDays,
      matchedBandLabel: band ? band.label : null,
      matchedBandPercent: bandPct,
      currentQuantity: it.qty.toFixed(2),
      currentAvgCost: it.cost.toFixed(3),
      grossValueKwd: gross.toFixed(3),
      writedownKwd: writedown.toFixed(3),
      nrvKwd: nrv.toFixed(3),
      note: band ? `matched band "${band.label}"` : 'no matching band — no writedown',
    };
  });
  return {
    asOf: new Date(asOfStr).toISOString(),
    policyId: policy.id,
    totalGrossKwd: totalGross.toFixed(3),
    totalWritedownKwd: totalWritedown.toFixed(3),
    totalNrvKwd: totalNrv.toFixed(3),
    rows,
    warnings,
  };
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
      // mockEngine does not export getHealth (only getHealthScore, which
      // is a different shape). Force the shim in MOCK mode so the named
      // export below is always defined and the bundler does not flag
      // an undefined import. See HASEEB-142.
      getHealth: mockHealth,
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

// Leave provision (FN-255, Phase 4 Track A Tier 5 — 2026-04-19).
// Per-tenant effective-dated leave accrual policy + per-employee
// balance register + provision compute. Drives month-end accrual JEs
// via a future runner (jeScope='leave_accrual').
export const listLeavePolicies = surface.listLeavePolicies;
export const getActiveLeavePolicy = surface.getActiveLeavePolicy;
export const createLeavePolicy = surface.createLeavePolicy;
export const updateLeavePolicy = surface.updateLeavePolicy;
export const listLeaveBalances = surface.listLeaveBalances;
export const getLeaveBalance = surface.getLeaveBalance;
export const upsertLeaveBalance = surface.upsertLeaveBalance;
export const getLeaveProvisionSummary = surface.getLeaveProvisionSummary;
export const getLeaveProvisionForEmployee = surface.getLeaveProvisionForEmployee;

// CBK rates (FN-238, Phase 4 Track A Tier 5 — 2026-04-19).
// Central Bank of Kuwait exchange-rate register. Manual entry only in
// this partial; scheduled fetcher + bank-embedded sources reserved.
// Consumers: FX revaluation (FN-175), bilingual reports.
export const listCbkRates = surface.listCbkRates;
export const getCbkRate = surface.getCbkRate;
export const lookupCbkRateForDate = surface.lookupCbkRateForDate;
export const lookupLatestCbkRate = surface.lookupLatestCbkRate;
export const getCbkRateStaleness = surface.getCbkRateStaleness;
export const upsertCbkRate = surface.upsertCbkRate;
export const deleteCbkRate = surface.deleteCbkRate;

// Board pack (FN-258, Phase 4 Track A Tier 5 — 2026-04-19).
// Annual composite: current+prior report versions + YoY comparisons +
// disclosure-note summaries + warnings. OWNER+AUDITOR only.
export const getBoardPack = surface.getBoardPack;

// OCR gating (FN-224, Phase 4 Track A Tier 5 — 2026-04-19).
// Receipt / statement OCR extraction review surface. Upload pipelines
// record extractions; OWNER approves/rejects; OWNER+ACCOUNTANT correct
// individual fields.
export const listOcrExtractions = surface.listOcrExtractions;
export const getOcrExtraction = surface.getOcrExtraction;
export const recordOcrExtraction = surface.recordOcrExtraction;
export const correctOcrField = surface.correctOcrField;
export const approveOcrExtraction = surface.approveOcrExtraction;
export const rejectOcrExtraction = surface.rejectOcrExtraction;

// Inventory count (FN-263, Phase 4 Track A Tier 4 — 2026-04-19).
// Physical count session lifecycle + variance JE-shape preview.
// Memo-only; POSTED state deferred pending backend JE splice.
export const listInventoryCounts = surface.listInventoryCounts;
export const getInventoryCount = surface.getInventoryCount;
export const createInventoryCount = surface.createInventoryCount;
export const snapshotInventoryCount = surface.snapshotInventoryCount;
export const recordInventoryCountLine = surface.recordInventoryCountLine;
export const reconcileInventoryCount = surface.reconcileInventoryCount;
export const cancelInventoryCount = surface.cancelInventoryCount;
export const getInventoryCountVarianceJeShape = surface.getInventoryCountVarianceJeShape;

// Spinoff (FN-242, Phase 4 Track A Tier 4 — 2026-04-19).
// Entity split lifecycle with A=L+E balance check. Memo-only until
// backend JE splice ships.
export const listSpinoffEvents = surface.listSpinoffEvents;
export const getSpinoffEvent = surface.getSpinoffEvent;
export const createSpinoffEvent = surface.createSpinoffEvent;
export const addSpinoffTransfer = surface.addSpinoffTransfer;
export const removeSpinoffTransfer = surface.removeSpinoffTransfer;
export const validateSpinoffEvent = surface.validateSpinoffEvent;
export const approveSpinoffEvent = surface.approveSpinoffEvent;
export const cancelSpinoffEvent = surface.cancelSpinoffEvent;
export const getSpinoffBalanceCheck = surface.getSpinoffBalanceCheck;
export const listIslamicArrangements = surface.listIslamicArrangements;
export const getIslamicArrangement = surface.getIslamicArrangement;
export const createIslamicArrangement = surface.createIslamicArrangement;
export const transitionIslamicStatus = surface.transitionIslamicStatus;
export const generateIslamicSchedule = surface.generateIslamicSchedule;
export const markIslamicInstallmentPaid = surface.markIslamicInstallmentPaid;
export const getIslamicPosition = surface.getIslamicPosition;
export const listPurchaseOrders = surface.listPurchaseOrders;
export const getPurchaseOrder = surface.getPurchaseOrder;
export const createPurchaseOrder = surface.createPurchaseOrder;
export const transitionPurchaseOrderStatus = surface.transitionPurchaseOrderStatus;
export const createGoodsReceipt = surface.createGoodsReceipt;
export const runThreeWayMatch = surface.runThreeWayMatch;
export const predictiveBillMatch = surface.predictiveBillMatch;
export const getTenantFlags = surface.getTenantFlags;
export const updateTenantFlags = surface.updateTenantFlags;
export const createNrvPolicy = surface.createNrvPolicy;
export const deactivateNrvPolicy = surface.deactivateNrvPolicy;
export const getActiveNrvPolicy = surface.getActiveNrvPolicy;
export const listNrvPolicies = surface.listNrvPolicies;
export const getNrvAssessment = surface.getNrvAssessment;

// CFO TodayScreen composite reads (Track B Dispatch 3a+3b, 2026-04-20).
// getCFOTodayQueue, getCloseStatus, getCFOAminahNotes, getTeamActivity,
// getEngineStatus, getSuggestedCategorizationRules,
// getSuggestedRoutingRules are all on mockEngine's namespace — the
// Object.keys(mockEngine) loop in buildLiveSurface picks them up via
// FUNCTION_ROUTING + REAL_IMPLS above. Named exports below so screens
// can import them from '../../engine' uniformly.
export const getCFOTodayQueue = surface.getCFOTodayQueue;
export const getCloseStatus = surface.getCloseStatus;
export const getCFOAminahNotes = surface.getCFOAminahNotes;
export const getTeamActivity = surface.getTeamActivity;
export const getEngineStatus = surface.getEngineStatus;
export const getSuggestedCategorizationRules = surface.getSuggestedCategorizationRules;
export const getSuggestedRoutingRules = surface.getSuggestedRoutingRules;

// Administration (Track B Dispatch 2, 2026-04-20). Tenant-wide admin
// surface. Backed by corporate-api; MOCK mode delegates to the legacy
// mockEngine integrations + audit-log trio via buildMockExtras.
export const listAdminIntegrations = surface.listAdminIntegrations;
export const addAdminIntegration = surface.addAdminIntegration;
export const removeAdminIntegration = surface.removeAdminIntegration;
export const listAdminAuditLog = surface.listAdminAuditLog;

// Settings — personal surface (Track B Dispatch 2 wire 3, 2026-04-20).
// Notifications, sessions, 2FA, and personal activity. Role is derived
// from JWT on the backend; these wrappers take no role argument. See
// src/api/settings.js + buildMockExtras above for the MOCK adapter that
// handles the legacy role-arg mockEngine signatures transparently.
export const getNotificationPreferences = surface.getNotificationPreferences;
export const updateNotificationPreferences = surface.updateNotificationPreferences;
export const getActiveSessions = surface.getActiveSessions;
export const signOutSession = surface.signOutSession;
export const signOutAllOtherSessions = surface.signOutAllOtherSessions;
export const getTwoFactorStatus = surface.getTwoFactorStatus;
export const disableTwoFactor = surface.disableTwoFactor;
export const getMyActivity = surface.getMyActivity;
// getAminahInsights is an "extras" call (NOT on mockEngine's namespace)
// that returns the full structured insights payload — used by
// TodayScreen's Aminah's Notes panel to surface suggestedAction buttons
// and lowConfidence affordances. LIVE routes to the cfo-today API
// wrapper; MOCK returns an empty shape so the UI renders its empty-
// state rather than pretending there are narrations.
export const getAminahInsights = surface.getAminahInsights;

// Banking — bank accounts surface (Track B Dispatch 4 wire 4, 2026-04-20).
// Canonical backend naming: listBankAccounts / getBankAccountStatement /
// getBankAccountSummary (options-object signature with calendar ranges per
// HASEEB-148). MOCK mode adapts via buildMockExtras above to the legacy
// mockEngine positional-arg signatures so screens call one surface in
// both modes.
export const listBankAccounts = surface.listBankAccounts;
export const getBankAccountStatement = surface.getBankAccountStatement;
export const getBankAccountSummary = surface.getBankAccountSummary;

// Reconciliation — Track B Dispatch 5 + 5a/5b/5c wire 5 (2026-04-20).
//
// Canonical backend naming with `*Live` suffix where the mockEngine has a
// same-named legacy function (dashboard, reopen, lock, import, resolveException,
// confirmSuggestion, dismissSuggestion, getPrimaryOperatingAccount). Plain
// names for brand-new surface (getFiscalPeriodStatus, exportReconciliationCsv,
// createReconciliationJournalEntry, parseStatementLive).
//
// Shape caveat (see src/api/reconciliation.js file-level comment):
//   The EXISTING getReconciliationDashboard + getReconciliationById +
//   getReconciliationHistory mock readers return a much richer nested shape
//   than the live backend currently surfaces. Adapting those three readers
//   would require inventing fields (`pendingSuggestions`, per-match
//   `matchTier`, `period: {month,year,label}`, `openingBalance /
//   closingLedgerBalance`, `exceptions[]` with `type + suggestedAction`) and
//   is STOPPED-AND-FLAGGED for a follow-up wire. Per wire 5 spec ("Do NOT
//   refactor the screen architecture"), the dashboard/getById read path stays
//   on mockEngine while the 11 ACTION endpoints below go live.
//
// 12 wrappers / 11 line-items (reopen + lock bundle per Checkpoint A):
export const getReconciliationDashboardLive = surface.getReconciliationDashboardLive;
export const getPrimaryOperatingAccountLive = surface.getPrimaryOperatingAccountLive;
export const getFiscalPeriodStatus = surface.getFiscalPeriodStatus;
export const reopenReconciliationLive = surface.reopenReconciliationLive;
export const lockReconciliationLive = surface.lockReconciliationLive;
export const importStatementLive = surface.importStatementLive;
export const exportReconciliationCsv = surface.exportReconciliationCsv;
export const resolveExceptionLive = surface.resolveExceptionLive;
export const confirmSuggestionLive = surface.confirmSuggestionLive;
export const dismissSuggestionLive = surface.dismissSuggestionLive;
export const createReconciliationJournalEntry = surface.createReconciliationJournalEntry;
export const parseStatementLive = surface.parseStatementLive;

// Budgets — Track B Dispatch 6 wire 6 (2026-04-20).
//
// 16 canonical backend-aligned wrappers exposed with `*Live` suffix to
// coexist with the legacy mockEngine functions of colliding names (which
// remain in place because the existing BudgetScreen consumes a richer
// DTO than the live backend surfaces — see src/api/budgets.js file
// header for the flagged-shape-delta list). Screens that opt into the
// live surface swap their imports explicitly to these `*Live` names.
//
// Legacy mock-shaped budget surface — these ARE on mockEngine's namespace,
// picked up by the Object.keys(mockEngine) loop in buildLiveSurface +
// routed via mock_fallback (LIVE mode warns once, then returns mock
// data). They MUST be re-exported here so screens that import them from
// `../../engine` get the router-wrapped function (MOCK-mode mockEngine
// or LIVE-mode mock_fallback wrapper) rather than `undefined`. The
// screen rewire keeps the same semantic shape; a future wire that
// reshapes the screen to the live budgets DTO can swap these exports
// one at a time.
export const getActiveBudget = surface.getActiveBudget;
export const getActiveBudgetSummary = surface.getActiveBudgetSummary;
export const getBudgetVarianceByDepartment = surface.getBudgetVarianceByDepartment;
export const getBudgetVarianceByLineItem = surface.getBudgetVarianceByLineItem;
export const getBudgetById = surface.getBudgetById;
export const getAllBudgets = surface.getAllBudgets;
export const getTeamMembers = surface.getTeamMembers;
export const approveBudget = surface.approveBudget;
export const delegateBudget = surface.delegateBudget;
export const getBudgetForYear = surface.getBudgetForYear;
export const updateBudgetLine = surface.updateBudgetLine;
export const deleteBudgetLine = surface.deleteBudgetLine;
export const createBudgetLine = surface.createBudgetLine;
export const addBudgetLineComment = surface.addBudgetLineComment;
export const getBudgetLineComments = surface.getBudgetLineComments;
export const deleteBudgetLineComment = surface.deleteBudgetLineComment;
export const updateBudgetLineItemValue = surface.updateBudgetLineItemValue;
export const submitDepartment = surface.submitDepartment;
export const getBudgetWorkflowSummary = surface.getBudgetWorkflowSummary;

// Group A — reads:
export const getBudgetSummaryLive = surface.getBudgetSummaryLive;
export const getBudgetVarianceLive = surface.getBudgetVarianceLive;
export const getBudgetForYearLive = surface.getBudgetForYearLive;
// Group B — per-line CRUD:
export const createBudgetLineLive = surface.createBudgetLineLive;
export const updateBudgetLineLive = surface.updateBudgetLineLive;
export const deleteBudgetLineLive = surface.deleteBudgetLineLive;
// Group C — approval workflow:
export const submitBudgetForApprovalLive = surface.submitBudgetForApprovalLive;
export const delegateBudgetLive = surface.delegateBudgetLive;
export const approveBudgetDepartmentLive = surface.approveBudgetDepartmentLive;
export const requestDepartmentRevisionLive = surface.requestDepartmentRevisionLive;
export const requestBudgetChangesLive = surface.requestBudgetChangesLive;
// Group D — comments:
export const addBudgetLineCommentLive = surface.addBudgetLineCommentLive;
export const listBudgetLineCommentsLive = surface.listBudgetLineCommentsLive;
export const deleteBudgetLineCommentLive = surface.deleteBudgetLineCommentLive;
// Group E — state + team:
export const getBudgetApprovalStateLive = surface.getBudgetApprovalStateLive;
export const listTeamMembersLive = surface.listTeamMembersLive;
