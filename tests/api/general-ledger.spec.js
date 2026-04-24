/**
 * HASEEB-447 — General Ledger API shape tests (Dispatch Item 2).
 *
 * Covers the two wrappers on /api/reports/general-ledger added by
 * this dispatch (backend HASEEB-424, FN-188):
 *   (1) getGeneralLedger happy path — correct URL, params, unwraps
 *       the `data` envelope.
 *   (2) getGeneralLedger joins accountIds array to CSV; omits `format`
 *       & `language` overrides from caller, defaults format=json.
 *   (3) getGeneralLedger surfaces backend errors via the shared axios
 *       client's normalised error envelope.
 *   (4) exportGeneralLedger happy path — format=xlsx + responseType=blob,
 *       extracts filename from Content-Disposition.
 *   (5) exportGeneralLedger falls back to synthesised filename when
 *       Content-Disposition is absent.
 *   (6) joinAccountIds helper — array, string, empty, null.
 *
 * Mocks the shared axios client (same pattern as
 * tests/api/chat.pending-entries.spec.js).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/api/client', () => {
  const get = vi.fn();
  const post = vi.fn();
  return {
    default: { get, post },
    DEFAULT_TIMEOUT_MS: 15000,
    __esModule: true,
  };
});

import client from '../../src/api/client';
import {
  getGeneralLedger,
  exportGeneralLedger,
  joinAccountIds,
} from '../../src/api/reports';

function makeJsonResponse(body) {
  return { data: body };
}

function makeBlobResponse(blobBody, disposition) {
  const blob =
    typeof Blob !== 'undefined'
      ? new Blob([blobBody], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      : { size: blobBody.length, _mock: true };
  return {
    data: blob,
    headers: disposition ? { 'content-disposition': disposition } : {},
  };
}

beforeEach(() => {
  vi.mocked(client.get).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── (6) joinAccountIds helper ─────────────────────────────────────

describe('joinAccountIds', () => {
  it('joins an array of ids', () => {
    expect(joinAccountIds(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('filters empties from the array', () => {
    expect(joinAccountIds(['a', '', '  ', 'b'])).toBe('a,b');
  });

  it('returns undefined for null / undefined / empty array', () => {
    expect(joinAccountIds(null)).toBeUndefined();
    expect(joinAccountIds(undefined)).toBeUndefined();
    expect(joinAccountIds([])).toBeUndefined();
    expect(joinAccountIds(['', '   '])).toBeUndefined();
  });

  it('passes a string through when non-empty; returns undefined when blank', () => {
    expect(joinAccountIds('x,y,z')).toBe('x,y,z');
    expect(joinAccountIds('')).toBeUndefined();
    expect(joinAccountIds('   ')).toBeUndefined();
  });
});

// ── (1) getGeneralLedger happy path ───────────────────────────────

describe('getGeneralLedger', () => {
  it('GETs /api/reports/general-ledger with format=json, unwraps `data` envelope', async () => {
    vi.mocked(client.get).mockResolvedValue(
      makeJsonResponse({
        success: true,
        data: {
          from: '2025-01-01',
          to: '2025-12-31',
          rows: [
            { accountId: 'a1', debit: '100.000', credit: '0.000' },
          ],
          totals: {
            openingBalance: '0.000',
            periodDebits: '100.000',
            periodCredits: '0.000',
            closingBalance: '100.000',
          },
        },
      }),
    );

    const result = await getGeneralLedger({
      from: '2025-01-01',
      to: '2025-12-31',
    });

    expect(client.get).toHaveBeenCalledWith(
      '/api/reports/general-ledger',
      { params: { from: '2025-01-01', to: '2025-12-31', format: 'json' } },
    );
    expect(result.rows).toHaveLength(1);
    expect(result.totals.closingBalance).toBe('100.000');
  });

  it('joins accountIds array to csv + forwards language param', async () => {
    vi.mocked(client.get).mockResolvedValue(
      makeJsonResponse({ data: { rows: [] } }),
    );

    await getGeneralLedger({
      from: '2025-01-01',
      to: '2025-03-31',
      accountIds: ['acc-1', 'acc-2', 'acc-3'],
      language: 'ar',
    });

    const [, config] = client.get.mock.calls[0];
    expect(config.params).toEqual({
      from: '2025-01-01',
      to: '2025-03-31',
      format: 'json',
      accountIds: 'acc-1,acc-2,acc-3',
      language: 'ar',
    });
  });

  it('throws when from/to are missing', async () => {
    await expect(getGeneralLedger({ from: '2025-01-01' })).rejects.toThrow(
      /from and to are required/,
    );
    await expect(getGeneralLedger({})).rejects.toThrow(
      /from and to are required/,
    );
  });

  it('(3) propagates backend error envelope', async () => {
    vi.mocked(client.get).mockRejectedValue({
      ok: false,
      status: 500,
      code: 'SERVER_ERROR',
      message: 'KABOOM',
    });

    await expect(
      getGeneralLedger({ from: '2025-01-01', to: '2025-12-31' }),
    ).rejects.toMatchObject({
      ok: false,
      status: 500,
      code: 'SERVER_ERROR',
    });
  });
});

// ── (4) (5) exportGeneralLedger ────────────────────────────────────

describe('exportGeneralLedger', () => {
  it('(4) GETs with format=xlsx + responseType=blob; extracts filename from Content-Disposition', async () => {
    vi.mocked(client.get).mockResolvedValue(
      makeBlobResponse(
        'XLSX-BYTES',
        'attachment; filename="general-ledger_2025-01-01_2025-12-31.xlsx"',
      ),
    );

    const result = await exportGeneralLedger({
      from: '2025-01-01',
      to: '2025-12-31',
      accountIds: ['a1', 'a2'],
      language: 'bilingual',
    });

    expect(client.get).toHaveBeenCalledWith(
      '/api/reports/general-ledger',
      {
        params: {
          from: '2025-01-01',
          to: '2025-12-31',
          format: 'xlsx',
          accountIds: 'a1,a2',
          language: 'bilingual',
        },
        responseType: 'blob',
      },
    );
    expect(result.filename).toBe(
      'general-ledger_2025-01-01_2025-12-31.xlsx',
    );
    expect(result.blob).toBeDefined();
  });

  it('(5) falls back to synthesised filename when Content-Disposition is absent', async () => {
    vi.mocked(client.get).mockResolvedValue(makeBlobResponse('XLSX'));

    const result = await exportGeneralLedger({
      from: '2025-01-01',
      to: '2025-06-30',
    });

    expect(result.filename).toBe('general-ledger_2025-01-01_2025-06-30.xlsx');
  });

  it('throws when from/to are missing', async () => {
    await expect(exportGeneralLedger({})).rejects.toThrow(
      /from and to are required/,
    );
  });

  it('surfaces backend error as structured rejection', async () => {
    vi.mocked(client.get).mockRejectedValue({
      ok: false,
      status: 403,
      code: 'CLIENT_ERROR',
      message: 'forbidden',
    });

    await expect(
      exportGeneralLedger({ from: '2025-01-01', to: '2025-12-31' }),
    ).rejects.toMatchObject({
      ok: false,
      status: 403,
    });
  });
});
