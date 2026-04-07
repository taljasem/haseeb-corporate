import { formatKWD } from "../../utils/format";

function ShieldIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function JournalEntryCard({ entry, posted = false, onConfirm, onEdit, onDiscard }) {
  if (!entry) return null;

  const statusLabel = posted ? `Posted · ${entry.id}` : "Draft · Validated";
  const createdLabel = (() => {
    try {
      const d = new Date(entry.createdAt);
      return d
        .toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
        .toUpperCase();
    } catch {
      return "—";
    }
  })();

  return (
    <div
      style={{
        background: posted ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderLeft: "2px solid #00C48C",
        borderRadius: 8,
        overflow: "hidden",
        opacity: posted ? 0.85 : 1,
        margin: "8px 0",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
            }}
          >
            DRAFT JOURNAL ENTRY
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 13,
              color: "#E6EDF3",
              marginTop: 2,
            }}
          >
            {entry.id}
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.10em",
            color: posted ? "#8B98A5" : "#00C48C",
            background: posted ? "rgba(255,255,255,0.04)" : "rgba(0,196,140,0.10)",
            border: `1px solid ${posted ? "rgba(255,255,255,0.10)" : "rgba(0,196,140,0.30)"}`,
            padding: "3px 8px",
            borderRadius: 3,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Lines */}
      <div style={{ padding: "12px 16px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 100px 100px",
            gap: 8,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.12em",
            color: "#5B6570",
            paddingBottom: 8,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div>ACCOUNT</div>
          <div style={{ textAlign: "right" }}>DEBIT</div>
          <div style={{ textAlign: "right" }}>CREDIT</div>
        </div>

        {entry.lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 100px 100px",
              gap: 8,
              padding: "10px 0",
              alignItems: "baseline",
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: "#E6EDF3" }}>{line.account}</div>
              <div style={{ fontSize: 11, color: "#5B6570", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                ({line.code})
              </div>
            </div>
            <div
              style={{
                textAlign: "right",
                fontFamily: "'DM Mono', monospace",
                fontSize: 13,
                color: line.debit != null ? "#FF5A5F" : "#5B6570",
                opacity: line.debit != null ? 0.85 : 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {line.debit != null ? line.debit.toFixed(3) : "—"}
            </div>
            <div
              style={{
                textAlign: "right",
                fontFamily: "'DM Mono', monospace",
                fontSize: 13,
                color: line.credit != null ? "#00C48C" : "#5B6570",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {line.credit != null ? line.credit.toFixed(3) : "—"}
            </div>
          </div>
        ))}

        {/* Total */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 100px 100px",
            gap: 8,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.10)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.10em",
            color: "#8B98A5",
          }}
        >
          <div>TOTAL</div>
          <div
            style={{
              textAlign: "right",
              fontFamily: "'DM Mono', monospace",
              color: "#E6EDF3",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatKWD(entry.totalDebit)}
          </div>
          <div
            style={{
              textAlign: "right",
              fontFamily: "'DM Mono', monospace",
              color: "#E6EDF3",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatKWD(entry.totalCredit)}
          </div>
        </div>
      </div>

      {/* Metadata strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.10em",
          color: "#5B6570",
          flexWrap: "wrap",
        }}
      >
        <span>MAPPING: {entry.mappingVersion}</span>
        <span>·</span>
        <span style={{ color: entry.balanced ? "#00C48C" : "#FF5A5F" }}>
          {entry.balanced ? "✓ BALANCED" : "✗ UNBALANCED"}
        </span>
        <span>·</span>
        <span>CREATED: {createdLabel}</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ShieldIcon />
          HASH CHAIN: SHA-256 · {entry.hashChainStatus}
        </span>
      </div>

      {/* Actions */}
      {!posted && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            onClick={onConfirm}
            className="send-btn"
            style={{
              background: "#00C48C",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            Confirm and post
          </button>
          <button
            onClick={onEdit}
            style={{
              background: "transparent",
              color: "#8B98A5",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "8px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            Edit
          </button>
          <button
            onClick={onDiscard}
            style={{
              background: "transparent",
              color: "#8B98A5",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "8px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
