/**
 * ConversationalJEScreen — the Haseeb recording surface.
 *
 * Wave 3 rebuild: this screen used to be a scripted three-exchange demo
 * (ExchangeOne/Two/Three and Junior variants) with a decorative input
 * bar. The scripted flow hard-coded amounts, used AccountPicker to
 * mock-select debit/credit, and posted a locally-constructed
 * JournalEntryCard to local state. Nothing talked to the backend.
 *
 * The permanent path wired here:
 *
 *   1. User types a natural-language description in the input bar.
 *   2. Frontend POSTs /api/ai/chat with agent='haseeb' (recording /
 *      write path). The backend compound-entry handler returns an
 *      assistant text reply plus, if intent matched, a
 *      `pendingJournalEntry` payload and a `confirmationId`.
 *   3. The assistant message renders as a chat bubble. If a pending
 *      entry is present, a JournalEntryCard renders inline after the
 *      last assistant message, adapted from the API pendingJournalEntry
 *      shape to the card's existing entry shape.
 *   4. User clicks Confirm → POST /api/ai/confirm with action=confirm.
 *      On success the response carries the created journalEntry
 *      (additive field on the bare envelope per the Wave 3 prep delta).
 *      We render a "Posted as JE-<entryNumber>" system message and
 *      dispatch `haseeb:journal-entry-posted` so JE lists can refresh.
 *   5. Edit → navigate to Manual JE with the draft pre-filled via
 *      SessionStorage. Discard → drop the pending action and add a
 *      system message to the thread.
 *
 * The visual design of the old scripted screen is preserved: message
 * bubbles, header, input bar appearance, empty state layout. Only the
 * interior logic is replaced with real state.
 *
 * Role-aware rendering: Owner / CFO / Junior all run through the same
 * live chat flow in Wave 3. Role-specific UI divergence (Junior
 * threshold → CFO approval routing) is a server-side pending-approval
 * concern and is not in Wave 3 scope — the backend does not yet emit a
 * distinct "pending CFO approval" payload, and the old Junior scripted
 * flow was a demo of that future state.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, AlertCircle } from "lucide-react";
import DirArrow from "../../components/shared/DirArrow";
import JournalEntryCard from "../../components/cfo/JournalEntryCard";
import { sendChatMessage, confirmPendingAction, getConversationMessages } from "../../engine";

// ─────────────────────────────────────────
// Visual primitives (preserved from the Wave 2 scripted screen).
// ─────────────────────────────────────────

function UserBubble({ children }) {
  return (
    <div data-bubble="user" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
      <div
        style={{
          maxWidth: "78%",
          background: "rgba(0,196,140,0.12)",
          border: "1px solid rgba(0,196,140,0.20)",
          borderRadius: 12,
          borderBottomRightRadius: 4,
          padding: "10px 14px",
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--text-primary)",
          whiteSpace: "pre-wrap",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function AminahBubble({ children, wide = false, isError = false }) {
  return (
    <div data-bubble="aminah" style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
      <div
        style={{
          maxWidth: wide ? "100%" : "88%",
          width: wide ? "100%" : "auto",
          background: isError ? "var(--semantic-danger-subtle)" : "var(--bg-surface-sunken)",
          border: `1px solid ${isError ? "rgba(255,90,95,0.30)" : "var(--border-default)"}`,
          borderRadius: 12,
          borderBottomLeftRadius: 4,
          padding: "12px 14px",
          fontSize: 13,
          lineHeight: 1.6,
          color: isError ? "var(--semantic-danger)" : "var(--text-secondary)",
          whiteSpace: "pre-wrap",
          display: "flex",
          gap: isError ? 8 : 0,
          alignItems: "flex-start",
        }}
      >
        {isError && <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />}
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

function ThinkingBubble({ label }) {
  return (
    <div data-bubble="thinking" style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
      <div
        style={{
          background: "var(--bg-surface-sunken)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          borderBottomLeftRadius: 4,
          padding: "10px 14px",
          fontSize: 12,
          color: "var(--text-tertiary)",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
        {label}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Shape adapter: pendingJournalEntry → JournalEntryCard entry
// ─────────────────────────────────────────
//
// The API returns (see wave-3-write-contract.md §1.2 and the compound
// entry handler):
//   { date, description, lines: [{accountCode, accountName, debit, credit, label?}] }
//
// JournalEntryCard expects (see src/components/cfo/JournalEntryCard.jsx
// around lines 99, 219, 275):
//   { id, description, status, lines: [{account, code, debit, credit}],
//     totalDebit, totalCredit, balanced, mappingVersion, createdAt,
//     hashChainStatus }
//
// Notes:
//   - The card renders a line's debit/credit as "—" when null (not 0),
//     so we only keep the non-zero side.
//   - `balanced` is derived by the card from `lines.every(l => l.account != null)`.
//     We always set `account`, so the card will consider the entry balanced
//     as long as the API returned accountName on every line.
//   - `id` is a placeholder — we don't have an entry number until after
//     POST /api/ai/confirm succeeds.
//
function pendingToCardEntry(pending, fallbackId = "DRAFT") {
  if (!pending) return null;
  const lines = Array.isArray(pending.lines) ? pending.lines : [];
  const mapped = lines.map((l) => {
    const debit = Number(l.debit || 0);
    const credit = Number(l.credit || 0);
    return {
      account: l.accountName || l.account || null,
      code: l.accountCode || l.code || "",
      debit: debit > 0 ? debit : null,
      credit: credit > 0 ? credit : null,
      memo: l.label || l.description || "",
    };
  });
  const totalDebit = mapped.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = mapped.reduce((s, l) => s + (l.credit || 0), 0);
  // HASEEB-309 (V2 lower-pri L3, 2026-04-23) — suppress empty-card
  // render during clarification turns where the backend sent a
  // partial pendingJournalEntry whose lines all resolved to null
  // debit/credit. Rendering the card with "KWD 0.000" totals on
  // both sides was confusing users mid-clarification; the chat
  // bubble carries the question they actually need to answer.
  if (totalDebit === 0 && totalCredit === 0 && mapped.every((l) => !l.account)) {
    return null;
  }
  return {
    id: fallbackId,
    description: pending.description || "",
    status: "Draft - Validated",
    lines: mapped,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.001 && mapped.every((l) => l.account != null),
    mappingVersion: "live",
    createdAt: pending.date || new Date().toISOString(),
    hashChainStatus: "ready",
    _raw: pending,
  };
}

// ─────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
export default function ConversationalJEScreen({ role = "CFO", onNavigate }) {
  const { t } = useTranslation("conv-je");

  // Chat state
  // messages = [{ id, role: 'user'|'assistant'|'system'|'error', text, ts, pendingAction?, confirmationId? }]
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  // activePendingAction holds the card payload the user is currently
  // being asked to confirm. It's always the last assistant message's
  // pendingJournalEntry; we lift it out so the card renders once at
  // the bottom of the thread rather than being embedded in every
  // historical message.
  const [activePendingAction, setActivePendingAction] = useState(null);
  const [activeConfirmationId, setActiveConfirmationId] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  // HASEEB-282 (2026-04-22, hallucination stopgap): carries the server's
  // `buildError` envelope when the backend refused to surface a
  // confirmable entry because the LLM emitted account codes not on the
  // tenant's COA. Drives the red BUILD FAILED pill on the card and
  // suppresses the Confirm button. Cleared the next time a successful
  // pending action arrives or the user discards.
  const [activeBuildError, setActiveBuildError] = useState(null);
  // HASEEB-292 Phase 1 task 1.10: PendingJournalEntryStatus from the
  // backend (task 1.9). Drives the 6-state pill variant on the card.
  // Preferred over activeBuildError when both are present (buildStatus
  // is the unified shape; buildError is the legacy V1 stopgap).
  const [activeBuildStatus, setActiveBuildStatus] = useState(null);

  const scrollRef = useRef(null);

  // ─── Hydrate from ?conversation=<id> ──────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("conversation");
    if (!cid) return;
    let cancelled = false;
    (async () => {
      try {
        const history = await getConversationMessages(cid);
        if (cancelled) return;
        setConversationId(cid);
        setMessages(
          (history || []).map((m, i) => ({
            id: m.id || `hist-${i}`,
            role: m.role === "user" ? "user" : "assistant",
            text: m.content || m.message || m.text || "",
            ts: m.createdAt || m.timestamp || new Date().toISOString(),
          }))
        );
      } catch {
        /* swallow: empty thread falls through to the empty state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Auto-scroll on new messages ─────────────────────────────────
  // HASEEB-309 (V2 lower-pri L5, 2026-04-23) — wrap in rAF so the
  // scroll read happens AFTER the DOM has flushed the new card /
  // bubble height. Prior version read scrollHeight synchronously
  // and sometimes missed buildStatus-only updates that lay beneath
  // the fold. Also depend on activeBuildStatus / isConfirming so
  // status-only transitions (e.g. requires_clarification → awaiting
  // answer) re-fire the effect.
  useEffect(() => {
    if (!scrollRef.current) return;
    const id = window.requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [messages, activePendingAction, isThinking, activeBuildStatus, isConfirming]);

  // ─── Send a user message ─────────────────────────────────────────
  const handleSubmit = async (forcedText) => {
    const text = (forcedText != null ? forcedText : input).trim();
    if (!text || isThinking) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
      ts: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    try {
      const response = await sendChatMessage({
        message: text,
        agent: "haseeb",
        conversationId,
      });

      // Capture conversationId for subsequent sends.
      if (response.conversationId) {
        setConversationId(response.conversationId);
      }

      // Append assistant message.
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: response.message || "",
          ts: new Date().toISOString(),
        },
      ]);

      // HASEEB-292 Phase 1 task 1.10 — buildStatus is now the
      // authoritative state signal (task 1.9 backend emission).
      // When present, replace the legacy HASEEB-282 buildError
      // stopgap. Server guarantees requiresConfirmation=false on
      // any state where Confirm should be disabled, so we mirror
      // that into activeConfirmationId handling.
      const rejected =
        response.pendingJournalEntry ||
        (response.action && response.action.type === "confirm_transaction"
          ? response.action.data
          : null);

      if (response.buildStatus) {
        setActiveBuildStatus(response.buildStatus);
        setActivePendingAction(rejected || null);
        setActiveConfirmationId(
          response.buildStatus.requiresConfirmation ? response.confirmationId || null : null,
        );
        // Keep legacy buildError cleared — server drives the state.
        setActiveBuildError(null);
      } else if (response.buildError) {
        // Legacy V1 stopgap path — no buildStatus emitted.
        setActiveBuildError(response.buildError);
        setActivePendingAction(rejected || null);
        setActiveConfirmationId(null);
        setActiveBuildStatus(null);
      } else if (rejected) {
        // Legacy success path without buildStatus (older backend).
        setActivePendingAction(rejected);
        setActiveConfirmationId(response.confirmationId || null);
        setActiveBuildError(null);
        setActiveBuildStatus(null);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "error",
          text:
            err?.code === "NETWORK_ERROR"
              ? t("live.error_network")
              : err?.message || t("live.error_generic"),
          ts: new Date().toISOString(),
          retryText: text,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  // ─── Confirm the active pending action ───────────────────────────
  const handleConfirm = async () => {
    if (!activeConfirmationId || isConfirming) return;
    setIsConfirming(true);
    try {
      const response = await confirmPendingAction({
        conversationId,
        confirmationId: activeConfirmationId,
        action: "confirm",
        agent: "haseeb",
      });

      // Pull the created entry out of the additive `journalEntry`
      // field on the bare envelope.
      const created = response.journalEntry;
      const idLabel = created?.entryNumber
        ? `JE-${String(created.entryNumber).padStart(4, "0")}`
        : created?.id || null;

      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: "system",
          text: idLabel
            ? t("live.posted_as", { id: idLabel })
            : response.message || t("live.posted_generic"),
          ts: new Date().toISOString(),
        },
      ]);
      setActivePendingAction(null);
      setActiveConfirmationId(null);
      setActiveBuildError(null);
      setActiveBuildStatus(null);

      // Fire a global event so JE lists can refresh. ManualJEScreen
      // and any other wired surfaces can listen for this.
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(
            new CustomEvent("haseeb:journal-entry-posted", {
              detail: { entry: created, source: "conversational-je" },
            })
          );
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "error",
          text: err?.message || t("live.error_generic"),
          ts: new Date().toISOString(),
        },
      ]);
      // Keep the activePendingAction so the user can retry.
    } finally {
      setIsConfirming(false);
    }
  };

  // ─── HASEEB-307 (V2 bugfix Failure 2a, 2026-04-23) — inline-edit save.
  // JournalEntryCard toggles to edit mode locally and calls this on save.
  // POST /api/ai/confirm with action='amend' + newData → backend
  // validates (balance + CoA existence) + updates pendingAction in
  // place, returns a fresh confirmationId + the updated draft. We
  // rehydrate the on-screen pending state from the response. On
  // validation failure the backend surfaces buildStatus.state =
  // 'validation_failed' — frontend shows a chat message and keeps
  // the draft unchanged; user can try again.
  const handleSaveEdit = async (newData) => {
    if (!activeConfirmationId) return;
    try {
      const response = await confirmPendingAction({
        conversationId,
        confirmationId: activeConfirmationId,
        action: "amend",
        agent: "haseeb",
        newData,
      });
      // Amend-failure path: backend returned buildStatus validation_failed.
      if (response.buildStatus?.state === "validation_failed") {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "error",
            text: response.message || t("live.error_generic"),
            ts: new Date().toISOString(),
          },
        ]);
        // Keep the prior pending state as-is; edit didn't save.
        return;
      }
      // Amend-success path: replace pending state with the new draft.
      if (response.pendingJournalEntry) {
        setActivePendingAction(response.pendingJournalEntry);
        setActiveConfirmationId(response.confirmationId || null);
        setActiveBuildStatus(response.buildStatus || null);
        setActiveBuildError(null);
      }
      if (response.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: "system",
            text: response.message,
            ts: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "error",
          text: err?.message || t("live.error_generic"),
          ts: new Date().toISOString(),
        },
      ]);
    }
  };

  // ─── Edit the draft in the Manual JE composer (legacy V1 flow) ─────
  const handleEdit = () => {
    if (!activePendingAction || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        "haseeb:manual-je-prefill",
        JSON.stringify({
          draft: activePendingAction,
          confirmationId: activeConfirmationId,
          conversationId,
          from: "conversational-je",
          ts: Date.now(),
        })
      );
    } catch {
      /* ignore storage errors */
    }
    // Also cancel server-side so the confirmation token is released.
    if (activeConfirmationId) {
      confirmPendingAction({
        conversationId,
        confirmationId: activeConfirmationId,
        action: "edit",
        agent: "haseeb",
      }).catch(() => {});
    }
    onNavigate && onNavigate("manual-je");
  };

  // ─── Discard the draft ───────────────────────────────────────────
  const handleDiscard = async () => {
    if (!activePendingAction) return;
    // Best-effort server-side cancel so the confirmation token is
    // released — ignore failures, the client state is authoritative
    // for UX.
    if (activeConfirmationId) {
      try {
        await confirmPendingAction({
          conversationId,
          confirmationId: activeConfirmationId,
          action: "cancel",
          agent: "haseeb",
        });
      } catch {
        /* ignore */
      }
    }
    setActivePendingAction(null);
    setActiveConfirmationId(null);
    setActiveBuildError(null);
    setActiveBuildStatus(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        role: "system",
        text: t("live.discarded"),
        ts: new Date().toISOString(),
      },
    ]);
  };

  // ─── Retry a failed send ─────────────────────────────────────────
  const handleRetry = (text) => {
    if (!text) return;
    // Strip the last error from the thread before retrying so the user
    // isn't stuck looking at a stale error.
    setMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => m.role === "error");
      if (idx === -1) return prev;
      const cut = prev.length - 1 - idx;
      return prev.slice(0, cut);
    });
    handleSubmit(text);
  };

  const cardEntry = useMemo(
    () => pendingToCardEntry(activePendingAction),
    [activePendingAction]
  );

  const isEmpty = messages.length === 0 && !isThinking && !activePendingAction;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "20px 28px 14px",
          borderBottom: "1px solid var(--border-default)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.15em",
            color: "var(--text-tertiary)",
            marginBottom: 4,
          }}
        >
          {t("header.label")}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>
          {t("header.sub")}
        </div>
      </div>

      {/* Scrollable chat area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 28px" }}>
          {isEmpty ? (
            <EmptyState
              onPick={(example) => handleSubmit(example)}
              t={t}
            />
          ) : (
            messages.map((m) => {
              if (m.role === "user") return <UserBubble key={m.id}>{m.text}</UserBubble>;
              if (m.role === "error") {
                return (
                  <AminahBubble key={m.id} isError>
                    <div>{m.text}</div>
                    {m.retryText && (
                      <button
                        type="button"
                        onClick={() => handleRetry(m.retryText)}
                        style={{
                          marginTop: 6,
                          background: "transparent",
                          border: "1px solid rgba(255,90,95,0.40)",
                          color: "var(--semantic-danger)",
                          padding: "4px 10px",
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {t("live.retry")}
                      </button>
                    )}
                  </AminahBubble>
                );
              }
              if (m.role === "system") {
                return (
                  <div
                    key={m.id}
                    style={{
                      textAlign: "center",
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      fontStyle: "italic",
                      margin: "12px 0",
                    }}
                  >
                    {m.text}
                  </div>
                );
              }
              return <AminahBubble key={m.id}>{m.text}</AminahBubble>;
            })
          )}

          {isThinking && <ThinkingBubble label={t("live.thinking")} />}

          {cardEntry && (
            <div style={{ maxWidth: "100%" }}>
              {/* HASEEB-292 Phase 1 task 1.10 — server-driven 6-state
                  card per PendingJournalEntryStatus. Precedence:
                  activeBuildStatus (V2 wire shape) →
                  activeBuildError (V1 stopgap, renders build-failed) →
                  legacy default (draft-validated). */}
              <JournalEntryCard
                entry={cardEntry}
                state={
                  activeBuildStatus?.state
                    ? activeBuildStatus.state
                    : activeBuildError
                    ? "build-failed"
                    : "draft-validated"
                }
                onConfirm={handleConfirm}
                onEdit={handleEdit}
                onDiscard={handleDiscard}
                onSaveEdit={handleSaveEdit}
              />
              {!activeBuildError &&
                (!activeBuildStatus || activeBuildStatus.requiresConfirmation) && (
                  <AminahBubble>{t("live.review_and_confirm")}</AminahBubble>
                )}
              {isConfirming && <ThinkingBubble label={t("live.thinking")} />}
            </div>
          )}
        </div>
      </div>

      {/* Functional input bar */}
      <div
        style={{
          padding: "14px 28px 18px",
          borderTop: "1px solid var(--border-default)",
          flexShrink: 0,
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative" }}>
          <input
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={t("input_placeholder")}
            disabled={isThinking}
            aria-label={t("input_placeholder")}
            style={{
              width: "100%",
              background: "var(--bg-surface-sunken)",
              border: "1px solid var(--border-default)",
              borderRadius: 10,
              padding: "14px 50px 14px 16px",
              color: "var(--text-primary)",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <button
            type="button"
            className="send-btn"
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isThinking}
            aria-label="Send"
            style={{
              position: "absolute",
              insetInlineEnd: 7,
              top: "50%",
              transform: "translateY(-50%)",
              width: 34,
              height: 34,
              background: input.trim() && !isThinking ? "var(--accent-primary)" : "var(--border-subtle)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              cursor: input.trim() && !isThinking ? "pointer" : "not-allowed",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <DirArrow />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Empty state with 3 clickable example prompts
// ─────────────────────────────────────────

function EmptyState({ onPick, t }) {
  const examples = [t("empty.example_1"), t("empty.example_2"), t("empty.example_3")];
  return (
    <div style={{ padding: "40px 0 20px", textAlign: "center" }}>
      <div
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 28,
          color: "var(--text-primary)",
          letterSpacing: "-0.3px",
          marginBottom: 8,
        }}
      >
        {t("empty.title")}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-tertiary)",
          marginBottom: 24,
          lineHeight: 1.55,
          maxWidth: 520,
          marginInline: "auto",
        }}
      >
        {t("empty.subtitle")}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "stretch",
          maxWidth: 480,
          marginInline: "auto",
        }}
      >
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => onPick(ex)}
            style={{
              textAlign: "start",
              padding: "12px 16px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 10,
              color: "var(--text-secondary)",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
              lineHeight: 1.5,
            }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
