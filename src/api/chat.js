/**
 * Chat / Aminah API module.
 *
 * Wave 3: this module is now the single authoritative wrapper around
 * POST /api/ai/chat and POST /api/ai/confirm. The dashboard's rich chat
 * UIs (AminahChat, AminahSlideOver, ConversationalJEScreen) no longer
 * speak to the stub backend directly in LIVE mode — they consume an
 * event-protocol generator from `chat-adapter.js` that in turn calls
 * `sendChatMessage` here.
 *
 * Contract reference: memory-bank/wave-3-write-contract.md §1.
 *
 *   • Request body key is `message` (NOT `text`).
 *   • `agent: 'aminah'` = advisor/read-only. Server strips any
 *     `pendingJournalEntry` / `confirm_transaction` payload so the
 *     advisor surfaces never see a write-confirmation prompt.
 *   • `agent: 'haseeb'` = recording/write path. Confirmation prompts flow
 *     through in the response.
 *   • Response is a BARE envelope (not wrapped in `{ success, data }`).
 *     Unique to /api/ai/chat and /api/ai/confirm; every other endpoint
 *     still uses the standard envelope.
 *   • Conversation persistence is server-side automatic via
 *     conversationService.upsert — the client just echoes back the
 *     `conversationId` from the previous response.
 */
import client from './client';

/**
 * Per-request timeout for the Aminah LLM endpoints (ms).
 *
 * Rationale: post-token-trim latency measurements (2026-04-22,
 * `memory-bank/2026-04-22-aminah-latency-post-trim.md`) show median 18s
 * and a worst-case 31s for a 10-step tool loop on a live demo-tenant.
 * The shared axios client's default `DEFAULT_TIMEOUT_MS` (15s in
 * `src/api/client.js`) would abort the request mid-flight while the
 * backend is still delivering a correct response — the user sees a
 * NETWORK_ERROR despite Aminah answering.
 *
 * 120s gives headroom above the observed worst-case with room for a
 * cold-start or a 2× tail event without false-aborting. This only
 * applies to `/api/ai/chat` and `/api/ai/confirm`; every other endpoint
 * — `/api/conversations/*` included — retains the 15s default so
 * database-read slowness still surfaces quickly.
 *
 * Not a retry controller. This is a single-attempt ceiling. Retry logic
 * is a separate concern handled by the backend cascade.
 */
export const AI_CHAT_TIMEOUT_MS = 120000;

function unwrap(response) {
  // /api/ai/chat returns a bare envelope (not { success, data, ... }).
  // We still tolerate the wrapped form defensively so the same unwrap
  // works for /api/conversations which uses the standard envelope.
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data && 'success' in response.data) {
      return response.data.data;
    }
    return response.data;
  }
  return response?.data;
}

/**
 * Send a single chat message. New Wave 3 signature:
 *
 *   sendChatMessage({ message, agent, conversationId, file })
 *
 * Returns the bare response envelope:
 *   {
 *     message,          // assistant text reply
 *     language,         // 'en' | 'ar'
 *     conversationId,   // always present
 *     action?,          // { type, data, buttons? } — only for write path
 *     pendingJournalEntry?, // mirror of action.data for confirm_transaction
 *     confirmationId?,  // echo back to /api/ai/confirm
 *     metadata?,        // report attachment, etc.
 *     raw,              // the raw unwrapped body, for belt-and-braces access
 *   }
 *
 * Backwards-compatible: a first positional string argument is treated
 * as the message text. Existing call sites that used
 * `sendChatMessage("hello", convId)` keep working; new call sites should
 * use the named-options form.
 */
export async function sendChatMessage(messageOrOptions, legacyConversationId) {
  let message;
  let agent = 'haseeb';
  let conversationId;
  let file;

  if (typeof messageOrOptions === 'string') {
    message = messageOrOptions;
    conversationId = legacyConversationId;
  } else if (messageOrOptions && typeof messageOrOptions === 'object') {
    message = messageOrOptions.message;
    agent = messageOrOptions.agent || 'haseeb';
    conversationId = messageOrOptions.conversationId;
    file = messageOrOptions.file;
  }

  let r;
  if (file) {
    // Multipart path for receipt/statement attachments. Field name is
    // `file` per ai.routes.ts:84 (multer single-file upload).
    const form = new FormData();
    if (message) form.append('message', message);
    form.append('agent', agent);
    if (conversationId) form.append('conversation_id', conversationId);
    form.append('file', file);
    r = await client.post('/api/ai/chat', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: AI_CHAT_TIMEOUT_MS,
    });
  } else {
    r = await client.post(
      '/api/ai/chat',
      {
        message,
        agent,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      },
      { timeout: AI_CHAT_TIMEOUT_MS },
    );
  }

  const data = unwrap(r);

  return {
    message: data?.message || '',
    language: data?.language || 'en',
    conversationId: data?.conversationId || conversationId || null,
    action: data?.action || null,
    pendingJournalEntry: data?.pendingJournalEntry || null,
    pendingInvoice: data?.pendingInvoice || null,
    confirmationId: data?.confirmationId || null,
    metadata: data?.metadata || null,
    tool_uses: data?.tool_uses || data?.toolUses || null,
    raw: data,
  };
}

/**
 * Confirm / cancel / edit a pending action. Wave 3 signature:
 *
 *   confirmPendingAction({ conversationId, confirmationId, action, agent })
 *
 * action ∈ 'confirm' | 'cancel' | 'edit'
 *
 * Returns the bare envelope:
 *   { message, language, success, journalEntry?, ruleSuggestion? }
 *
 * `journalEntry` is additive: present on the success path when a JE was
 * posted (see backend prep commits f11e238). `ruleSuggestion` is
 * optional and nullable.
 *
 * Backwards-compatible: positional `(conversationId, actionId)` still
 * works and maps to `action: 'confirm'`.
 */
export async function confirmPendingAction(optionsOrConversationId, legacyActionId) {
  let payload;
  if (typeof optionsOrConversationId === 'string') {
    payload = {
      action: 'confirm',
      confirmationId: legacyActionId,
    };
  } else {
    const {
      confirmationId,
      action = 'confirm',
      agent = 'haseeb',
    } = optionsOrConversationId || {};
    payload = { action, confirmationId, agent };
  }

  const r = await client.post('/api/ai/confirm', payload, {
    timeout: AI_CHAT_TIMEOUT_MS,
  });
  const data = unwrap(r);
  return {
    message: data?.message || '',
    language: data?.language || 'en',
    success: data?.success !== false,
    journalEntry: data?.journalEntry || null,
    ruleSuggestion: data?.ruleSuggestion || null,
    raw: data,
  };
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

/**
 * Hydrate the message history for a conversation.
 * Used by ConversationalJEScreen when loading ?conversation=<id>.
 * Returns the adapted message array or [] on 404.
 */
export async function getConversationMessages(id) {
  try {
    const r = await client.get(`/api/conversations/${encodeURIComponent(id)}/messages`);
    const data = unwrap(r);
    return Array.isArray(data) ? data : data?.messages || [];
  } catch (err) {
    if (err?.status === 404) return [];
    throw err;
  }
}
