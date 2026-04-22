/**
 * @file chat.timeout.spec.js
 *
 * AMINAH-TIMEOUT-P1 (2026-04-22) — lock the per-request axios timeout
 * override for the Aminah LLM endpoints.
 *
 * Background: post-token-trim latency measurements (see
 * memory-bank/2026-04-22-aminah-latency-post-trim.md) show median 18s
 * and worst-case 31s for Aminah chat turns. The shared axios client
 * defaults to 15s (DEFAULT_TIMEOUT_MS), which would NETWORK_ERROR-abort
 * mid-flight while the backend is still delivering a correct response.
 * The fix raises the per-request timeout on /api/ai/chat +
 * /api/ai/confirm to 120s (AI_CHAT_TIMEOUT_MS) without touching the
 * default — all other endpoints still fail fast.
 *
 * The test mocks the underlying axios client's `post` method and asserts
 * the exact config object that each of the three AI-path call sites
 * passes through. Locking the number in a test means a future "let's
 * drop this back to 30s for cost" change has to be explicit.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the axios client module BEFORE importing chat.js — otherwise
// chat.js captures the real client at module-load time.
vi.mock('../../src/api/client', () => {
  const post = vi.fn();
  const get = vi.fn();
  return {
    default: { post, get },
    // Re-export the constant as defined in client.js so the regression
    // assertion below reads the real module, not a mock shape.
    DEFAULT_TIMEOUT_MS: 15000,
    // Helpers to retrieve the spy instances inside the test body. vitest
    // module-mocks evaluate the factory lazily per-file, so the spies
    // live on the mocked module's default export.
    __esModule: true,
  };
});

// Import AFTER the mock is installed.
import client from '../../src/api/client';
import {
  AI_CHAT_TIMEOUT_MS,
  sendChatMessage,
  confirmPendingAction,
  listConversations,
  getConversation,
  getConversationMessages,
} from '../../src/api/chat';
import { DEFAULT_TIMEOUT_MS } from '../../src/api/client';

/** A minimal axios-shaped "success" response for each mocked POST/GET. */
function makeResponse(body) {
  return { data: body };
}

beforeEach(() => {
  vi.mocked(client.post).mockReset();
  vi.mocked(client.get).mockReset();
  // Default: every POST resolves with a minimal valid Aminah envelope so
  // sendChatMessage / confirmPendingAction don't reject.
  vi.mocked(client.post).mockResolvedValue(
    makeResponse({
      message: 'ok',
      language: 'en',
      conversationId: 'conv-1',
      success: true,
    }),
  );
  vi.mocked(client.get).mockResolvedValue(makeResponse({ conversations: [] }));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AMINAH-TIMEOUT-P1 — axios timeout override for AI-path endpoints', () => {
  it('(1) AI_CHAT_TIMEOUT_MS is 120000 (2 minutes, well above observed 18–31s latency)', () => {
    expect(AI_CHAT_TIMEOUT_MS).toBe(120_000);
  });

  it('(2) DEFAULT_TIMEOUT_MS on the shared client is unchanged at 15000 (fail-fast for non-AI endpoints)', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(15_000);
  });

  it('(3) sendChatMessage (JSON path) posts to /api/ai/chat with timeout: 120000', async () => {
    await sendChatMessage({ message: 'hello', agent: 'aminah' });

    expect(client.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(client.post).mock.calls[0];
    expect(url).toBe('/api/ai/chat');
    expect(body).toMatchObject({ message: 'hello', agent: 'aminah' });
    expect(config).toBeDefined();
    expect(config.timeout).toBe(AI_CHAT_TIMEOUT_MS);
  });

  it('(4) sendChatMessage (multipart/file path) posts to /api/ai/chat with timeout: 120000 AND multipart headers', async () => {
    const fakeFile = new Blob(['hello'], { type: 'text/plain' });
    await sendChatMessage({ message: 'caption', agent: 'haseeb', file: fakeFile });

    expect(client.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(client.post).mock.calls[0];
    expect(url).toBe('/api/ai/chat');
    // FormData body — not a plain object.
    expect(body).toBeInstanceOf(FormData);
    expect(config).toBeDefined();
    expect(config.timeout).toBe(AI_CHAT_TIMEOUT_MS);
    expect(config.headers?.['Content-Type']).toBe('multipart/form-data');
  });

  it('(5) confirmPendingAction posts to /api/ai/confirm with timeout: 120000', async () => {
    await confirmPendingAction({ confirmationId: 'conf-123' });

    expect(client.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(client.post).mock.calls[0];
    expect(url).toBe('/api/ai/confirm');
    expect(body).toMatchObject({ action: 'confirm', confirmationId: 'conf-123' });
    expect(config).toBeDefined();
    expect(config.timeout).toBe(AI_CHAT_TIMEOUT_MS);
  });

  it('(6) confirmPendingAction legacy positional signature still gets the 120s timeout', async () => {
    await confirmPendingAction('conv-xyz', 'conf-456');

    expect(client.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(client.post).mock.calls[0];
    expect(url).toBe('/api/ai/confirm');
    expect(body).toMatchObject({ action: 'confirm', confirmationId: 'conf-456' });
    expect(config?.timeout).toBe(AI_CHAT_TIMEOUT_MS);
  });

  it('(7) non-AI endpoints (/api/conversations) use the shared-client default — no per-request timeout override', async () => {
    await listConversations();
    await getConversation('c-1');
    await getConversationMessages('c-1');

    // All three are GETs via the shared client; none should pass a
    // per-request config object that overrides timeout. The 15s
    // client-level default applies.
    const getCalls = vi.mocked(client.get).mock.calls;
    expect(getCalls.length).toBe(3);
    for (const call of getCalls) {
      const config = call[1];
      // Either undefined (no config) or present without timeout key.
      if (config !== undefined) {
        expect(config.timeout).toBeUndefined();
      }
    }
  });

  it('(8) sendChatMessage legacy positional signature still gets the 120s timeout', async () => {
    // Pre-Wave-3 callers used `sendChatMessage("text", convId)`.
    await sendChatMessage('hi', 'conv-legacy');

    expect(client.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(client.post).mock.calls[0];
    expect(url).toBe('/api/ai/chat');
    expect(body).toMatchObject({ message: 'hi', conversation_id: 'conv-legacy' });
    expect(config?.timeout).toBe(AI_CHAT_TIMEOUT_MS);
  });
});
