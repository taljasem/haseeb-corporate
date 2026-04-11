import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Send, Square, Sparkles, ChevronDown, ChevronRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import ActionButton from "../ds/ActionButton";
import { runAminahSession } from "../../engine/aminah/stubBackend";
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
        default:
          break;
      }
      return msgs;
    });
  }, []);

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
      const gen = runAminahSession(sessionId, text.trim(), { role, screen: "general" });
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
            <MessageBubble key={msg.id} msg={msg} t={t} />
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

function MessageBubble({ msg, t }) {
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
              <BlockRenderer key={i} block={block} t={t} />
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

function BlockRenderer({ block, t }) {
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
