import { useEffect, useState } from "react";
import { Check, X, Shield, Lock } from "lucide-react";
import AminahNarrationCard from "../../components/financial/AminahNarrationCard";
import { getAuditChecks } from "../../engine/mockEngine";
import { formatRelativeTime } from "../../utils/relativeTime";

function CheckCard({ check }) {
  const passing = check.status === "passing";
  const color = passing ? "#00C48C" : "#FF5A5F";
  const Icon = passing ? Check : X;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${passing ? "rgba(255,255,255,0.08)" : "rgba(255,90,95,0.30)"}`,
        borderLeft: `2px solid ${color}`,
        borderRadius: 8,
        padding: "14px 16px",
        minHeight: 140,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: `${color}22`,
            border: `1px solid ${color}55`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color,
          }}
        >
          <Icon size={12} strokeWidth={3} />
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color,
          }}
        >
          {passing ? "PASSING" : "FAILING"}
        </span>
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#E6EDF3",
          fontWeight: 500,
          lineHeight: 1.3,
          marginBottom: 8,
          flex: 1,
        }}
      >
        {check.name}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#8B98A5",
          lineHeight: 1.4,
          marginBottom: 8,
        }}
      >
        {check.detail}
      </div>
      <div
        style={{
          fontSize: 10,
          fontFamily: "'DM Mono', monospace",
          color: "#5B6570",
        }}
      >
        Verified {formatRelativeTime(check.lastVerified)}
      </div>
    </div>
  );
}

export default function AuditBridgeScreen() {
  const [data, setData] = useState(null);
  useEffect(() => {
    getAuditChecks().then(setData);
  }, []);

  if (!data) return <div style={{ padding: 28, color: "#5B6570" }}>Loading…</div>;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 28,
              color: "#E6EDF3",
              letterSpacing: "-0.3px",
              lineHeight: 1,
            }}
          >
            AUDIT BRIDGE
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
              marginTop: 6,
            }}
          >
            CONTINUOUS AUDIT ASSURANCE
          </div>
        </div>

        {/* Big status */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 18,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 32,
              fontWeight: 500,
              color: "#00C48C",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {data.passing} / {data.total}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
            }}
          >
            CHECKS PASSING
          </div>
          {data.failing > 0 && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.10em",
                color: "#FF5A5F",
                background: "rgba(255,90,95,0.08)",
                border: "1px solid rgba(255,90,95,0.30)",
                padding: "5px 10px",
                borderRadius: 4,
              }}
            >
              {data.failing} ATTENTION NEEDED
            </div>
          )}
        </div>

        <AminahNarrationCard text={data.aminahNarration} />

        {/* Checks grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {data.checks.map((c) => (
            <CheckCard key={c.id} check={c} />
          ))}
        </div>

        {/* Hash chain status */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderLeft: "2px solid #00C48C",
            borderRadius: 10,
            padding: "18px 20px",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <Lock size={14} color="#00C48C" strokeWidth={2.2} />
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "#5B6570",
              }}
            >
              HASH CHAIN STATUS
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 9, color: "#5B6570", letterSpacing: "0.12em", fontWeight: 600 }}>
                TOTAL POSTED ENTRIES
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 20,
                  color: "#E6EDF3",
                  marginTop: 4,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {data.hashChain.totalEntries.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "#5B6570", letterSpacing: "0.12em", fontWeight: 600 }}>
                CHAIN LENGTH
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 20,
                  color: "#E6EDF3",
                  marginTop: 4,
                }}
              >
                {data.hashChain.chainLength.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "#5B6570", letterSpacing: "0.12em", fontWeight: 600 }}>
                LAST HASH
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 15,
                  color: "#E6EDF3",
                  marginTop: 4,
                }}
              >
                {data.hashChain.lastHash}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "#5B6570", letterSpacing: "0.12em", fontWeight: 600 }}>
                STATUS
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#00C48C",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  marginTop: 4,
                }}
              >
                ✓ {data.hashChain.status}
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#5B6570",
              fontFamily: "'DM Mono', monospace",
              marginTop: 12,
            }}
          >
            Last verified {formatRelativeTime(data.hashChain.lastVerified)}
          </div>
        </div>

        {/* Auditor access */}
        <div
          style={{
            background: "rgba(0,196,140,0.04)",
            border: "1px solid rgba(0,196,140,0.25)",
            borderRadius: 10,
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <Shield size={16} color="#00C48C" strokeWidth={2.2} />
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "#00C48C",
              }}
            >
              EXTERNAL AUDITOR ACCESS
            </div>
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#8B98A5",
              lineHeight: 1.6,
              marginBottom: 14,
            }}
          >
            Grant read-only access to an external auditor. They see the full ledger, hash-chained entries,
            all approvals, and the audit trail — without any ability to modify.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{
                background: "#00C48C",
                color: "#fff",
                border: "none",
                padding: "9px 16px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              Grant auditor access
            </button>
            <button
              style={{
                background: "transparent",
                color: "#8B98A5",
                border: "1px solid rgba(255,255,255,0.15)",
                padding: "9px 16px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
              }}
            >
              View audit trail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
