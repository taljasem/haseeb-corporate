/**
 * HASEEB-406 — API shape tests for the multi-pending surface.
 *
 * Covers:
 *   (1) getPendingEntries returns the `pending` array from the backend
 *       envelope.
 *   (2) getPendingEntries tolerates a bare array envelope (defence).
 *   (3) cancelPendingEntry POSTs to the right URL and returns
 *       `pending`.
 *   (4) cancelPendingEntry surfaces 409/410/404 as thrown
 *       `{ ok:false, status, code }` objects so the UI can branch.
 *   (5) cancelPendingEntry URL-encodes the confirmationId.
 *
 * Companion to backend HASEEB-405 (PendingJournalEntry model + the two
 * new endpoints). Mocks the shared axios client the same way
 * tests/api/chat.timeout.spec.js does.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/api/client', () => {
  const post = vi.fn();
  const get = vi.fn();
  return {
    default: { post, get },
    DEFAULT_TIMEOUT_MS: 15000,
    __esModule: true,
  };
});

import client from '../../src/api/client';
import { getPendingEntries, cancelPendingEntry } from '../../src/api/chat';

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

describe('HASEEB-406 — multi-pending API shape', () => {
  it('(1) getPendingEntries returns the `pending` array from the backend envelope', async () => {
    vi.mocked(client.get).mockResolvedValue(
      makeResponse({
        pending: [
          { id: 'p1', confirmationId: 'c1' },
          { id: 'p2', confirmationId: 'c2' },
        ],
      }),
    );

    const rows = await getPendingEntries();

    expect(client.get).toHaveBeenCalledWith('/api/ai/pending-entries');
    expect(rows).toHaveLength(2);
    expect(rows[0].confirmationId).toBe('c1');
  });

  it('(2) getPendingEntries tolerates a bare-array envelope', async () => {
    vi.mocked(client.get).mockResolvedValue(
      makeResponse([{ id: 'p1', confirmationId: 'c1' }]),
    );

    const rows = await getPendingEntries();
    expect(rows).toHaveLength(1);
  });

  it('(2b) getPendingEntries returns [] when backend returns empty pending', async () => {
    vi.mocked(client.get).mockResolvedValue(makeResponse({ pending: [] }));
    const rows = await getPendingEntries();
    expect(rows).toEqual([]);
  });

  it('(3) cancelPendingEntry POSTs to the right URL and returns `pending`', async () => {
    vi.mocked(client.post).mockResolvedValue(
      makeResponse({
        pending: { id: 'p1', confirmationId: 'c1', status: 'CANCELLED' },
      }),
    );

    const result = await cancelPendingEntry('c1');

    expect(client.post).toHaveBeenCalledTimes(1);
    const [url] = vi.mocked(client.post).mock.calls[0];
    expect(url).toBe('/api/ai/pending-entries/c1/cancel');
    expect(result).toMatchObject({ confirmationId: 'c1', status: 'CANCELLED' });
  });

  it('(4a) cancelPendingEntry surfaces 409 STALE_CONFIRMATION as a rejected error with status=409', async () => {
    vi.mocked(client.post).mockRejectedValue({
      ok: false,
      status: 409,
      code: 'CLIENT_ERROR',
      message: 'This pending has already been processed',
    });

    await expect(cancelPendingEntry('c1')).rejects.toMatchObject({
      ok: false,
      status: 409,
    });
  });

  it('(4b) cancelPendingEntry surfaces 410 PENDING_EXPIRED as status=410', async () => {
    vi.mocked(client.post).mockRejectedValue({
      ok: false,
      status: 410,
      code: 'CLIENT_ERROR',
      message: 'Pending entry expired',
    });

    await expect(cancelPendingEntry('c1')).rejects.toMatchObject({
      ok: false,
      status: 410,
    });
  });

  it('(4c) cancelPendingEntry surfaces 404 PENDING_NOT_FOUND as status=404', async () => {
    vi.mocked(client.post).mockRejectedValue({
      ok: false,
      status: 404,
      code: 'CLIENT_ERROR',
      message: 'Pending entry not found',
    });

    await expect(cancelPendingEntry('c1')).rejects.toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it('(5) cancelPendingEntry URL-encodes the confirmationId (defence against IDs containing slashes/spaces)', async () => {
    vi.mocked(client.post).mockResolvedValue(
      makeResponse({ pending: { confirmationId: 'weird id/x' } }),
    );
    await cancelPendingEntry('weird id/x');
    const [url] = vi.mocked(client.post).mock.calls[0];
    // encodeURIComponent → space=%20, /=%2F
    expect(url).toBe('/api/ai/pending-entries/weird%20id%2Fx/cancel');
  });

  it('(6) cancelPendingEntry throws a client-side error without calling the server when confirmationId is missing', async () => {
    await expect(cancelPendingEntry('')).rejects.toMatchObject({
      ok: false,
      code: 'CLIENT_ERROR',
    });
    expect(client.post).not.toHaveBeenCalled();
  });
});
