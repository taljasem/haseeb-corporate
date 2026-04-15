/**
 * Chat / Aminah API module.
 *
 * Wave 2 status: this module exists and is wired into the engine router,
 * but the default AminahChat UI in the dashboard still runs off the
 * streaming `runAminahSession` generator in `engine/aminah/stubBackend.js`,
 * which speaks a rich event protocol (tool.call_started, text_delta, etc.)
 * that POST /api/ai/chat does NOT emit. Adapting the streaming UI to a
 * single-shot HTTP response would be a deep refactor and is explicitly
 * out of scope for Wave 2 (see the smoke test "known limitations").
 *
 * Callers that want the non-streaming flow (e.g. ConversationalJEScreen
 * demo) can import `sendChatMessage` directly from here or from
 * `../engine` — the router will do the right thing for MOCK vs LIVE.
 */
import client from './client';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data) return response.data.data;
    return response.data;
  }
  return response?.data;
}

/**
 * Send a single chat message to Aminah. Returns `{ response, pendingAction?, conversationId }`.
 */
export async function sendChatMessage(text, conversationId) {
  const r = await client.post('/api/ai/chat', {
    message: text,
    ...(conversationId ? { conversationId } : {}),
  });
  const data = unwrap(r);
  // Normalize the response into a UI-friendly shape.
  return {
    response: data?.response || data?.message || '',
    pendingAction: data?.pendingAction || null,
    conversationId: data?.conversationId || conversationId || null,
    raw: data,
  };
}

/**
 * Confirm a previously proposed action (usually a pending journal entry).
 */
export async function confirmPendingAction(conversationId, actionId) {
  const r = await client.post('/api/ai/confirm', {
    conversationId,
    actionId,
  });
  return unwrap(r);
}

export async function listConversations() {
  const r = await client.get('/api/conversations');
  const data = unwrap(r);
  return data?.conversations || data || [];
}

export async function getConversation(id) {
  const r = await client.get(`/api/conversations/${encodeURIComponent(id)}`);
  return unwrap(r);
}
