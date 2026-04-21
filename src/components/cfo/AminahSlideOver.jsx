import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Send, Square, Sparkles, ChevronDown, ChevronRight, Loader2, CheckCircle2, AlertCircle, Ban } from "lucide-react";
import ActionButton from "../ds/ActionButton";
import SuspendRecurrenceModal from "./SuspendRecurrenceModal";
import { canEditAdmin, ROLES, normalizeRole } from "../../utils/role";
// Wave 3: runAminahSession comes from the engine router. MOCK mode
// uses the scripted stubBackend generator; LIVE mode uses the
// chat-adapter that wraps POST /api/ai/chat (agent='aminah', read-only)
// into the same block-event protocol. The for-await loop below is
// unchanged.
import { runAminahSession } from "../../engine";
import {
  createAminahSession,
  getAminahSession,
  listRecentAminahSessions,
  appendMessageToSession,
} from "../../engine/mockEngine";

function renderBold(text) {
  const parts = (text || "").split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      const inner = p.slice(2, -2);
      const isNum = /\d/.test(inner);
      return <span key={i} style={{ color: "var(--text-primary)", fontWeight: 600, fontFamily: isNum ? "'DM Mono', monospace" : "inherit" }}>{inner}</span>;
    }
    return <span key={i}>{p}</span>;
  });
}

export default function AminahSlideOver({ open, onClose, context = null, role = "CFO" }) {
  const { t } = useTranslation("aminah");
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  // Wave 3: server-side conversation id from POST /api/ai/chat.
  // Captured from message.complete events, echoed back on sends.
  const [conversationId, setConversationId] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);
  const streamRef = useRef(null);
  const autoScrollRef = useRef(true);
  const inputRef = useRef(null);

  // Load or create session when slide-over opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      const recent = await listRecentAminahSessions(role === "Owner" ? "owner" : role === "Junior" ? "junior" : "cfo");
      setRecentSessions(recent);
      if (recent.length > 0 && !context) {
        const sess = await getAminahSession(recent[0].id);
        if (sess) { setSessionId(sess.id); setMessages(sess.messages); return; }
      }
      await startNewSession();
    })();
  }, [open, role]);

  // Auto-send context message
  useEffect(() => {
    if (open && context && sessionId && messages.length === 0) {
      sendMessage(typeof context === "string" ? context : `Tell me about ${context}`);
    }
  }, [open, context, sessionId]);

  const startNewSession = async () => {
    const roleKey = role === "Owner" ? "owner" : role === "Junior" ? "junior" : "cfo";
    const sess = await createAminahSession(roleKey);
    setSessionId(sess.id);
    setMessages([]);
    setDraft("");
    // Reset server-side conversation id so the next send starts a
    // fresh thread.
    setConversationId(null);
  };

  const switchSession = async (sid) => {
    const sess = await getAminahSession(sid);
    if (sess) { setSessionId(sess.id); setMessages(sess.messages); }
  };

  // Auto-scroll
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;
  };

  const applyEvent = useCallback((msgId, event) => {
    setMessages((prev) => {
      const msgs = [...prev];
      const idx = msgs.findIndex((m) => m.id === msgId);
      if (idx < 0) return prev;
      const msg = { ...msgs[idx], blocks: [...msgs[idx].blocks] };
      msgs[idx] = msg;

      switch (event.type) {
        case "message.block_added":
          msg.blocks.push({ ...event.block });
          break;
        case "message.text_delta": {
          const lastBlock = msg.blocks[msg.blocks.length - 1];
          if (lastBlock && lastBlock.type === "text") {
            msg.blocks[msg.blocks.length - 1] = { ...lastBlock, text: lastBlock.text + event.textDelta };
          } else {
            msg.blocks.push({ type: "text", text: event.textDelta });
          }
          break;
        }
        case "status.update":
          msg.blocks.push({ type: "status", label: event.label, icon: event.icon });
          break;
        case "tool.call_started":
          msg.blocks.push({ type: "tool_call", toolName: event.toolName, toolInput: event.toolInput, callId: event.callId, status: "running" });
          break;
        case "tool.call_completed": {
          const tcIdx = msg.blocks.findIndex((b) => b.type === "tool_call" && b.callId === event.callId);
          if (tcIdx >= 0) {
            msg.blocks[tcIdx] = { ...msg.blocks[tcIdx], status: "complete", result: event.result };
          }
          break;
        }
        case "message.complete":
          msg.complete = true;
          break;
        case "error":
          // Wave 3: live-adapter error → inline error bubble.
          msg.blocks.push({
            type: "text",
            text: event.message || t("error.generic"),
            isError: true,
          });
          break;
        default:
          break;
      }
      return msgs;
    });
    if (event.type === "message.complete" && event.conversationId) {
      setConversationId(event.conversationId);
    }
  }, [t]);

  const sendMessage = async (text) => {
    if (!text.trim() || isStreaming || !sessionId) return;
    const userMsg = { id: `msg-u-${Date.now()}`, role: "user", blocks: [{ type: "text", text: text.trim() }], createdAt: new Date().toISOString(), complete: true };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setIsStreaming(true);
    autoScrollRef.current = true;

    const asstId = `msg-a-${Date.now()}`;
    const asstMsg = { id: asstId, role: "assistant", blocks: [], createdAt: new Date().toISOString(), complete: false };
    setMessages((prev) => [...prev, asstMsg]);

    try {
      const gen = runAminahSession(sessionId, text.trim(), {
        role,
        screen: "general",
        agent: "aminah",
        conversationId,
        thinkingLabel: t("subtitle_thinking"),
      });
      streamRef.current = gen;
      for await (const event of gen) {
        applyEvent(asstId, event);
        if (event.type === "message.complete") break;
      }
      await appendMessageToSession(sessionId, userMsg);
      // Get final assistant message from state
      setMessages((prev) => {
        const final = prev.find((m) => m.id === asstId);
        if (final) appendMessageToSession(sessionId, final);
        return prev;
      });
    } catch (err) {
      applyEvent(asstId, { type: "message.block_added", block: { type: "text", text: t("error.generic") } });
      applyEvent(asstId, { type: "message.complete" });
    } finally {
      setIsStreaming(false);
      streamRef.current = null;
    }
  };

  const stopStreaming = () => {
    if (streamRef.current) {
      streamRef.current.return();
      streamRef.current = null;
    }
    setIsStreaming(false);
    setMessages((prev) => prev.map((m) => m.complete ? m : { ...m, complete: true, blocks: [...m.blocks, { type: "text", text: t("stopped_suffix") }] }));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(draft);
    }
    if (e.key === "Escape") onClose();
  };

  if (!open) return null;

  const roleKey = role === "Owner" ? "owner" : role === "Junior" ? "junior" : "cfo";
  const examples = [t("empty_state.example_1"), t("empty_state.example_2"), t("empty_state.example_3")];
  const showEmpty = messages.length === 0 && !isStreaming;

  return (
    <>
      <div onClick={isStreaming ? undefined : onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 90 }} />
      <aside data-panel="aminah-slideover" style={{ position: "fixed", top: 52, insetInlineEnd: 0, bottom: 0, width: 440, maxWidth: "calc(100vw - 32px)", background: "var(--panel-bg)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderInlineStart: "1px solid var(--border-default)", zIndex: 100, display: "flex", flexDirection: "column", animation: "viewEnter 0.2s ease-out both" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} color="var(--accent-primary)" />
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: "var(--text-primary)", letterSpacing: "0.06em" }}>{t("label")}</span>
            <span style={{ fontSize: 9, color: isStreaming ? "var(--semantic-warning)" : "var(--accent-primary)", fontWeight: 600 }}>{isStreaming ? t("subtitle_thinking") : t("subtitle_online")}</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <ActionButton variant="tertiary" size="sm" icon={Plus} label={t("new_conversation")} onClick={startNewSession} disabled={isStreaming} />
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}><X size={16} /></button>
          </div>
        </div>

        {/* Session history strip */}
        {recentSessions.length > 1 && (
          <div style={{ display: "flex", gap: 6, padding: "8px 18px", borderBottom: "1px solid var(--border-subtle)", overflowX: "auto", flexShrink: 0 }}>
            {recentSessions.slice(0, 5).map((s) => (
              <button key={s.id} onClick={() => switchSession(s.id)} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 12, border: s.id === sessionId ? "1px solid rgba(0,196,140,0.3)" : "1px solid var(--border-default)", background: s.id === sessionId ? "rgba(0,196,140,0.08)" : "transparent", color: s.id === sessionId ? "var(--accent-primary)" : "var(--text-tertiary)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.preview || "New"}
              </button>
            ))}
          </div>
        )}

        {/* Messages area */}
        <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {showEmpty && (
            <div style={{ textAlign: "center", padding: "40px 0 20px" }}>
              <Sparkles size={28} color="var(--accent-primary)" style={{ opacity: 0.6, marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{t("empty_state.title")}</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 20, lineHeight: 1.5 }}>{t("empty_state.subtitle")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                {examples.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)} style={{ textAlign: "start", padding: "10px 14px", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", maxWidth: 320, width: "100%" }}>{q}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} t={t} role={role} />
          ))}
        </div>

        {/* Input area */}
        <div style={{ padding: "12px 18px 16px", borderTop: "1px solid var(--border-default)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("input.placeholder")}
              rows={1}
              disabled={isStreaming}
              style={{ flex: 1, background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "10px 14px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", minHeight: 40, maxHeight: 100 }}
            />
            {isStreaming ? (
              <button onClick={stopStreaming} style={{ background: "var(--semantic-danger)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center" }}><Square size={14} /></button>
            ) : (
              <button onClick={() => sendMessage(draft)} disabled={!draft.trim()} style={{ background: draft.trim() ? "var(--accent-primary)" : "var(--border-subtle)", color: draft.trim() ? "#fff" : "var(--text-tertiary)", border: "none", borderRadius: 8, padding: "10px 12px", cursor: draft.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center" }}><Send size={14} /></button>
            )}
          </div>
          <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 6, textAlign: "center" }}>{t("input.disclaimer")}</div>
        </div>
      </aside>
    </>
  );
}

function MessageBubble({ msg, t, role }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div style={{ maxWidth: isUser ? "80%" : "95%", minWidth: 0 }}>
        {isUser ? (
          <div style={{ background: "rgba(0,196,140,0.12)", border: "1px solid rgba(0,196,140,0.20)", borderRadius: 12, borderBottomRightRadius: 4, padding: "10px 14px", fontSize: 13, lineHeight: 1.55, color: "var(--text-primary)" }}>
            {msg.blocks?.[0]?.text || ""}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(msg.blocks || []).map((block, i) => (
              <BlockRenderer key={i} block={block} t={t} role={role} />
            ))}
            {!msg.complete && msg.blocks?.length === 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-tertiary)" }}>
                <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> {t("subtitle_thinking")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BlockRenderer({ block, t, role }) {
  const [expanded, setExpanded] = useState(false);

  if (block.type === "text") {
    return (
      <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
        {renderBold(block.text)}
      </div>
    );
  }

  if (block.type === "status") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--accent-primary)", padding: "4px 0" }}>
        <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
        {block.label}
      </div>
    );
  }

  if (block.type === "tool_call") {
    // Tier C-3 FOLLOW-UP (HASEEB-183): typed card for the
    // `get_missing_recurrences` read tool. Operator-usable surface
    // replaces the raw JSON blob for this specific tool — still falls
    // through to the generic collapsible renderer for every other tool.
    if (
      block.toolName === "get_missing_recurrences" &&
      block.status === "complete" &&
      Array.isArray(block.result?.items)
    ) {
      return <MissedRecurrencesCard block={block} role={role} t={t} />;
    }

    // Tier D Dispatch 3 FOLLOW-UP: typed card for the
    // `get_cross_tenant_recurrence_context` read tool. Privacy-gated
    // (>=3 tenants) aggregate context for a merchant name; backend
    // returns `thresholdMet:false` with zeros when below threshold,
    // and the card renders a neutral empty state in that case.
    if (
      block.toolName === "get_cross_tenant_recurrence_context" &&
      block.status === "complete" &&
      block.result &&
      typeof block.result === "object"
    ) {
      return <CrossTenantContextCard block={block} t={t} />;
    }
    const isComplete = block.status === "complete";
    return (
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 12px", fontSize: 11 }}>
        <button onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--text-secondary)", padding: 0 }}>
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text-tertiary)" }}>{block.toolName}</span>
          {isComplete ? (
            <CheckCircle2 size={11} color="var(--accent-primary)" />
          ) : block.status === "error" ? (
            <AlertCircle size={11} color="var(--semantic-danger)" />
          ) : (
            <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} color="var(--semantic-warning)" />
          )}
          <span style={{ fontSize: 9, color: isComplete ? "var(--accent-primary)" : "var(--semantic-warning)", fontWeight: 600 }}>
            {isComplete ? t("tool_call.status_complete") : block.status === "error" ? t("tool_call.status_error") : t("tool_call.status_running")}
          </span>
        </button>
        {expanded && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle)" }}>
            {block.toolInput && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-tertiary)" }}>{t("tool_call.input_header")}</div>
                <pre style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace", margin: "2px 0", whiteSpace: "pre-wrap" }}>{JSON.stringify(block.toolInput, null, 2)}</pre>
              </div>
            )}
            {block.result && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-tertiary)" }}>{t("tool_call.result_header")}</div>
                <pre style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "'DM Mono', monospace", margin: "2px 0", whiteSpace: "pre-wrap" }}>{JSON.stringify(block.result, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}

/**
 * MissedRecurrencesCard — typed renderer for Aminah's
 * `get_missing_recurrences` read tool (Tier C-3 FOLLOW-UP;
 * backend HASEEB-183 at `aff0764`, 2026-04-21).
 *
 * Replaces the generic collapsible JSON-blob tool_call renderer for this
 * one tool with an operator-usable card: per-row merchant + amount +
 * overdue-days pill + severity + Suspend button. Suspending opens the
 * SuspendRecurrenceModal; on success we mark the row Suspended locally
 * without re-fetching (the tool is read-only; the suspend action does
 * not re-run it).
 *
 * Role gate (midsize model): backend accepts OWNER or ACCOUNTANT, which
 * maps to Owner / CFO / Senior on the frontend. Junior is hidden. The
 * button therefore uses `canEditAdmin(role) || role === Owner`.
 *
 * Tier D Dispatch 2 extension (corporate-api `a8772c8`, 2026-04-22):
 * severity enum gained `'UNKNOWN'` for the FX-rate-unavailable path;
 * items now carry `nativeCurrency`, `nativeExpectedAmount`, `fxRateUsed`,
 * `fxRateDate`, `fxRateSource`. Non-KWD tenants with FX available render
 * a dual-amount stack (primary KWD + secondary native) + subordinate
 * FX-rate line. KWD-native tenants (`fxRateSource === 'none'`) render
 * a single KWD amount as before. UNKNOWN items render neutral (not a
 * severity colour) with a native-only amount and an "FX rate unavailable"
 * tag; they sort below LOW in the list.
 */

const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2, UNKNOWN: 3 };

function MissedRecurrencesCard({ block, role, t }) {
  const rawItems = Array.isArray(block.result?.items) ? block.result.items : [];
  const currencyNote = block.result?.currencyNote || "";
  const [suspended, setSuspended] = useState({}); // { [patternId]: true }
  const [modalOpen, setModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null); // { patternId, merchantName }

  const normalized = normalizeRole(role);
  const canSuspend = canEditAdmin(role) || normalized === ROLES.OWNER;

  // Severity-sorted copy. Stable-sort within a severity by severityScore
  // desc, then by merchant name for deterministic test output.
  const items = [...rawItems].sort((a, b) => {
    const sa = SEVERITY_ORDER[String(a.severity || "").toUpperCase()] ?? 99;
    const sb = SEVERITY_ORDER[String(b.severity || "").toUpperCase()] ?? 99;
    if (sa !== sb) return sa - sb;
    const scoreDiff = (b.severityScore ?? 0) - (a.severityScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return String(a.merchantNormalizedName || "").localeCompare(
      String(b.merchantNormalizedName || "")
    );
  });

  const openModal = (item) => {
    setActiveItem({
      patternId: item.patternId,
      merchantName: item.merchantNormalizedName,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setActiveItem(null);
  };

  const handleConfirmed = (patternId) => {
    setSuspended((prev) => ({ ...prev, [patternId]: true }));
  };

  // Severity → tokenised background + foreground colour. UNKNOWN uses a
  // muted neutral treatment (bordered surface chip) to avoid reading as
  // a severity hue — it means "we could not compute severity", not
  // "severity is low".
  const severityStyle = (sev) => {
    const s = String(sev || "").toUpperCase();
    if (s === "HIGH") {
      return {
        background: "var(--semantic-danger-subtle)",
        color: "var(--semantic-danger)",
        border: "none",
        label: t("missed_recurrences.severity.high"),
      };
    }
    if (s === "MEDIUM") {
      return {
        background: "var(--semantic-warning-subtle)",
        color: "var(--semantic-warning)",
        border: "none",
        label: t("missed_recurrences.severity.medium"),
      };
    }
    if (s === "UNKNOWN") {
      return {
        background: "var(--bg-surface)",
        color: "var(--text-secondary)",
        border: "1px solid var(--border-default)",
        label: t("missed_recurrences.severity.unknown"),
      };
    }
    return {
      background: "transparent",
      color: "var(--text-tertiary)",
      border: "none",
      label: t("missed_recurrences.severity.low"),
    };
  };

  // KWD-native detection (per spec §11): prefer `fxRateSource === 'none'`
  // as the authoritative signal; fall back to `nativeCurrency === 'KWD'`
  // if the backend omits fxRateSource.
  const isKwdNative = (item) => {
    if (item?.fxRateSource === "none") return true;
    if (!item?.fxRateSource && String(item?.nativeCurrency || "").toUpperCase() === "KWD") return true;
    return false;
  };

  // FX-rate source → bilingual label.
  const fxSourceLabel = (src) => {
    if (src === "exact") return t("missed_recurrences.fx_rate_source.exact");
    if (src === "fallback") return t("missed_recurrences.fx_rate_source.fallback");
    return "";
  };

  // Trim currencyNote to the first sentence for the footer.
  const noteShort = currencyNote
    ? currencyNote.split(/(?<=\.)\s/)[0]
    : "";

  return (
    <>
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 12,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <Sparkles size={12} color="var(--accent-primary)" />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: "var(--text-primary)",
            }}
          >
            {t("missed_recurrences.title")}
          </span>
          {items.length > 0 && (
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: "var(--text-tertiary)",
              }}
            >
              · {items.length}
            </span>
          )}
        </div>

        {/* Empty state — no items */}
        {items.length === 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--text-tertiary)",
              padding: "8px 0",
            }}
          >
            <CheckCircle2 size={12} color="var(--accent-primary)" />
            {t("missed_recurrences.empty")}
          </div>
        )}

        {/* Item list */}
        {items.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((item) => {
              const sev = severityStyle(item.severity);
              const isSuspended = !!suspended[item.patternId];
              const kwdNative = isKwdNative(item);
              const severityUpper = String(item.severity || "").toUpperCase();
              const isUnknown = severityUpper === "UNKNOWN";
              const nativeCurrency = String(item.nativeCurrency || "").toUpperCase();
              // Show secondary native amount only when non-KWD tenant AND
              // FX was available (exact or fallback). UNKNOWN severity
              // (fxRateSource='unavailable') falls through to the native-
              // only branch below — no secondary stack.
              const hasUsableFx =
                !kwdNative &&
                !isUnknown &&
                (item.fxRateSource === "exact" || item.fxRateSource === "fallback");
              return (
                <div
                  key={item.patternId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "var(--bg-surface-sunken)",
                    border: "1px solid var(--border-subtle)",
                    opacity: isSuspended ? 0.6 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textDecoration: isSuspended ? "line-through" : "none",
                      }}
                    >
                      {item.merchantNormalizedName}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 3,
                        flexWrap: "wrap",
                      }}
                    >
                      {/* Amount rendering — three cases:
                          (1) KWD-native or implicit KWD: single KWD amount.
                          (2) Non-KWD with usable FX: primary KWD + secondary native ≈ prefix.
                          (3) UNKNOWN (FX unavailable): native amount only with fx-unavailable tag;
                              no KWD equivalent is shown because backend returns null. */}
                      {isUnknown ? (
                        <>
                          {item.nativeExpectedAmount != null && (
                            <span
                              style={{
                                fontFamily: "'DM Mono', monospace",
                                fontSize: 11,
                                color: "var(--text-secondary)",
                              }}
                            >
                              {item.nativeExpectedAmount} {nativeCurrency || ""}
                            </span>
                          )}
                          <span
                            title={t("missed_recurrences.fx_unavailable_tooltip", {
                              currency: nativeCurrency || "—",
                            })}
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "2px 7px",
                              borderRadius: 10,
                              background: "var(--bg-surface)",
                              color: "var(--text-secondary)",
                              border: "1px solid var(--border-default)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t("missed_recurrences.fx_unavailable_badge")}
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 11,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {item.expectedAmountKwd} KWD
                          </span>
                          {hasUsableFx && item.nativeExpectedAmount != null && (
                            <span
                              style={{
                                fontFamily: "'DM Mono', monospace",
                                fontSize: 10,
                                color: "var(--text-tertiary)",
                              }}
                            >
                              {t("missed_recurrences.native_amount_prefix")}{" "}
                              {item.nativeExpectedAmount} {nativeCurrency}
                            </span>
                          )}
                        </>
                      )}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: 10,
                          background: sev.background,
                          color: sev.color,
                          border: sev.border,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {sev.label}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--text-tertiary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t("missed_recurrences.overdue_days", { count: item.daysOverdue })}
                      </span>
                      {isSuspended && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: 10,
                            background: "var(--bg-surface)",
                            color: "var(--text-tertiary)",
                            border: "1px solid var(--border-default)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t("missed_recurrences.suspended_badge")}
                        </span>
                      )}
                    </div>
                    {/* FX-rate subordinate line — only for non-KWD tenants
                        where FX was usable. Keeps the amount row light and
                        pushes rate/date/source into a small muted strip. */}
                    {hasUsableFx && item.fxRateUsed && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-tertiary)",
                          marginTop: 3,
                          fontFamily: "'DM Mono', monospace",
                        }}
                      >
                        {t("missed_recurrences.fx_rate_label")}: {item.fxRateUsed}{" "}
                        {nativeCurrency}/KWD
                        {item.fxRateDate ? ` · ${item.fxRateDate.slice(0, 10)}` : ""}
                        {fxSourceLabel(item.fxRateSource)
                          ? ` · ${fxSourceLabel(item.fxRateSource)}`
                          : ""}
                      </div>
                    )}
                  </div>
                  {canSuspend && (
                    <button
                      onClick={() => openModal(item)}
                      disabled={isSuspended}
                      aria-label={t("missed_recurrences.suspend_aria", {
                        merchant: item.merchantNormalizedName,
                      })}
                      title={t("missed_recurrences.suspend_action")}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--border-default)",
                        color: isSuspended
                          ? "var(--text-tertiary)"
                          : "var(--semantic-warning)",
                        borderRadius: 6,
                        padding: 6,
                        cursor: isSuspended ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginInlineStart: "auto",
                        flexShrink: 0,
                      }}
                    >
                      <Ban size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer — short currency note */}
        {noteShort && (
          <div
            style={{
              fontSize: 10,
              fontStyle: "italic",
              color: "var(--text-tertiary)",
              marginTop: 8,
              lineHeight: 1.4,
            }}
          >
            {noteShort}
          </div>
        )}
      </div>

      <SuspendRecurrenceModal
        open={modalOpen}
        patternId={activeItem?.patternId}
        merchantName={activeItem?.merchantName}
        onClose={closeModal}
        onConfirmed={handleConfirmed}
      />
    </>
  );
}

/**
 * CrossTenantContextCard — typed renderer for Aminah's
 * `get_cross_tenant_recurrence_context` read tool (Tier D Dispatch 3;
 * backend corporate-api `5a8d2df`, 2026-04-22).
 *
 * Privacy threshold: backend enforces a minimum of 3 distinct tenants
 * sharing a merchant before returning an aggregate. Below threshold it
 * returns `thresholdMet:false` with `distinctTenantCount:0` +
 * `medianExpectedAmountKwd:null`; this renderer shows a neutral
 * empty-state in that case.
 *
 * Read-only surface — no role gate beyond what gates the containing
 * slide-over (Owner / CFO / Senior / Junior all see the card when
 * Aminah chains this tool after a missed-recurrence card).
 *
 * Visual treatment: supplementary context card — slightly smaller than
 * MissedRecurrencesCard, `bg-surface-sunken` background to distinguish
 * from the action-card it typically follows.
 */
function CrossTenantContextCard({ block, t }) {
  const r = block.result || {};
  const thresholdMet = !!r.thresholdMet;
  const merchant = r.merchantNormalizedName || "—";
  const industry = r.industryBucket || "";
  const distinctCount =
    typeof r.distinctTenantCount === "number" ? r.distinctTenantCount : 0;
  const medianAmount = r.medianExpectedAmountKwd; // string|null
  const medianIntervalDays =
    typeof r.medianIntervalDays === "number" ? r.medianIntervalDays : null;
  const intervalClass = r.intervalClass; // weekly|monthly|...|null
  const note = r.note || "";
  const noteShort = note ? note.split(/(?<=\.)\s/)[0] : "";

  const intervalLabel = (() => {
    const valid = [
      "weekly",
      "monthly",
      "quarterly",
      "semi_annual",
      "annual",
      "other",
    ];
    if (intervalClass && valid.includes(intervalClass)) {
      return t(`cross_tenant_context.interval_class.${intervalClass}`);
    }
    if (medianIntervalDays != null) {
      return t("cross_tenant_context.interval_days_fallback", {
        count: medianIntervalDays,
      });
    }
    return null;
  })();

  // Below-threshold neutral state — muted surface, no primary colour.
  if (!thresholdMet) {
    return (
      <div
        style={{
          background: "var(--bg-surface-sunken)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 6,
          }}
        >
          <Sparkles size={12} color="var(--text-tertiary)" />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: "var(--text-secondary)",
            }}
          >
            {t("cross_tenant_context.title")}
            {merchant !== "—" ? ` · ${merchant}` : ""}
          </span>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 4,
          }}
        >
          {t("cross_tenant_context.below_threshold_title")}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-tertiary)",
            lineHeight: 1.5,
          }}
        >
          {t("cross_tenant_context.below_threshold_explanation")}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-surface-sunken)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 10,
        padding: "10px 12px",
        fontSize: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
        }}
      >
        <Sparkles size={12} color="var(--accent-primary)" />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "var(--text-primary)",
          }}
        >
          {t("cross_tenant_context.title")} · {merchant}
        </span>
      </div>

      {/* Tenant-count primary line */}
      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          marginBottom: 6,
        }}
      >
        {t("cross_tenant_context.tenant_count", {
          count: distinctCount,
          industry: industry || "—",
        })}
      </div>

      {/* Facts strip — median amount + typical interval */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginBottom: 6,
        }}
      >
        {medianAmount != null && (
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              {t("cross_tenant_context.median_amount_label")}
            </span>
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                color: "var(--text-primary)",
                fontWeight: 600,
              }}
            >
              {medianAmount} KWD
            </span>
          </div>
        )}
        {intervalLabel && (
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              {t("cross_tenant_context.typical_interval_label")}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-primary)",
                fontWeight: 600,
              }}
            >
              {intervalLabel}
            </span>
            {intervalClass &&
              medianIntervalDays != null &&
              intervalClass !== "other" && (
                <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                  ·{" "}
                  {t("cross_tenant_context.interval_days_fallback", {
                    count: medianIntervalDays,
                  })}
                </span>
              )}
          </div>
        )}
      </div>

      {/* Footer — short privacy/aggregation note from backend */}
      {noteShort && (
        <div
          style={{
            fontSize: 10,
            fontStyle: "italic",
            color: "var(--text-tertiary)",
            marginTop: 6,
            lineHeight: 1.4,
          }}
        >
          {noteShort}
        </div>
      )}
    </div>
  );
}

// Named exports for test harness. These are internal BlockRenderer
// short-circuits; the default export remains the parent slide-over.
export { MissedRecurrencesCard, CrossTenantContextCard };
