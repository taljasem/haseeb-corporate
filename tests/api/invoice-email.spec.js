/**
 * HASEEB-447 — Invoice Email API shape tests (Dispatch Item 2).
 *
 * Covers the two wrappers on /api/invoices/:id added by this dispatch
 * (backend HASEEB-420, FN-063):
 *   (1) emailInvoice happy path — correct URL + body, unwraps the
 *       201 send-log row.
 *   (2) emailInvoice coerces a comma-string `cc` into an array;
 *       strips empty optional fields so the .strict() backend schema
 *       does not reject them.
 *   (3) emailInvoice URL-encodes the invoiceId; throws when invoiceId
 *       is missing.
 *   (4) emailInvoice surfaces 403 / 409 / 422 via the shared axios
 *       client's normalised error envelope so the UI can toast.
 *   (5) getInvoiceSendLogs happy path — returns the array; tolerates
 *       a bare-array envelope; returns [] on unexpected shape.
 *   (6) getInvoiceSendLogs throws when invoiceId is missing.
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
import { emailInvoice, getInvoiceSendLogs } from '../../src/api/invoices';

function makeResponse(body) {
  return { data: body };
}

beforeEach(() => {
  vi.mocked(client.post).mockReset();
  vi.mocked(client.get).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── (1) emailInvoice happy path ───────────────────────────────────

describe('emailInvoice', () => {
  it('POSTs to /api/invoices/:id/email with the body; unwraps the send-log row', async () => {
    vi.mocked(client.post).mockResolvedValue(
      makeResponse({
        success: true,
        data: {
          id: 'SL-100',
          invoiceId: 'inv-1',
          recipientEmail: 'bill@customer.example',
          cc: [],
          language: 'en',
          sentAt: '2026-04-24T10:00:00.000Z',
          status: 'SENT',
        },
      }),
    );

    const row = await emailInvoice('inv-1', {
      recipientEmail: 'bill@customer.example',
      language: 'en',
      message: 'Please find attached',
    });

    expect(client.post).toHaveBeenCalledWith(
      '/api/invoices/inv-1/email',
      {
        recipientEmail: 'bill@customer.example',
        message: 'Please find attached',
        language: 'en',
      },
    );
    expect(row.id).toBe('SL-100');
    expect(row.status).toBe('SENT');
  });

  it('(2) coerces a comma-string `cc` into an array + strips empty optional fields', async () => {
    vi.mocked(client.post).mockResolvedValue(makeResponse({ data: { id: 'SL' } }));

    await emailInvoice('inv-2', {
      recipientEmail: 'to@x.com',
      cc: 'a@x.com, b@x.com  c@x.com',
      subject: '',
      message: undefined,
      language: null,
    });

    const [, body] = client.post.mock.calls[0];
    expect(body).toEqual({
      recipientEmail: 'to@x.com',
      cc: ['a@x.com', 'b@x.com', 'c@x.com'],
    });
    // No stray keys.
    expect('subject' in body).toBe(false);
    expect('message' in body).toBe(false);
    expect('language' in body).toBe(false);
  });

  it('passes through an array `cc` as-is', async () => {
    vi.mocked(client.post).mockResolvedValue(makeResponse({ data: {} }));

    await emailInvoice('inv-3', { cc: ['x@y.com', 'y@z.com'] });

    const [, body] = client.post.mock.calls[0];
    expect(body.cc).toEqual(['x@y.com', 'y@z.com']);
  });

  it('tolerates a bare object envelope (no `data` wrap)', async () => {
    vi.mocked(client.post).mockResolvedValue(
      makeResponse({ id: 'SL-200', status: 'SENT' }),
    );
    const row = await emailInvoice('inv-4', {});
    expect(row.id).toBe('SL-200');
  });

  it('(3) URL-encodes invoice ids with special chars', async () => {
    vi.mocked(client.post).mockResolvedValue(makeResponse({ data: {} }));

    await emailInvoice('inv id/with spaces', { recipientEmail: 'to@x.com' });

    const [url] = client.post.mock.calls[0];
    expect(url).toBe('/api/invoices/inv%20id%2Fwith%20spaces/email');
  });

  it('(3) throws when invoiceId is missing', async () => {
    await expect(emailInvoice('', {})).rejects.toThrow(
      /invoiceId is required/,
    );
    await expect(emailInvoice(null, {})).rejects.toThrow(
      /invoiceId is required/,
    );
  });

  it('(4) propagates backend 422 (validation) via normalised envelope', async () => {
    vi.mocked(client.post).mockRejectedValue({
      ok: false,
      status: 422,
      code: 'CLIENT_ERROR',
      message: 'Invalid recipient email',
    });

    await expect(
      emailInvoice('inv-5', { recipientEmail: 'not-an-email' }),
    ).rejects.toMatchObject({
      ok: false,
      status: 422,
      code: 'CLIENT_ERROR',
    });
  });

  it('(4) propagates backend 403 (role gate) via normalised envelope', async () => {
    vi.mocked(client.post).mockRejectedValue({
      ok: false,
      status: 403,
      code: 'CLIENT_ERROR',
      message: 'Forbidden',
    });

    await expect(
      emailInvoice('inv-6', { recipientEmail: 'x@y.com' }),
    ).rejects.toMatchObject({ ok: false, status: 403 });
  });
});

// ── (5) (6) getInvoiceSendLogs ────────────────────────────────────

describe('getInvoiceSendLogs', () => {
  it('(5) GETs /api/invoices/:id/send-logs; unwraps + returns array', async () => {
    vi.mocked(client.get).mockResolvedValue(
      makeResponse({
        success: true,
        data: [
          { id: 'SL-1', sentAt: '2026-04-20T00:00:00Z' },
          { id: 'SL-2', sentAt: '2026-04-24T00:00:00Z' },
        ],
      }),
    );

    const rows = await getInvoiceSendLogs('inv-1');

    expect(client.get).toHaveBeenCalledWith('/api/invoices/inv-1/send-logs');
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('SL-1');
  });

  it('(5) tolerates a bare-array envelope', async () => {
    vi.mocked(client.get).mockResolvedValue(
      makeResponse([{ id: 'SL-1' }]),
    );
    const rows = await getInvoiceSendLogs('inv-1');
    expect(rows).toHaveLength(1);
  });

  it('(5) returns [] when backend sends non-array payload', async () => {
    vi.mocked(client.get).mockResolvedValue(makeResponse({ data: null }));
    const rows = await getInvoiceSendLogs('inv-1');
    expect(rows).toEqual([]);
  });

  it('(5) URL-encodes invoice ids with special chars', async () => {
    vi.mocked(client.get).mockResolvedValue(makeResponse({ data: [] }));

    await getInvoiceSendLogs('inv with/slash');

    const [url] = client.get.mock.calls[0];
    expect(url).toBe('/api/invoices/inv%20with%2Fslash/send-logs');
  });

  it('(6) throws when invoiceId is missing', async () => {
    await expect(getInvoiceSendLogs('')).rejects.toThrow(
      /invoiceId is required/,
    );
  });
});
