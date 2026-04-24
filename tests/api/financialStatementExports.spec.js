/**
 * HASEEB-443 — Financial Statement Exports API shape tests.
 *
 * Covers the YearEndCloseScreen APPROVED-state detail-view export
 * pipeline:
 *   (1) PDF happy path for balance-sheet: correct URL + params,
 *       Content-Disposition filename extraction, browser-download
 *       dance (createObjectURL → anchor.click → revokeObjectURL).
 *   (2) XLSX happy path for income-statement: from/to range derived
 *       from fiscalYear, xlsx MIME handled, fallback filename when
 *       server omits Content-Disposition.
 *   (3) DOCX disclosure-notes: two-step lookup (by-year → :id/docx)
 *       picks the most recent APPROVED run and triggers download.
 *   (4) DOCX disclosure-notes error path: no APPROVED run yields a
 *       structured bilingual NO_APPROVED_DISCLOSURE_RUN rejection.
 *
 * The tests mock the global `fetch` (the module deliberately bypasses
 * the shared axios client to reach the binary body + Content-
 * Disposition header — same pattern as src/api/payroll.js).
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';

// Stub client's getAuthToken so the Authorization header is deterministic.
vi.mock('../../src/api/client', () => ({
  default: {},
  getAuthToken: () => 'test-token',
  DEFAULT_TIMEOUT_MS: 15000,
  __esModule: true,
}));

import {
  exportFinancialStatementBinary,
  exportDisclosureNotesDocx,
  paramsForTab,
  triggerBrowserDownload,
} from '../../src/api/financialStatementExports';

// ── Helpers ─────────────────────────────────────────────────────────

function makeBinaryResponse({
  body = 'BINARY',
  disposition = null,
  status = 200,
  contentType = 'application/pdf',
} = {}) {
  const blob = new Blob([body], { type: contentType });
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => {
        if (name.toLowerCase() === 'content-disposition') return disposition;
        if (name.toLowerCase() === 'content-type') return contentType;
        return null;
      },
    },
    blob: async () => blob,
    json: async () => ({ error: { message: 'Server error body (JSON)' } }),
  };
}

function makeJsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    blob: async () => new Blob([JSON.stringify(body)], { type: 'application/json' }),
  };
}

let clickSpy;
let createObjectUrlSpy;
let revokeObjectUrlSpy;

beforeEach(() => {
  // Global fetch stub — vitest jsdom env has no network.
  global.fetch = vi.fn();

  // jsdom provides URL.createObjectURL as undefined — shim + spy.
  createObjectUrlSpy = vi.fn(() => 'blob:mock-url');
  revokeObjectUrlSpy = vi.fn();
  URL.createObjectURL = createObjectUrlSpy;
  URL.revokeObjectURL = revokeObjectUrlSpy;

  // Spy on anchor.click — jsdom's default no-ops but we want to assert
  // it was invoked. Spy on HTMLAnchorElement.prototype.click.
  clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ── Shape adapter ──────────────────────────────────────────────────

describe('paramsForTab (shape adapter)', () => {
  it('balance-sheet → as_of=YYYY-12-31', () => {
    expect(paramsForTab('balance-sheet', 2024)).toMatchObject({
      as_of: '2024-12-31',
    });
    expect(paramsForTab('balance-sheet', '2024')).toMatchObject({
      as_of: '2024-12-31',
    });
    expect(paramsForTab('balance-sheet', 'FY2024')).toMatchObject({
      as_of: '2024-12-31',
    });
  });

  it('income-statement / cash-flow / socie → from & to bracket the calendar year', () => {
    for (const tab of ['income-statement', 'cash-flow', 'socie']) {
      expect(paramsForTab(tab, 2024)).toMatchObject({
        from: '2024-01-01',
        to: '2024-12-31',
      });
    }
  });

  it('rejects a non-4-digit fiscalYear', () => {
    expect(() => paramsForTab('balance-sheet', 'yolo')).toThrow(
      /4-digit year/,
    );
  });
});

// ── (1) PDF happy path ─────────────────────────────────────────────

describe('exportFinancialStatementBinary — PDF happy path', () => {
  it('balance-sheet: hits /api/reports/balance-sheet/export with as_of + format=pdf; extracts filename from header; triggers browser download', async () => {
    global.fetch.mockResolvedValueOnce(
      makeBinaryResponse({
        body: 'PDF-BYTES',
        disposition: 'attachment; filename="balance-sheet-2024.pdf"',
        contentType: 'application/pdf',
      }),
    );

    const result = await exportFinancialStatementBinary(
      'balance-sheet',
      2024,
      'pdf',
    );

    expect(result).toEqual({
      success: true,
      filename: 'balance-sheet-2024.pdf',
    });
    // URL + query-params assertion.
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/reports\/balance-sheet\/export\?/);
    expect(url).toMatch(/as_of=2024-12-31/);
    expect(url).toMatch(/format=pdf/);
    expect(init?.headers?.Authorization).toBe('Bearer test-token');
    // Download dance.
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

// ── (2) XLSX happy path ────────────────────────────────────────────

describe('exportFinancialStatementBinary — XLSX happy path', () => {
  it('income-statement: hits /api/reports/income-statement/export with from+to+format=xlsx; falls back to synthesised filename when no Content-Disposition', async () => {
    global.fetch.mockResolvedValueOnce(
      makeBinaryResponse({
        body: 'XLSX-BYTES',
        disposition: null,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );

    const result = await exportFinancialStatementBinary(
      'income-statement',
      2024,
      'xlsx',
    );

    expect(result).toEqual({
      success: true,
      filename: 'income-statement-FY2024.xlsx',
    });
    const [url] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/reports\/income-statement\/export\?/);
    expect(url).toMatch(/from=2024-01-01/);
    expect(url).toMatch(/to=2024-12-31/);
    expect(url).toMatch(/format=xlsx/);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported format', async () => {
    await expect(
      exportFinancialStatementBinary('balance-sheet', 2024, 'zip'),
    ).rejects.toThrow(/format must be 'pdf' or 'xlsx'/);
  });

  it('rejects unknown tab', async () => {
    await expect(
      exportFinancialStatementBinary('not-a-tab', 2024, 'pdf'),
    ).rejects.toThrow(/unsupported tab/);
  });

  it('surfaces 500 from backend as structured error (no crash)', async () => {
    global.fetch.mockResolvedValueOnce(
      makeBinaryResponse({
        status: 500,
        body: JSON.stringify({ error: { message: 'KABOOM' } }),
      }),
    );

    await expect(
      exportFinancialStatementBinary('socie', 2024, 'pdf'),
    ).rejects.toMatchObject({
      ok: false,
      status: 500,
      code: 'SERVER_ERROR',
    });
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

// ── (3) DOCX disclosure-notes happy path ──────────────────────────

describe('exportDisclosureNotesDocx — happy path', () => {
  it('picks the most-recently-approved run from by-year and downloads its DOCX', async () => {
    // Step 1: list returns 3 rows — 1 DRAFT + 2 APPROVED, newest approvedAt second.
    global.fetch
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          data: [
            { id: 'r-old', status: 'APPROVED', approvedAt: '2024-02-01T00:00:00Z', runAt: '2024-01-20T00:00:00Z' },
            { id: 'r-draft', status: 'DRAFT', runAt: '2024-03-01T00:00:00Z' },
            { id: 'r-new', status: 'APPROVED', approvedAt: '2024-05-15T00:00:00Z', runAt: '2024-05-10T00:00:00Z' },
          ],
        }),
      )
      // Step 2: binary DOCX pack.
      .mockResolvedValueOnce(
        makeBinaryResponse({
          body: 'DOCX-BYTES',
          disposition:
            'attachment; filename="disclosure-notes-FY2024-pack.docx"',
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      );

    const result = await exportDisclosureNotesDocx(2024);

    expect(result).toEqual({
      success: true,
      filename: 'disclosure-notes-FY2024-pack.docx',
    });
    // Ensure step 1 went to /runs/by-year/2024
    const [listUrl] = global.fetch.mock.calls[0];
    expect(listUrl).toMatch(/\/api\/disclosure-notes\/runs\/by-year\/2024$/);
    // Ensure step 2 picked r-new (most recent approvedAt).
    const [docxUrl] = global.fetch.mock.calls[1];
    expect(docxUrl).toMatch(
      /\/api\/disclosure-notes\/runs\/r-new\/docx$/,
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

// ── (4) DOCX disclosure-notes error path ───────────────────────────

describe('exportDisclosureNotesDocx — no approved run', () => {
  it('rejects with structured bilingual NO_APPROVED_DISCLOSURE_RUN when all runs are non-APPROVED', async () => {
    // Two fetch mocks — one for each `exportDisclosureNotesDocx` call
    // below (the first toMatchObject assertion + the second try/catch
    // each consume one list fetch; no /docx fetch is made because we
    // short-circuit on the empty-APPROVED branch).
    global.fetch
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          data: [{ id: 'r-draft', status: 'DRAFT' }],
        }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          data: [{ id: 'r-draft', status: 'DRAFT' }],
        }),
      );

    await expect(exportDisclosureNotesDocx(2024)).rejects.toMatchObject({
      ok: false,
      code: 'NO_APPROVED_DISCLOSURE_RUN',
      status: 404,
    });

    // Verify bilingual copy on a second call.
    let caught;
    try {
      await exportDisclosureNotesDocx(2024);
    } catch (err) {
      caught = err;
    }
    expect(caught?.message).toMatch(/approved disclosure-notes run/i);
    expect(caught?.messageAr).toMatch(/ملاحظات/);

    // No download triggered (we short-circuited before /docx).
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('tolerates a bare-array envelope from the by-year endpoint', async () => {
    global.fetch.mockResolvedValueOnce(
      makeJsonResponse([{ id: 'r1', status: 'APPROVED', runAt: '2024-06-01T00:00:00Z' }]),
    );
    global.fetch.mockResolvedValueOnce(
      makeBinaryResponse({
        body: 'DOCX',
        disposition: 'attachment; filename="dn.docx"',
      }),
    );

    const result = await exportDisclosureNotesDocx(2024);
    expect(result).toEqual({ success: true, filename: 'dn.docx' });
  });
});

// ── triggerBrowserDownload defensive behaviour ─────────────────────

describe('triggerBrowserDownload', () => {
  it('no-ops when URL.createObjectURL is unavailable', () => {
    const savedCreate = URL.createObjectURL;
    // eslint-disable-next-line no-undefined
    URL.createObjectURL = undefined;
    expect(() =>
      triggerBrowserDownload(new Blob(['x']), 'x.bin'),
    ).not.toThrow();
    URL.createObjectURL = savedCreate;
  });
});
