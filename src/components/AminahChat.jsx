import { useEffect, useState } from "react";
import { getMockChatHistory } from "../engine/mockEngine";

const PROMPTS = [
  "How am I doing?",
  "Cash position",
  "Branches",
  "Budget",
  "Who owes me?",
];

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="1" width="6" height="12" rx="3" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

/** Renders **bold** segments. Numbers inside bold use DM Mono. */
function renderBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      const isNumeric = /^[-+]?[\d,.]+(\s*KWD)?$|^\+\d+%/.test(inner) || /\d/.test(inner);
      return (
        <span
          key={i}
          style={{
            color: "#E6EDF3",
            fontWeight: 500,
            fontFamily: isNumeric ? "'DM Mono', monospace" : "inherit",
          }}
        >
          {inner}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function ChatBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          maxWidth: isUser ? "80%" : "90%",
          background: isUser ? "rgba(0,196,140,0.12)" : "rgba(255,255,255,0.03)",
          border: isUser
            ? "1px solid rgba(0,196,140,0.20)"
            : "1px solid rgba(255,255,255,0.08)",
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

export default function AminahChat() {
  const [history, setHistory] = useState(null);
  useEffect(() => {
    getMockChatHistory().then(setHistory);
  }, []);

  // Group messages into exchanges (user → aminah pairs) for spacing.
  const exchanges = [];
  if (history) {
    for (let i = 0; i < history.length; i += 2) {
      exchanges.push(history.slice(i, i + 2));
    }
  }

  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        padding: "16px 18px 0",
        borderRight: "1px solid rgba(255,255,255,0.10)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Arabic watermark — narrower clamp for the 340px column */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: "'Noto Sans Arabic', sans-serif",
          fontWeight: 700,
          fontSize: "clamp(80px, 9vw, 140px)",
          color: "rgba(255,255,255,0.01)",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
          whiteSpace: "nowrap",
        }}
      >
        حسيب
      </div>

      {/* Top: status + intro + prompt chips */}
      <div style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
          }}
        >
          <span className="aminah-dot" />
          <span className="aminah-label">AMINAH ONLINE</span>
        </div>
        <p
          style={{
            fontSize: 14,
            fontStyle: "italic",
            lineHeight: 1.6,
            color: "#5B6570",
            marginBottom: 12,
          }}
        >
          Ask me anything about your business.
        </p>
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {PROMPTS.map((p) => (
            <button
              key={p}
              className="starter"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14,
                cursor: "pointer",
                fontSize: 12,
                color: "#5B6570",
                fontFamily: "inherit",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#8B5CF6",
                }}
              />
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chat history scroll */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          position: "relative",
          zIndex: 1,
          paddingTop: 6,
        }}
      >
        {exchanges.map((ex, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: idx === exchanges.length - 1 ? 8 : 14,
            }}
          >
            {ex.map((m, j) => (
              <ChatBubble key={j} msg={m} />
            ))}
          </div>
        ))}
      </div>

      {/* Input */}
      <div
        style={{
          padding: "10px 0 16px",
          flexShrink: 0,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ position: "relative" }}>
          <input
            className="chat-input"
            placeholder="Talk to Aminah…"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10,
              padding: "14px 86px 14px 16px",
              color: "#E6EDF3",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
              transition: "all 0.15s ease",
            }}
          />
          <button
            aria-label="Mic"
            style={{
              position: "absolute",
              right: 46,
              top: "50%",
              transform: "translateY(-50%)",
              width: 32,
              height: 32,
              background: "transparent",
              border: "none",
              borderRadius: 8,
              color: "#5B6570",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MicIcon />
          </button>
          <button
            className="send-btn"
            aria-label="Send"
            style={{
              position: "absolute",
              right: 7,
              top: "50%",
              transform: "translateY(-50%)",
              width: 32,
              height: 32,
              background: "#00C48C",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
