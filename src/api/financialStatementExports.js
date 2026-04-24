/**
 * Financial Statement Exports API module — HASEEB-443 Part B5.
 *
 * Binary-download wrappers for the 5 year-end FS export surfaces wired
 * by YearEndCloseScreen's APPROVED-state detail view. Backend endpoints
 * shipped earlier (HASEEB-223 for BS/IS/CF/SOCIE PDF+XLSX; HASEEB-138
 * for disclosure-notes DOCX); this module closes the frontend
 * shape-adapter + browser-download gap.
 *
 *   GET  /api/reports/balance-sheet/export      → pdf | xlsx
 *          params: as_of=YYYY-12-31
 *   GET  /api/reports/income-statement/export   → pdf | xlsx
 *          params: from=YYYY-01-01&to=YYYY-12-31
 *   GET  /api/reports/cash-flow/export          → pdf | xlsx
 *          params: from=YYYY-01-01&to=YYYY-12-31
 *   GET  /api/reports/socie/export              → pdf | xlsx
 *          params: from=YYYY-01-01&to=YYYY-12-31
 *
 *   Disclosure-notes (two-step):
 *     GET /api/disclosure-notes/runs/by-year/:fiscalYear
 *          → find the most recent APPROVED run; throw a structured
 *            NO_APPROVED_DISCLOSURE_RUN error if none exists.
 *     GET /api/disclosure-notes/runs/:id/docx
 *          → download the DOCX pack.
 *
 * All endpoints respond with a binary Blob + `Content-Disposition`
 * attachment header (IAS 8 RESTATED watermark is baked in by the
 * backend when applicable; the frontend never rewrites the file). We
 * bypass the shared axios client's JSON interceptor and use `fetch`
 * directly — same pattern as `src/api/payroll.js` downloadWpsFile /
 * downloadPayslip.
 *
 * Return shape:
 *   Success:  { success: true, blob: Blob, filename: string }
 *   Failure:  Promise rejects with { ok:false, status, code, message }
 *             (matches client.js error envelope).
 *
 * The `triggerBrowserDownload(blob, filename)` helper performs the
 * anchor-click + URL.createObjectURL + revokeObjectURL dance so the
 * calling engine dispatcher can stay one-liner.
 *
 * Shape adapter: FY${year} → per-statement date params.
 *   - balance-sheet: as_of=YYYY-12-31
 *   - income-statement / cash-flow / socie: from=YYYY-01-01 & to=YYYY-12-31
 * Non-calendar fiscal years are not supported in v1 — the YearEndCloseScreen
 * already assumes calendar-year boundaries for its UX; a follow-up can
 * source the record's fiscal-year calendar boundary from
 * getYearEndClose(fiscalYear) once the backend DTO exposes it.
 */
import { getAuthToken } from './client';

// ──────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────

const TAB_TO_ENDPOINT = {
  'balance-sheet': '/api/reports/balance-sheet/export',
  'income-statement': '/api/reports/income-statement/export',
  'cash-flow': '/api/reports/cash-flow/export',
  socie: '/api/reports/socie/export',
};

function baseUrl() {
  return (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
    'http://localhost:3000'
  );
}

/**
 * RFC 5987 + quoted + plain Content-Disposition filename parser.
 * Copied from src/api/payroll.js to keep the two download pipelines
 * independent; if a 3rd consumer lands, lift this into a shared util.
 */
function parseContentDispositionFilename(header) {
  if (!header) return null;
  const ext = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(header);
  if (ext && ext[1]) {
    try {
      return decodeURIComponent(ext[1].trim());
    } catch {
      // fall through
    }
  }
  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(header);
  if (quoted && quoted[1]) return quoted[1];
  const plain = /filename\s*=\s*([^;]+)/i.exec(header);
  if (plain && plain[1]) return plain[1].trim();
  return null;
}

function rejectFromResponse(res, defaultMessage) {
  // Normalise error into client.js's error envelope.
  let message = defaultMessage || `Request failed (${res.status})`;
  let code = 'UNKNOWN';
  if (res.status === 401) code = 'UNAUTHORIZED';
  else if (res.status >= 500) code = 'SERVER_ERROR';
  else if (res.status >= 400) code = 'CLIENT_ERROR';
  // Returning a thenable that resolves to the rejection value is how
  // payroll.js does this; prefer an explicit Promise.reject.
  return Promise.reject({ ok: false, status: res.status, code, message });
}

async function fetchBinary(path, { params } = {}) {
  const url = new URL(`${baseUrl()}${path}`);
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const token = getAuthToken();
  let res;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (err) {
    return Promise.reject({
      ok: false,
      status: 0,
      code: 'NETWORK_ERROR',
      message: err?.message || `Network error: cannot reach ${baseUrl()}.`,
    });
  }
  if (!res.ok) {
    // Try to extract a server-side error message — backend emits JSON
    // even on the binary-response endpoints when something is wrong.
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.error?.message || body?.message || message;
    } catch {
      // Body wasn't JSON; keep default.
    }
    return rejectFromResponse(res, message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const filename = parseContentDispositionFilename(disposition);
  return { blob, filename };
}

// ──────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────

/**
 * Trigger a browser download for a Blob. Creates an anchor element,
 * clicks it, then revokes the object URL. Silent-noop if the runtime
 * lacks Blob / URL.createObjectURL / document (SSR, unit tests without
 * jsdom) — the caller's `{ success, filename }` return is still honest.
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export function triggerBrowserDownload(blob, filename) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  if (typeof URL.createObjectURL !== 'function') return;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename || 'download';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick before revoking so the download actually
  // starts — immediate revoke can race in some browsers.
  setTimeout(() => {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // ignore
    }
  }, 0);
}

/**
 * Map `FY${year}` to the query params the backend expects for a given
 * statement-tab. Exported so the engine dispatcher + tests can share
 * the adapter without re-deriving.
 *
 * @param {string} tab One of 'balance-sheet' | 'income-statement' | 'cash-flow' | 'socie'
 * @param {number|string} fiscalYear e.g. 2024 or '2024'
 * @returns {object} query params for the export endpoint
 */
export function paramsForTab(tab, fiscalYear) {
  const year = String(fiscalYear).replace(/^FY/, '');
  if (!/^\d{4}$/.test(year)) {
    throw new Error(
      `paramsForTab: fiscalYear must be a 4-digit year (got "${fiscalYear}").`,
    );
  }
  if (tab === 'balance-sheet') {
    return { as_of: `${year}-12-31`, format: undefined /* overwritten */ };
  }
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    format: undefined /* overwritten */,
  };
}

/**
 * Download a primary-statement export (BS / IS / CF / SOCIE) in PDF or
 * XLSX. Triggers the browser download via anchor-click internally and
 * returns `{ success, filename }` for the caller's toast.
 *
 * @param {'balance-sheet'|'income-statement'|'cash-flow'|'socie'} tab
 * @param {number|string} fiscalYear
 * @param {'pdf'|'xlsx'} format
 * @returns {Promise<{success: true, filename: string}>}
 */
export async function exportFinancialStatementBinary(tab, fiscalYear, format) {
  const path = TAB_TO_ENDPOINT[tab];
  if (!path) {
    throw new Error(
      `exportFinancialStatementBinary: unsupported tab "${tab}".`,
    );
  }
  if (format !== 'pdf' && format !== 'xlsx') {
    throw new Error(
      `exportFinancialStatementBinary: format must be 'pdf' or 'xlsx' (got "${format}").`,
    );
  }
  const params = { ...paramsForTab(tab, fiscalYear), format };
  const { blob, filename: serverFilename } = await fetchBinary(path, {
    params,
  });
  const year = String(fiscalYear).replace(/^FY/, '');
  const fallback = `${tab}-FY${year}.${format}`;
  const filename = serverFilename || fallback;
  triggerBrowserDownload(blob, filename);
  return { success: true, filename };
}

/**
 * Download the disclosure-notes DOCX for a fiscal year. Two-step:
 *   (1) GET /api/disclosure-notes/runs/by-year/:fiscalYear → find the
 *       most recent APPROVED run.
 *   (2) GET /api/disclosure-notes/runs/:id/docx → binary download.
 *
 * If no APPROVED run exists, throws a structured error the screen can
 * branch on:
 *   {
 *     ok: false, code: 'NO_APPROVED_DISCLOSURE_RUN',
 *     message:   '...'  (EN),
 *     messageAr: '...'  (AR),
 *   }
 *
 * @param {number|string} fiscalYear
 * @returns {Promise<{success: true, filename: string}>}
 */
export async function exportDisclosureNotesDocx(fiscalYear) {
  const year = String(fiscalYear).replace(/^FY/, '');
  if (!/^\d{4}$/.test(year)) {
    throw new Error(
      `exportDisclosureNotesDocx: fiscalYear must be a 4-digit year (got "${fiscalYear}").`,
    );
  }
  // Step 1: list runs for the fiscal year. This endpoint returns JSON,
  // so we can use fetch with the JSON envelope directly (the shared
  // axios client is also fine here, but using fetch keeps the module's
  // auth/error story uniform with the binary path below).
  const listUrl = `${baseUrl()}/api/disclosure-notes/runs/by-year/${encodeURIComponent(year)}`;
  const token = getAuthToken();
  let listRes;
  try {
    listRes = await fetch(listUrl, {
      method: 'GET',
      headers: token
        ? { Authorization: `Bearer ${token}`, Accept: 'application/json' }
        : { Accept: 'application/json' },
    });
  } catch (err) {
    return Promise.reject({
      ok: false,
      status: 0,
      code: 'NETWORK_ERROR',
      message: err?.message || `Network error: cannot reach ${baseUrl()}.`,
    });
  }
  if (!listRes.ok) {
    let message = `Request failed (${listRes.status})`;
    try {
      const body = await listRes.json();
      message = body?.error?.message || body?.message || message;
    } catch {
      // keep default
    }
    return rejectFromResponse(listRes, message);
  }
  let listBody;
  try {
    listBody = await listRes.json();
  } catch {
    return Promise.reject({
      ok: false,
      status: listRes.status,
      code: 'UNKNOWN',
      message: 'Disclosure-notes run lookup returned a non-JSON body.',
    });
  }
  // successResponse wrapper → { success: true, data: [...] } or just [...]
  const rows = Array.isArray(listBody)
    ? listBody
    : Array.isArray(listBody?.data)
      ? listBody.data
      : [];
  const approved = rows.filter(
    (r) => typeof r?.status === 'string' && r.status.toUpperCase() === 'APPROVED',
  );
  if (approved.length === 0) {
    // Structured bilingual error — screen's existing error branch
    // surfaces err.message; we carry Ar copy on the same envelope.
    return Promise.reject({
      ok: false,
      status: 404,
      code: 'NO_APPROVED_DISCLOSURE_RUN',
      message:
        'No approved disclosure-notes run exists for this fiscal year. Publish one from the Disclosure Notes screen first.',
      messageAr:
        'لا توجد جولة ملاحظات إفصاح معتمدة لهذه السنة المالية. يُرجى نشر واحدة من شاشة ملاحظات الإفصاح أولاً.',
    });
  }
  // Pick the most-recently-approved run. Prefer `approvedAt`, fall back
  // to `runAt`, fall back to array order.
  approved.sort((a, b) => {
    const ta = Date.parse(a?.approvedAt || a?.runAt || 0) || 0;
    const tb = Date.parse(b?.approvedAt || b?.runAt || 0) || 0;
    return tb - ta;
  });
  const runId = approved[0].id;
  if (!runId) {
    return Promise.reject({
      ok: false,
      status: 500,
      code: 'UNKNOWN',
      message: 'Disclosure-notes run lookup returned a row without an id.',
    });
  }

  // Step 2: download the DOCX.
  const { blob, filename: serverFilename } = await fetchBinary(
    `/api/disclosure-notes/runs/${encodeURIComponent(runId)}/docx`,
  );
  const fallback = `disclosure-notes-FY${year}.docx`;
  const filename = serverFilename || fallback;
  triggerBrowserDownload(blob, filename);
  return { success: true, filename };
}
