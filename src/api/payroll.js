/**
 * Payroll API module — AUDIT-ACC-013 (2026-04-22).
 *
 * Wraps the 23 endpoints exposed by corporate-api's payroll module
 * (`src/modules/payroll/payroll.routes.ts`). The router mounts under two
 * base paths: `/api/employees` and `/api/payroll`; `/api/tenant-payroll-config`
 * is also mounted via the same router.
 *
 *   Employees
 *     GET    /api/employees                              → listEmployees(filter)
 *     GET    /api/employees/:id                          → getEmployee(id)
 *     POST   /api/employees                              → createEmployee(input)    [OWNER/ACCOUNTANT]
 *     PATCH  /api/employees/:id                          → updateEmployee(id, patch) [OWNER/ACCOUNTANT]
 *     POST   /api/employees/:id/terminate                → terminateEmployee(id, input) [OWNER]
 *     GET    /api/employees/:id/eos                      → getEmployeeEos(id)
 *     POST   /api/employees/:id/rehire                   → registerEmployeeRehire(id, input) [OWNER/ACCOUNTANT]
 *     POST   /api/employees/:id/service-continuity       → classifyServiceContinuity(id, input) [OWNER/ACCOUNTANT]
 *     GET    /api/employees/:id/eos-history              → getEmployeeEosHistory(id)
 *     GET    /api/employees/:id/advances                 → getEmployeeAdvances(id)
 *
 *   Tenant payroll config (singleton)
 *     GET    /api/tenant-payroll-config                  → getTenantPayrollConfig()
 *     PATCH  /api/tenant-payroll-config/eosi-reform-date → updateEosiReformDate(input) [OWNER]
 *
 *   PIFSS submissions
 *     GET    /api/payroll/pifss-submissions              → listPifssSubmissions(filter)
 *     POST   /api/payroll/pifss-submissions/:year/:month/generate → generatePifssFile(year, month) [OWNER/ACCOUNTANT]
 *     GET    /api/payroll/pifss-submissions/:id          → getPifssSubmission(id)
 *     PATCH  /api/payroll/pifss-submissions/:id/status   → updatePifssSubmissionStatus(id, input) [OWNER]
 *
 *   Payroll runs
 *     GET    /api/payroll/history                        → getPayrollHistory(filter)
 *     GET    /api/payroll/:id                            → getPayrollRun(id)
 *     POST   /api/payroll/run                            → runPayroll(input) [OWNER/ACCOUNTANT]
 *     POST   /api/payroll/eos/accrue                     → accrueEos(input) [OWNER/ACCOUNTANT]
 *     POST   /api/payroll/:id/approve                    → approvePayroll(id) [OWNER]
 *     POST   /api/payroll/:id/pay                        → payPayroll(id, input) [OWNER]
 *     GET    /api/payroll/:id/wps                        → downloadWpsFile(id)
 *
 * PayrollRunStatus enum (prisma/tenant/schema.prisma): DRAFT → APPROVED → PAID.
 * No intermediate statuses; approval is direct OWNER-only action and
 * publishes a JE via journalEntryService.create. Pay transitions APPROVED→PAID
 * and writes the WPS file to storage; the WPS download endpoint is always
 * available for APPROVED or PAID runs.
 *
 * WPS download shape (differs from HASEEB-180 bank-account export):
 *   - Content-Type: text/plain (NOT application/json)
 *   - Content-Disposition: attachment; filename="WPS_<year>_<month>.sif"
 *   - Body: raw SIF text, not base64, not JSON-wrapped
 *
 * We bypass the axios client's JSON-envelope `unwrap` and do the fetch
 * directly so the response Blob + the Content-Disposition filename reach
 * the caller intact. Errors are converted to the same `{ok:false,...}`
 * shape client.js emits.
 *
 * Errors are normalised by client.js into `{ ok:false, status, code, message }`
 * and surface to callers (or to the local fetch-based handler in
 * downloadWpsFile).
 */
import client, { getAuthToken } from './client';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data && 'success' in response.data) {
      return response.data.data;
    }
    return response.data;
  }
  return response?.data;
}

// ── Employees ─────────────────────────────────────────────────────────

/**
 * List employees with optional search + pagination. All authenticated
 * roles can read.
 *
 * @param {{search?: string, status?: 'ACTIVE'|'TERMINATED', isKuwaiti?: boolean,
 *          page?: number, limit?: number}} filter
 * @returns {Promise<{data: Array, total: number, page: number, limit: number}>}
 */
export async function listEmployees(filter = {}) {
  const params = {};
  if (filter.search) params.search = filter.search;
  if (filter.status) params.status = filter.status;
  if (filter.isKuwaiti != null) params.isKuwaiti = filter.isKuwaiti;
  if (filter.page != null) params.page = filter.page;
  if (filter.limit != null) params.limit = filter.limit;
  const r = await client.get('/api/employees', { params });
  const data = unwrap(r);
  // Controller envelopes list responses as {data, meta}. Accept both shapes.
  if (data && Array.isArray(data.data)) return data;
  if (Array.isArray(data)) return { data, total: data.length, page: 1, limit: data.length };
  return { data: [], total: 0, page: 1, limit: 20 };
}

/** Fetch a single employee by id. 404 on unknown. */
export async function getEmployee(id) {
  if (!id) throw new Error('getEmployee: id is required');
  const r = await client.get(`/api/employees/${encodeURIComponent(id)}`);
  return unwrap(r);
}

/**
 * Create a new employee. OWNER / ACCOUNTANT only.
 *
 * @param {{
 *   employeeNumber: string, nameEn: string, nameAr?: string, civilId?: string,
 *   nationality?: string, isKuwaiti: boolean,
 *   basicSalary: number|string, housingAllowance?: number|string,
 *   transportAllowance?: number|string, otherAllowances?: number|string,
 *   hireDate: string, bankAccountIban?: string
 * }} input
 */
export async function createEmployee(input) {
  const r = await client.post('/api/employees', input);
  return unwrap(r);
}

/**
 * Partially update an employee. OWNER / ACCOUNTANT only.
 *
 * @param {string} id
 * @param {Partial<Parameters<typeof createEmployee>[0]>} patch
 */
export async function updateEmployee(id, patch) {
  if (!id) throw new Error('updateEmployee: id is required');
  const r = await client.patch(
    `/api/employees/${encodeURIComponent(id)}`,
    patch || {},
  );
  return unwrap(r);
}

/**
 * Terminate an employee. OWNER only. Snapshots EOS entitlement and marks
 * status TERMINATED; re-hire requires the `/rehire` endpoint below.
 *
 * @param {string} id
 * @param {{terminationDate: string, reason?: string}} input
 */
export async function terminateEmployee(id, input) {
  if (!id) throw new Error('terminateEmployee: id is required');
  const r = await client.post(
    `/api/employees/${encodeURIComponent(id)}/terminate`,
    input || {},
  );
  return unwrap(r);
}

/** EOS calculation + accrual history for a single employee. */
export async function getEmployeeEos(id) {
  if (!id) throw new Error('getEmployeeEos: id is required');
  const r = await client.get(`/api/employees/${encodeURIComponent(id)}/eos`);
  return unwrap(r);
}

/**
 * Register a re-hire. OWNER / ACCOUNTANT only.
 *
 * @param {string} id
 * @param {{rehireDate: string, priorTerminationDate: string}} input
 */
export async function registerEmployeeRehire(id, input) {
  if (!id) throw new Error('registerEmployeeRehire: id is required');
  const r = await client.post(
    `/api/employees/${encodeURIComponent(id)}/rehire`,
    input,
  );
  return unwrap(r);
}

/**
 * Classify a re-hired employee's service continuity. OWNER / ACCOUNTANT only.
 *
 * @param {string} id
 * @param {{decision: 'CONTINUOUS'|'RESTARTED'|'SPLIT_ACCRUAL', legalBasisNote: string}} input
 */
export async function classifyServiceContinuity(id, input) {
  if (!id) throw new Error('classifyServiceContinuity: id is required');
  const r = await client.post(
    `/api/employees/${encodeURIComponent(id)}/service-continuity`,
    input,
  );
  return unwrap(r);
}

/** Full service-event + accrual history. */
export async function getEmployeeEosHistory(id) {
  if (!id) throw new Error('getEmployeeEosHistory: id is required');
  const r = await client.get(
    `/api/employees/${encodeURIComponent(id)}/eos-history`,
  );
  return unwrap(r);
}

/** Active advances (salary advances carried into deductions). */
export async function getEmployeeAdvances(id) {
  if (!id) throw new Error('getEmployeeAdvances: id is required');
  const r = await client.get(
    `/api/employees/${encodeURIComponent(id)}/advances`,
  );
  return unwrap(r);
}

// ── Tenant payroll config ────────────────────────────────────────────

/** Read the tenant payroll config singleton (EOSI reform date etc.). */
export async function getTenantPayrollConfig() {
  const r = await client.get('/api/tenant-payroll-config');
  return unwrap(r);
}

/**
 * Patch the EOSI reform date override. OWNER only.
 *
 * @param {{date: string, legalBasisNote: string}} input
 */
export async function updateEosiReformDate(input) {
  const r = await client.patch(
    '/api/tenant-payroll-config/eosi-reform-date',
    input,
  );
  return unwrap(r);
}

// ── PIFSS submissions ────────────────────────────────────────────────

/**
 * List PIFSS monthly submissions. All authenticated roles.
 *
 * @param {{year?: number, status?: 'GENERATED'|'SUBMITTED'|'ACCEPTED'|'REJECTED'|'PAID',
 *          page?: number, limit?: number}} filter
 */
export async function listPifssSubmissions(filter = {}) {
  const params = {};
  if (filter.year != null) params.year = filter.year;
  if (filter.status) params.status = filter.status;
  if (filter.page != null) params.page = filter.page;
  if (filter.limit != null) params.limit = filter.limit;
  const r = await client.get('/api/payroll/pifss-submissions', { params });
  const data = unwrap(r);
  if (data && Array.isArray(data.data)) return data;
  if (Array.isArray(data)) return { data, total: data.length, page: 1, limit: data.length };
  return { data: [], total: 0, page: 1, limit: 20 };
}

/**
 * Generate a PIFSS file for a year/month period. OWNER / ACCOUNTANT only.
 *
 * @param {number} year
 * @param {number} month
 */
export async function generatePifssFile(year, month) {
  if (!year || !month) throw new Error('generatePifssFile: year and month are required');
  const r = await client.post(
    `/api/payroll/pifss-submissions/${encodeURIComponent(year)}/${encodeURIComponent(month)}/generate`,
  );
  return unwrap(r);
}

/** Submission detail by id. */
export async function getPifssSubmission(id) {
  if (!id) throw new Error('getPifssSubmission: id is required');
  const r = await client.get(
    `/api/payroll/pifss-submissions/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}

/**
 * Transition a submission's state. OWNER only. `rejectionReason` is
 * required when `status === 'REJECTED'`.
 *
 * @param {string} id
 * @param {{status: 'SUBMITTED'|'ACCEPTED'|'REJECTED'|'PAID',
 *          portalReference?: string, rejectionReason?: string,
 *          submittedAt?: string, acceptedAt?: string, rejectedAt?: string, paidAt?: string}} input
 */
export async function updatePifssSubmissionStatus(id, input) {
  if (!id) throw new Error('updatePifssSubmissionStatus: id is required');
  const r = await client.patch(
    `/api/payroll/pifss-submissions/${encodeURIComponent(id)}/status`,
    input,
  );
  return unwrap(r);
}

// ── Payroll runs ─────────────────────────────────────────────────────

/**
 * List payroll runs with optional year filter + pagination.
 *
 * @param {{year?: number, page?: number, limit?: number}} filter
 */
export async function getPayrollHistory(filter = {}) {
  const params = {};
  if (filter.year != null) params.year = filter.year;
  if (filter.page != null) params.page = filter.page;
  if (filter.limit != null) params.limit = filter.limit;
  const r = await client.get('/api/payroll/history', { params });
  const data = unwrap(r);
  if (data && Array.isArray(data.data)) return data;
  if (Array.isArray(data)) return { data, total: data.length, page: 1, limit: data.length };
  return { data: [], total: 0, page: 1, limit: 20 };
}

/** Full payroll run detail by id, including per-employee entries. */
export async function getPayrollRun(id) {
  if (!id) throw new Error('getPayrollRun: id is required');
  const r = await client.get(`/api/payroll/${encodeURIComponent(id)}`);
  return unwrap(r);
}

/**
 * Run payroll for a given period. Creates a DRAFT run + line items.
 * OWNER / ACCOUNTANT only.
 *
 * Backend body shape: `{year: number, month: number}` (year 2000-2100,
 * month 1-12). Accepts `periodYear` / `periodMonth` aliases and maps
 * them; if both are present `year`/`month` win.
 *
 * @param {{year?: number, month?: number, periodYear?: number, periodMonth?: number}} input
 */
export async function runPayroll(input) {
  const body = {
    year: input.year ?? input.periodYear,
    month: input.month ?? input.periodMonth,
  };
  if (!body.year || !body.month) {
    throw new Error('runPayroll: year and month (or periodYear/periodMonth) are required');
  }
  const r = await client.post('/api/payroll/run', body);
  return unwrap(r);
}

/**
 * Accrue monthly EOS for all active employees. OWNER / ACCOUNTANT only.
 *
 * @param {{year: number, month: number}} input
 */
export async function accrueEos(input) {
  const r = await client.post('/api/payroll/eos/accrue', input);
  return unwrap(r);
}

/**
 * Approve a DRAFT payroll run. OWNER only. Creates a JE via
 * journalEntryService.create with role-resolved accounts; downstream
 * FN-269 approval tiers apply at the JE layer, not here.
 */
export async function approvePayroll(id) {
  if (!id) throw new Error('approvePayroll: id is required');
  const r = await client.post(`/api/payroll/${encodeURIComponent(id)}/approve`);
  return unwrap(r);
}

/**
 * Pay an APPROVED payroll run. OWNER only. Generates the WPS SIF file,
 * marks the run PAID, persists the WPS file URL on the run.
 *
 * @param {string} id
 * @param {object} [input]  Reserved for future payment-reference metadata.
 */
export async function payPayroll(id, input) {
  if (!id) throw new Error('payPayroll: id is required');
  const r = await client.post(
    `/api/payroll/${encodeURIComponent(id)}/pay`,
    input || {},
  );
  return unwrap(r);
}

/**
 * Download the WPS (SIF) file for an APPROVED / PAID payroll run.
 *
 * The backend responds with `text/plain` + `Content-Disposition` (NOT a
 * JSON envelope), so we bypass the axios client's JSON interceptor and
 * use `fetch` directly. Returns `{ blob, filename }` — the caller
 * triggers the browser download (anchor + URL.createObjectURL).
 *
 * Filename is parsed from the `Content-Disposition` header; falls back
 * to `WPS_<runId>.sif` if the header is missing or unparseable.
 *
 * Errors are normalised into the same `{ok:false, status, code, message}`
 * shape client.js emits so callers can handle them uniformly.
 *
 * @param {string} id Payroll run id
 * @returns {Promise<{blob: Blob, filename: string}>}
 */
export async function downloadWpsFile(id) {
  if (!id) throw new Error('downloadWpsFile: id is required');
  const baseURL =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
    'http://localhost:3000';
  const url = `${baseURL}/api/payroll/${encodeURIComponent(id)}/wps`;
  const token = getAuthToken();
  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (err) {
    // Network / CORS failure mirrors client.js NETWORK_ERROR shape.
    return Promise.reject({
      ok: false,
      status: 0,
      code: 'NETWORK_ERROR',
      message: err?.message || `Network error: cannot reach ${baseURL}.`,
    });
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.error?.message || body?.message || message;
    } catch {
      // Body wasn't JSON; keep the default message.
    }
    let code = 'UNKNOWN';
    if (res.status === 401) code = 'UNAUTHORIZED';
    else if (res.status >= 500) code = 'SERVER_ERROR';
    else if (res.status >= 400) code = 'CLIENT_ERROR';
    return Promise.reject({ ok: false, status: res.status, code, message });
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const filename = parseContentDispositionFilename(disposition) || `WPS_${id}.sif`;
  return { blob, filename };
}

/**
 * Parse a `Content-Disposition` header's filename. Handles quoted and
 * unquoted forms and the RFC 5987 `filename*=UTF-8''...` extension.
 */
function parseContentDispositionFilename(header) {
  if (!header) return null;
  // RFC 5987 extended form first (UTF-8 percent-encoded).
  const ext = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(header);
  if (ext && ext[1]) {
    try {
      return decodeURIComponent(ext[1].trim());
    } catch {
      // fall through
    }
  }
  // Plain quoted form.
  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(header);
  if (quoted && quoted[1]) return quoted[1];
  // Plain unquoted form.
  const plain = /filename\s*=\s*([^;]+)/i.exec(header);
  if (plain && plain[1]) return plain[1].trim();
  return null;
}
