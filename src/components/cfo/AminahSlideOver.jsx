import { useEffect, useState } from "react";

const ROLE_CONTENT = {
  Owner: {
    greeting: "Hi Tarek. What can I help you understand?",
    suggestions: [
      "How is cash this month?",
      "What's my biggest expense risk?",
      "Walk me through the close progress",
      "Why is marketing over budget again?",
    ],
  },
  CFO: {
    greeting: "Hi. What are we working on?",
    suggestions: [
      "What needs my attention right now?",
      "Summarize today's bank transactions",
      "What's blocking the close?",
      "Any rules I should approve?",
    ],
  },
  Junior: {
    greeting: "Hi Sara. How can I help with your work?",
    suggestions: [
      "What should I work on next?",
      "Help me categorize this transaction",
      "Draft a JE for me",
      "What's my accuracy this week?",
    ],
  },
};

function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <div
        style={{
          maxWidth: isUser ? "80%" : "92%",
          background: isUser ? "rgba(0,196,140,0.12)" : "rgba(255,255,255,0.03)",
          border: isUser ? "1px solid rgba(0,196,140,0.20)" : "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          borderBottomRightRadius: isUser ? 4 : 12,
          borderBottomLeftRadius: isUser ? 12 : 4,
          padding: "10px 14px",
          fontSize: 13,
          lineHeight: 1.55,
          color: isUser ? "#E6EDF3" : "#8B98A5",
        }}
      >
        {renderBold(msg.text)}
      </div>
    </div>
  );
}

function renderBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      const inner = p.slice(2, -2);
      const isNum = /\d/.test(inner);
      return (
        <span
          key={i}
          style={{
            color: "#E6EDF3",
            fontWeight: 500,
            fontFamily: isNum ? "'DM Mono', monospace" : "inherit",
          }}
        >
          {inner}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export default function AminahSlideOver({ open, onClose, context = null, role = "CFO" }) {
  const content = ROLE_CONTENT[role] || ROLE_CONTENT.CFO;
  const [draft, setDraft] = useState("");
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 90,
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 52,
          right: 0,
          bottom: 0,
          width: 380,
          background: "#08090C",
          borderLeft: "1px solid rgba(255,255,255,0.10)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          animation: "viewEnter 0.2s ease-out both",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="aminah-dot" />
            <span
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 16,
                color: "#E6EDF3",
                letterSpacing: "0.06em",
              }}
            >
              AMINAH
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "#5B6570",
              cursor: "pointer",
              fontSize: 18,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {context && (
            <div
              style={{
                fontSize: 11,
                color: "#5B6570",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                padding: "8px 10px",
                marginBottom: 12,
                fontStyle: "italic",
              }}
            >
              Context: {context}
            </div>
          )}
          <Bubble msg={{ role: "aminah", text: content.greeting }} />
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
              marginTop: 14,
              marginBottom: 8,
            }}
          >
            SUGGESTED QUESTIONS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {content.suggestions.map((q) => (
              <button
                key={q}
                onClick={() => setDraft(q)}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  color: "#8B98A5",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "12px 18px 16px", borderTop: "1px solid rgba(255,255,255,0.10)" }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="chat-input"
            placeholder="Ask Aminah…"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10,
              padding: "12px 14px",
              color: "#E6EDF3",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
        </div>
      </aside>
    </>
  );
}
