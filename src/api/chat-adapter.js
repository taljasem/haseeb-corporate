/**
 * Single-shot chat API → block-event generator shim.
 *
 * The dashboard's Aminah chat UIs (AminahChat, AminahSlideOver) consume
 * a rich block-event protocol that was originally emitted by the
 * scripted `runAminahSession` generator in `engine/aminah/stubBackend.js`:
 *
 *     for await (const event of runAminahSession(...)) { applyEvent(...) }
 *
 *     event types: 'session.start' | 'status.update' |
 *                  'message.block_added' | 'message.text_delta' |
 *                  'tool.call_started' | 'tool.call_completed' |
 *                  'message.complete' | 'error'
 *
 * The Corporate API at POST /api/ai/chat returns a single-shot JSON
 * response (see memory-bank/wave-3-write-contract.md §1.2). Instead of
 * rewriting the UI to consume a single-shot response, we wrap the
 * response into a synchronous-yielding async generator that produces
 * the same event sequence the UI expects.
 *
 * This is a reference pattern for future agent surfaces: keep the UI's
 * event protocol stable; put the adapter at the API boundary.
 */
import { sendChatMessage } from './chat';

/**
 * runLiveChatSession — drop-in replacement for the stub `runAminahSession`
 * when in LIVE mode. Signature matches the stub so callers can swap via
 * the engine router without touching the `for await` loop.
 *
 *   runLiveChatSession(sessionId, userMessage, context)
 *
 * `context` is an object that may carry:
 *   - role:         'Owner' | 'CFO' | 'Junior'   (informational only)
 *   - agent:        'aminah' | 'haseeb'          (defaults to 'aminah'
 *                                                 for read-only advisor)
 *   - conversationId: echoed back to the server to continue a thread
 *   - file:         File object for multipart upload (optional)
 *
 * `sessionId` is kept for signature compat but the server-side
 * `conversation_id` is the authoritative thread key. Callers that need
 * to read it back should look for `message.complete.conversationId`.
 */
export async function* runLiveChatSession(sessionId, userMessage, context = {}) {
  const msgId = `msg-${Date.now()}`;
  yield { type: 'session.start', sessionId, messageId: msgId };

  // Kick off the status indicator so the UI shows "thinking" immediately,
  // before the HTTP round-trip completes.
  yield {
    type: 'status.update',
    label: context.thinkingLabel || 'Thinking...',
    icon: 'search',
    messageId: msgId,
  };

  let response;
  try {
    response = await sendChatMessage({
      message: userMessage,
      agent: context.agent || 'aminah',
      conversationId: context.conversationId || null,
      file: context.file || null,
    });
  } catch (err) {
    // Normalise to an error event so the UI can render a retry affordance.
    yield {
      type: 'error',
      code: err?.code || 'UNKNOWN',
      message:
        err?.code === 'NETWORK_ERROR'
          ? "I couldn't reach the server. Check your connection and try again."
          : err?.message || 'Something went wrong.',
      messageId: msgId,
    };
    // Still mark the assistant message as complete so the UI doesn't
    // hang on the spinner.
    yield { type: 'message.complete', messageId: msgId };
    return;
  }

  // Surface tool calls before the final text, if the backend included
  // any. The orchestrator doesn't currently stream these, but the bare
  // envelope may carry a `tool_uses` field for observability.
  if (Array.isArray(response.tool_uses)) {
    for (const tc of response.tool_uses) {
      const callId = tc.id || `call-${Math.random().toString(36).slice(2, 8)}`;
      yield {
        type: 'tool.call_started',
        toolName: tc.name || tc.toolName || 'tool',
        toolInput: tc.input || tc.arguments || null,
        callId,
        messageId: msgId,
      };
      yield {
        type: 'tool.call_completed',
        callId,
        result: tc.result || tc.output || null,
        messageId: msgId,
      };
    }
  }

  // Seed an empty text block, then a single text_delta with the full
  // message. This matches the stub protocol — the UI concatenates
  // deltas into the last text block.
  yield {
    type: 'message.block_added',
    block: { type: 'text', text: '' },
    messageId: msgId,
  };
  if (response.message) {
    yield {
      type: 'message.text_delta',
      textDelta: response.message,
      messageId: msgId,
    };
  }

  // Write-path confirmation payload: advisor mode should never see this
  // because the server strips it for agent=aminah, but we defensively
  // only surface it if the caller explicitly opted into the recording
  // agent AND asked to receive action events.
  if (
    context.agent === 'haseeb' &&
    context.emitAction &&
    (response.action || response.pendingJournalEntry)
  ) {
    yield {
      type: 'action',
      action: response.action || {
        type: 'confirm_transaction',
        data: response.pendingJournalEntry,
      },
      confirmationId: response.confirmationId || null,
      messageId: msgId,
    };
  }

  yield {
    type: 'message.complete',
    messageId: msgId,
    conversationId: response.conversationId || null,
    raw: response.raw,
  };
}
