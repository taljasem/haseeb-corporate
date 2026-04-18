import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  Send, Sparkles, Loader2, CheckCircle2, ChevronRight,
  Calendar, DollarSign, Bell, AlertTriangle, Clock, X, Check,
} from "lucide-react";
import { useTranslation } from "react-i18next";
// Wave 3: `runAminahSession` now comes from the engine router, which
// picks between the scripted `stubBackend` generator in MOCK mode and
// the live `chat-adapter.runLiveChatSession` in LIVE mode. Both speak
// the same block-event protocol, so the `for await` loop below is
// unchanged. The advisor surface always uses agent='aminah' which the
// Corporate API treats as read-only: the server strips any
// pendingJournalEntry from the response.
import {
  runAminahSession,
  // Wave 6B.3 Layer 3 — Aminah proactive surface. The engine router
  // picks MOCK (advisor-pending-stub.js) vs LIVE (api/advisor-pending.js)
  // transparently.
  listAdvisorPending,
  deferAdvisorPending,
  dismissAdvisorPending,
  acknowledgeAdvisorPending,
  // Existing JE approval gateway — `postJournalEntry` wraps
  // POST /api/journal-entries/:id/validate which is the sole authority
  // for JE state (DRAFT → POSTED). The new /acknowledge endpoint is a
  // bookkeeping sink called only after this returns successfully.
  postJournalEntry,
} from "../engine";
import { createAminahSession, listRecentAminahSessions, getAminahSession, appendMessageToSession } from "../engine/mockEngine";
import { useAuth } from "../contexts/AuthContext";
import { formatDate } from "../utils/format";

const PROMPTS = [
  "How am I doing?",
  "Cash position",
  "Budget status",
  "Anything to worry about?",
];

// Source → Lucide icon. Anything unknown falls through to `Bell`.
function iconForSource(source) {
  switch (source) {
    case "compliance-calendar":
      return Calendar;
    case "statutory-reserve":
      return DollarSign;
    case "pifss-monthly":
    default:
      return Bell;
  }
}

function severityColorVar(severity) {
  switch (severity) {
    case "critical":
      return "var(--semantic-danger)";      // #FF5A5F / #DC2626
    case "warning":
      return "var(--semantic-warning)";     // #D4A84B / #B7791F
    case "info":
    default:
      return "var(--role-owner)";           // #8B5CF6 / #7C3AED
  }
}

function severityBadgeStyle(severity) {
  const color = severityColorVar(severity);
  return {
    display: "inline-flex",
    alignItems: "center",
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: "0.06em",
    color,
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${color}`,
    padding: "2px 6px",
    borderRadius: 3,
    textTransform: "uppercase",
  };
}

function normalizeRole(r) {
  if (!r) return "CFO";
  const s = String(r).toLowerCase();
  if (s.startsWith("own")) return "Owner";
  if (s.startsWith("cfo")) return "CFO";
  return "Junior";
}

function renderBold(text) {
  const parts = (text || "").split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      const inner = p.slice(2, -2);
      return <span key={i} style={{ color: "var(--text-primary)", fontWeight: 600, fontFamily: /\d/.test(inner) ? "'DM Mono', monospace" : "inherit" }}>{inner}</span>;
    }
    return <span key={i}>{p}</span>;
  });
}

export default function AminahChat({ role = "cfo" }) {
  const normalizedRole = normalizeRole(role);
  const { t, i18n } = useTranslation("aminah");
  const { user: authUser } = useAuth();
  // Dismiss authorization: the server is the gate (403 on non-Owner),
  // but the UI hides the button when we can see the user isn't Owner.
  // Fall back to the role prop when auth user isn't hydrated yet (demo /
  // mock mode). Case-insensitive — auth sometimes returns 'OWNER'.
  const canDismiss = useMemo(() => {
    const authRole = String(authUser?.role || "").toLowerCase();
    if (authRole.startsWith("own")) return true;
    if (authRole) return false;
    // Unauthenticated / mock mode — defer to the view's own role prop.
    return normalizedRole === "Owner";
  }, [authUser, normalizedRole]);

  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  // Wave 3: the server-side conversation id returned from /api/ai/chat.
  // In MOCK mode this stays null (the stub uses sessionId instead). In
  // LIVE mode we capture it from message.complete events and echo it
  // back on subsequent sends so the thread persists server-side.
  const [conversationId, setConversationId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [draft, setDraft] = useState("");

  // Wave 6B.3 Layer 3 — proactive surface state.
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingBusyId, setPendingBusyId] = useState(null);
  const [pendingError, setPendingError] = useState(null);
  const [deferMenuFor, setDeferMenuFor] = useState(null);
  const [dismissModalFor, setDismissModalFor] = useState(null);
  const [dismissReason, setDismissReason] = useState("");

  const scrollRef = useRef(null);
  const streamRef = useRef(null);

  // Load or create session
  useEffect(() => {
    (async () => {
      const recent = await listRecentAminahSessions(role, 1);
      if (recent.length > 0) {
        const sess = await getAminahSession(recent[0].id);
        if (sess) { setSessionId(sess.id); setMessages(sess.messages || []); return; }
      }
      const sess = await createAminahSession(role);
      setSessionId(sess.id);
      setMessages([]);
    })();
  }, [role]);

  // Load advisor pending queue on mount. Non-blocking: failures degrade
  // the chat surface to its pre-6B.3 empty-state prompts, which is the
  // exact right behaviour if the new endpoint is unavailable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await listAdvisorPending();
        if (cancelled) return;
        setPendingItems(Array.isArray(items) ? items : []);
      } catch (err) {
        if (cancelled) return;
        // Silent — proactive surface is additive. Do not block the chat.
        // eslint-disable-next-line no-console
        console.warn("[AminahChat] listAdvisorPending failed:", err?.message || err);
        setPendingItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const applyEvent = useCallback((msgId, event) => {
    setMessages((prev) => {
      const msgs = [...prev];
      const idx = msgs.findIndex((m) => m.id === msgId);
      if (idx < 0) return prev;
      const msg = { ...msgs[idx], blocks: [...msgs[idx].blocks] };
      msgs[idx] = msg;
      if (event.type === "message.text_delta") {
        const last = msg.blocks[msg.blocks.length - 1];
        if (last?.type === "text") msg.blocks[msg.blocks.length - 1] = { ...last, text: last.text + event.textDelta };
        else msg.blocks.push({ type: "text", text: event.textDelta });
      } else if (event.type === "message.block_added") {
        msg.blocks.push({ ...event.block });
      } else if (event.type === "status.update") {
        msg.blocks.push({ type: "status", label: event.label });
      } else if (event.type === "tool.call_started") {
        msg.blocks.push({ type: "tool_call", toolName: event.toolName, callId: event.callId, status: "running" });
      } else if (event.type === "tool.call_completed") {
        const tc = msg.blocks.findIndex((b) => b.callId === event.callId);
        if (tc >= 0) msg.blocks[tc] = { ...msg.blocks[tc], status: "complete" };
      } else if (event.type === "message.complete") {
        msg.complete = true;
      } else if (event.type === "error") {
        // Wave 3: live-adapter error events get rendered as an inline
        // error bubble so the user can see what went wrong and retry.
        msg.blocks.push({
          type: "text",
          text: event.message || "Something went wrong.",
          isError: true,
        });
      }
      return msgs;
    });
    // Capture the server-side conversation id from completion events so
    // subsequent sends echo it back and the thread persists.
    if (event.type === "message.complete" && event.conversationId) {
      setConversationId(event.conversationId);
    }
  }, []);

  const sendMessage = async (text) => {
    if (!text.trim() || isStreaming || !sessionId) return;
    const userMsg = { id: `msg-u-${Date.now()}`, role: "user", blocks: [{ type: "text", text: text.trim() }], createdAt: new Date().toISOString(), complete: true };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setIsStreaming(true);
    const asstId = `msg-a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: asstId, role: "assistant", blocks: [], createdAt: new Date().toISOString(), complete: false }]);
    try {
      // Advisor is read-only: agent='aminah' makes the server strip
      // pendingJournalEntry from the response, so the for-await loop
      // never sees a confirmation prompt on this surface.
      const gen = runAminahSession(sessionId, text.trim(), {
        role,
        agent: "aminah",
        conversationId,
        thinkingLabel: "Checking your books...",
      });
      streamRef.current = gen;
      for await (const event of gen) {
        applyEvent(asstId, event);
        if (event.type === "message.complete") break;
      }
      await appendMessageToSession(sessionId, userMsg);
    } catch { /* ignore */ } finally {
      setIsStreaming(false);
      streamRef.current = null;
    }
  };

  // ── Proactive-surface handlers ───────────────────────────────────────

  const removePendingLocally = useCallback((id) => {
    setPendingItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const handleConfirm = useCallback(async (item) => {
    if (!item?.pendingJeId) return;
    setPendingBusyId(item.id);
    setPendingError(null);
    try {
      // Route through the existing JE approval gateway. Gateway is the
      // sole authority for JE state; the advisor /acknowledge endpoint
      // does NOT verify gateway state, so we only call it after this
      // returns successfully.
      const gatewayResponse = await postJournalEntry(item.pendingJeId);
      const gatewayRef = gatewayResponse?.id
        || gatewayResponse?.entryNumber
        || item.pendingJeId;
      try {
        await acknowledgeAdvisorPending(item.id, String(gatewayRef));
      } catch (ackErr) {
        // Bookkeeping sink failed but the JE is posted. Surface a
        // soft warning — the alert will resurface on next /pending
        // poll, but that's better than pretending nothing happened.
        setPendingError({
          id: item.id,
          message: t("pending.errors.acknowledge_failed"),
        });
        // eslint-disable-next-line no-console
        console.warn("[AminahChat] acknowledge failed after gateway success:", ackErr?.message || ackErr);
      }
      removePendingLocally(item.id);
    } catch (gwErr) {
      setPendingError({
        id: item.id,
        message: t("pending.errors.confirm_failed"),
      });
      // eslint-disable-next-line no-console
      console.warn("[AminahChat] JE gateway rejected:", gwErr?.message || gwErr);
    } finally {
      setPendingBusyId(null);
    }
  }, [removePendingLocally, t]);

  const handleDefer = useCallback(async (item, option) => {
    // option is one of 'tomorrow' | 'three_days' | 'one_week' | ISO string
    let iso = null;
    const d = new Date();
    if (option === "tomorrow") {
      d.setDate(d.getDate() + 1);
      iso = d.toISOString();
    } else if (option === "three_days") {
      d.setDate(d.getDate() + 3);
      iso = d.toISOString();
    } else if (option === "one_week") {
      d.setDate(d.getDate() + 7);
      iso = d.toISOString();
    } else if (typeof option === "string" && option) {
      // Custom date (from <input type="date">) — anchor to end-of-day
      // so "defer until Friday" means "don't show it to me until Fri".
      const parsed = new Date(option);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(23, 59, 59, 999);
        iso = parsed.toISOString();
      }
    }
    if (!iso) return;
    setPendingBusyId(item.id);
    setPendingError(null);
    try {
      await deferAdvisorPending(item.id, iso);
      removePendingLocally(item.id);
      setDeferMenuFor(null);
    } catch (err) {
      setPendingError({
        id: item.id,
        message: t("pending.errors.defer_failed"),
      });
      // eslint-disable-next-line no-console
      console.warn("[AminahChat] defer failed:", err?.message || err);
    } finally {
      setPendingBusyId(null);
    }
  }, [removePendingLocally, t]);

  const performDismiss = useCallback(async (item, reason) => {
    setPendingBusyId(item.id);
    setPendingError(null);
    try {
      await dismissAdvisorPending(item.id, reason);
      removePendingLocally(item.id);
      setDismissModalFor(null);
      setDismissReason("");
    } catch (err) {
      if (err?.status === 403) {
        setPendingError({
          id: item.id,
          message: t("pending.errors.owner_only"),
        });
      } else {
        setPendingError({
          id: item.id,
          message: t("pending.errors.dismiss_failed"),
        });
      }
      // eslint-disable-next-line no-console
      console.warn("[AminahChat] dismiss failed:", err?.message || err);
    } finally {
      setPendingBusyId(null);
    }
  }, [removePendingLocally, t]);

  const handleDismissClick = useCallback((item) => {
    if (item.severity === "critical") {
      setDismissModalFor(item);
      setDismissReason("");
      return;
    }
    performDismiss(item, undefined);
  }, [performDismiss]);

  // ── Rendering ────────────────────────────────────────────────────────

  const isAr = i18n.language === "ar" || i18n.dir() === "rtl";

  return (
    <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", padding: "16px 18px 0", borderInlineEnd: "1px solid var(--border-default)", position: "relative", overflow: "hidden" }}>
      {/* Watermark */}
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", fontFamily: "'Noto Sans Arabic', sans-serif", fontWeight: 700, fontSize: "clamp(80px, 9vw, 140px)", color: "rgba(255,255,255,0.01)", pointerEvents: "none", userSelect: "none", zIndex: 0, whiteSpace: "nowrap" }}>حسيب</div>

      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span className="aminah-dot" />
          <span className="aminah-label">{isStreaming ? "AMINAH THINKING..." : "AMINAH ONLINE"}</span>
        </div>

        {/* Proactive-surface cards — rendered above the empty-state prompts,
            below the header. If the list is empty, nothing renders here at
            all (no "no pending items" message; the suggested-prompt pills
            should breathe). */}
        {pendingItems.length > 0 && (
          <div
            data-testid="advisor-pending-stack"
            style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}
          >
            {pendingItems.map((item) => {
              const Icon = iconForSource(item.source);
              const color = severityColorVar(item.severity);
              const busy = pendingBusyId === item.id;
              const displayMessage = isAr && item.messageAr ? item.messageAr : item.message;
              const showConfirm = Boolean(item.pendingJeId);
              const errForItem = pendingError?.id === item.id ? pendingError.message : null;

              return (
                <div
                  key={item.id}
                  data-testid={`advisor-pending-card-${item.id}`}
                  style={{
                    position: "relative",
                    display: "flex",
                    gap: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    overflow: "hidden",
                  }}
                >
                  {/* Severity bar (leading edge — mirrors in RTL via borderInlineStart) */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      insetInlineStart: 0,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      background: color,
                    }}
                  />
                  <div style={{ flexShrink: 0, paddingInlineStart: 4, paddingTop: 2, color }}>
                    <Icon size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
                        {item.subject}
                      </span>
                      <span style={severityBadgeStyle(item.severity)}>
                        {t(`pending.severity_${item.severity || "info"}`)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        lineHeight: 1.5,
                        color: "var(--text-secondary)",
                        fontFamily: isAr ? "'Noto Sans Arabic', sans-serif" : "inherit",
                        marginBottom: 6,
                      }}
                    >
                      {displayMessage}
                    </div>
                    {item.displayAmountKwd && (
                      <div
                        style={{
                          fontSize: 12,
                          fontFamily: "'DM Mono', monospace",
                          color: "var(--text-primary)",
                          marginBottom: 4,
                          unicodeBidi: "embed",
                          direction: "ltr",
                          display: "inline-block",
                        }}
                      >
                        {item.displayAmountKwd} KWD
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-tertiary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        marginBottom: 8,
                      }}
                    >
                      <Clock size={10} />
                      <span>{t("pending.due_prefix", { date: formatDate(item.dueAt) })}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {showConfirm && (
                        <button
                          data-testid={`advisor-pending-confirm-${item.id}`}
                          onClick={() => handleConfirm(item)}
                          disabled={busy}
                          style={{
                            background: "var(--accent-primary)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 4,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: busy ? "not-allowed" : "pointer",
                            fontFamily: "inherit",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {busy ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={10} />}
                          {t("pending.confirm")}
                        </button>
                      )}
                      <button
                        data-testid={`advisor-pending-defer-${item.id}`}
                        onClick={() => setDeferMenuFor(deferMenuFor === item.id ? null : item.id)}
                        disabled={busy}
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          color: "var(--text-secondary)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          borderRadius: 4,
                          padding: "4px 10px",
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: busy ? "not-allowed" : "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {t("pending.defer")}
                      </button>
                      {canDismiss && (
                        <button
                          data-testid={`advisor-pending-dismiss-${item.id}`}
                          onClick={() => handleDismissClick(item)}
                          disabled={busy}
                          style={{
                            background: "transparent",
                            color: "var(--text-tertiary)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 4,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: busy ? "not-allowed" : "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {t("pending.dismiss")}
                        </button>
                      )}
                    </div>

                    {/* Inline defer menu. Compact; expands in place. */}
                    {deferMenuFor === item.id && (
                      <div
                        data-testid={`advisor-pending-defer-menu-${item.id}`}
                        style={{
                          marginTop: 8,
                          padding: 8,
                          background: "var(--bg-surface-sunken)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 4,
                        }}
                      >
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {t("pending.defer_menu.title")}
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                          {[
                            { key: "tomorrow", label: t("pending.defer_menu.tomorrow") },
                            { key: "three_days", label: t("pending.defer_menu.three_days") },
                            { key: "one_week", label: t("pending.defer_menu.one_week") },
                          ].map((opt) => (
                            <button
                              key={opt.key}
                              data-testid={`advisor-pending-defer-opt-${opt.key}-${item.id}`}
                              onClick={() => handleDefer(item, opt.key)}
                              disabled={busy}
                              style={{
                                background: "rgba(255,255,255,0.04)",
                                color: "var(--text-secondary)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: 4,
                                padding: "3px 8px",
                                fontSize: 10,
                                cursor: busy ? "not-allowed" : "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <input
                          type="date"
                          data-testid={`advisor-pending-defer-custom-${item.id}`}
                          onChange={(e) => { if (e.target.value) handleDefer(item, e.target.value); }}
                          style={{
                            width: "100%",
                            background: "var(--bg-surface-sunken)",
                            border: "1px solid var(--border-default)",
                            borderRadius: 4,
                            padding: "4px 6px",
                            fontSize: 10,
                            color: "var(--text-primary)",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                    )}

                    {errForItem && (
                      <div
                        role="alert"
                        data-testid={`advisor-pending-error-${item.id}`}
                        style={{
                          marginTop: 6,
                          fontSize: 10,
                          color: "var(--semantic-danger)",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <AlertTriangle size={10} />
                        {errForItem}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {messages.length === 0 && (
          <>
            <p style={{ fontSize: 14, fontStyle: "italic", lineHeight: 1.6, color: "var(--text-tertiary)", marginBottom: 12 }}>Ask me anything about your business.</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {PROMPTS.map((p) => (
                <button key={p} onClick={() => sendMessage(p)} className="starter" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 14, cursor: "pointer", fontSize: 12, color: "var(--text-tertiary)", fontFamily: "inherit" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--role-owner)" }} />{p}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1, paddingTop: 6 }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{ maxWidth: msg.role === "user" ? "80%" : "90%", background: msg.role === "user" ? "rgba(0,196,140,0.12)" : "var(--bg-surface-sunken)", border: msg.role === "user" ? "1px solid rgba(0,196,140,0.20)" : "1px solid var(--border-default)", borderRadius: 12, borderBottomRightRadius: msg.role === "user" ? 4 : 12, borderBottomLeftRadius: msg.role === "user" ? 12 : 4, padding: "10px 14px" }}>
              {msg.role === "user" ? (
                <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-primary)" }}>{msg.blocks?.[0]?.text || ""}</div>
              ) : (
                (msg.blocks || []).map((block, i) => {
                  if (block.type === "text") return <div key={i} style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{renderBold(block.text)}</div>;
                  if (block.type === "status") return <div key={i} style={{ fontSize: 10, color: "var(--accent-primary)", display: "flex", alignItems: "center", gap: 4, padding: "2px 0" }}><Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />{block.label}</div>;
                  if (block.type === "tool_call") return <div key={i} style={{ fontSize: 10, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4, padding: "2px 0" }}>{block.status === "complete" ? <CheckCircle2 size={10} color="var(--accent-primary)" /> : <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />}<span style={{ fontFamily: "'DM Mono', monospace" }}>{block.toolName}</span></div>;
                  return null;
                })
              )}
              {msg.role === "assistant" && !msg.complete && msg.blocks?.length === 0 && (
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}><Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> Thinking...</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ position: "relative", zIndex: 1, padding: "10px 0 14px", borderTop: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(draft); }} placeholder="Ask Aminah..." disabled={isStreaming} style={{ flex: 1, background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
          <button onClick={() => sendMessage(draft)} disabled={!draft.trim() || isStreaming} style={{ background: draft.trim() ? "var(--accent-primary)" : "var(--border-subtle)", color: draft.trim() ? "#fff" : "var(--text-tertiary)", border: "none", borderRadius: 8, padding: "8px 10px", cursor: draft.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center" }}><Send size={13} /></button>
        </div>
      </div>

      {/* Critical-severity dismiss confirmation modal */}
      {dismissModalFor && (
        <div
          data-testid="advisor-pending-dismiss-modal"
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--overlay-backdrop)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => { setDismissModalFor(null); setDismissReason(""); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--panel-bg)",
              border: "1px solid var(--panel-border)",
              borderRadius: 8,
              padding: 20,
              maxWidth: 380,
              width: "100%",
              boxShadow: "var(--panel-shadow)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={16} color="var(--semantic-danger)" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                {t("pending.dismiss_modal.title")}
              </h3>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
              {t("pending.dismiss_modal.body")}
            </p>
            <textarea
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder={t("pending.dismiss_modal.reason_placeholder")}
              rows={3}
              style={{
                width: "100%",
                background: "var(--bg-surface-sunken)",
                border: "1px solid var(--border-default)",
                borderRadius: 4,
                padding: "6px 8px",
                fontSize: 12,
                color: "var(--text-primary)",
                fontFamily: "inherit",
                resize: "vertical",
                marginBottom: 12,
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setDismissModalFor(null); setDismissReason(""); }}
                style={{
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 4,
                  padding: "6px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t("pending.dismiss_modal.cancel")}
              </button>
              <button
                data-testid="advisor-pending-dismiss-modal-confirm"
                onClick={() => performDismiss(dismissModalFor, dismissReason.trim() || undefined)}
                style={{
                  background: "var(--semantic-danger)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  padding: "6px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 500,
                }}
              >
                {t("pending.dismiss_modal.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
