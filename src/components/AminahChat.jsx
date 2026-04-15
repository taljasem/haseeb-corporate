import { useEffect, useState, useRef, useCallback } from "react";
import { Send, Sparkles, Loader2, CheckCircle2, ChevronRight } from "lucide-react";
// Wave 3: `runAminahSession` now comes from the engine router, which
// picks between the scripted `stubBackend` generator in MOCK mode and
// the live `chat-adapter.runLiveChatSession` in LIVE mode. Both speak
// the same block-event protocol, so the `for await` loop below is
// unchanged. The advisor surface always uses agent='aminah' which the
// Corporate API treats as read-only: the server strips any
// pendingJournalEntry from the response.
import { runAminahSession } from "../engine";
import { createAminahSession, listRecentAminahSessions, getAminahSession, appendMessageToSession } from "../engine/mockEngine";

const PROMPTS = [
  "How am I doing?",
  "Cash position",
  "Budget status",
  "Anything to worry about?",
];

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
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  // Wave 3: the server-side conversation id returned from /api/ai/chat.
  // In MOCK mode this stays null (the stub uses sessionId instead). In
  // LIVE mode we capture it from message.complete events and echo it
  // back on subsequent sends so the thread persists server-side.
  const [conversationId, setConversationId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [draft, setDraft] = useState("");
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
    </div>
  );
}
