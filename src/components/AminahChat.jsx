const PROMPTS = [
  "How am I doing?",
  "Cash position",
  "Branches",
  "Budget",
  "Who owes me?",
  "Payroll",
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

export default function AminahChat() {
  return (
    <div
      style={{
        flex: 1,
        maxWidth: "calc(100% - 600px)",
        display: "flex",
        flexDirection: "column",
        padding: "0 24px",
        borderRight: "1px solid rgba(255,255,255,0.10)",
        minWidth: 0,
        position: "relative",
      }}
    >
      {/* Arabic watermark */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: "'Noto Sans Arabic', sans-serif",
          fontWeight: 700,
          fontSize: "clamp(100px, 14vw, 220px)",
          color: "rgba(255,255,255,0.01)",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
          whiteSpace: "nowrap",
        }}
      >
        حسيب
      </div>

      {/* Welcome state */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          zIndex: 1,
          animation: "fadeUp 0.5s ease 0.15s both",
          paddingBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 12,
          }}
        >
          <span className="aminah-dot" />
          <span className="aminah-label">AMINAH ONLINE</span>
        </div>

        <p
          style={{
            fontSize: 16,
            fontWeight: 300,
            fontStyle: "italic",
            lineHeight: 1.9,
            color: "#5B6570",
            marginBottom: 28,
            maxWidth: 460,
          }}
        >
          Ask me anything about your business.
        </p>

        <div
          style={{
            display: "flex",
            gap: 7,
            flexWrap: "wrap",
            marginBottom: 16,
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
                padding: "9px 16px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 16,
                cursor: "pointer",
                fontSize: 13,
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
              padding: "16px 90px 16px 18px",
              color: "#E6EDF3",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              transition: "all 0.15s ease",
            }}
          />
          <button
            aria-label="Mic"
            style={{
              position: "absolute",
              right: 48,
              top: "50%",
              transform: "translateY(-50%)",
              width: 34,
              height: 34,
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
              width: 34,
              height: 34,
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
