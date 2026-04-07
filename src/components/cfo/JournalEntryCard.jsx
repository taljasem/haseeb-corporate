import { useState } from "react";
import { formatKWD } from "../../utils/format";
import AccountPicker from "./AccountPicker";
import AssignToButton from "../shared/AssignToButton";

function ShieldIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const STATE_STYLES = {
  suggested: {
    accent: "#D4A84B",
    pillFg: "#D4A84B",
    pillBg: "rgba(212,168,75,0.10)",
    pillBorder: "rgba(212,168,75,0.30)",
    pillLabel: "ENGINE SUGGESTION · PENDING CONFIRMATION",
    headerLabel: "ENGINE SUGGESTED ENTRY",
    hashSuffix: "not yet committed",
    cardBg: "rgba(255,255,255,0.04)",
    opacity: 1,
  },
  "draft-validated": {
    accent: "#00C48C",
    pillFg: "#00C48C",
    pillBg: "rgba(0,196,140,0.10)",
    pillBorder: "rgba(0,196,140,0.30)",
    pillLabel: "DRAFT · VALIDATED",
    headerLabel: "DRAFT JOURNAL ENTRY",
    hashSuffix: "ready",
    cardBg: "rgba(255,255,255,0.04)",
    opacity: 1,
  },
  "pending-approval": {
    accent: "#D4A84B",
    pillFg: "#D4A84B",
    pillBg: "rgba(212,168,75,0.10)",
    pillBorder: "rgba(212,168,75,0.30)",
    pillLabel: "PENDING CFO APPROVAL",
    headerLabel: "JOURNAL ENTRY",
    hashSuffix: "not committed",
    cardBg: "rgba(255,255,255,0.04)",
    opacity: 0.95,
  },
  posted: {
    accent: "#5B6570",
    pillFg: "#8B98A5",
    pillBg: "rgba(91,101,112,0.14)",
    pillBorder: "rgba(91,101,112,0.30)",
    pillLabelTemplate: (id) => `POSTED · ${id}`,
    headerLabel: "JOURNAL ENTRY",
    hashSuffix: "extended · a4f2…9c1b",
    cardBg: "rgba(255,255,255,0.025)",
    opacity: 0.85,
  },
};

function fmtCreated(iso) {
  try {
    const d = new Date(iso);
    return d
      .toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      .toUpperCase();
  } catch {
    return "—";
  }
}

export default function JournalEntryCard({
  entry,
  state = "draft-validated",
  onConfirm,
  onEdit,
  onDiscard,
  onAskAminah,
  onChooseDifferentAccount,
  postedBy = "You (CFO)",
  showAssign = false,
  assignItemType = "journal-entry",
  onAssign,
}) {
  const [pickerLineIdx, setPickerLineIdx] = useState(null); // which line is being edited
  const [workingEntry, setWorkingEntry] = useState(null);

  if (!entry) return null;
  const live = workingEntry || entry;
  const s = STATE_STYLES[state] || STATE_STYLES["draft-validated"];
  const isPosted = state === "posted";
  const isSuggested = state === "suggested";
  const isLocked = state === "posted" || state === "pending-approval";
  const balanced = live.lines.every((l) => l.account != null) && live.balanced !== false;

  const pillLabel = s.pillLabelTemplate ? s.pillLabelTemplate(live.id) : s.pillLabel;

  // Handlers for the inline picker swap
  const openPickerForLine = (idx) => {
    setPickerLineIdx(idx);
    onChooseDifferentAccount && onChooseDifferentAccount(idx);
  };

  const handlePicked = (account) => {
    const next = {
      ...live,
      lines: live.lines.map((l, i) =>
        i === pickerLineIdx ? { ...l, account: account.name, code: account.code, placeholder: false } : l
      ),
    };
    next.balanced = next.lines.every((l) => l.account != null);
    setWorkingEntry(next);
    setPickerLineIdx(null);
  };

  const canConfirm = balanced;

  return (
    <div
      style={{
        background: s.cardBg,
        border: "1px solid rgba(255,255,255,0.10)",
        borderLeft: `2px solid ${s.accent}`,
        borderRadius: 8,
        overflow: "hidden",
        opacity: s.opacity,
        margin: "8px 0",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
            }}
          >
            {s.headerLabel}
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 13,
              color: "#E6EDF3",
              marginTop: 2,
            }}
          >
            {live.id}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.10em",
              color: s.pillFg,
              background: s.pillBg,
              border: `1px solid ${s.pillBorder}`,
              padding: "3px 8px",
              borderRadius: 3,
            }}
          >
            {pillLabel}
          </span>
          {showAssign && !isPosted && (
            <AssignToButton
              itemType={assignItemType}
              itemId={live.id}
              onAssign={onAssign}
              compact
            />
          )}
        </div>
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

        {live.lines.map((line, i) => {
          const isPlaceholder = !line.account;
          return (
            <div key={i}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 100px",
                  gap: 8,
                  padding: "10px 0",
                  alignItems: "baseline",
                }}
              >
                <div>
                  {isPlaceholder ? (
                    <button
                      onClick={() => openPickerForLine(i)}
                      style={{
                        background: "rgba(255,90,95,0.06)",
                        border: "1px dashed rgba(255,90,95,0.4)",
                        borderRadius: 4,
                        color: "#FF5A5F",
                        fontSize: 12,
                        padding: "4px 10px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Select account...
                    </button>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: "#E6EDF3" }}>{line.account}</div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#5B6570",
                          fontFamily: "'DM Mono', monospace",
                          marginTop: 2,
                        }}
                      >
                        ({line.code})
                      </div>
                    </>
                  )}
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
              {pickerLineIdx === i && (
                <div style={{ padding: "8px 0 12px" }}>
                  <AccountPicker onSelect={handlePicked} />
                  <div style={{ marginTop: 6 }}>
                    <a
                      onClick={() => setPickerLineIdx(null)}
                      style={{ fontSize: 11, color: "#5B6570", cursor: "pointer" }}
                    >
                      ← Cancel
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}

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
            {formatKWD(live.totalDebit)}
          </div>
          <div
            style={{
              textAlign: "right",
              fontFamily: "'DM Mono', monospace",
              color: "#E6EDF3",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatKWD(live.totalCredit)}
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
        <span>MAPPING: {live.mappingVersion}</span>
        <span>·</span>
        <span style={{ color: balanced ? "#00C48C" : "#FF5A5F" }}>
          {balanced ? "✓ BALANCED" : "✗ INCOMPLETE"}
        </span>
        <span>·</span>
        <span>CREATED: {fmtCreated(live.createdAt)}</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ShieldIcon />
          HASH CHAIN: SHA-256 · {s.hashSuffix}
        </span>
      </div>

      {/* Posted footer */}
      {isPosted && (
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            fontSize: 11,
            color: "#5B6570",
          }}
        >
          Posted by <span style={{ color: "#8B98A5", fontWeight: 500 }}>{postedBy}</span> at{" "}
          {fmtCreated(live.createdAt)} ·{" "}
          <a style={{ color: "#00C48C", cursor: "pointer" }}>View audit trail →</a>
        </div>
      )}

      {/* Actions */}
      {!isLocked && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => canConfirm && onConfirm && onConfirm(live)}
            disabled={!canConfirm}
            style={{
              background: canConfirm ? "#00C48C" : "rgba(0,196,140,0.25)",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: 6,
              cursor: canConfirm ? "pointer" : "not-allowed",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            Confirm and post
          </button>

          {isSuggested ? (
            <>
              <button
                onClick={() => {
                  // open picker for the line that has a counterparty (not the bank account line)
                  const idx = live.lines.findIndex((l) => l.code !== "1120" && l.code !== "1130" && l.code !== "1140");
                  openPickerForLine(idx >= 0 ? idx : 0);
                }}
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
                Choose different account
              </button>
              <button
                onClick={onAskAminah}
                style={{
                  background: "transparent",
                  color: "#8B5CF6",
                  border: "1px solid rgba(139,92,246,0.30)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.10)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Ask Aminah
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
