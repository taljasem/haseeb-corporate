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
import * as recurrencePatternsApi from '../api/recurrence-patterns';
import * as reconciliationApi from '../api/reconciliation';
import * as budgetsApi from '../api/budgets';
import * as migrationImportApi from '../api/migration-import';
import * as vendorsApi from '../api/vendors';
import * as customersApi from '../api/customers';
import * as recurringEntriesApi from '../api/recurring-entries';
import * as payrollApi from '../api/payroll';
import * as paymentVouchersApi from '../api/paymentVouchers';
import * as bankMandatesApi from '../api/bankMandates';
import * as pifssReconciliationApi from '../api/pifssReconciliation';
import * as yearEndCloseApi from '../api/yearEndClose';
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

  // YEAR-END-FS-TRIO (AUDIT-ACC-040 / HASEEB-213 / HASEEB-216).
  // SOCIE + disclosure-notes fetch wrappers are mock-backed for now —
  // see HASEEB-223. Wired here so callers import them from the same
  // surface as the other FS readers.
  getStatementOfChangesInEquity: 'wired',
  getDisclosureNotes: 'wired',

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
  // Aging action writes — AUDIT-ACC-005 (corporate-api 3fdb92c,
  // 2026-04-22). Three new invoice-lifecycle writes, all OWNER/ACCOUNTANT
  // gated at the backend. writeOffInvoice supersedes the old mock-only
  // createWriteOffJE (HASEEB-068 resolved by 3fdb92c; category is
  // preserved as metadata only in v1 — GL-flexibility follow-up tracked
  // as HASEEB-194). disputeInvoice supersedes the old mock-only
  // markInvoiceDisputed. scheduleInvoicePaymentPlan is AR-only; the
  // AP scheduleVendorPayment mock stays (HASEEB-195 follow-up).
  writeOffInvoice: 'wired',
  disputeInvoice: 'wired',
  scheduleInvoicePaymentPlan: 'wired',
  // getChartOfAccounts — route to the existing getAccountsFlat wiring
  // so modals' GL dropdowns pick up real Expenses accounts in LIVE mode.
  // MOCK mode falls back to mockEngine.getChartOfAccounts (which returns
  // a different shape — category-vs-type — and the old WriteOffModal's
  // `a.type === 'Expenses'` filter was broken in MOCK — see HASEEB-071
  // for the separate mock-shape fix). Retained here because logPayment's
  // bank-account picker still uses this.
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
  // exportBankAccountStatement — new in HASEEB-180 (corporate-api 2ff14dc,
  // 2026-04-21). "Extras" name (no mockEngine counterpart); wired via
  // buildLiveSurface direct assignment + buildMockExtras stub below.
  exportBankAccountStatement: 'wired',

  // Recurrence patterns — Tier C-3 FOLLOW-UP (Aminah missed-recurrence
  // surface, corporate-api HASEEB-183 at aff0764, 2026-04-21). Operator-
  // only mutation (OWNER / ACCOUNTANT on the backend; midsize FE hides
  // for Junior). "Extras" name NOT on mockEngine's namespace; wired via
  // buildLiveSurface direct assignment + a minimal buildMockExtras stub.
  suspendRecurrencePattern: 'wired',

  // Migration Import — Track 1 Migration Wizard (2026-04-20). Twelve
  // wrappers: 3 ingest + 3 staged reads + 5 source-account-map + 2
  // post/reject. All are "extras" names NOT on mockEngine's namespace;
  // wired via buildLiveSurface direct assignment + buildMockExtras MOCK
  // adapters (the mock returns empty/placeholder data so dev can navigate
  // the wizard without a live backend). These routing table entries are
  // documentation — the assignments below are what route the calls.
  ingestInvoices: 'wired',
  ingestBills: 'wired',
  ingestJournalEntries: 'wired',
  listStagedInvoices: 'wired',
  listStagedBills: 'wired',
  listStagedJournalEntries: 'wired',
  listSourceAccountMap: 'wired',
  suggestSourceMap: 'wired',
  suggestAllSourceMap: 'wired',
  declineSuggestion: 'wired',
  updateSourceMap: 'wired',
  postStagedItem: 'wired',
  rejectStagedItem: 'wired',

  // Recurring entries — AUDIT-ACC-010 (corporate-api 65ccaf6, 2026-04-22).
  // Eight wrappers on /api/recurring-entries. All "extras" names NOT on
  // mockEngine's namespace; wired via buildLiveSurface direct assignment
  // + buildMockExtras MOCK stubs. Routing-table entries are documentation.
  //
  // Behavior change: fire-next + process produce DRAFT JEs (not POSTED)
  // and emit AminahAdvisorPending rows with sourceType='RECURRING_ENTRY'.
  // HASEEB-200 wall fix is shipped backend-side; the frontend's existing
  // AdvisorPending queue picks these up generically.
  //
  // The old mockEngine template lifecycle (getManualJETemplates /
  // createFromTemplate / saveAsTemplate / useJETemplate / getJETemplateMeta
  // / deleteJETemplateRecord / scheduleManualJE / postScheduledNow) is
  // superseded by this surface. See buildLiveSurface / buildMockExtras
  // below for the thin adapters that map the legacy mock names onto
  // the new LIVE surface so ManualJEScreen keeps working in both modes.
  listRecurringEntries: 'wired',
  getRecurringEntry: 'wired',
  createRecurringEntry: 'wired',
  updateRecurringEntry: 'wired',
  deleteRecurringEntry: 'wired',
  processRecurringEntries: 'wired',
  fireRecurringEntryNow: 'wired',
  listRecurringEntryInstances: 'wired',

  // Payroll — AUDIT-ACC-013 (2026-04-22). 23 wrappers across three
  // sub-surfaces: Employees (10) + TenantPayrollConfig (2) + PIFSS
  // submissions (4) + PayrollRuns (7). All "extras" names NOT on
  // mockEngine's namespace; wired via buildLiveSurface direct
  // assignment + buildMockExtras MOCK stubs. Role gates enforced by
  // backend. downloadWpsFile returns {blob, filename} — raw SIF
  // text/plain response from the backend (differs from HASEEB-180
  // bank-account export which is JSON-wrapped base64).
  listEmployees: 'wired',
  getEmployee: 'wired',
  createEmployee: 'wired',
  updateEmployee: 'wired',
  terminateEmployee: 'wired',
  getEmployeeEos: 'wired',
  registerEmployeeRehire: 'wired',
  classifyServiceContinuity: 'wired',
  getEmployeeEosHistory: 'wired',
  getEmployeeAdvances: 'wired',
  getTenantPayrollConfig: 'wired',
  updateEosiReformDate: 'wired',
  listPifssSubmissions: 'wired',
  generatePifssFile: 'wired',
  getPifssSubmission: 'wired',
  updatePifssSubmissionStatus: 'wired',
  getPayrollHistory: 'wired',
  getPayrollRun: 'wired',
  runPayroll: 'wired',
  accrueEos: 'wired',
  approvePayroll: 'wired',
  payPayroll: 'wired',
  downloadWpsFile: 'wired',
  downloadPayslip: 'wired',

  // Payment Vouchers — AUDIT-ACC-002 (2026-04-22). 13 voucher endpoints
  // + 3 mandate read endpoints on /api/payment-vouchers and
  // /api/bank-mandates (FN-274). All names NEW and NOT on mockEngine's
  // namespace; both MOCK and LIVE are assigned as extras via
  // buildLiveSurface / buildMockExtras. Only the action-write toasts
  // surface in the screen — list + detail run in both modes against a
  // small in-memory mock fixture so the composer + lifecycle exercise
  // without a live backend.
  listVouchers: 'wired',
  getVoucher: 'wired',
  createVoucher: 'wired',
  patchVoucher: 'wired',
  submitVoucher: 'wired',
  reviewVoucher: 'wired',
  approveVoucher: 'wired',
  assignSignatories: 'wired',
  signVoucher: 'wired',
  markVoucherPaid: 'wired',
  rejectVoucher: 'wired',
  cancelVoucher: 'wired',
  getVoucherAminahStatus: 'wired',
  listMandates: 'wired',
  getMandate: 'wired',
  listMandateSignatories: 'wired',

  // Annual PIFSS Reconciliation — AUDIT-ACC-058 (2026-04-22). 5
  // endpoints on /api/pifss-reconciliation (FN-251) + 1 client-side
  // aggregation (listReconciliationYears) that probes current-year and
  // two priors since backend has no list-years endpoint yet
  // (HASEEB-215 follow-up). All names NEW and NOT on mockEngine's
  // namespace; assigned as extras via buildLiveSurface / buildMockExtras.
  listReconciliationYears: 'wired',
  getReconciliation: 'wired',
  getReconciliationReport: 'wired',
  importStatement: 'wired',
  runReconciliation: 'wired',
  resolveVariance: 'wired',

  // Year-End Close — AUDIT-ACC-003 (2026-04-22). 7 endpoints on
  // /api/year-end-close (FN-271, TASK-WAVE5-YEAR-END-ROLLOVER). All
  // names NEW and NOT on mockEngine's namespace; assigned as extras
  // via buildLiveSurface / buildMockExtras. Annual fiscal-year close
  // — distinct from the monthly close surface on the Aminah advisor
  // pipeline + /api/monthly-close-checklist.
  getYearEndCloseConfig: 'wired',
  updateYearEndCloseConfig: 'wired',
  prepareYearEndClose: 'wired',
  listYearEndCloseRecords: 'wired',
  approveYearEndClose: 'wired',
  reverseYearEndClose: 'wired',
  getYearEndClose: 'wired',
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

  // YEAR-END-FS-TRIO. Both reads fall back to mockEngine inside the
  // api/reports.js wrapper until a dedicated HTTP route lands
  // (HASEEB-223).
  getStatementOfChangesInEquity: reportsApi.getStatementOfChangesInEquity,
  getDisclosureNotes: reportsApi.getDisclosureNotes,

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
  // Aging action writes (AUDIT-ACC-005, corporate-api 3fdb92c,
  // 2026-04-22). The three new invoice-lifecycle writes replace the
  // old mock-only createWriteOffJE + markInvoiceDisputed. HASEEB-068
  // (backend write-off JE path) is closed by this backend dispatch;
  // HASEEB-194 (GL-flexible category routing) is the v2 follow-up.
  // scheduleInvoicePaymentPlan is AR-only installment plans; the AP
  // scheduleVendorPayment mock remains (HASEEB-195 follow-up).
  writeOffInvoice: invoicesApi.writeOffInvoice,
  disputeInvoice: invoicesApi.disputeInvoice,
  scheduleInvoicePaymentPlan: invoicesApi.scheduleInvoicePaymentPlan,

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

  // Vendors + Customers KYC admin (FN-272, 2026-04-19). Backend live at
  // corporate-api 493030e (HASEEB-143). Both surfaces parallel: 5 wrappers
  // each. listVendorsForRelatedParty / listCustomersForRelatedParty
  // already exist on the related-party API path and stay there — these
  // are the full CRUD surface for the new SetupScreen sub-sections.
  listVendors: vendorsApi.listVendors,
  getVendor: vendorsApi.getVendor,
  createVendor: vendorsApi.createVendor,
  updateVendor: vendorsApi.updateVendor,
  deactivateVendor: vendorsApi.deactivateVendor,
  listCustomers: customersApi.listCustomers,
  getCustomer: customersApi.getCustomer,
  createCustomer: customersApi.createCustomer,
  updateCustomer: customersApi.updateCustomer,
  deactivateCustomer: customersApi.deactivateCustomer,

  // Recurring entries — AUDIT-ACC-010 (corporate-api 65ccaf6, 2026-04-22).
  listRecurringEntries: recurringEntriesApi.listRecurringEntries,
  getRecurringEntry: recurringEntriesApi.getRecurringEntry,
  createRecurringEntry: recurringEntriesApi.createRecurringEntry,
  updateRecurringEntry: recurringEntriesApi.updateRecurringEntry,
  deleteRecurringEntry: recurringEntriesApi.deleteRecurringEntry,
  processRecurringEntries: recurringEntriesApi.processRecurringEntries,
  fireRecurringEntryNow: recurringEntriesApi.fireRecurringEntryNow,
  listRecurringEntryInstances: recurringEntriesApi.listRecurringEntryInstances,

  // Payroll — AUDIT-ACC-013 (2026-04-22). 23 wrappers (employees +
  // tenant-payroll-config + PIFSS submissions + payroll runs + WPS).
  listEmployees: payrollApi.listEmployees,
  getEmployee: payrollApi.getEmployee,
  createEmployee: payrollApi.createEmployee,
  updateEmployee: payrollApi.updateEmployee,
  terminateEmployee: payrollApi.terminateEmployee,
  getEmployeeEos: payrollApi.getEmployeeEos,
  registerEmployeeRehire: payrollApi.registerEmployeeRehire,
  classifyServiceContinuity: payrollApi.classifyServiceContinuity,
  getEmployeeEosHistory: payrollApi.getEmployeeEosHistory,
  getEmployeeAdvances: payrollApi.getEmployeeAdvances,
  getTenantPayrollConfig: payrollApi.getTenantPayrollConfig,
  updateEosiReformDate: payrollApi.updateEosiReformDate,
  listPifssSubmissions: payrollApi.listPifssSubmissions,
  generatePifssFile: payrollApi.generatePifssFile,
  getPifssSubmission: payrollApi.getPifssSubmission,
  updatePifssSubmissionStatus: payrollApi.updatePifssSubmissionStatus,
  getPayrollHistory: payrollApi.getPayrollHistory,
  getPayrollRun: payrollApi.getPayrollRun,
  runPayroll: payrollApi.runPayroll,
  accrueEos: payrollApi.accrueEos,
  approvePayroll: payrollApi.approvePayroll,
  payPayroll: payrollApi.payPayroll,
  downloadWpsFile: payrollApi.downloadWpsFile,
  downloadPayslip: payrollApi.downloadPayslip,

  // Payment Vouchers + Bank Mandates — AUDIT-ACC-002 (2026-04-22).
  // Full 13/3 wrappers against the FN-274 backend. Mandate CRUD
  // (create/acknowledge/cancel/assign/revoke) is NOT wired this wave —
  // tracked as HASEEB-210 for a dedicated Owner-side mandate admin
  // surface. The composer + detail views only need the 3 read wrappers
  // in this list.
  listVouchers: paymentVouchersApi.listVouchers,
  getVoucher: paymentVouchersApi.getVoucher,
  createVoucher: paymentVouchersApi.createVoucher,
  patchVoucher: paymentVouchersApi.patchVoucher,
  submitVoucher: paymentVouchersApi.submitVoucher,
  reviewVoucher: paymentVouchersApi.reviewVoucher,
  approveVoucher: paymentVouchersApi.approveVoucher,
  assignSignatories: paymentVouchersApi.assignSignatories,
  signVoucher: paymentVouchersApi.signVoucher,
  markVoucherPaid: paymentVouchersApi.markVoucherPaid,
  rejectVoucher: paymentVouchersApi.rejectVoucher,
  cancelVoucher: paymentVouchersApi.cancelVoucher,
  getVoucherAminahStatus: paymentVouchersApi.getVoucherAminahStatus,
  listMandates: bankMandatesApi.listMandates,
  getMandate: bankMandatesApi.getMandate,
  listMandateSignatories: bankMandatesApi.listMandateSignatories,

  // Annual PIFSS Reconciliation — AUDIT-ACC-058 (2026-04-22).
  listReconciliationYears: pifssReconciliationApi.listReconciliationYears,
  getReconciliation: pifssReconciliationApi.getReconciliation,
  getReconciliationReport: pifssReconciliationApi.getReconciliationReport,
  importStatement: pifssReconciliationApi.importStatement,
  runReconciliation: pifssReconciliationApi.runReconciliation,
  resolveVariance: pifssReconciliationApi.resolveVariance,

  // Year-End Close — AUDIT-ACC-003 (2026-04-22). 7 endpoints (FN-271).
  getYearEndCloseConfig: yearEndCloseApi.getYearEndCloseConfig,
  updateYearEndCloseConfig: yearEndCloseApi.updateYearEndCloseConfig,
  prepareYearEndClose: yearEndCloseApi.prepareYearEndClose,
  listYearEndCloseRecords: yearEndCloseApi.listYearEndCloseRecords,
  approveYearEndClose: yearEndCloseApi.approveYearEndClose,
  reverseYearEndClose: yearEndCloseApi.reverseYearEndClose,
  getYearEndClose: yearEndCloseApi.getYearEndClose,
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
  // HASEEB-180 (corporate-api 2ff14dc, 2026-04-21): export the statement in
  // CSV / PDF / XLSX. JSON-wrapped response; PDF/XLSX bytes are base64 in
  // `data` so no special axios response type is needed.
  surface.exportBankAccountStatement = bankAccountsApi.exportBankAccountStatement;

  // Aging action writes — AUDIT-ACC-005 (corporate-api 3fdb92c,
  // 2026-04-22). The three new invoice-lifecycle writes are NEW engine
  // surface names NOT on mockEngine's namespace, so they must be
  // assigned here (the Object.keys(mockEngine) loop above does not
  // pick them up). See FUNCTION_ROUTING + REAL_IMPLS blocks above for
  // the parallel routing-table entries and the buildMockExtras() block
  // below for the MOCK parity stubs.
  surface.writeOffInvoice = invoicesApi.writeOffInvoice;
  surface.disputeInvoice = invoicesApi.disputeInvoice;
  surface.scheduleInvoicePaymentPlan = invoicesApi.scheduleInvoicePaymentPlan;

  // Recurrence patterns — Tier C-3 FOLLOW-UP (HASEEB-183, aff0764,
  // 2026-04-21). Aminah surfaces missed-recurrence alerts via the
  // read-only `get_missing_recurrences` tool; suspending a pattern is an
  // operator-only mutation gated OWNER / ACCOUNTANT backend-side.
  surface.suspendRecurrencePattern = recurrencePatternsApi.suspendRecurrencePattern;

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
  // Three OWNER-only status-transition endpoints (2026-04-21). Reject is
  // now a proper terminal state (no more "REJECTED: "-notes-prefix
  // workaround on request-changes); lock and reopen-to-draft close the
  // previous placeholder toasts.
  //   lock            APPROVED | CHANGES_REQUESTED → LOCKED
  //   reopen-to-draft LOCKED   | REJECTED          → DRAFT
  //   reject          PENDING_APPROVAL | CHANGES_REQUESTED → REJECTED
  surface.lockBudgetLive = budgetsApi.lockBudget;
  surface.reopenBudgetToDraftLive = budgetsApi.reopenBudgetToDraft;
  surface.rejectBudgetLive = budgetsApi.rejectBudget;
  surface.addBudgetLineCommentLive = budgetsApi.addBudgetLineComment;
  surface.listBudgetLineCommentsLive = budgetsApi.listBudgetLineComments;
  surface.deleteBudgetLineCommentLive = budgetsApi.deleteBudgetLineComment;
  surface.getBudgetApprovalStateLive = budgetsApi.getBudgetApprovalState;
  surface.listTeamMembersLive = budgetsApi.listTeamMembers;

  // Migration Import — Track 1 Migration Wizard (2026-04-20). Twelve
  // wrappers exposed as engine extras under canonical names. Not on
  // mockEngine's namespace; MOCK mode adapters in buildMockExtras return
  // empty/placeholder data so the wizard renders its empty states in
  // dev without a live backend.
  surface.ingestInvoices = migrationImportApi.ingestInvoices;
  surface.ingestBills = migrationImportApi.ingestBills;
  surface.ingestJournalEntries = migrationImportApi.ingestJournalEntries;
  surface.listStagedInvoices = migrationImportApi.listStagedInvoices;
  surface.listStagedBills = migrationImportApi.listStagedBills;
  surface.listStagedJournalEntries = migrationImportApi.listStagedJournalEntries;
  surface.listSourceAccountMap = migrationImportApi.listSourceAccountMap;
  surface.suggestSourceMap = migrationImportApi.suggestSourceMap;
  surface.suggestAllSourceMap = migrationImportApi.suggestAllSourceMap;
  surface.declineSuggestion = migrationImportApi.declineSuggestion;
  surface.updateSourceMap = migrationImportApi.updateSourceMap;
  surface.postStagedItem = migrationImportApi.postStagedItem;
  surface.rejectStagedItem = migrationImportApi.rejectStagedItem;

  // Vendors + Customers KYC admin (FN-272). Extras pattern. Names are
  // NOT on mockEngine's namespace (the existing
  // listVendorsForRelatedParty / listCustomersForRelatedParty are
  // related-party-helper names with different scope), so they must be
  // assigned explicitly — both surfaces parallel.
  surface.listVendors = vendorsApi.listVendors;
  surface.getVendor = vendorsApi.getVendor;
  surface.createVendor = vendorsApi.createVendor;
  surface.updateVendor = vendorsApi.updateVendor;
  surface.deactivateVendor = vendorsApi.deactivateVendor;
  surface.listCustomers = customersApi.listCustomers;
  surface.getCustomer = customersApi.getCustomer;
  surface.createCustomer = customersApi.createCustomer;
  surface.updateCustomer = customersApi.updateCustomer;
  surface.deactivateCustomer = customersApi.deactivateCustomer;

  // Recurring entries — AUDIT-ACC-010 (corporate-api 65ccaf6, 2026-04-22).
  // Eight wrappers. Names NOT on mockEngine's namespace, so they must
  // be assigned explicitly. MOCK-mode adapters in buildMockExtras below
  // map the legacy mockEngine template names (getManualJETemplates /
  // createFromTemplate / etc.) onto these canonical LIVE names so
  // ManualJEScreen calls the same engine surface in both modes.
  surface.listRecurringEntries = recurringEntriesApi.listRecurringEntries;
  surface.getRecurringEntry = recurringEntriesApi.getRecurringEntry;
  surface.createRecurringEntry = recurringEntriesApi.createRecurringEntry;
  surface.updateRecurringEntry = recurringEntriesApi.updateRecurringEntry;
  surface.deleteRecurringEntry = recurringEntriesApi.deleteRecurringEntry;
  surface.processRecurringEntries = recurringEntriesApi.processRecurringEntries;
  surface.fireRecurringEntryNow = recurringEntriesApi.fireRecurringEntryNow;
  surface.listRecurringEntryInstances = recurringEntriesApi.listRecurringEntryInstances;

  // Payroll — AUDIT-ACC-013 (2026-04-22). 23 wrappers exposed as engine
  // extras under canonical backend-aligned names. Not on mockEngine's
  // namespace; buildMockExtras below provides MOCK-mode stubs so the
  // new PayrollScreen renders meaningful seed data without a live
  // backend. WPS download uses a raw `fetch` path (not the axios JSON
  // client) because the backend returns `text/plain` + Content-Disposition
  // — the MOCK stub emits a tiny static SIF string so the download dance
  // exercises anchor/revokeObjectURL in both modes.
  surface.listEmployees = payrollApi.listEmployees;
  surface.getEmployee = payrollApi.getEmployee;
  surface.createEmployee = payrollApi.createEmployee;
  surface.updateEmployee = payrollApi.updateEmployee;
  surface.terminateEmployee = payrollApi.terminateEmployee;
  surface.getEmployeeEos = payrollApi.getEmployeeEos;
  surface.registerEmployeeRehire = payrollApi.registerEmployeeRehire;
  surface.classifyServiceContinuity = payrollApi.classifyServiceContinuity;
  surface.getEmployeeEosHistory = payrollApi.getEmployeeEosHistory;
  surface.getEmployeeAdvances = payrollApi.getEmployeeAdvances;
  surface.getTenantPayrollConfig = payrollApi.getTenantPayrollConfig;
  surface.updateEosiReformDate = payrollApi.updateEosiReformDate;
  surface.listPifssSubmissions = payrollApi.listPifssSubmissions;
  surface.generatePifssFile = payrollApi.generatePifssFile;
  surface.getPifssSubmission = payrollApi.getPifssSubmission;
  surface.updatePifssSubmissionStatus = payrollApi.updatePifssSubmissionStatus;
  surface.getPayrollHistory = payrollApi.getPayrollHistory;
  surface.getPayrollRun = payrollApi.getPayrollRun;
  surface.runPayroll = payrollApi.runPayroll;
  surface.accrueEos = payrollApi.accrueEos;
  surface.approvePayroll = payrollApi.approvePayroll;
  surface.payPayroll = payrollApi.payPayroll;
  surface.downloadWpsFile = payrollApi.downloadWpsFile;
  surface.downloadPayslip = payrollApi.downloadPayslip;

  // Payment Vouchers + Bank Mandates — AUDIT-ACC-002 (2026-04-22). 13
  // voucher wrappers + 3 read-only mandate wrappers. All names new;
  // assigned as extras parallel to the payroll block above. Mandate
  // CRUD is NOT shipped this wave (HASEEB-210 follow-up).
  surface.listVouchers = paymentVouchersApi.listVouchers;
  surface.getVoucher = paymentVouchersApi.getVoucher;
  surface.createVoucher = paymentVouchersApi.createVoucher;
  surface.patchVoucher = paymentVouchersApi.patchVoucher;
  surface.submitVoucher = paymentVouchersApi.submitVoucher;
  surface.reviewVoucher = paymentVouchersApi.reviewVoucher;
  surface.approveVoucher = paymentVouchersApi.approveVoucher;
  surface.assignSignatories = paymentVouchersApi.assignSignatories;
  surface.signVoucher = paymentVouchersApi.signVoucher;
  surface.markVoucherPaid = paymentVouchersApi.markVoucherPaid;
  surface.rejectVoucher = paymentVouchersApi.rejectVoucher;
  surface.cancelVoucher = paymentVouchersApi.cancelVoucher;
  surface.getVoucherAminahStatus = paymentVouchersApi.getVoucherAminahStatus;
  surface.listMandates = bankMandatesApi.listMandates;
  surface.getMandate = bankMandatesApi.getMandate;
  surface.listMandateSignatories = bankMandatesApi.listMandateSignatories;

  // Annual PIFSS Reconciliation — AUDIT-ACC-058 (2026-04-22). 5
  // endpoints + 1 client-side aggregation. Mock extras provide a
  // plausible fixture (2 years of history, 12+ variances across 3
  // employees, 4 variance types) in MOCK mode via buildMockExtras.
  surface.listReconciliationYears = pifssReconciliationApi.listReconciliationYears;
  surface.getReconciliation = pifssReconciliationApi.getReconciliation;
  surface.getReconciliationReport = pifssReconciliationApi.getReconciliationReport;
  surface.importStatement = pifssReconciliationApi.importStatement;
  surface.runReconciliation = pifssReconciliationApi.runReconciliation;
  surface.resolveVariance = pifssReconciliationApi.resolveVariance;

  // Year-End Close — AUDIT-ACC-003 (2026-04-22). 7 endpoints
  // on /api/year-end-close (FN-271). Mock extras seed 3 fiscal-year
  // fixtures (FY-1 APPROVED, FY CURRENT PREPARED with partial
  // checklist, FY-2 REVERSED) in MOCK mode via buildMockExtras.
  surface.getYearEndCloseConfig = yearEndCloseApi.getYearEndCloseConfig;
  surface.updateYearEndCloseConfig = yearEndCloseApi.updateYearEndCloseConfig;
  surface.prepareYearEndClose = yearEndCloseApi.prepareYearEndClose;
  surface.listYearEndCloseRecords = yearEndCloseApi.listYearEndCloseRecords;
  surface.approveYearEndClose = yearEndCloseApi.approveYearEndClose;
  surface.reverseYearEndClose = yearEndCloseApi.reverseYearEndClose;
  surface.getYearEndClose = yearEndCloseApi.getYearEndClose;

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
    // HASEEB-180 (2026-04-21). mockEngine has no export plumbing for the
    // banking statement surface; stub a minimal CSV payload for MOCK mode
    // so the download path renders a real (if toy) file and the surface
    // stays symmetric with LIVE. Base64 branches are exercised against
    // real bytes in LIVE mode only — acceptable per the dispatch spec.
    exportBankAccountStatement: async (id, opts = {}) => {
      const fmt = (opts?.format || 'csv').toLowerCase();
      const range = opts?.range || 'month';
      return {
        data: 'date,description,amount\n2026-04-01,MOCK,0.000\n',
        filename: `mock_${id}_${range}.${fmt === 'xlsx' ? 'csv' : fmt}`,
        rowCount: 1,
        contentType: 'text/csv',
      };
    },

    // Recurrence patterns — Tier C-3 FOLLOW-UP (HASEEB-183, 2026-04-21).
    // MOCK stub returns the same contract as the live response envelope
    // after unwrap. Lets the MissedRecurrencesCard demo the full suspend
    // flow in MOCK mode without a live backend.
    suspendRecurrencePattern: async (patternId /* , opts */) => ({
      suspended: true,
      patternId,
    }),

    // Aging action writes — AUDIT-ACC-005 (corporate-api 3fdb92c,
    // 2026-04-22). MOCK parity stubs mirror the LIVE response envelopes
    // after unwrap so the WriteOffModal / DisputeInvoiceModal /
    // ScheduleARInstallmentModal round-trip cleanly in MOCK mode
    // without a backend. These supersede the old mock-only
    // createWriteOffJE + markInvoiceDisputed exports on mockEngine
    // (which have been deleted; see mockEngine.js blame).
    writeOffInvoice: async (invoiceId, { reason, effectiveDate, category } = {}) => {
      await new Promise((r) => setTimeout(r, 120));
      const jeId = `JE-WO-${Math.floor(Math.random() * 900 + 100)}`;
      return {
        invoice: {
          id: invoiceId,
          status: 'WRITTEN_OFF',
          outstanding: '0.000',
        },
        writeOff: {
          id: `WO-${Math.floor(Math.random() * 900 + 100)}`,
          invoiceId,
          reason: reason || '',
          effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10),
          category: category || 'bad_debt',
          journalEntryId: jeId,
          createdAt: new Date().toISOString(),
          _mock: true,
        },
        journalEntry: { id: jeId, entryNumber: jeId, status: 'POSTED', _mock: true },
      };
    },
    disputeInvoice: async (invoiceId, { reason, disputedAmount } = {}) => {
      await new Promise((r) => setTimeout(r, 120));
      return {
        invoice: {
          id: invoiceId,
          status: 'DISPUTED',
        },
        dispute: {
          id: `DSP-${Math.floor(Math.random() * 900 + 100)}`,
          invoiceId,
          reason: reason || '',
          disputedAmount: disputedAmount || null,
          createdAt: new Date().toISOString(),
          _mock: true,
        },
      };
    },
    scheduleInvoicePaymentPlan: async (invoiceId, { installments } = {}) => {
      await new Promise((r) => setTimeout(r, 120));
      const planId = `PP-${Math.floor(Math.random() * 900 + 100)}`;
      const normalized = Array.isArray(installments)
        ? installments.map((inst, i) => ({
            id: `${planId}-I${i + 1}`,
            dueDate: inst?.dueDate || new Date().toISOString().slice(0, 10),
            amount: String(inst?.amount || '0.000'),
            status: 'SCHEDULED',
          }))
        : [];
      return {
        invoice: { id: invoiceId },
        paymentPlan: {
          id: planId,
          invoiceId,
          status: 'ACTIVE',
          installments: normalized,
          createdAt: new Date().toISOString(),
          _mock: true,
        },
      };
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
    // Three MOCK-mode status-transition adapters (2026-04-21). Mock-side
    // status vocabulary is kebab-lower; the mockEngine helpers translate
    // the reason string into the _addHistory note slot.
    lockBudgetLive: (id, { reason } = {}) =>
      mockEngine.lockBudget(id, reason),
    reopenBudgetToDraftLive: (id, { reason } = {}) =>
      mockEngine.reopenBudgetToDraft(id, reason),
    rejectBudgetLive: (id, { reason } = {}) =>
      mockEngine.rejectBudget(id, reason),
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

    // Migration Import — Track 1 Migration Wizard (2026-04-20). MOCK stubs
    // so dev can navigate the wizard without a live backend. Ingest
    // fabricates a plausible importJobId; all reads return empty arrays
    // so the UI renders its empty states; mutations echo so the UI can
    // proceed through the flow without erroring.
    ingestInvoices: async (payload) => ({
      importJobId: `mock-import-${Date.now()}`,
      count: 0,
      sourceSystem: payload?.sourceSystem || null,
      parserVersion: payload?.parserVersion || 'v1',
    }),
    ingestBills: async (payload) => ({
      importJobId: `mock-import-${Date.now()}`,
      count: 0,
      sourceSystem: payload?.sourceSystem || null,
      parserVersion: payload?.parserVersion || 'v1',
    }),
    ingestJournalEntries: async (payload) => ({
      importJobId: `mock-import-${Date.now()}`,
      count: 0,
      sourceSystem: payload?.sourceSystem || null,
      parserVersion: payload?.parserVersion || 'v1',
    }),
    listStagedInvoices: async () => [],
    listStagedBills: async () => [],
    listStagedJournalEntries: async () => [],
    listSourceAccountMap: async () => [],
    suggestSourceMap: async (id) => ({
      id,
      suggestedHaseebAccountRole: null,
      confidence: 0,
      suggestionReason: null,
    }),
    suggestAllSourceMap: async () => ({ updated: 0 }),
    declineSuggestion: async (id) => ({
      id,
      suggestedHaseebAccountRole: null,
      confidence: 0,
      suggestionReason: null,
    }),
    updateSourceMap: async (id, payload) => ({ id, ...payload }),
    postStagedItem: async (kind, id) => ({
      stagedId: id,
      postedEntityId: `mock-${kind}-${id}`,
      status: 'POSTED',
    }),
    rejectStagedItem: async (kind, id, reason) => ({
      stagedId: id,
      status: 'REJECTED',
      reason: reason || null,
    }),

    // Vendors + Customers KYC admin (FN-272) MOCK stubs. In-memory CRUD
    // against a small seed list so the SetupScreen Vendors / Customers
    // sub-sections render real-looking rows in MOCK mode, the KYCEditModal
    // round-trips through update*, and create / deactivate persist for
    // the lifetime of the tab. The seed shape mirrors the live DTO so
    // the same UI works in both modes without branching.
    listVendors: mockListVendors,
    getVendor: mockGetVendor,
    createVendor: mockCreateVendor,
    updateVendor: mockUpdateVendor,
    deactivateVendor: mockDeactivateVendor,
    listCustomers: mockListCustomers,
    getCustomer: mockGetCustomer,
    createCustomer: mockCreateCustomer,
    updateCustomer: mockUpdateCustomer,
    deactivateCustomer: mockDeactivateCustomer,
    // Override the related-party helper listers (which previously
    // returned []) so the related-party modal's vendor + customer
    // pickers see the same MOCK data as the new Vendors / Customers
    // sub-sections — keeps the two flows visually consistent.
    listVendorsForRelatedParty: mockListVendors,
    listCustomersForRelatedParty: mockListCustomers,

    // Recurring entries — AUDIT-ACC-010 (2026-04-22). MOCK adapters map
    // to the legacy mockEngine template surface so ManualJEScreen
    // calls the same engine-level names (listRecurringEntries / etc.)
    // in both modes. The adapters reshape the mock's legacy shape
    // (name, usageCount, lines with DR/CR of zero) onto the LIVE
    // contract (description, frequency, nextDate, templateLines, etc.)
    // so the screen renders without branching.
    //
    // Shape translations:
    //   mock template → LIVE RecurringEntry:
    //     id              → id (unchanged)
    //     name            → description (fallback to mock.description)
    //     source          → frequency='MONTHLY' default (mock had no cadence)
    //     createdAt       → nextDate='today', createdAt passthrough
    //     lines           → templateLines
    //     usageCount      → (preserved as _mockUsageCount; LIVE has no equivalent)
    //
    // Firing / instances have no mock backing; the MOCK stubs return
    // plausible round-trip shapes so the templates-tab UI exercises its
    // loading / success / error states in MOCK mode.
    listRecurringEntries: async () => {
      const rows = await mockEngine.getManualJETemplates();
      return (rows || []).map((t) => ({
        id: t.id,
        description: t.name || t.description || '',
        frequency: 'MONTHLY',
        nextDate: new Date().toISOString(),
        endDate: null,
        templateLines: (t.lines || []).map((l) => ({
          accountId: l.accountCode || null,
          accountCode: l.accountCode || null,
          accountName: l.accountName || '',
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          description: l.memo || '',
        })),
        isActive: true,
        createdAt: t.createdAt || new Date().toISOString(),
        updatedAt: t.createdAt || new Date().toISOString(),
        _mockUsageCount: t.usageCount ?? 0,
        _mockName: t.name || null,
      }));
    },
    getRecurringEntry: async (id) => {
      const tpl = await mockEngine.getManualJETemplateById(id);
      if (!tpl) return null;
      return {
        id: tpl.id,
        description: tpl.name || tpl.description || '',
        frequency: 'MONTHLY',
        nextDate: new Date().toISOString(),
        endDate: null,
        templateLines: (tpl.lines || []).map((l) => ({
          accountId: l.accountCode || null,
          accountCode: l.accountCode || null,
          accountName: l.accountName || '',
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          description: l.memo || '',
        })),
        isActive: true,
        createdAt: tpl.createdAt || new Date().toISOString(),
        updatedAt: tpl.createdAt || new Date().toISOString(),
        _mockUsageCount: tpl.usageCount ?? 0,
        _mockName: tpl.name || null,
      };
    },
    createRecurringEntry: async (input = {}) => {
      await new Promise((r) => setTimeout(r, 120));
      const id = `MOCK-REC-${Math.floor(Math.random() * 900 + 100)}`;
      return {
        id,
        description: input.description || '',
        frequency: input.frequency || 'MONTHLY',
        nextDate: input.nextDate || new Date().toISOString(),
        endDate: input.endDate || null,
        templateLines: Array.isArray(input.templateLines) ? input.templateLines : [],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _mock: true,
      };
    },
    updateRecurringEntry: async (id, patch = {}) => {
      await new Promise((r) => setTimeout(r, 80));
      return { id, ...patch, updatedAt: new Date().toISOString(), _mock: true };
    },
    deleteRecurringEntry: async (id) => {
      // Delegate to legacy mock so the in-memory store stays consistent
      // when tests exercise create → delete.
      await mockEngine.deleteJETemplateRecord(id).catch(() => null);
      return { message: 'Recurring entry deleted' };
    },
    processRecurringEntries: async () => {
      await new Promise((r) => setTimeout(r, 120));
      return { generated: 0, errors: [] };
    },
    fireRecurringEntryNow: async (id) => {
      await new Promise((r) => setTimeout(r, 120));
      const instanceId = `MOCK-INST-${Math.floor(Math.random() * 900 + 100)}`;
      const jeId = `MOCK-JE-${Math.floor(Math.random() * 900 + 100)}`;
      return {
        recurring: { id, isActive: true, nextDate: new Date().toISOString() },
        instance: { id: instanceId },
        outcome: {
          kind: 'DRAFT_CREATED',
          instance: { id: instanceId },
          journalEntryId: jeId,
          advisorPendingId: `MOCK-ADV-${Math.floor(Math.random() * 900 + 100)}`,
        },
      };
    },
    listRecurringEntryInstances: async (_id, opts = {}) => {
      await new Promise((r) => setTimeout(r, 80));
      const limit = opts.limit != null ? Number(opts.limit) : 20;
      const page = opts.page != null ? Number(opts.page) : 1;
      return { entries: [], total: 0, page, limit };
    },

    // Payroll — AUDIT-ACC-013 (2026-04-22). MOCK stubs for the 23
    // wrappers. The seed data is deliberately rich enough for the
    // PayrollScreen to exercise all three tabs + all role-gated
    // actions without a live backend: 6 employees (3 Kuwaiti + 3
    // non-Kuwaiti, one terminated), 3 payroll runs (DRAFT / APPROVED
    // / PAID), 2 PIFSS submissions. The WPS download stub emits a
    // tiny static SIF string so the browser-download path (anchor +
    // URL.createObjectURL) exercises in MOCK.
    listEmployees: mockListEmployees,
    getEmployee: mockGetEmployee,
    createEmployee: mockCreateEmployee,
    updateEmployee: mockUpdateEmployee,
    terminateEmployee: mockTerminateEmployee,
    getEmployeeEos: mockGetEmployeeEos,
    registerEmployeeRehire: mockRegisterEmployeeRehire,
    classifyServiceContinuity: mockClassifyServiceContinuity,
    getEmployeeEosHistory: mockGetEmployeeEosHistory,
    getEmployeeAdvances: mockGetEmployeeAdvances,
    getTenantPayrollConfig: mockGetTenantPayrollConfig,
    updateEosiReformDate: mockUpdateEosiReformDate,
    listPifssSubmissions: mockListPifssSubmissions,
    generatePifssFile: mockGeneratePifssFile,
    getPifssSubmission: mockGetPifssSubmission,
    updatePifssSubmissionStatus: mockUpdatePifssSubmissionStatus,
    getPayrollHistory: mockGetPayrollHistory,
    getPayrollRun: mockGetPayrollRun,
    runPayroll: mockRunPayroll,
    accrueEos: mockAccrueEos,
    approvePayroll: mockApprovePayroll,
    payPayroll: mockPayPayroll,
    downloadWpsFile: mockDownloadWpsFile,
    downloadPayslip: mockDownloadPayslip,

    // Payment Vouchers + Bank Mandates — AUDIT-ACC-002 (2026-04-22). MOCK
    // stubs for the 13 voucher wrappers + 3 mandate read wrappers. Seed
    // data covers the four filter tabs (DRAFT + PENDING_* + APPROVED +
    // PAID/REJECTED/CANCELLED) and two mandate shapes — one compliant
    // (Σcount=2) and one non-compliant (Σcount=1) so the HASEEB-274
    // warning banner can be exercised in MOCK. The mock state is
    // module-scoped so lifecycle transitions persist for the tab
    // lifetime.
    listVouchers: mockListVouchers,
    getVoucher: mockGetVoucher,
    createVoucher: mockCreateVoucher,
    patchVoucher: mockPatchVoucher,
    submitVoucher: mockSubmitVoucher,
    reviewVoucher: mockReviewVoucher,
    approveVoucher: mockApproveVoucher,
    assignSignatories: mockAssignSignatories,
    signVoucher: mockSignVoucher,
    markVoucherPaid: mockMarkVoucherPaid,
    rejectVoucher: mockRejectVoucher,
    cancelVoucher: mockCancelVoucher,
    getVoucherAminahStatus: mockGetVoucherAminahStatus,
    listMandates: mockListMandates,
    getMandate: mockGetMandate,
    listMandateSignatories: mockListMandateSignatories,

    // Annual PIFSS Reconciliation — AUDIT-ACC-058 (2026-04-22). MOCK
    // stubs for the 5 endpoints + 1 aggregation. Seed covers 2 years
    // of reconciliation history; current year has 12 variances across
    // 3 employees covering all 4 VarianceType values so the 4-tone
    // type badges + 4-state status badges all exercise.
    listReconciliationYears: mockListReconciliationYears,
    getReconciliation: mockGetReconciliation,
    getReconciliationReport: mockGetReconciliationReport,
    importStatement: mockImportStatement,
    runReconciliation: mockRunReconciliation,
    resolveVariance: mockResolveVariance,

    // Year-End Close — AUDIT-ACC-003 (2026-04-22). MOCK stubs for the
    // 7 endpoints (FN-271). Seed covers 3 fiscal years: FY-2 APPROVED
    // (CLOSED) with full ready checklist + complete audit trail; FY-1
    // PREPARED (PENDING_APPROVAL) with partial checklist (bank rec
    // still blocked); FY-3 REVERSED with reversal reason + reversedBy.
    // Config: Kuwait defaults with requireStatutoryReserveBeforeClose
    // enabled. Lifecycle transitions persist module-scoped so
    // prepare → approve → reverse all exercise end-to-end in MOCK.
    getYearEndCloseConfig: mockGetYearEndCloseConfig,
    updateYearEndCloseConfig: mockUpdateYearEndCloseConfig,
    prepareYearEndClose: mockPrepareYearEndClose,
    listYearEndCloseRecords: mockListYearEndCloseRecords,
    approveYearEndClose: mockApproveYearEndClose,
    reverseYearEndClose: mockReverseYearEndClose,
    getYearEndClose: mockGetYearEndClose,
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
// Seeded with 7 cases covering every CitAssessmentStatus enum value plus
// one approaching-statute scenario (< 90 days), so AUDIT-ACC-057 can
// demo the screen without touching the backend. Case IDs are stable
// across reloads to let deep links / tests reference them by id.
function _defaultStatute(fiscalYear) {
  const y = Number(fiscalYear) + 5;
  return `${y}-12-31`;
}
function _approachingStatuteDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}
const _citSeedNow = new Date().toISOString();
const _mockCitAssessments = [
  {
    id: 'cit-seed-001',
    fiscalYear: 2024,
    filedAmountKwd: '185000.000',
    filedOnDate: '2025-03-31',
    authorityCaseNumber: 'MOF-CIT-2025-0441',
    status: 'FILED',
    computationId: null,
    assessedAmountKwd: null,
    assessedOnDate: null,
    varianceKwd: null,
    objectionFiledOn: null,
    finalAmountKwd: null,
    finalizedOnDate: null,
    statuteExpiresOn: '2029-12-31',
    notes: 'FY2024 CIT return filed via authority portal; awaiting review.',
    createdAt: _citSeedNow,
    updatedAt: _citSeedNow,
    _mock: true,
  },
  {
    id: 'cit-seed-002',
    fiscalYear: 2023,
    filedAmountKwd: '142000.000',
    filedOnDate: '2024-03-28',
    authorityCaseNumber: 'MOF-CIT-2024-0318',
    status: 'UNDER_REVIEW',
    computationId: null,
    assessedAmountKwd: null,
    assessedOnDate: null,
    varianceKwd: null,
    objectionFiledOn: null,
    finalAmountKwd: null,
    finalizedOnDate: null,
    statuteExpiresOn: '2028-12-31',
    notes: 'Authority requested additional documentation on transfer-pricing memo.',
    createdAt: _citSeedNow,
    updatedAt: _citSeedNow,
    _mock: true,
  },
  {
    id: 'cit-seed-003',
    fiscalYear: 2022,
    filedAmountKwd: '118500.000',
    filedOnDate: '2023-03-30',
    authorityCaseNumber: 'MOF-CIT-2023-0207',
    status: 'ASSESSED',
    computationId: null,
    assessedAmountKwd: '134250.000',
    assessedOnDate: '2025-09-15',
    varianceKwd: '15750.000',
    objectionFiledOn: null,
    finalAmountKwd: null,
    finalizedOnDate: null,
    statuteExpiresOn: '2027-12-31',
    notes: 'Authority disallowed KD 15,750 of inter-company management fees.',
    createdAt: _citSeedNow,
    updatedAt: _citSeedNow,
    _mock: true,
  },
  {
    id: 'cit-seed-004',
    fiscalYear: 2021,
    filedAmountKwd: '96000.000',
    filedOnDate: '2022-03-29',
    authorityCaseNumber: 'MOF-CIT-2022-0188',
    status: 'OBJECTED',
    computationId: null,
    assessedAmountKwd: '112400.000',
    assessedOnDate: '2024-11-10',
    varianceKwd: '16400.000',
    objectionFiledOn: '2024-12-08',
    finalAmountKwd: null,
    finalizedOnDate: null,
    statuteExpiresOn: '2026-12-31',
    notes:
      'Formal objection filed re: transfer-pricing adjustment on royalty fees.',
    createdAt: _citSeedNow,
    updatedAt: _citSeedNow,
    _mock: true,
  },
  {
    id: 'cit-seed-005',
    fiscalYear: 2020,
    filedAmountKwd: '84500.000',
    filedOnDate: '2021-03-30',
    authorityCaseNumber: 'MOF-CIT-2021-0102',
    status: 'FINAL',
    computationId: null,
    assessedAmountKwd: '91200.000',
    assessedOnDate: '2023-06-18',
    varianceKwd: '6700.000',
    objectionFiledOn: null,
    finalAmountKwd: '91200.000',
    finalizedOnDate: '2024-02-14',
    // Approaching-statute case: deliberately ~80 days from now.
    statuteExpiresOn: _approachingStatuteDate(80),
    notes:
      'Final authority assessment accepted without objection; payment settled via JE-2024-0398.',
    createdAt: _citSeedNow,
    updatedAt: _citSeedNow,
    _mock: true,
  },
  {
    id: 'cit-seed-006',
    fiscalYear: 2019,
    filedAmountKwd: '72300.000',
    filedOnDate: '2020-03-31',
    authorityCaseNumber: 'MOF-CIT-2020-0057',
    status: 'CLOSED',
    computationId: null,
    assessedAmountKwd: '74100.000',
    assessedOnDate: '2022-05-12',
    varianceKwd: '1800.000',
    objectionFiledOn: null,
    finalAmountKwd: '74100.000',
    finalizedOnDate: '2023-01-09',
    statuteExpiresOn: '2024-12-31',
    notes: 'Paid and closed; archived for audit trail.',
    createdAt: _citSeedNow,
    updatedAt: _citSeedNow,
    _mock: true,
  },
  {
    id: 'cit-seed-007',
    fiscalYear: 2018,
    filedAmountKwd: '65800.000',
    filedOnDate: '2019-03-28',
    authorityCaseNumber: 'MOF-CIT-2019-0033',
    status: 'STATUTE_EXPIRED',
    computationId: null,
    assessedAmountKwd: null,
    assessedOnDate: null,
    varianceKwd: null,
    objectionFiledOn: null,
    finalAmountKwd: null,
    finalizedOnDate: null,
    statuteExpiresOn: '2023-12-31',
    notes:
      'Authority missed the 5-year window; case flagged statute-expired per Kuwait CIT law.',
    createdAt: _citSeedNow,
    updatedAt: _citSeedNow,
    _mock: true,
  },
];
let _mockCitCounter = _mockCitAssessments.length;
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

// ── Vendors + Customers MOCK stubs (FN-272) ──
//
// In-memory CRUD against a small bilingual seed list so the SetupScreen
// Vendors / Customers sub-sections render real-looking rows in MOCK
// mode. Seed data deliberately covers the three KYC display states the
// UI needs to render: (1) CR expiring within 30 days, (2) CR already
// expired, (3) no CR tracked yet — so designers can verify all three
// chip variants without manual edits.
//
// Shape mirrors the live DTO from src/api/vendors.js + customers.js so
// the same UI works in both modes. Mutations persist for the lifetime
// of the tab; isActive flips false on deactivate.

let _mockVendorCounter = 0;
let _mockCustomerCounter = 0;

function _todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function _isoOffsetDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function _seedVendors() {
  const now = new Date().toISOString();
  const seeds = [
    { nameEn: 'MEW Kuwait', nameAr: 'وزارة الكهرباء والماء',
      email: 'billing@mew.gov.kw', phone: '+965 1801802',
      crNumber: 'CR-MEW-001', crIssuedAt: '2018-03-12',
      crExpiryDate: _isoOffsetDays(15),  // expiring soon
      civilIdNumber: null, kycNotes: 'Government utility — perpetual CR.',
      paymentTermsDays: 30 },
    { nameEn: 'Kuwait Telecom KTC', nameAr: 'كي تي سي للاتصالات',
      email: 'ap@ktc.com.kw', phone: '+965 22456700',
      crNumber: 'CR-KTC-44218', crIssuedAt: '2019-06-01',
      crExpiryDate: _isoOffsetDays(-10), // expired
      civilIdNumber: null,
      kycNotes: 'CR renewal pending — finance to chase by month-end.',
      paymentTermsDays: 45 },
    { nameEn: 'AWS Middle East', nameAr: 'أمازون لخدمات الويب',
      email: 'aws-receivables@amazon.com', phone: '+971 4 4500 100',
      crNumber: null, crIssuedAt: null, crExpiryDate: null,
      civilIdNumber: null, kycNotes: 'Foreign vendor — no Kuwait CR.',
      paymentTermsDays: 30 },
    { nameEn: 'Trade Show Productions', nameAr: 'إنتاج المعارض التجارية',
      email: 'finance@tspkw.com', phone: '+965 22440011',
      crNumber: 'CR-TSP-9921', crIssuedAt: '2020-01-15',
      crExpiryDate: _isoOffsetDays(120), // healthy
      civilIdNumber: '281030104567', kycNotes: null,
      paymentTermsDays: 30 },
    { nameEn: 'Deloitte & Touche', nameAr: 'ديلويت آند توش',
      email: 'kuwait@deloitte.com', phone: '+965 22408844',
      crNumber: 'CR-DELO-1192', crIssuedAt: '2017-09-01',
      crExpiryDate: _isoOffsetDays(220), civilIdNumber: null,
      kycNotes: 'Audit firm — annual engagement.', paymentTermsDays: 30 },
  ];
  return seeds.map((s) => {
    _mockVendorCounter += 1;
    return {
      id: `mock-vn-${_mockVendorCounter}`,
      ...s,
      businessAddress: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      _mock: true,
    };
  });
}
function _seedCustomers() {
  const now = new Date().toISOString();
  const seeds = [
    { nameEn: 'Salhiya Mall Tenants Ltd', nameAr: 'مستأجرو مجمع السالمية',
      email: 'ar@salhiyamall.com', phone: '+965 22424001',
      crNumber: 'CR-SMT-77110', crIssuedAt: '2019-04-12',
      crExpiryDate: _isoOffsetDays(8),   // expiring soon
      civilIdNumber: null,
      kycNotes: 'Major tenant cluster — monthly invoicing.' },
    { nameEn: 'Kuwait Petroleum Corp', nameAr: 'مؤسسة البترول الكويتية',
      email: 'invoices@kpc.com.kw', phone: '+965 18 KPC (572)',
      crNumber: 'CR-KPC-00001', crIssuedAt: '2010-02-20',
      crExpiryDate: _isoOffsetDays(-30), // expired 30 days ago
      civilIdNumber: null,
      kycNotes: 'Strategic account — flag CR renewal to CFO.' },
    { nameEn: 'Local Family Trust', nameAr: 'شركة العائلة',
      email: null, phone: '+965 99887766',
      crNumber: null, crIssuedAt: null, crExpiryDate: null,
      civilIdNumber: '278042205541',
      kycNotes: 'Personal account — civil ID only, no CR required.' },
    { nameEn: 'Boubyan Investments', nameAr: 'استثمارات بوبيان',
      email: 'invoices@boubyan-inv.com', phone: '+965 22907700',
      crNumber: 'CR-BBYI-3344', crIssuedAt: '2021-11-01',
      crExpiryDate: _isoOffsetDays(180), civilIdNumber: null,
      kycNotes: null },
    { nameEn: 'Zain Telecom B2B', nameAr: 'زين الأعمال',
      email: 'b2b-finance@kw.zain.com', phone: '+965 1 ZAIN (9246)',
      crNumber: 'CR-ZAIN-8801', crIssuedAt: '2018-08-08',
      crExpiryDate: _isoOffsetDays(95), civilIdNumber: null,
      kycNotes: 'Net-60 terms per master agreement.' },
  ];
  return seeds.map((s) => {
    _mockCustomerCounter += 1;
    return {
      id: `mock-cu-${_mockCustomerCounter}`,
      ...s,
      businessAddress: null,
      deliveryAddress: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      _mock: true,
    };
  });
}
const _mockVendors = _seedVendors();
const _mockCustomers = _seedCustomers();

function _filterAndSearch(rows, filters) {
  let list = rows.filter((r) => r.isActive !== false);
  if (filters?.search) {
    const q = String(filters.search).toLowerCase();
    list = list.filter((r) =>
      [r.nameEn, r.nameAr, r.email, r.crNumber, r.civilIdNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }
  return list;
}

async function mockListVendors(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _filterAndSearch(_mockVendors, filters).map((r) => ({ ...r }));
}
async function mockGetVendor(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockVendors.find((r) => r.id === id);
  return row ? { ...row } : null;
}
async function mockCreateVendor(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockVendorCounter += 1;
  const now = new Date().toISOString();
  const row = {
    id: `mock-vn-${_mockVendorCounter}`,
    nameEn: payload.nameEn || `Vendor ${_mockVendorCounter}`,
    nameAr: payload.nameAr ?? null,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    businessAddress: payload.businessAddress ?? null,
    crNumber: payload.crNumber ?? null,
    crExpiryDate: payload.crExpiryDate ?? null,
    crIssuedAt: payload.crIssuedAt ?? null,
    civilIdNumber: payload.civilIdNumber ?? null,
    kycNotes: payload.kycNotes ?? null,
    paymentTermsDays: payload.paymentTermsDays ?? 30,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    _mock: true,
  };
  _mockVendors.unshift(row);
  return { ...row };
}
function _applyMockKycPatch(row, patch) {
  const next = { ...row };
  for (const key of [
    'nameEn', 'nameAr', 'email', 'phone', 'businessAddress',
    'crNumber', 'crExpiryDate', 'crIssuedAt', 'civilIdNumber',
    'kycNotes', 'paymentTermsDays',
  ]) {
    if (patch[key] !== undefined) next[key] = patch[key];
  }
  next.updatedAt = new Date().toISOString();
  return next;
}
async function mockUpdateVendor(id, patch = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockVendors.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  _mockVendors[idx] = _applyMockKycPatch(_mockVendors[idx], patch);
  return { ..._mockVendors[idx] };
}
async function mockDeactivateVendor(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockVendors.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  _mockVendors[idx] = {
    ..._mockVendors[idx],
    isActive: false,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockVendors[idx] };
}

async function mockListCustomers(filters = {}) {
  await new Promise((r) => setTimeout(r, 40));
  return _filterAndSearch(_mockCustomers, filters).map((r) => ({ ...r }));
}
async function mockGetCustomer(id) {
  await new Promise((r) => setTimeout(r, 20));
  const row = _mockCustomers.find((r) => r.id === id);
  return row ? { ...row } : null;
}
async function mockCreateCustomer(payload = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockCustomerCounter += 1;
  const now = new Date().toISOString();
  const row = {
    id: `mock-cu-${_mockCustomerCounter}`,
    nameEn: payload.nameEn || `Customer ${_mockCustomerCounter}`,
    nameAr: payload.nameAr ?? null,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    businessAddress: payload.businessAddress ?? null,
    deliveryAddress: payload.deliveryAddress ?? null,
    crNumber: payload.crNumber ?? null,
    crExpiryDate: payload.crExpiryDate ?? null,
    crIssuedAt: payload.crIssuedAt ?? null,
    civilIdNumber: payload.civilIdNumber ?? null,
    kycNotes: payload.kycNotes ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    _mock: true,
  };
  _mockCustomers.unshift(row);
  return { ...row };
}
async function mockUpdateCustomer(id, patch = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockCustomers.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  _mockCustomers[idx] = _applyMockKycPatch(_mockCustomers[idx], patch);
  return { ..._mockCustomers[idx] };
}
async function mockDeactivateCustomer(id) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockCustomers.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  _mockCustomers[idx] = {
    ..._mockCustomers[idx],
    isActive: false,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockCustomers[idx] };
}

// ── Payroll MOCK stubs (AUDIT-ACC-013) ──
// In-memory seed deliberately covers Kuwaiti vs non-Kuwaiti (drives
// statutory differences on payroll lines) + one TERMINATED employee
// so the status filter + re-hire flow are exercisable in MOCK.
const _mockEmployees = [
  {
    id: 'EMP-001',
    employeeNumber: 'E-001',
    nameEn: 'Fahad Al-Jasem',
    nameAr: 'فهد الجاسم',
    civilId: '••••1234',
    nationality: 'Kuwaiti',
    isKuwaiti: true,
    basicSalary: '1800.000',
    housingAllowance: '150.000',
    transportAllowance: '50.000',
    otherAllowances: '0.000',
    hireDate: '2022-01-15',
    bankAccountIban: 'KW81CBKU0000000000001234567890',
    status: 'ACTIVE',
    position: 'Accounting Manager',
    createdAt: '2022-01-15T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'EMP-002',
    employeeNumber: 'E-002',
    nameEn: 'Layla Al-Mutairi',
    nameAr: 'ليلى المطيري',
    civilId: '••••5678',
    nationality: 'Kuwaiti',
    isKuwaiti: true,
    basicSalary: '1200.000',
    housingAllowance: '100.000',
    transportAllowance: '50.000',
    otherAllowances: '0.000',
    hireDate: '2023-06-01',
    bankAccountIban: 'KW81NBOK0000000000001234567891',
    status: 'ACTIVE',
    position: 'Senior Accountant',
    createdAt: '2023-06-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'EMP-003',
    employeeNumber: 'E-003',
    nameEn: 'Salem Al-Rashid',
    nameAr: 'سالم الراشد',
    civilId: '••••9012',
    nationality: 'Kuwaiti',
    isKuwaiti: true,
    basicSalary: '900.000',
    housingAllowance: '80.000',
    transportAllowance: '40.000',
    otherAllowances: '0.000',
    hireDate: '2024-03-10',
    bankAccountIban: 'KW81CBKU0000000000001234567892',
    status: 'ACTIVE',
    position: 'Junior Accountant',
    createdAt: '2024-03-10T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'EMP-004',
    employeeNumber: 'E-004',
    nameEn: 'Rajesh Kumar',
    nameAr: 'راجيش كومار',
    civilId: '••••3456',
    nationality: 'Indian',
    isKuwaiti: false,
    basicSalary: '750.000',
    housingAllowance: '75.000',
    transportAllowance: '35.000',
    otherAllowances: '0.000',
    hireDate: '2023-09-15',
    bankAccountIban: 'KW81NBOK0000000000001234567893',
    status: 'ACTIVE',
    position: 'IT Specialist',
    createdAt: '2023-09-15T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'EMP-005',
    employeeNumber: 'E-005',
    nameEn: 'Maria Santos',
    nameAr: 'ماريا سانتوس',
    civilId: '••••7890',
    nationality: 'Filipino',
    isKuwaiti: false,
    basicSalary: '400.000',
    housingAllowance: '50.000',
    transportAllowance: '25.000',
    otherAllowances: '0.000',
    hireDate: '2024-01-20',
    bankAccountIban: 'KW81CBKU0000000000001234567894',
    status: 'ACTIVE',
    position: 'Administrative Assistant',
    createdAt: '2024-01-20T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'EMP-006',
    employeeNumber: 'E-006',
    nameEn: 'Ahmed Hassan',
    nameAr: 'أحمد حسن',
    civilId: '••••2468',
    nationality: 'Egyptian',
    isKuwaiti: false,
    basicSalary: '600.000',
    housingAllowance: '60.000',
    transportAllowance: '30.000',
    otherAllowances: '0.000',
    hireDate: '2021-04-01',
    bankAccountIban: 'KW81NBOK0000000000001234567895',
    status: 'TERMINATED',
    position: 'Operations Analyst',
    terminationDate: '2026-02-15',
    createdAt: '2021-04-01T00:00:00.000Z',
    updatedAt: '2026-02-15T00:00:00.000Z',
  },
];

function _buildMockPayrollEntries() {
  // Active employees only (5 of 6). PIFSS applies only to Kuwaitis
  // (8% employee + 11.5% employer, capped at KD 2,750 basic).
  return _mockEmployees
    .filter((e) => e.status === 'ACTIVE')
    .map((e) => {
      const base = Number(e.basicSalary || 0);
      const allowances =
        Number(e.housingAllowance || 0) +
        Number(e.transportAllowance || 0) +
        Number(e.otherAllowances || 0);
      const gross = base + allowances;
      const pifssCap = Math.min(base, 2750);
      const pifssEmployee = e.isKuwaiti ? +(pifssCap * 0.08).toFixed(3) : 0;
      const pifssEmployer = e.isKuwaiti ? +(pifssCap * 0.115).toFixed(3) : 0;
      const otherDeductions = 0;
      const net = +(gross - pifssEmployee - otherDeductions).toFixed(3);
      return {
        id: `ENTRY-${e.id}`,
        employeeId: e.id,
        employee: {
          id: e.id,
          employeeNumber: e.employeeNumber,
          nameEn: e.nameEn,
          nameAr: e.nameAr,
          isKuwaiti: e.isKuwaiti,
          nationality: e.nationality,
          position: e.position,
        },
        basicSalary: base.toFixed(3),
        allowances: allowances.toFixed(3),
        grossSalary: gross.toFixed(3),
        pifssCappedSalary: pifssCap.toFixed(3),
        pifssEmployee: pifssEmployee.toFixed(3),
        pifssEmployer: pifssEmployer.toFixed(3),
        otherDeductions: otherDeductions.toFixed(3),
        netSalary: net.toFixed(3),
      };
    });
}

function _sumPayrollEntries(entries) {
  const sum = (field) =>
    entries
      .reduce((acc, e) => acc + Number(e[field] || 0), 0)
      .toFixed(3);
  return {
    totalGross: sum('grossSalary'),
    totalDeductions: entries
      .reduce(
        (acc, e) =>
          acc + Number(e.pifssEmployee || 0) + Number(e.otherDeductions || 0),
        0,
      )
      .toFixed(3),
    totalNet: sum('netSalary'),
    totalPifssEmployer: sum('pifssEmployer'),
    totalPifssEmployee: sum('pifssEmployee'),
  };
}

function _seedMockPayrollRuns() {
  const entries = _buildMockPayrollEntries();
  const totals = _sumPayrollEntries(entries);
  return [
    {
      id: 'RUN-2026-04',
      periodYear: 2026,
      periodMonth: 4,
      status: 'DRAFT',
      ...totals,
      processedBy: 'mock-owner',
      processedAt: '2026-04-20T10:00:00.000Z',
      approvedBy: null,
      approvedAt: null,
      paidAt: null,
      journalEntryId: null,
      wpsFileUrl: null,
      entries,
    },
    {
      id: 'RUN-2026-03',
      periodYear: 2026,
      periodMonth: 3,
      status: 'APPROVED',
      ...totals,
      processedBy: 'mock-owner',
      processedAt: '2026-03-28T10:00:00.000Z',
      approvedBy: 'mock-owner',
      approvedAt: '2026-03-29T12:00:00.000Z',
      paidAt: null,
      journalEntryId: 'JE-PAYROLL-2026-03',
      wpsFileUrl: null,
      entries,
    },
    {
      id: 'RUN-2026-02',
      periodYear: 2026,
      periodMonth: 2,
      status: 'PAID',
      ...totals,
      processedBy: 'mock-owner',
      processedAt: '2026-02-28T10:00:00.000Z',
      approvedBy: 'mock-owner',
      approvedAt: '2026-03-01T09:00:00.000Z',
      paidAt: '2026-03-02T11:00:00.000Z',
      journalEntryId: 'JE-PAYROLL-2026-02',
      wpsFileUrl: 'mock://wps/RUN-2026-02.sif',
      entries,
    },
  ];
}

const _mockPayrollRuns = _seedMockPayrollRuns();

const _mockPifssSubmissions = [
  {
    id: 'PIFSS-2026-03',
    year: 2026,
    month: 3,
    status: 'ACCEPTED',
    fileName: 'PIFSS_2026_03.txt',
    portalReference: 'KWT-PIFSS-2026-03-ABC123',
    totalEmployees: 3,
    totalPifssEmployee: '264.000',
    totalPifssEmployer: '379.500',
    submittedAt: '2026-04-05T10:00:00.000Z',
    acceptedAt: '2026-04-06T11:00:00.000Z',
    rejectedAt: null,
    rejectionReason: null,
    paidAt: null,
    createdAt: '2026-04-01T09:00:00.000Z',
  },
  {
    id: 'PIFSS-2026-02',
    year: 2026,
    month: 2,
    status: 'PAID',
    fileName: 'PIFSS_2026_02.txt',
    portalReference: 'KWT-PIFSS-2026-02-XYZ456',
    totalEmployees: 3,
    totalPifssEmployee: '264.000',
    totalPifssEmployer: '379.500',
    submittedAt: '2026-03-05T10:00:00.000Z',
    acceptedAt: '2026-03-06T11:00:00.000Z',
    rejectedAt: null,
    rejectionReason: null,
    paidAt: '2026-03-10T12:00:00.000Z',
    createdAt: '2026-03-01T09:00:00.000Z',
  },
];

let _mockPayrollRunCounter = _mockPayrollRuns.length;
let _mockEmployeeCounter = _mockEmployees.length;
let _mockPifssCounter = _mockPifssSubmissions.length;

async function mockListEmployees(filter = {}) {
  await new Promise((r) => setTimeout(r, 60));
  let rows = _mockEmployees.slice();
  if (filter.search) {
    const q = String(filter.search).toLowerCase();
    rows = rows.filter(
      (e) =>
        e.nameEn.toLowerCase().includes(q) ||
        (e.nameAr || '').toLowerCase().includes(q) ||
        e.employeeNumber.toLowerCase().includes(q) ||
        (e.civilId || '').toLowerCase().includes(q),
    );
  }
  if (filter.status) rows = rows.filter((e) => e.status === filter.status);
  if (filter.isKuwaiti != null) {
    rows = rows.filter((e) => !!e.isKuwaiti === !!filter.isKuwaiti);
  }
  const page = filter.page || 1;
  const limit = filter.limit || rows.length;
  const start = (page - 1) * limit;
  return {
    data: rows.slice(start, start + limit).map((e) => ({ ...e })),
    total: rows.length,
    page,
    limit,
  };
}

async function mockGetEmployee(id) {
  await new Promise((r) => setTimeout(r, 30));
  const row = _mockEmployees.find((e) => e.id === id);
  return row ? { ...row } : null;
}

async function mockCreateEmployee(input = {}) {
  await new Promise((r) => setTimeout(r, 80));
  _mockEmployeeCounter += 1;
  const id = `EMP-${String(_mockEmployeeCounter).padStart(3, '0')}`;
  const row = {
    id,
    employeeNumber: input.employeeNumber || `E-${_mockEmployeeCounter}`,
    nameEn: input.nameEn || '',
    nameAr: input.nameAr || '',
    civilId: input.civilId || null,
    nationality: input.nationality || null,
    isKuwaiti: !!input.isKuwaiti,
    basicSalary: String(input.basicSalary ?? '0.000'),
    housingAllowance: String(input.housingAllowance ?? '0.000'),
    transportAllowance: String(input.transportAllowance ?? '0.000'),
    otherAllowances: String(input.otherAllowances ?? '0.000'),
    hireDate: input.hireDate || new Date().toISOString().slice(0, 10),
    bankAccountIban: input.bankAccountIban || null,
    status: 'ACTIVE',
    position: input.position || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  _mockEmployees.push(row);
  return { ...row };
}

async function mockUpdateEmployee(id, patch = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockEmployees.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  _mockEmployees[idx] = {
    ..._mockEmployees[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockEmployees[idx] };
}

async function mockTerminateEmployee(id, input = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockEmployees.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  _mockEmployees[idx] = {
    ..._mockEmployees[idx],
    status: 'TERMINATED',
    terminationDate:
      input.terminationDate || new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockEmployees[idx] };
}

async function mockGetEmployeeEos(id) {
  await new Promise((r) => setTimeout(r, 40));
  const emp = _mockEmployees.find((e) => e.id === id);
  if (!emp) return null;
  const base = Number(emp.basicSalary || 0);
  const years = 2; // stub
  return {
    employeeId: emp.id,
    employeeName: emp.nameEn,
    hireDate: emp.hireDate,
    yearsOfService: years,
    basicSalary: base.toFixed(3),
    dailyRate: (base / 30).toFixed(3),
    first5YearsAmount: (base * 0.5 * years).toFixed(3),
    after5YearsAmount: '0.000',
    totalEos: (base * 0.5 * years).toFixed(3),
    accruedToDate: (base * 0.5 * (years - 0.1)).toFixed(3),
    accrualHistory: [],
  };
}

async function mockRegisterEmployeeRehire(id, input = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockEmployees.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  _mockEmployees[idx] = {
    ..._mockEmployees[idx],
    status: 'ACTIVE',
    rehireDate: input.rehireDate,
    priorTerminationDate: input.priorTerminationDate,
    updatedAt: new Date().toISOString(),
  };
  return { ..._mockEmployees[idx] };
}

async function mockClassifyServiceContinuity(id, input = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const emp = _mockEmployees.find((e) => e.id === id);
  return {
    employeeId: id,
    decision: input.decision,
    legalBasisNote: input.legalBasisNote,
    classifiedAt: new Date().toISOString(),
    employee: emp ? { ...emp } : null,
  };
}

async function mockGetEmployeeEosHistory(id) {
  await new Promise((r) => setTimeout(r, 40));
  return {
    employeeId: id,
    events: [],
    accruals: [],
  };
}

async function mockGetEmployeeAdvances(id) {
  await new Promise((r) => setTimeout(r, 40));
  return { employeeId: id, advances: [] };
}

async function mockGetTenantPayrollConfig() {
  await new Promise((r) => setTimeout(r, 30));
  return {
    id: 'TENANT-PAYROLL-CONFIG',
    eosiReformDate: '2024-01-01',
    eosiReformLegalBasisNote: 'Kuwait EOSI reform law 123 of 2024.',
    pifssSalaryCapKwd: '2750.000',
    pifssEmployeeRate: '0.08',
    pifssEmployerRate: '0.115',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

async function mockUpdateEosiReformDate(input = {}) {
  await new Promise((r) => setTimeout(r, 60));
  return {
    id: 'TENANT-PAYROLL-CONFIG',
    eosiReformDate: input.date,
    eosiReformLegalBasisNote: input.legalBasisNote,
    updatedAt: new Date().toISOString(),
  };
}

async function mockListPifssSubmissions(filter = {}) {
  await new Promise((r) => setTimeout(r, 50));
  let rows = _mockPifssSubmissions.slice();
  if (filter.year) rows = rows.filter((s) => s.year === filter.year);
  if (filter.status) rows = rows.filter((s) => s.status === filter.status);
  const page = filter.page || 1;
  const limit = filter.limit || rows.length;
  const start = (page - 1) * limit;
  return {
    data: rows.slice(start, start + limit).map((r) => ({ ...r })),
    total: rows.length,
    page,
    limit,
  };
}

async function mockGeneratePifssFile(year, month) {
  await new Promise((r) => setTimeout(r, 100));
  _mockPifssCounter += 1;
  const row = {
    id: `PIFSS-${year}-${String(month).padStart(2, '0')}`,
    year,
    month,
    status: 'GENERATED',
    fileName: `PIFSS_${year}_${String(month).padStart(2, '0')}.txt`,
    portalReference: null,
    totalEmployees: 3,
    totalPifssEmployee: '264.000',
    totalPifssEmployer: '379.500',
    submittedAt: null,
    acceptedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    paidAt: null,
    createdAt: new Date().toISOString(),
  };
  _mockPifssSubmissions.unshift(row);
  return { ...row };
}

async function mockGetPifssSubmission(id) {
  await new Promise((r) => setTimeout(r, 30));
  const row = _mockPifssSubmissions.find((s) => s.id === id);
  return row ? { ...row } : null;
}

async function mockUpdatePifssSubmissionStatus(id, input = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const idx = _mockPifssSubmissions.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const patch = { status: input.status };
  if (input.status === 'SUBMITTED') patch.submittedAt = input.submittedAt || now;
  if (input.status === 'ACCEPTED') patch.acceptedAt = input.acceptedAt || now;
  if (input.status === 'REJECTED') {
    patch.rejectedAt = input.rejectedAt || now;
    patch.rejectionReason = input.rejectionReason;
  }
  if (input.status === 'PAID') patch.paidAt = input.paidAt || now;
  if (input.portalReference) patch.portalReference = input.portalReference;
  _mockPifssSubmissions[idx] = { ..._mockPifssSubmissions[idx], ...patch };
  return { ..._mockPifssSubmissions[idx] };
}

async function mockGetPayrollHistory(filter = {}) {
  await new Promise((r) => setTimeout(r, 60));
  let rows = _mockPayrollRuns.slice();
  if (filter.year) rows = rows.filter((r) => r.periodYear === filter.year);
  const page = filter.page || 1;
  const limit = filter.limit || rows.length;
  const start = (page - 1) * limit;
  return {
    data: rows.slice(start, start + limit).map((r) => ({ ...r })),
    total: rows.length,
    page,
    limit,
  };
}

async function mockGetPayrollRun(id) {
  await new Promise((r) => setTimeout(r, 50));
  const row = _mockPayrollRuns.find((r) => r.id === id);
  return row ? { ...row } : null;
}

async function mockRunPayroll(input = {}) {
  await new Promise((r) => setTimeout(r, 100));
  _mockPayrollRunCounter += 1;
  const year = input.year ?? input.periodYear;
  const month = input.month ?? input.periodMonth;
  const entries = _buildMockPayrollEntries();
  const totals = _sumPayrollEntries(entries);
  const row = {
    id: `RUN-${year}-${String(month).padStart(2, '0')}`,
    periodYear: year,
    periodMonth: month,
    status: 'DRAFT',
    ...totals,
    processedBy: 'mock-owner',
    processedAt: new Date().toISOString(),
    approvedBy: null,
    approvedAt: null,
    paidAt: null,
    journalEntryId: null,
    wpsFileUrl: null,
    entries,
  };
  _mockPayrollRuns.unshift(row);
  return { ...row };
}

async function mockAccrueEos(input = {}) {
  await new Promise((r) => setTimeout(r, 80));
  return {
    year: input.year,
    month: input.month,
    accruedEmployees: _mockEmployees.filter((e) => e.status === 'ACTIVE').length,
    journalEntryId: `JE-EOS-${input.year}-${String(input.month).padStart(2, '0')}`,
  };
}

async function mockApprovePayroll(id) {
  await new Promise((r) => setTimeout(r, 80));
  const idx = _mockPayrollRuns.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  _mockPayrollRuns[idx] = {
    ..._mockPayrollRuns[idx],
    status: 'APPROVED',
    approvedBy: 'mock-owner',
    approvedAt: new Date().toISOString(),
    journalEntryId:
      _mockPayrollRuns[idx].journalEntryId ||
      `JE-PAYROLL-${_mockPayrollRuns[idx].periodYear}-${String(
        _mockPayrollRuns[idx].periodMonth,
      ).padStart(2, '0')}`,
  };
  return {
    payrollRunId: _mockPayrollRuns[idx].id,
    journalEntryId: _mockPayrollRuns[idx].journalEntryId,
    status: 'APPROVED',
  };
}

async function mockPayPayroll(id) {
  await new Promise((r) => setTimeout(r, 100));
  const idx = _mockPayrollRuns.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  _mockPayrollRuns[idx] = {
    ..._mockPayrollRuns[idx],
    status: 'PAID',
    paidAt: new Date().toISOString(),
    wpsFileUrl: `mock://wps/${id}.sif`,
  };
  return { ..._mockPayrollRuns[idx] };
}

async function mockDownloadWpsFile(id) {
  await new Promise((r) => setTimeout(r, 60));
  const run = _mockPayrollRuns.find((r) => r.id === id);
  const year = run?.periodYear || 2026;
  const month = run?.periodMonth || 1;
  // Minimal SIF-like text; real files are fixed-width records.
  const sifText = [
    `HEADER|${year}${String(month).padStart(2, '0')}|MOCK-TENANT|KWD`,
    ...(_mockEmployees
      .filter((e) => e.status === 'ACTIVE')
      .map((e, i) => {
        const base = Number(e.basicSalary || 0);
        const allowances =
          Number(e.housingAllowance || 0) +
          Number(e.transportAllowance || 0) +
          Number(e.otherAllowances || 0);
        const gross = base + allowances;
        const net = e.isKuwaiti
          ? gross - Math.min(base, 2750) * 0.08
          : gross;
        return `DETAIL|${i + 1}|${e.civilId || ''}|${e.bankAccountIban || ''}|${net.toFixed(3)}`;
      })),
    `TRAILER|${_mockEmployees.filter((e) => e.status === 'ACTIVE').length}`,
  ].join('\n');
  const filename = `WPS_${year}_${String(month).padStart(2, '0')}.sif`;
  const blob =
    typeof Blob !== 'undefined'
      ? new Blob([sifText], { type: 'text/plain' })
      : { text: async () => sifText, type: 'text/plain', size: sifText.length };
  return { blob, filename };
}

/**
 * HASEEB-221 (2026-04-22) — MOCK stub for the per-employee payslip PDF
 * download. Real backend (HASEEB-205, merged `109d377` 2026-04-22) emits
 * `application/pdf` via `src/modules/payroll/payslip-generator.ts`; the
 * MOCK here returns a 1-line PDF-magic blob + deterministic filename so
 * dev-mode + tests can exercise the download dance without a live API.
 */
async function mockDownloadPayslip(runId, empId) {
  await new Promise((r) => setTimeout(r, 60));
  const pdfText = `%PDF-1.4 mock payslip run=${runId} emp=${empId}`;
  const filename = `payslip_${empId}_${runId}.pdf`;
  const blob =
    typeof Blob !== 'undefined'
      ? new Blob([pdfText], { type: 'application/pdf' })
      : { text: async () => pdfText, type: 'application/pdf', size: pdfText.length };
  return { blob, filename };
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

// YEAR-END-FS-TRIO (AUDIT-ACC-040 / HASEEB-213 / HASEEB-216)
export const getStatementOfChangesInEquity =
  surface.getStatementOfChangesInEquity;
export const getDisclosureNotes = surface.getDisclosureNotes;

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

// Aging reports — sendAgingReminder stays mock-only (no backend email
// delivery surface yet); scheduleVendorPayment stays mock-only per
// HASEEB-195 follow-up (AP scheduling wire).
export const sendAgingReminder = surface.sendAgingReminder;
export const scheduleVendorPayment = surface.scheduleVendorPayment;

// Aging action writes — AUDIT-ACC-005 (corporate-api 3fdb92c, 2026-04-22).
// Three new invoice-lifecycle writes, OWNER / ACCOUNTANT gated at the
// backend. writeOffInvoice + disputeInvoice supersede the old mock-only
// createWriteOffJE + markInvoiceDisputed exports (removed). See
// src/api/invoices.js for per-function JSDoc + memory-bank/
// 2026-04-22-audit-acc-005-checkpoint-a.md for resolutions 2.1(c) +
// 2.2(a). HASEEB-194 tracks GL-flexibility follow-up for write-off.
export const writeOffInvoice = surface.writeOffInvoice;
export const disputeInvoice = surface.disputeInvoice;
export const scheduleInvoicePaymentPlan = surface.scheduleInvoicePaymentPlan;

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
// HASEEB-180 (corporate-api 2ff14dc, 2026-04-21): CSV / PDF / XLSX export
// of the account's statement. JSON-wrapped response (base64 for binary).
export const exportBankAccountStatement = surface.exportBankAccountStatement;

// Recurrence patterns — Tier C-3 FOLLOW-UP (HASEEB-183, aff0764,
// 2026-04-21). Operator-only suspend action paired with Aminah's
// `get_missing_recurrences` read tool. Role gate OWNER / ACCOUNTANT
// backend-side; midsize FE additionally hides for Junior.
export const suspendRecurrencePattern = surface.suspendRecurrencePattern;

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
// OWNER-only status transitions (2026-04-21).
export const lockBudgetLive = surface.lockBudgetLive;
export const reopenBudgetToDraftLive = surface.reopenBudgetToDraftLive;
export const rejectBudgetLive = surface.rejectBudgetLive;
// Group D — comments:
export const addBudgetLineCommentLive = surface.addBudgetLineCommentLive;
export const listBudgetLineCommentsLive = surface.listBudgetLineCommentsLive;
export const deleteBudgetLineCommentLive = surface.deleteBudgetLineCommentLive;
// Group E — state + team:
export const getBudgetApprovalStateLive = surface.getBudgetApprovalStateLive;
export const listTeamMembersLive = surface.listTeamMembersLive;

// Migration Import — Track 1 Migration Wizard (2026-04-20). Twelve
// canonical engine-extras wrappers, all NOT on mockEngine's namespace
// (both MOCK and LIVE assignments happen in buildMockExtras /
// buildLiveSurface above). Wire pattern mirrors Track B reconciliation /
// budgets extras. Screens import from '../../engine' in both modes.
export const ingestInvoices = surface.ingestInvoices;
export const ingestBills = surface.ingestBills;
export const ingestJournalEntries = surface.ingestJournalEntries;
export const listStagedInvoices = surface.listStagedInvoices;
export const listStagedBills = surface.listStagedBills;
export const listStagedJournalEntries = surface.listStagedJournalEntries;
export const listSourceAccountMap = surface.listSourceAccountMap;
export const suggestSourceMap = surface.suggestSourceMap;
export const suggestAllSourceMap = surface.suggestAllSourceMap;
export const declineSuggestion = surface.declineSuggestion;
export const updateSourceMap = surface.updateSourceMap;
export const postStagedItem = surface.postStagedItem;
export const rejectStagedItem = surface.rejectStagedItem;

// Vendors + Customers KYC admin (FN-272 — 2026-04-19). Five wrappers
// each. Backend live at corporate-api 493030e (HASEEB-143). MOCK mode
// runs the in-memory CRUD store seeded with five rows per surface that
// deliberately cover the three KYC display states the SetupScreen
// chips render: expiring-within-30, expired, and no-CR-tracked.
//
// Note: listVendorsForRelatedParty / listCustomersForRelatedParty
// (FN-254 helpers) are still exported above and remain the canonical
// names for the related-party modal pickers; in MOCK mode they now
// share the same seed list as listVendors / listCustomers (the
// related-party helpers used to return [] before this wire).
export const listVendors = surface.listVendors;
export const getVendor = surface.getVendor;
export const createVendor = surface.createVendor;
export const updateVendor = surface.updateVendor;
export const deactivateVendor = surface.deactivateVendor;
export const listCustomers = surface.listCustomers;
export const getCustomer = surface.getCustomer;
export const createCustomer = surface.createCustomer;
export const updateCustomer = surface.updateCustomer;
export const deactivateCustomer = surface.deactivateCustomer;

// Recurring entries — AUDIT-ACC-010 (corporate-api 65ccaf6, 2026-04-22).
// Eight wrappers on /api/recurring-entries. Supersedes the legacy
// mockEngine template lifecycle (getManualJETemplates /
// createFromTemplate / saveAsTemplate / useJETemplate /
// getJETemplateMeta / deleteJETemplateRecord / scheduleManualJE /
// postScheduledNow) on the active ManualJEScreen path. The legacy
// mock names remain in mockEngine for test fixtures only — the
// ManualJEScreen rewire imports from this surface in both modes.
//
// shareJETemplate is NOT included — no backend surface exists for
// template sharing. Tracked as HASEEB-202 (P3, scope-locked follow-up).
export const listRecurringEntries = surface.listRecurringEntries;
export const getRecurringEntry = surface.getRecurringEntry;
export const createRecurringEntry = surface.createRecurringEntry;
export const updateRecurringEntry = surface.updateRecurringEntry;
export const deleteRecurringEntry = surface.deleteRecurringEntry;
export const processRecurringEntries = surface.processRecurringEntries;
export const fireRecurringEntryNow = surface.fireRecurringEntryNow;
export const listRecurringEntryInstances = surface.listRecurringEntryInstances;

// Payroll — AUDIT-ACC-013 (2026-04-22). 23 wrappers. See src/api/payroll.js
// for the file-level contract notes. WPS download skips the JSON envelope
// and returns `{blob, filename}` directly so the PayrollScreen can trigger
// a browser download via anchor + URL.createObjectURL without decoding
// base64 — the backend emits raw `text/plain` SIF content.
//
// Scope carve-out: employee payslip viewer is explicitly out of scope
// (AUDIT-ACC-014 dropped per Tarek 2026-04-22 → tracked as HASEEB-205
// Wave follow-up). The WPS-download action on the approved payroll-run
// row substitutes for the payslip as the v1 "proof of pay" artifact.
export const listEmployees = surface.listEmployees;
export const getEmployee = surface.getEmployee;
export const createEmployee = surface.createEmployee;
export const updateEmployee = surface.updateEmployee;
export const terminateEmployee = surface.terminateEmployee;
export const getEmployeeEos = surface.getEmployeeEos;
export const registerEmployeeRehire = surface.registerEmployeeRehire;
export const classifyServiceContinuity = surface.classifyServiceContinuity;
export const getEmployeeEosHistory = surface.getEmployeeEosHistory;
export const getEmployeeAdvances = surface.getEmployeeAdvances;
export const getTenantPayrollConfig = surface.getTenantPayrollConfig;
export const updateEosiReformDate = surface.updateEosiReformDate;
export const listPifssSubmissions = surface.listPifssSubmissions;
export const generatePifssFile = surface.generatePifssFile;
export const getPifssSubmission = surface.getPifssSubmission;
export const updatePifssSubmissionStatus = surface.updatePifssSubmissionStatus;
export const getPayrollHistory = surface.getPayrollHistory;
export const getPayrollRun = surface.getPayrollRun;
export const runPayroll = surface.runPayroll;
export const accrueEos = surface.accrueEos;
export const approvePayroll = surface.approvePayroll;
export const payPayroll = surface.payPayroll;
export const downloadWpsFile = surface.downloadWpsFile;
export const downloadPayslip = surface.downloadPayslip;

// Payment Vouchers + Bank Mandates — AUDIT-ACC-002 (2026-04-22). 13
// voucher wrappers + 3 read-only mandate wrappers. See
// src/api/paymentVouchers.js + src/api/bankMandates.js for the
// file-level contract notes. Lifecycle: DRAFT → PENDING_REVIEW →
// PENDING_APPROVAL → PENDING_SIGNATORIES (cheque) | APPROVED →
// PAID. SoD enforced backend-side; HASEEB-274 two-signatory surface
// lives on the composer + detail. Mandate CRUD is a follow-up
// (HASEEB-210 — P3 Owner-side admin surface).
export const listVouchers = surface.listVouchers;
export const getVoucher = surface.getVoucher;
export const createVoucher = surface.createVoucher;
export const patchVoucher = surface.patchVoucher;
export const submitVoucher = surface.submitVoucher;
export const reviewVoucher = surface.reviewVoucher;
export const approveVoucher = surface.approveVoucher;
export const assignSignatories = surface.assignSignatories;
export const signVoucher = surface.signVoucher;
export const markVoucherPaid = surface.markVoucherPaid;
export const rejectVoucher = surface.rejectVoucher;
export const cancelVoucher = surface.cancelVoucher;
export const getVoucherAminahStatus = surface.getVoucherAminahStatus;
export const listMandates = surface.listMandates;
export const getMandate = surface.getMandate;
export const listMandateSignatories = surface.listMandateSignatories;

// Annual PIFSS Reconciliation — AUDIT-ACC-058 (2026-04-22). 5 endpoints
// on /api/pifss-reconciliation (FN-251) + 1 client-side aggregation
// (listReconciliationYears). This is the ANNUAL reconciliation surface;
// monthly SIF generation lives on the existing listPifssSubmissions /
// generatePifssFile / getPifssSubmission wrappers above.
export const listReconciliationYears = surface.listReconciliationYears;
export const getReconciliation = surface.getReconciliation;
export const getReconciliationReport = surface.getReconciliationReport;
export const importStatement = surface.importStatement;
export const runReconciliation = surface.runReconciliation;
export const resolveVariance = surface.resolveVariance;

// Year-End Close — AUDIT-ACC-003 (2026-04-22). 7 endpoints on
// /api/year-end-close (FN-271, TASK-WAVE5-YEAR-END-ROLLOVER). Annual
// fiscal-year close surface; the monthly close surface is a different
// endpoint set and lives on the Aminah advisor + monthly-close-checklist
// wrappers above.
export const getYearEndCloseConfig = surface.getYearEndCloseConfig;
export const updateYearEndCloseConfig = surface.updateYearEndCloseConfig;
export const prepareYearEndClose = surface.prepareYearEndClose;
export const listYearEndCloseRecords = surface.listYearEndCloseRecords;
export const approveYearEndClose = surface.approveYearEndClose;
export const reverseYearEndClose = surface.reverseYearEndClose;
export const getYearEndClose = surface.getYearEndClose;

// ══════════════════════════════════════════════════════════════════
// Payment Voucher + Bank Mandate MOCK stubs — AUDIT-ACC-002
// ══════════════════════════════════════════════════════════════════
//
// Seed fixtures deliberately cover every status for the four filter
// tabs on the screen, plus two mandate shapes (one compliant — 2-of-2
// class-A + class-B; one deliberately sub-2 so the HASEEB-274 banner
// can be exercised in MOCK). The in-memory stores are module-scoped
// so lifecycle transitions persist for the tab's lifetime.

const _mockVouchersStore = (() => {
  const nowIso = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  return [
    {
      id: 'mock-voucher-draft-1',
      voucherNumber: 'PV-2026-0001',
      beneficiaryType: 'Vendor',
      beneficiaryId: 'mock-vendor-1',
      beneficiaryNameSnapshot: 'Al-Khaleej Supplies LLC',
      amountKwd: '4250.500',
      paymentMethod: 'CHEQUE_IMMEDIATE',
      chequeId: null,
      issueDate: today,
      description: 'April office supplies',
      status: 'DRAFT',
      preparedBy: 'user-cfo-1',
      preparedAt: nowIso,
      reviewedBy: null,
      reviewedAt: null,
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      paidAt: null,
      linkedJournalEntryId: null,
      linkedApprovalEventId: null,
      bankAccountMandateId: 'mock-mandate-1',
      signatories: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'mock-voucher-review-1',
      voucherNumber: 'PV-2026-0002',
      beneficiaryType: 'Vendor',
      beneficiaryId: 'mock-vendor-2',
      beneficiaryNameSnapshot: 'Gulf Logistics Kuwait',
      amountKwd: '1200.000',
      paymentMethod: 'BANK_TRANSFER_KNET',
      chequeId: null,
      issueDate: today,
      description: 'Customs clearance March',
      status: 'PENDING_REVIEW',
      preparedBy: 'user-cfo-1',
      preparedAt: nowIso,
      reviewedBy: null,
      reviewedAt: null,
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      paidAt: null,
      linkedJournalEntryId: null,
      linkedApprovalEventId: null,
      bankAccountMandateId: 'mock-mandate-1',
      signatories: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'mock-voucher-signatories-1',
      voucherNumber: 'PV-2026-0003',
      beneficiaryType: 'Vendor',
      beneficiaryId: 'mock-vendor-3',
      beneficiaryNameSnapshot: 'Burgan Electric Works',
      amountKwd: '8750.000',
      paymentMethod: 'CHEQUE_POST_DATED',
      chequeId: 'mock-cheque-1',
      issueDate: today,
      description: 'Milestone 2 payment, contract CN-118',
      status: 'PENDING_SIGNATORIES',
      preparedBy: 'user-cfo-1',
      preparedAt: nowIso,
      reviewedBy: 'user-senior-1',
      reviewedAt: nowIso,
      approvedBy: 'user-owner-1',
      approvedAt: nowIso,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      paidAt: null,
      linkedJournalEntryId: null,
      linkedApprovalEventId: 'mock-approval-1',
      bankAccountMandateId: 'mock-mandate-1',
      signatories: [
        {
          userId: 'user-owner-1',
          signatoryClass: 'CLASS_A',
          assignedAt: nowIso,
          signedAt: nowIso,
          signedBy: 'user-owner-1',
        },
        {
          userId: 'user-cfo-1',
          signatoryClass: 'CLASS_B',
          assignedAt: nowIso,
          signedAt: undefined,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'mock-voucher-paid-1',
      voucherNumber: 'PV-2026-0004',
      beneficiaryType: 'Employee',
      beneficiaryId: 'mock-emp-1',
      beneficiaryNameSnapshot: 'Fahad Al-Jasem',
      amountKwd: '350.000',
      paymentMethod: 'CASH',
      chequeId: null,
      issueDate: today,
      description: 'Petty-cash reimbursement March',
      status: 'PAID',
      preparedBy: 'user-cfo-1',
      preparedAt: nowIso,
      reviewedBy: 'user-senior-1',
      reviewedAt: nowIso,
      approvedBy: 'user-owner-1',
      approvedAt: nowIso,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      paidAt: nowIso,
      linkedJournalEntryId: 'mock-je-pv-0004',
      linkedApprovalEventId: null,
      bankAccountMandateId: null,
      signatories: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
})();

const _mockMandatesStore = (() => {
  const nowIso = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  return [
    {
      id: 'mock-mandate-1',
      bankName: 'National Bank of Kuwait',
      accountReference: '****4421',
      mandateDocumentUrl: null,
      mandateRules: {
        requires: [
          { signatoryClass: 'CLASS_A', count: 1 },
          { signatoryClass: 'CLASS_B', count: 1 },
        ],
      },
      effectiveFrom: today,
      effectiveUntil: null,
      status: 'ACTIVE',
      submittedToBankAt: nowIso,
      acknowledgedAt: nowIso,
      acknowledgedBy: 'user-owner-1',
      createdBy: 'user-owner-1',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'mock-mandate-2',
      bankName: 'Burgan Bank',
      accountReference: '****9813',
      mandateDocumentUrl: null,
      mandateRules: {
        requires: [{ signatoryClass: 'CLASS_A', count: 1 }],
      },
      effectiveFrom: today,
      effectiveUntil: null,
      status: 'ACTIVE',
      submittedToBankAt: nowIso,
      acknowledgedAt: nowIso,
      acknowledgedBy: 'user-owner-1',
      createdBy: 'user-owner-1',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
})();

function _mockFindVoucher(id) {
  return _mockVouchersStore.find((v) => v.id === id) || null;
}
function _mockFindMandate(id) {
  return _mockMandatesStore.find((m) => m.id === id) || null;
}

async function mockListVouchers(filter = {}) {
  await new Promise((r) => setTimeout(r, 40));
  let rows = _mockVouchersStore.slice();
  if (filter.status) rows = rows.filter((r) => r.status === filter.status);
  if (filter.beneficiaryType) rows = rows.filter((r) => r.beneficiaryType === filter.beneficiaryType);
  if (filter.beneficiaryId) rows = rows.filter((r) => r.beneficiaryId === filter.beneficiaryId);
  if (filter.paymentMethod) rows = rows.filter((r) => r.paymentMethod === filter.paymentMethod);
  if (filter.preparedBy) rows = rows.filter((r) => r.preparedBy === filter.preparedBy);
  if (filter.approvedBy) rows = rows.filter((r) => r.approvedBy === filter.approvedBy);
  if (filter.mandateId) rows = rows.filter((r) => r.bankAccountMandateId === filter.mandateId);
  if (filter.limit != null) rows = rows.slice(0, Number(filter.limit));
  return { rowCount: rows.length, rows };
}

async function mockGetVoucher(id) {
  await new Promise((r) => setTimeout(r, 30));
  const v = _mockFindVoucher(id);
  if (!v) throw new Error(`Voucher ${id} not found (mock)`);
  return v;
}

async function mockCreateVoucher(body = {}) {
  await new Promise((r) => setTimeout(r, 120));
  const nowIso = new Date().toISOString();
  const nextSeq = 5000 + _mockVouchersStore.length;
  const id = `mock-voucher-${Math.floor(Math.random() * 9000 + 1000)}`;
  const row = {
    id,
    voucherNumber: `PV-2026-${String(nextSeq).padStart(4, '0')}`,
    beneficiaryType: body.beneficiaryType || 'Vendor',
    beneficiaryId: body.beneficiaryId || 'mock-bene-x',
    beneficiaryNameSnapshot: body.beneficiaryNameSnapshot || 'New Beneficiary',
    amountKwd: String(body.amountKwd || '0.000'),
    paymentMethod: body.paymentMethod || 'CASH',
    chequeId: null,
    issueDate: body.issueDate || new Date().toISOString().slice(0, 10),
    description: body.description ?? null,
    status: 'DRAFT',
    preparedBy: 'user-cfo-1',
    preparedAt: nowIso,
    reviewedBy: null,
    reviewedAt: null,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    cancelledBy: null,
    cancelledAt: null,
    cancellationReason: null,
    paidAt: null,
    linkedJournalEntryId: null,
    linkedApprovalEventId: null,
    bankAccountMandateId: body.bankAccountMandateId ?? null,
    signatories: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  _mockVouchersStore.push(row);
  return row;
}

async function mockPatchVoucher(id, patch = {}) {
  await new Promise((r) => setTimeout(r, 80));
  const v = _mockFindVoucher(id);
  if (!v) throw new Error(`Voucher ${id} not found (mock)`);
  if (v.status !== 'DRAFT') throw new Error('Voucher must be DRAFT to patch (mock)');
  Object.assign(v, patch, { updatedAt: new Date().toISOString() });
  if (patch.amountKwd != null) v.amountKwd = String(patch.amountKwd);
  return v;
}

async function mockSubmitVoucher(id) {
  await new Promise((r) => setTimeout(r, 80));
  const v = _mockFindVoucher(id);
  if (!v) throw new Error(`Voucher ${id} not found (mock)`);
  v.status = 'PENDING_REVIEW';
  v.updatedAt = new Date().toISOString();
  return v;
}

async function mockReviewVoucher(id) {
  await new Promise((r) => setTimeout(r, 80));
  const v = _mockFindVoucher(id);
  if (!v) throw new Error(`Voucher ${id} not found (mock)`);
  v.status = 'PENDING_APPROVAL';
  v.reviewedBy = 'user-senior-1';
  v.reviewedAt = new Date().toISOString();
  v.updatedAt = v.reviewedAt;
  return v;
}

async function mockApproveVoucher(id) {
  await new Promise((r) => setTimeout(r, 80));
  const v = _mockFindVoucher(id);
  if (!v) throw new Error(`Voucher ${id} not found (mock)`);
  const chequeMethods = new Set(['CHEQUE_IMMEDIATE', 'CHEQUE_POST_DATED']);
  v.status = chequeMethods.has(v.paymentMethod) ? 'PENDING_SIGNATORIES' : 'APPROVED';
  v.approvedBy = 'user-owner-1';
  v.approvedAt = new Date().toISOString();
  v.updatedAt = v.approvedAt;
  if (chequeMethods.has(v.paymentMethod) && !v.chequeId) {
    v.chequeId = `mock-cheque-${Math.floor(Math.random() * 9000 + 1000)}`;
  }
  return v;
}

async function mockAssignSignatories(id, userIds) {
  await new Promise((r) => setTimeout(r, 80));
  const v = _mockFindVoucher(id);
  if (!v) throw new Error(`Voucher ${id} not found (mock)`);
  const nowIso = new Date().toISOString();
  v.signatories = (userIds || []).map((uid, i) => ({
    userId: uid,
    signatoryClass: i % 2 === 0 ? 'CLASS_A' : 'CLASS_B',
    assignedAt: nowIso,
    signedAt: undefined,
  }));
  v.updatedAt = nowIso;
  return v;
}

async function mockSignVoucher(id, signatoryUserId) {
  await new Promise((r) => setTimeout(r, 80));
  const v = _mockFindVoucher(id);
  if (!v) throw new Error(`Voucher ${id} not found (mock)`);
  const sigs = Array.isArray(v.signatories) ? v.signatories : [];
  const target = sigs.find((s) => s.userId === signatoryUserId);
  if (!target) throw new Error('Signatory not assigned (mock)');
  if (target.signedAt) throw new Error('Already signed (mock)');
  target.signedAt = new Date().toISOString();
  target.signedBy = signatoryUserId;
  if (sigs.every((s) => s.signedAt)) {
    v.status = 'APPROVED';
  }
  v.updatedAt = new Date().toISOString();
  return v;
}

async function mockMarkVoucherPaid(id) {
  await new Promise((r) => setTimeout(r, 80));
  const v = _mockFindVoucher(id);
  if (!v) throw new Error(`Voucher ${id} not found (mock)`);
  v.status = 'PAID';
  v.paidAt = new Date().toISOString();
  v.linkedJournalEntryId = `mock-je-${v.voucherNumber}`;
  v.updatedAt = v.paidAt;
  return v;
}

async function mockRejectVoucher(id, reason) {
  await new Promise((r) => setTimeout(r, 80));
  const v = _mockFindVoucher(id);
  if (!v) throw new Error(`Voucher ${id} not found (mock)`);
  v.status = 'REJECTED';
  v.rejectedBy = 'user-owner-1';
  v.rejectedAt = new Date().toISOString();
  v.rejectionReason = String(reason || '');
  v.updatedAt = v.rejectedAt;
  return v;
}

async function mockCancelVoucher(id, reason) {
  await new Promise((r) => setTimeout(r, 80));
  const v = _mockFindVoucher(id);
  if (!v) throw new Error(`Voucher ${id} not found (mock)`);
  v.status = 'CANCELLED';
  v.cancelledBy = 'user-owner-1';
  v.cancelledAt = new Date().toISOString();
  v.cancellationReason = String(reason || '');
  v.updatedAt = v.cancelledAt;
  return v;
}

async function mockGetVoucherAminahStatus() {
  await new Promise((r) => setTimeout(r, 40));
  return {
    generatedAt: new Date().toISOString(),
    vouchers: { total: _mockVouchersStore.length },
    mandates: { total: _mockMandatesStore.length },
  };
}

async function mockListMandates(filter = {}) {
  await new Promise((r) => setTimeout(r, 30));
  let rows = _mockMandatesStore.slice();
  if (filter.status) rows = rows.filter((r) => r.status === filter.status);
  if (filter.bankName) rows = rows.filter((r) => r.bankName === filter.bankName);
  if (filter.accountReference) rows = rows.filter((r) => r.accountReference === filter.accountReference);
  if (filter.limit != null) rows = rows.slice(0, Number(filter.limit));
  return { rowCount: rows.length, rows };
}

async function mockGetMandate(id) {
  await new Promise((r) => setTimeout(r, 30));
  const m = _mockFindMandate(id);
  if (!m) throw new Error(`Mandate ${id} not found (mock)`);
  return m;
}

async function mockListMandateSignatories(id) {
  await new Promise((r) => setTimeout(r, 30));
  // Return two dummy class-A and class-B signatory assignments — the
  // composer only reads the mandateRules count in this dispatch; the
  // signatories list is only used for debug surface / future admin.
  const nowIso = new Date().toISOString();
  const rows = [
    {
      id: `${id}-assign-1`,
      mandateId: id,
      userId: 'user-owner-1',
      signatoryClass: 'CLASS_A',
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveUntil: null,
      revokedReason: null,
      createdAt: nowIso,
    },
    {
      id: `${id}-assign-2`,
      mandateId: id,
      userId: 'user-cfo-1',
      signatoryClass: 'CLASS_B',
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveUntil: null,
      revokedReason: null,
      createdAt: nowIso,
    },
  ];
  return { rowCount: rows.length, rows };
}

// ══════════════════════════════════════════════════════════════════
// Annual PIFSS Reconciliation MOCK fixtures — AUDIT-ACC-058 (2026-04-22)
// ══════════════════════════════════════════════════════════════════
//
// Seed: 2 fiscal years of history. The most recent year is fully-run
// with 12 variances across 3 employees, covering all 4 VarianceType
// enum values (COMPANY_ONLY, PORTAL_ONLY, CONTRIBUTION_AMOUNT_DIFFERS,
// SALARY_BASE_DIFFERS) AND a mix of 4 VarianceStatus values. The older
// year has the reconciliation marked all-resolved so the "All resolved"
// header badge also exercises. Both years' statements are pre-imported.
// A third empty-slot year returns `reconciliation: null` so the screen
// can demonstrate the "New fiscal year" affordance without fighting a
// populated fixture. Lifecycle transitions on resolveVariance persist
// module-scoped.

const _mockPifssReconRunYear = new Date().getUTCFullYear() - 1; // current prior year, fully populated
const _mockPifssReconResolvedYear = _mockPifssReconRunYear - 1; // year before that, all resolved

function _mockPifssSeedVariances() {
  // 12 variances × 3 employees. Amounts in KWD 3dp strings.
  const seed = [
    // Ahmed Al-Sabah (civilId 286012345678) — 5 variances, all types
    {
      civilId: '286012345678',
      employeeNameSnapshot: 'Ahmed Al-Sabah',
      periodYear: _mockPifssReconRunYear,
      periodMonth: 1,
      varianceType: 'CONTRIBUTION_AMOUNT_DIFFERS',
      companyEmployerKwd: '87.500',
      portalEmployerKwd: '90.000',
      companyEmployeeKwd: '42.000',
      portalEmployeeKwd: '42.000',
      deltaEmployerKwd: '2.500',
      deltaEmployeeKwd: '0.000',
      likelyCause: 'Employer-side contribution rounded down by 0.5 KWD; reform-era rate applied one month early.',
      status: 'UNRESOLVED',
    },
    {
      civilId: '286012345678',
      employeeNameSnapshot: 'Ahmed Al-Sabah',
      periodYear: _mockPifssReconRunYear,
      periodMonth: 3,
      varianceType: 'SALARY_BASE_DIFFERS',
      companyEmployerKwd: '87.500',
      portalEmployerKwd: '87.500',
      companyEmployeeKwd: '42.000',
      portalEmployeeKwd: '42.000',
      deltaEmployerKwd: '0.000',
      deltaEmployeeKwd: '0.000',
      likelyCause: 'Company recorded basic salary 1500.000; portal has 1450.000 (possible raise mid-cycle).',
      status: 'UNDER_INVESTIGATION',
      resolutionNote: 'Payroll lead confirmed mid-cycle raise; waiting on PIFSS portal update.',
    },
    {
      civilId: '286012345678',
      employeeNameSnapshot: 'Ahmed Al-Sabah',
      periodYear: _mockPifssReconRunYear,
      periodMonth: 6,
      varianceType: 'COMPANY_ONLY',
      companyEmployerKwd: '87.500',
      portalEmployerKwd: '0.000',
      companyEmployeeKwd: '42.000',
      portalEmployeeKwd: '0.000',
      deltaEmployerKwd: '87.500',
      deltaEmployeeKwd: '42.000',
      likelyCause: 'Company submitted June contribution; PIFSS portal missing month entirely.',
      status: 'IN_DISPUTE',
      resolutionNote: 'Escalated to PIFSS liaison; portal posting appears dropped.',
    },
    {
      civilId: '286012345678',
      employeeNameSnapshot: 'Ahmed Al-Sabah',
      periodYear: _mockPifssReconRunYear,
      periodMonth: 9,
      varianceType: 'CONTRIBUTION_AMOUNT_DIFFERS',
      companyEmployerKwd: '87.500',
      portalEmployerKwd: '87.500',
      companyEmployeeKwd: '42.000',
      portalEmployeeKwd: '48.000',
      deltaEmployerKwd: '0.000',
      deltaEmployeeKwd: '-6.000',
      likelyCause: 'Portal shows higher employee deduction; employee-side salary ceiling applied differently.',
      status: 'UNRESOLVED',
    },
    {
      civilId: '286012345678',
      employeeNameSnapshot: 'Ahmed Al-Sabah',
      periodYear: _mockPifssReconRunYear,
      periodMonth: 11,
      varianceType: 'PORTAL_ONLY',
      companyEmployerKwd: '0.000',
      portalEmployerKwd: '87.500',
      companyEmployeeKwd: '0.000',
      portalEmployeeKwd: '42.000',
      deltaEmployerKwd: '-87.500',
      deltaEmployeeKwd: '-42.000',
      likelyCause: 'Portal recorded November contribution; payroll system marked it as leave-without-pay month.',
      status: 'RESOLVED',
      resolutionNote: 'Reviewed timesheet — employee was present. Reconciled by crediting PIFSS side.',
    },

    // Fatima Al-Mutairi (civilId 287098765432) — 4 variances
    {
      civilId: '287098765432',
      employeeNameSnapshot: 'Fatima Al-Mutairi',
      periodYear: _mockPifssReconRunYear,
      periodMonth: 2,
      varianceType: 'SALARY_BASE_DIFFERS',
      companyEmployerKwd: '52.500',
      portalEmployerKwd: '52.500',
      companyEmployeeKwd: '25.200',
      portalEmployeeKwd: '25.200',
      deltaEmployerKwd: '0.000',
      deltaEmployeeKwd: '0.000',
      likelyCause: 'Basic-salary snapshot mismatch: company 900.000 vs portal 875.000.',
      status: 'UNDER_INVESTIGATION',
    },
    {
      civilId: '287098765432',
      employeeNameSnapshot: 'Fatima Al-Mutairi',
      periodYear: _mockPifssReconRunYear,
      periodMonth: 4,
      varianceType: 'CONTRIBUTION_AMOUNT_DIFFERS',
      companyEmployerKwd: '52.500',
      portalEmployerKwd: '54.000',
      companyEmployeeKwd: '25.200',
      portalEmployeeKwd: '26.000',
      deltaEmployerKwd: '-1.500',
      deltaEmployeeKwd: '-0.800',
      likelyCause: 'Portal contribution amounts higher by the leave-encashment component.',
      status: 'UNRESOLVED',
    },
    {
      civilId: '287098765432',
      employeeNameSnapshot: 'Fatima Al-Mutairi',
      periodYear: _mockPifssReconRunYear,
      periodMonth: 7,
      varianceType: 'COMPANY_ONLY',
      companyEmployerKwd: '52.500',
      portalEmployerKwd: '0.000',
      companyEmployeeKwd: '25.200',
      portalEmployeeKwd: '0.000',
      deltaEmployerKwd: '52.500',
      deltaEmployeeKwd: '25.200',
      likelyCause: 'July contribution submitted by company; portal shows no entry for this civilId-month.',
      status: 'UNRESOLVED',
    },
    {
      civilId: '287098765432',
      employeeNameSnapshot: 'Fatima Al-Mutairi',
      periodYear: _mockPifssReconRunYear,
      periodMonth: 12,
      varianceType: 'CONTRIBUTION_AMOUNT_DIFFERS',
      companyEmployerKwd: '52.500',
      portalEmployerKwd: '52.500',
      companyEmployeeKwd: '25.200',
      portalEmployeeKwd: '25.200',
      deltaEmployerKwd: '0.000',
      deltaEmployeeKwd: '0.000',
      likelyCause: 'Legacy variance carried from prior run; preserved via re-reconciliation matching.',
      status: 'RESOLVED',
      resolutionNote: 'Confirmed correct; duplicate classification resolved.',
    },

    // Mohammed Al-Rashidi (civilId 285000123456) — 3 variances
    {
      civilId: '285000123456',
      employeeNameSnapshot: 'Mohammed Al-Rashidi',
      periodYear: _mockPifssReconRunYear,
      periodMonth: 5,
      varianceType: 'PORTAL_ONLY',
      companyEmployerKwd: '0.000',
      portalEmployerKwd: '105.000',
      companyEmployeeKwd: '0.000',
      portalEmployeeKwd: '50.400',
      deltaEmployerKwd: '-105.000',
      deltaEmployeeKwd: '-50.400',
      likelyCause: 'Portal recorded contribution for May; employee was on unpaid leave per payroll records.',
      status: 'IN_DISPUTE',
      resolutionNote: 'Leave approval in question; HR investigating.',
    },
    {
      civilId: '285000123456',
      employeeNameSnapshot: 'Mohammed Al-Rashidi',
      periodYear: _mockPifssReconRunYear,
      periodMonth: 8,
      varianceType: 'SALARY_BASE_DIFFERS',
      companyEmployerKwd: '105.000',
      portalEmployerKwd: '105.000',
      companyEmployeeKwd: '50.400',
      portalEmployeeKwd: '50.400',
      deltaEmployerKwd: '0.000',
      deltaEmployeeKwd: '0.000',
      likelyCause: 'Basic-salary snapshot differs: company 1800.000 vs portal 1750.000.',
      status: 'UNRESOLVED',
    },
    {
      civilId: '285000123456',
      employeeNameSnapshot: 'Mohammed Al-Rashidi',
      periodYear: _mockPifssReconRunYear,
      periodMonth: 10,
      varianceType: 'CONTRIBUTION_AMOUNT_DIFFERS',
      companyEmployerKwd: '105.000',
      portalEmployerKwd: '100.800',
      companyEmployeeKwd: '50.400',
      portalEmployeeKwd: '50.400',
      deltaEmployerKwd: '4.200',
      deltaEmployeeKwd: '0.000',
      likelyCause: 'Employer-side contribution 4.200 KWD higher; possible rounding or rate-table version mismatch.',
      status: 'RESOLVED',
      resolutionNote: 'Confirmed rate-table version mismatch at portal side; no action required.',
    },
  ];
  // Assign stable mock IDs + resolved actors/timestamps where applicable.
  return seed.map((v, i) => ({
    id: `mock-variance-${_mockPifssReconRunYear}-${String(i + 1).padStart(3, '0')}`,
    reconciliationId: `mock-reconciliation-${_mockPifssReconRunYear}`,
    ...v,
    resolutionNote: v.resolutionNote ?? null,
    resolvedBy: v.status === 'RESOLVED' || v.status === 'IN_DISPUTE' ? 'user-cfo-1' : null,
    resolvedAt:
      v.status === 'RESOLVED' || v.status === 'IN_DISPUTE'
        ? new Date().toISOString()
        : null,
  }));
}

const _mockPifssStore = (() => {
  const nowIso = new Date().toISOString();
  const variances = _mockPifssSeedVariances();
  const state = new Map();
  // Run year: fully populated.
  state.set(_mockPifssReconRunYear, {
    reconciliation: {
      id: `mock-reconciliation-${_mockPifssReconRunYear}`,
      fiscalYear: _mockPifssReconRunYear,
      statementId: `mock-statement-${_mockPifssReconRunYear}`,
      statementImportedAt: nowIso,
      statementImportedBy: 'user-cfo-1',
      runBy: 'user-cfo-1',
      runAt: nowIso,
      totalVariances: variances.length,
      unresolvedCount: variances.filter((v) => v.status === 'UNRESOLVED').length,
      preservedResolutionCount: 1,
      newVarianceCount: variances.length - 1,
      byType: variances.reduce(
        (acc, v) => {
          acc[v.varianceType] = (acc[v.varianceType] || 0) + 1;
          return acc;
        },
        { COMPANY_ONLY: 0, PORTAL_ONLY: 0, CONTRIBUTION_AMOUNT_DIFFERS: 0, SALARY_BASE_DIFFERS: 0 },
      ),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    variances,
  });
  // Resolved year: statement imported, run complete, all resolved (no variances seeded).
  state.set(_mockPifssReconResolvedYear, {
    reconciliation: {
      id: `mock-reconciliation-${_mockPifssReconResolvedYear}`,
      fiscalYear: _mockPifssReconResolvedYear,
      statementId: `mock-statement-${_mockPifssReconResolvedYear}`,
      statementImportedAt: nowIso,
      statementImportedBy: 'user-owner-1',
      runBy: 'user-owner-1',
      runAt: nowIso,
      totalVariances: 0,
      unresolvedCount: 0,
      preservedResolutionCount: 0,
      newVarianceCount: 0,
      byType: { COMPANY_ONLY: 0, PORTAL_ONLY: 0, CONTRIBUTION_AMOUNT_DIFFERS: 0, SALARY_BASE_DIFFERS: 0 },
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    variances: [],
  });
  return state;
})();

function _pifssProbeYears() {
  const nowYear = new Date().getUTCFullYear();
  return [nowYear, nowYear - 1, nowYear - 2];
}

async function mockListReconciliationYears() {
  await new Promise((r) => setTimeout(r, 40));
  const years = _pifssProbeYears().map((fy) => {
    const entry = _mockPifssStore.get(fy);
    if (!entry) return { fiscalYear: fy, reconciliation: null, variances: [] };
    return {
      fiscalYear: fy,
      reconciliation: entry.reconciliation,
      variances: entry.variances,
    };
  });
  return { years };
}

async function mockGetReconciliation(fiscalYear) {
  await new Promise((r) => setTimeout(r, 40));
  const entry = _mockPifssStore.get(Number(fiscalYear));
  if (!entry) return { reconciliation: null, variances: [] };
  return {
    reconciliation: entry.reconciliation,
    variances: entry.variances,
  };
}

async function mockGetReconciliationReport(fiscalYear) {
  await new Promise((r) => setTimeout(r, 50));
  const entry = _mockPifssStore.get(Number(fiscalYear));
  if (!entry || !entry.reconciliation) {
    throw new Error(`No reconciliation available for fiscal year ${fiscalYear} (mock)`);
  }
  const recon = entry.reconciliation;
  const variances = entry.variances || [];
  // Group by civilId.
  const byCivil = new Map();
  for (const v of variances) {
    if (!byCivil.has(v.civilId)) {
      byCivil.set(v.civilId, {
        civilId: v.civilId,
        employeeNameSnapshot: v.employeeNameSnapshot || '',
        variances: [],
      });
    }
    byCivil.get(v.civilId).variances.push({
      id: v.id,
      periodYear: v.periodYear,
      periodMonth: v.periodMonth,
      varianceType: v.varianceType,
      companyEmployerKwd: v.companyEmployerKwd,
      portalEmployerKwd: v.portalEmployerKwd,
      companyEmployeeKwd: v.companyEmployeeKwd,
      portalEmployeeKwd: v.portalEmployeeKwd,
      deltaEmployerKwd: v.deltaEmployerKwd,
      deltaEmployeeKwd: v.deltaEmployeeKwd,
      likelyCause: v.likelyCause,
      status: v.status,
      resolutionNote: v.resolutionNote,
      resolvedBy: v.resolvedBy,
      resolvedAt: v.resolvedAt,
    });
  }
  // Sum Σ|Δ| per employee using integer fixed-point.
  function absSum3dp(values) {
    let total = 0n;
    for (const s of values) {
      if (s == null) continue;
      let rest = String(s);
      let neg = false;
      if (rest.startsWith('-')) { neg = true; rest = rest.slice(1); }
      else if (rest.startsWith('+')) rest = rest.slice(1);
      const dot = rest.indexOf('.');
      let intP = rest;
      let fracP = '';
      if (dot >= 0) { intP = rest.slice(0, dot); fracP = rest.slice(dot + 1); }
      if (fracP.length < 3) fracP = fracP + '0'.repeat(3 - fracP.length);
      else if (fracP.length > 3) fracP = fracP.slice(0, 3);
      if (!/^\d*$/.test(intP) || !/^\d{3}$/.test(fracP)) continue;
      let scaled = BigInt((intP || '0') + fracP);
      if (scaled < 0n) scaled = -scaled;
      if (neg) { /* abs */ }
      total += scaled;
    }
    const str = total.toString().padStart(4, '0');
    return `${str.slice(0, -3)}.${str.slice(-3)}`;
  }
  const employees = Array.from(byCivil.values())
    .map((g) => ({
      civilId: g.civilId,
      employeeNameSnapshot: g.employeeNameSnapshot,
      totalDeltaEmployerKwd: absSum3dp(g.variances.map((v) => v.deltaEmployerKwd)),
      totalDeltaEmployeeKwd: absSum3dp(g.variances.map((v) => v.deltaEmployeeKwd)),
      varianceCount: g.variances.length,
      unresolvedCount: g.variances.filter((v) => v.status === 'UNRESOLVED').length,
      variances: g.variances,
    }))
    .sort((a, b) => {
      const na = Number(a.totalDeltaEmployerKwd) + Number(a.totalDeltaEmployeeKwd);
      const nb = Number(b.totalDeltaEmployerKwd) + Number(b.totalDeltaEmployeeKwd);
      return nb - na;
    });
  return {
    reconciliationId: recon.id,
    fiscalYear: recon.fiscalYear,
    statementId: recon.statementId,
    runBy: recon.runBy,
    runAt: recon.runAt,
    totalVariances: recon.totalVariances,
    unresolvedCount: recon.unresolvedCount,
    byType: recon.byType,
    totalDeltaEmployerKwd: absSum3dp(variances.map((v) => v.deltaEmployerKwd)),
    totalDeltaEmployeeKwd: absSum3dp(variances.map((v) => v.deltaEmployeeKwd)),
    employees,
  };
}

async function mockImportStatement(fiscalYear, body) {
  await new Promise((r) => setTimeout(r, 100));
  const fy = Number(fiscalYear);
  const nowIso = new Date().toISOString();
  const statementId = `mock-statement-${fy}-${Date.now()}`;
  const existing = _mockPifssStore.get(fy);
  if (existing && existing.reconciliation) {
    // Re-import updates the statement pointer + clears variances (run
    // will need to be invoked again).
    existing.reconciliation = {
      ...existing.reconciliation,
      statementId,
      statementImportedAt: nowIso,
      statementImportedBy: 'user-cfo-1',
      runAt: null,
      runBy: null,
      totalVariances: 0,
      unresolvedCount: 0,
      preservedResolutionCount: 0,
      newVarianceCount: 0,
      updatedAt: nowIso,
    };
    existing.variances = [];
  } else {
    _mockPifssStore.set(fy, {
      reconciliation: {
        id: `mock-reconciliation-${fy}`,
        fiscalYear: fy,
        statementId,
        statementImportedAt: nowIso,
        statementImportedBy: 'user-cfo-1',
        runBy: null,
        runAt: null,
        totalVariances: 0,
        unresolvedCount: 0,
        preservedResolutionCount: 0,
        newVarianceCount: 0,
        byType: { COMPANY_ONLY: 0, PORTAL_ONLY: 0, CONTRIBUTION_AMOUNT_DIFFERS: 0, SALARY_BASE_DIFFERS: 0 },
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      variances: [],
    });
  }
  return { statementId, importedAt: nowIso };
}

async function mockRunReconciliation(fiscalYear) {
  await new Promise((r) => setTimeout(r, 150));
  const fy = Number(fiscalYear);
  const entry = _mockPifssStore.get(fy);
  if (!entry) {
    throw new Error(`No statement imported for fiscal year ${fy} (mock)`);
  }
  const nowIso = new Date().toISOString();
  // If the year already has seeded variances (most recent year fixture),
  // preserve them. Otherwise fabricate a minimal 2-variance set so the
  // reviewer has something to look at post-run.
  if (!entry.variances || entry.variances.length === 0) {
    const v1 = {
      id: `mock-variance-${fy}-run-001`,
      reconciliationId: `mock-reconciliation-${fy}`,
      civilId: '286012345678',
      employeeNameSnapshot: 'Ahmed Al-Sabah',
      periodYear: fy,
      periodMonth: 3,
      varianceType: 'CONTRIBUTION_AMOUNT_DIFFERS',
      companyEmployerKwd: '87.500',
      portalEmployerKwd: '90.000',
      companyEmployeeKwd: '42.000',
      portalEmployeeKwd: '42.000',
      deltaEmployerKwd: '2.500',
      deltaEmployeeKwd: '0.000',
      likelyCause: 'Employer-side rounding differs by 0.5 KWD.',
      status: 'UNRESOLVED',
      resolutionNote: null,
      resolvedBy: null,
      resolvedAt: null,
    };
    const v2 = {
      id: `mock-variance-${fy}-run-002`,
      reconciliationId: `mock-reconciliation-${fy}`,
      civilId: '287098765432',
      employeeNameSnapshot: 'Fatima Al-Mutairi',
      periodYear: fy,
      periodMonth: 7,
      varianceType: 'COMPANY_ONLY',
      companyEmployerKwd: '52.500',
      portalEmployerKwd: '0.000',
      companyEmployeeKwd: '25.200',
      portalEmployeeKwd: '0.000',
      deltaEmployerKwd: '52.500',
      deltaEmployeeKwd: '25.200',
      likelyCause: 'Portal missing July entry.',
      status: 'UNRESOLVED',
      resolutionNote: null,
      resolvedBy: null,
      resolvedAt: null,
    };
    entry.variances = [v1, v2];
  }
  const variances = entry.variances;
  entry.reconciliation = {
    ...entry.reconciliation,
    runBy: entry.reconciliation?.runBy || 'user-cfo-1',
    runAt: nowIso,
    totalVariances: variances.length,
    unresolvedCount: variances.filter((v) => v.status === 'UNRESOLVED').length,
    preservedResolutionCount: variances.filter((v) => v.status !== 'UNRESOLVED').length,
    newVarianceCount: variances.filter((v) => v.status === 'UNRESOLVED').length,
    byType: variances.reduce(
      (acc, v) => {
        acc[v.varianceType] = (acc[v.varianceType] || 0) + 1;
        return acc;
      },
      { COMPANY_ONLY: 0, PORTAL_ONLY: 0, CONTRIBUTION_AMOUNT_DIFFERS: 0, SALARY_BASE_DIFFERS: 0 },
    ),
    updatedAt: nowIso,
  };
  const r = entry.reconciliation;
  return {
    reconciliationId: r.id,
    fiscalYear: r.fiscalYear,
    statementId: r.statementId,
    totalVariances: r.totalVariances,
    unresolvedCount: r.unresolvedCount,
    byType: r.byType,
    preservedResolutionCount: r.preservedResolutionCount,
    newVarianceCount: r.newVarianceCount,
  };
}

async function mockResolveVariance(varianceId, body) {
  await new Promise((r) => setTimeout(r, 60));
  for (const entry of _mockPifssStore.values()) {
    const idx = entry.variances.findIndex((v) => v.id === varianceId);
    if (idx === -1) continue;
    const variance = entry.variances[idx];
    // Mirror backend's reopen gate at the mock boundary.
    const wasClosed =
      variance.status === 'RESOLVED' || variance.status === 'IN_DISPUTE';
    const toUnresolved = body?.status === 'UNRESOLVED';
    if (wasClosed && toUnresolved && !body?.reopenReason) {
      throw new Error(
        'reopenReason is required when transitioning RESOLVED/IN_DISPUTE → UNRESOLVED (mock)',
      );
    }
    const nowIso = new Date().toISOString();
    const updated = {
      ...variance,
      status: body.status,
      resolutionNote:
        body.resolutionNote !== undefined
          ? body.resolutionNote
          : variance.resolutionNote,
      resolvedBy:
        body.status === 'UNRESOLVED' ? null : 'user-cfo-1',
      resolvedAt:
        body.status === 'UNRESOLVED' ? null : nowIso,
    };
    entry.variances[idx] = updated;
    // Recompute recon counts.
    if (entry.reconciliation) {
      entry.reconciliation.unresolvedCount = entry.variances.filter(
        (v) => v.status === 'UNRESOLVED',
      ).length;
      entry.reconciliation.updatedAt = nowIso;
    }
    return { variance: updated };
  }
  throw new Error(`Variance ${varianceId} not found (mock)`);
}

// ══════════════════════════════════════════════════════════════════
// Year-End Close MOCK fixtures — AUDIT-ACC-003 (2026-04-22)
// ══════════════════════════════════════════════════════════════════
//
// Seed: 3 fiscal years of history exercising every UI state the screen
// renders.
//   FY-2 (current - 2): CLOSED (approved) — full checklist ready, all
//         three closing JEs posted, export buttons active.
//   FY-1 (current - 1): PENDING_APPROVAL — approved Owner pending;
//         prerequisites partially blocked (no scope exceptions) so the
//         blocked-checklist section renders.
//   FY-3 (current - 3): REVERSED — reversal reason + reversedBy + audit
//         trail shows the 3 events (prepared/approved/reversed).
// Config: Kuwait defaults (DEFAULT_REVENUE_ROLES / DEFAULT_EXPENSE_ROLES
// mirror the backend constants) with requireStatutoryReserveBeforeClose
// enabled.
//
// Lifecycle transitions via prepare / approve / reverse persist against
// the module-scoped Map so the dev-mode demo can walk a full flow.

const _mockYecCurrentYear = new Date().getUTCFullYear();
const _mockYecApprovedYear = _mockYecCurrentYear - 2;
const _mockYecPreparedYear = _mockYecCurrentYear - 1;
const _mockYecReversedYear = _mockYecCurrentYear - 3;

const _mockYecConfig = {
  id: 'mock-yec-config',
  revenueRoles: [
    'REVENUE_GOODS',
    'REVENUE_SERVICE',
    'INTEREST_INCOME',
    'RENTAL_INCOME',
    'FX_GAIN',
  ],
  expenseRoles: [
    'COGS_GOODS',
    'COGS_SERVICES',
    'SALARIES_WAGES',
    'RENT_EXPENSE',
    'UTILITIES_EXPENSE',
    'DEPRECIATION_EXPENSE',
    'INTEREST_EXPENSE',
    'INCOME_TAX_EXPENSE',
  ],
  requireStatutoryReserveBeforeClose: true,
  configuredBy: 'user-owner-1',
  configuredAt: new Date(
    Date.UTC(_mockYecApprovedYear, 0, 15, 10, 0, 0),
  ).toISOString(),
  updatedBy: null,
  updatedAt: new Date(
    Date.UTC(_mockYecApprovedYear, 0, 15, 10, 0, 0),
  ).toISOString(),
};

function _seedYecApprovedRecord() {
  const preparedAt = new Date(
    Date.UTC(_mockYecApprovedYear + 1, 2, 10, 9, 15, 0),
  ).toISOString();
  const approvedAt = new Date(
    Date.UTC(_mockYecApprovedYear + 1, 2, 18, 14, 30, 0),
  ).toISOString();
  return {
    id: `mock-yec-${_mockYecApprovedYear}`,
    fiscalYear: _mockYecApprovedYear,
    status: 'CLOSED',
    revenueCloseJeId: `mock-je-yec-${_mockYecApprovedYear}-rev`,
    expenseCloseJeId: `mock-je-yec-${_mockYecApprovedYear}-exp`,
    incomeSummaryCloseJeId: `mock-je-yec-${_mockYecApprovedYear}-is`,
    revenueTotalKwd: '4218450.750',
    expenseTotalKwd: '3184220.125',
    netIncomeKwd: '1034230.625',
    openingRetainedEarningsKwd: '2815400.000',
    endingRetainedEarningsKwd: '3849630.625',
    linkedRestatementIds: [],
    preparedBy: 'user-cfo-1',
    preparedAt,
    approvedBy: 'user-owner-1',
    approvedAt,
    reversedAt: null,
    reversedBy: null,
    reversalReason: null,
    reversalJournalEntryIds: [],
    notes: 'Year-end close for ' + _mockYecApprovedYear + '. All prerequisites satisfied.',
    createdAt: preparedAt,
    updatedAt: approvedAt,
    prerequisites: {
      statutoryReserveSatisfied: true,
      noUnresolvedRestatements: true,
      noOpenScopeExceptions: true,
    },
  };
}

function _seedYecPreparedRecord() {
  const preparedAt = new Date(
    Date.UTC(_mockYecPreparedYear + 1, 2, 12, 11, 5, 0),
  ).toISOString();
  return {
    id: `mock-yec-${_mockYecPreparedYear}`,
    fiscalYear: _mockYecPreparedYear,
    status: 'PENDING_APPROVAL',
    revenueCloseJeId: null,
    expenseCloseJeId: null,
    incomeSummaryCloseJeId: null,
    revenueTotalKwd: '4752100.000',
    expenseTotalKwd: '3510850.500',
    netIncomeKwd: '1241249.500',
    openingRetainedEarningsKwd: '3849630.625',
    endingRetainedEarningsKwd: '5090880.125',
    linkedRestatementIds: [],
    // preparedBy deliberately NOT the mock-auth user so the Approve
    // action is visible for the mock Owner (SoD does not fire). The
    // dispatch spec still asks for SoD demonstration; see MOCK override
    // note at the bottom of the dispatch-report.
    preparedBy: 'user-cfo-1',
    preparedAt,
    approvedBy: null,
    approvedAt: null,
    reversedAt: null,
    reversedBy: null,
    reversalReason: null,
    reversalJournalEntryIds: [],
    notes: null,
    createdAt: preparedAt,
    updatedAt: preparedAt,
    prerequisites: {
      statutoryReserveSatisfied: true,
      noUnresolvedRestatements: true,
      // Scope exceptions still open → one blocked item visible in the
      // pre-close checklist so the blocked-section exercises.
      noOpenScopeExceptions: false,
    },
  };
}

function _seedYecReversedRecord() {
  const preparedAt = new Date(
    Date.UTC(_mockYecReversedYear + 1, 2, 8, 9, 20, 0),
  ).toISOString();
  const approvedAt = new Date(
    Date.UTC(_mockYecReversedYear + 1, 2, 14, 15, 45, 0),
  ).toISOString();
  const reversedAt = new Date(
    Date.UTC(_mockYecReversedYear + 1, 7, 3, 10, 0, 0),
  ).toISOString();
  return {
    id: `mock-yec-${_mockYecReversedYear}`,
    fiscalYear: _mockYecReversedYear,
    status: 'REVERSED',
    revenueCloseJeId: `mock-je-yec-${_mockYecReversedYear}-rev`,
    expenseCloseJeId: `mock-je-yec-${_mockYecReversedYear}-exp`,
    incomeSummaryCloseJeId: `mock-je-yec-${_mockYecReversedYear}-is`,
    revenueTotalKwd: '3892000.000',
    expenseTotalKwd: '3120000.000',
    netIncomeKwd: '772000.000',
    openingRetainedEarningsKwd: '2043400.000',
    endingRetainedEarningsKwd: '2815400.000',
    linkedRestatementIds: [],
    preparedBy: 'user-cfo-1',
    preparedAt,
    approvedBy: 'user-owner-1',
    approvedAt,
    reversedAt,
    reversedBy: 'user-owner-1',
    reversalReason:
      'Material inventory count variance discovered post-close — five warehouses recounted and NRV writedown applied.',
    reversalJournalEntryIds: [
      `mock-je-yec-${_mockYecReversedYear}-rev-reverse`,
      `mock-je-yec-${_mockYecReversedYear}-exp-reverse`,
      `mock-je-yec-${_mockYecReversedYear}-is-reverse`,
    ],
    notes: null,
    createdAt: preparedAt,
    updatedAt: reversedAt,
    prerequisites: {
      statutoryReserveSatisfied: true,
      noUnresolvedRestatements: true,
      noOpenScopeExceptions: true,
    },
  };
}

const _mockYecStore = (() => {
  const state = new Map();
  state.set(_mockYecApprovedYear, _seedYecApprovedRecord());
  state.set(_mockYecPreparedYear, _seedYecPreparedRecord());
  state.set(_mockYecReversedYear, _seedYecReversedRecord());
  return state;
})();

async function mockGetYearEndCloseConfig() {
  await new Promise((r) => setTimeout(r, 40));
  return { ..._mockYecConfig };
}

async function mockUpdateYearEndCloseConfig(body) {
  await new Promise((r) => setTimeout(r, 80));
  if (!body || typeof body !== 'object') {
    throw new Error('updateYearEndCloseConfig: body is required (mock)');
  }
  const nowIso = new Date().toISOString();
  if (Array.isArray(body.revenueRoles)) {
    _mockYecConfig.revenueRoles = body.revenueRoles;
  }
  if (Array.isArray(body.expenseRoles)) {
    _mockYecConfig.expenseRoles = body.expenseRoles;
  }
  if (typeof body.requireStatutoryReserveBeforeClose === 'boolean') {
    _mockYecConfig.requireStatutoryReserveBeforeClose =
      body.requireStatutoryReserveBeforeClose;
  }
  _mockYecConfig.updatedBy = 'user-owner-1';
  _mockYecConfig.updatedAt = nowIso;
  return { ..._mockYecConfig };
}

async function mockListYearEndCloseRecords() {
  await new Promise((r) => setTimeout(r, 40));
  return Array.from(_mockYecStore.values())
    .map((r) => ({ ...r }))
    .sort((a, b) => b.fiscalYear - a.fiscalYear);
}

async function mockGetYearEndClose(fiscalYear) {
  await new Promise((r) => setTimeout(r, 30));
  const fy = Number(fiscalYear);
  const row = _mockYecStore.get(fy);
  if (!row) {
    const err = new Error(
      `No year-end close record for fiscal year ${fy} (mock)`,
    );
    // Mirror the axios-normalised error shape so the screen's error
    // handling branch behaves the same way in both modes.
    err.status = 404;
    err.code = 'CLIENT_ERROR';
    throw err;
  }
  return { ...row };
}

async function mockPrepareYearEndClose(fiscalYear) {
  await new Promise((r) => setTimeout(r, 100));
  const fy = Number(fiscalYear);
  if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) {
    throw new Error(
      `prepareYearEndClose: fiscalYear must be 2000..2100 (mock)`,
    );
  }
  const nowIso = new Date().toISOString();
  const existing = _mockYecStore.get(fy);
  if (existing && existing.status === 'CLOSED') {
    throw new Error(
      `Fiscal year ${fy} is already CLOSED; reverse it before re-preparing (mock)`,
    );
  }
  if (existing && existing.status === 'REVERSED') {
    throw new Error(
      `Fiscal year ${fy} is REVERSED (terminal); a new prepare is not supported on this record (mock)`,
    );
  }
  // Fresh prepare or re-prepare of an existing PENDING_APPROVAL record.
  // Fabricate plausible computed figures that tie to a notional P&L.
  const revenueTotal = '4100000.000';
  const expenseTotal = '3250000.000';
  const netIncome = '850000.000';
  const opening = existing?.openingRetainedEarningsKwd || '3500000.000';
  // Fixed-point addition in BigInt — opening + netIncome at 3 dp.
  // Reused from the PIFSS mock fixture helpers above: strings in 3-dp
  // form are scaled to integer micros, summed, and re-formatted.
  const projectedEnding = (() => {
    try {
      function toMicros(str) {
        let rest = String(str);
        let neg = false;
        if (rest.startsWith('-')) { neg = true; rest = rest.slice(1); }
        else if (rest.startsWith('+')) rest = rest.slice(1);
        const dot = rest.indexOf('.');
        let intP = rest;
        let fracP = '';
        if (dot >= 0) { intP = rest.slice(0, dot); fracP = rest.slice(dot + 1); }
        if (fracP.length < 3) fracP = fracP + '0'.repeat(3 - fracP.length);
        else if (fracP.length > 3) fracP = fracP.slice(0, 3);
        const scaled = BigInt((intP || '0') + fracP);
        return neg ? -scaled : scaled;
      }
      const sum = toMicros(opening) + toMicros(netIncome);
      const neg = sum < 0n;
      const abs = neg ? -sum : sum;
      const str = abs.toString().padStart(4, '0');
      return `${neg ? '-' : ''}${str.slice(0, -3)}.${str.slice(-3)}`;
    } catch {
      return '4350000.000';
    }
  })();
  const row = {
    id: existing?.id || `mock-yec-${fy}-${Date.now()}`,
    fiscalYear: fy,
    status: 'PENDING_APPROVAL',
    revenueCloseJeId: null,
    expenseCloseJeId: null,
    incomeSummaryCloseJeId: null,
    revenueTotalKwd: revenueTotal,
    expenseTotalKwd: expenseTotal,
    netIncomeKwd: netIncome,
    openingRetainedEarningsKwd: opening,
    endingRetainedEarningsKwd: projectedEnding,
    linkedRestatementIds: [],
    preparedBy: existing?.preparedBy || 'user-cfo-1',
    preparedAt: existing?.preparedAt || nowIso,
    approvedBy: null,
    approvedAt: null,
    reversedAt: null,
    reversedBy: null,
    reversalReason: null,
    reversalJournalEntryIds: [],
    notes: null,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
    prerequisites: {
      statutoryReserveSatisfied: true,
      noUnresolvedRestatements: true,
      noOpenScopeExceptions: true,
    },
  };
  _mockYecStore.set(fy, row);
  return { ...row };
}

async function mockApproveYearEndClose(recordId) {
  await new Promise((r) => setTimeout(r, 150));
  for (const [fy, row] of _mockYecStore.entries()) {
    if (row.id !== recordId) continue;
    if (row.status !== 'PENDING_APPROVAL') {
      throw new Error(
        `Year-end close ${recordId} cannot be approved from status ${row.status} (mock)`,
      );
    }
    const nowIso = new Date().toISOString();
    const approved = {
      ...row,
      status: 'CLOSED',
      revenueCloseJeId: `mock-je-yec-${fy}-rev`,
      expenseCloseJeId: `mock-je-yec-${fy}-exp`,
      incomeSummaryCloseJeId: `mock-je-yec-${fy}-is`,
      approvedBy: 'user-owner-1',
      approvedAt: nowIso,
      updatedAt: nowIso,
    };
    _mockYecStore.set(fy, approved);
    return { ...approved };
  }
  throw new Error(`Year-end close record ${recordId} not found (mock)`);
}

async function mockReverseYearEndClose(recordId, body) {
  await new Promise((r) => setTimeout(r, 150));
  const reason = String(body?.reason || '').trim();
  if (reason.length === 0) {
    throw new Error('reverseYearEndClose: reason is required (mock)');
  }
  for (const [fy, row] of _mockYecStore.entries()) {
    if (row.id !== recordId) continue;
    if (row.status !== 'CLOSED') {
      throw new Error(
        `Year-end close ${recordId} cannot be reversed from status ${row.status} (mock)`,
      );
    }
    const nowIso = new Date().toISOString();
    const reversed = {
      ...row,
      status: 'REVERSED',
      reversedAt: nowIso,
      reversedBy: 'user-owner-1',
      reversalReason: reason,
      reversalJournalEntryIds: [
        `mock-je-yec-${fy}-rev-reverse`,
        `mock-je-yec-${fy}-exp-reverse`,
        `mock-je-yec-${fy}-is-reverse`,
      ],
      updatedAt: nowIso,
    };
    _mockYecStore.set(fy, reversed);
    return { ...reversed };
  }
  throw new Error(`Year-end close record ${recordId} not found (mock)`);
}
