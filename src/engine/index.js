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
