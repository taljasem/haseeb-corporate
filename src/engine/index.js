/**
 * Engine router — per-function routing between the mock engine and the real API.
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
import * as journalEntriesApi from '../api/journal-entries';
import * as accountsApi from '../api/accounts';
import * as reportsApi from '../api/reports';
import * as settingsApi from '../api/settings';

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

  // Aminah chat (API module exists; UI is still on the streaming stubBackend,
  // so the sendChatMessage/confirmPendingAction wiring is available to callers
  // who want to use the non-streaming flow but the default chat UI stays on
  // mock_fallback for Wave 2 — see Section "Expected failures" in the smoke
  // test doc).
  sendChatMessage: 'wired',
  confirmPendingAction: 'wired',
  listConversations: 'wired',
  getConversation: 'wired',

  // Journal entries
  listJournalEntries: 'wired',
  getJournalEntry: 'wired',
  getManualJEs: 'wired',       // read list, shape-adapted
  getManualJEById: 'wired',    // read detail, shape-adapted

  // Chart of accounts
  getAccountsTree: 'wired',
  getAccountsFlat: 'wired',
  getSetupChartOfAccounts: 'wired', // shape-adapted for the existing Setup UI

  // Reports
  getTrialBalance: 'wired',
  getIncomeStatement: 'wired',
  getBalanceSheet: 'wired',
  getCashFlowStatement: 'wired',

  // Auth / settings
  getTenantInfo: 'wired',
  getCurrentUser: 'wired',
  getUserProfile: 'wired', // shape-adapted for the existing Settings UI
  listMembers: 'wired',
  changePassword: 'wired',
};

/**
 * Writes that must NEVER silently succeed via mock in LIVE mode. Anything in
 * this set throws a loud error if called in LIVE mode without explicit wiring.
 * Reads can be faked; writes cannot.
 */
const WRITE_THROW = new Set([
  // Ledger writes we do NOT wire in Wave 2 — leave in mockEngine and throw
  // if someone tries to call them against LIVE. Wave 3 wires these.
  'postManualJE',
  'createManualJEDraft',
  'updateManualJEDraft',
  'addLineToManualJE',
  'updateLineInManualJE',
  'removeLineFromManualJE',
  'reverseManualJE',
  'voidManualJE',
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

  // Journal entries
  listJournalEntries: journalEntriesApi.listJournalEntries,
  getJournalEntry: journalEntriesApi.getJournalEntry,
  getManualJEs: journalEntriesApi.getManualJEs,
  getManualJEById: journalEntriesApi.getManualJEById,

  // Accounts
  getAccountsTree: accountsApi.getAccountsTree,
  getAccountsFlat: accountsApi.getAccountsFlat,
  getSetupChartOfAccounts: accountsApi.getSetupChartOfAccounts,

  // Reports
  getTrialBalance: reportsApi.getTrialBalance,
  getIncomeStatement: reportsApi.getIncomeStatement,
  getBalanceSheet: reportsApi.getBalanceSheet,
  getCashFlowStatement: reportsApi.getCashFlow,

  // Settings
  getTenantInfo: settingsApi.getTenantInfo,
  getCurrentUser: settingsApi.getCurrentUser,
  getUserProfile: settingsApi.getUserProfile,
  listMembers: settingsApi.listMembers,
  changePassword: settingsApi.changePassword,
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
  return surface;
}

/**
 * Mock health fallback for when mockEngine itself does not export one.
 */
async function mockHealth() {
  return { ok: true, status: { status: 'ok', service: 'mock-engine', version: 'mock' } };
}

const surface = useMocks
  ? { ...mockEngine, getHealth: mockEngine.getHealth || mockHealth }
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

// Journal entries
export const listJournalEntries = surface.listJournalEntries;
export const getJournalEntry = surface.getJournalEntry;
export const getManualJEs = surface.getManualJEs;
export const getManualJEById = surface.getManualJEById;

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
