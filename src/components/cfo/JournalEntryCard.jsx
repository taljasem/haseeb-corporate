import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatKWD } from "../../utils/format";
import LtrText from "../shared/LtrText";
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
    accent: "var(--semantic-warning)",
    pillFg: "var(--semantic-warning)",
    pillBg: "var(--semantic-warning-subtle)",
    pillBorder: "var(--semantic-warning-subtle)",
    pillKey: "state_suggested_pill",
    headerKey: "header_suggested",
    hashKey: "hash_suggested",
    cardBg: "var(--bg-surface-sunken)",
    opacity: 1,
  },
  "draft-validated": {
    accent: "var(--accent-primary)",
    pillFg: "var(--accent-primary)",
    pillBg: "var(--accent-primary-subtle)",
    pillBorder: "var(--accent-primary-border)",
    pillKey: "state_draft_pill",
    headerKey: "header_draft",
    hashKey: "hash_draft",
    cardBg: "var(--bg-surface-sunken)",
    opacity: 1,
  },
  "pending-approval": {
    accent: "var(--semantic-warning)",
    pillFg: "var(--semantic-warning)",
    pillBg: "var(--semantic-warning-subtle)",
    pillBorder: "var(--semantic-warning-subtle)",
    pillKey: "state_pending_pill",
    headerKey: "header_je",
    hashKey: "hash_pending",
    cardBg: "var(--bg-surface-sunken)",
    opacity: 0.95,
  },
  posted: {
    accent: "var(--text-tertiary)",
    pillFg: "var(--text-secondary)",
    pillBg: "rgba(91,101,112,0.14)",
    pillBorder: "rgba(91,101,112,0.30)",
    pillKey: "state_posted_pill",
    headerKey: "header_je",
    hashKey: "hash_posted",
    cardBg: "var(--bg-surface)",
    opacity: 0.85,
    postedWithId: true,
  },
  // HASEEB-282 (2026-04-22, ConversationalJE hallucination stopgap):
  // the LLM produced lines against account codes that don't exist on
  // this tenant's chart of accounts. The card renders the proposed
  // entry so the user can see what was rejected, but the pill is red
  // and the Confirm button is suppressed. Paired with the backend
  // `buildError` field on OrchestratorResponse.
  "build-failed": {
    accent: "var(--semantic-danger)",
    pillFg: "var(--semantic-danger)",
    pillBg: "rgba(255,90,95,0.10)",
    pillBorder: "rgba(255,90,95,0.40)",
    pillKey: "state_build_failed_pill",
    headerKey: "header_build_failed",
    hashKey: "hash_build_failed",
    cardBg: "var(--bg-surface-sunken)",
    opacity: 0.92,
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
  postedBy,
  showAssign = false,
  assignItemType = "journal-entry",
  onAssign,
}) {
  const { t } = useTranslation("common");
  const [pickerLineIdx, setPickerLineIdx] = useState(null); // which line is being edited
  const [workingEntry, setWorkingEntry] = useState(null);
  const postedByLabel = postedBy || t("je_card.posted_by_cfo");

  if (!entry) return null;
  const live = workingEntry || entry;
  const s = STATE_STYLES[state] || STATE_STYLES["draft-validated"];
  const isPosted = state === "posted";
  const isSuggested = state === "suggested";
  // HASEEB-282: build-failed is locked (no Confirm/Edit/Discard action bar) —
  // the user must rephrase; the proposed entry is shown for context only.
  const isLocked = state === "posted" || state === "pending-approval" || state === "build-failed";
  const balanced = live.lines.every((l) => l.account != null) && live.balanced !== false;

  const pillLabel = s.postedWithId ? t("je_card.state_posted_pill", { id: live.id }) : t(`je_card.${s.pillKey}`);
  const headerLabel = t(`je_card.${s.headerKey}`);
  const hashSuffix = t(`je_card.${s.hashKey}`);

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
        border: "1px solid var(--border-default)",
        borderInlineStart: `2px solid ${s.accent}`,
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
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "var(--text-tertiary)",
            }}
          >
            {headerLabel}
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 13,
              color: "var(--text-primary)",
              marginTop: 2,
            }}
          >
            <LtrText>{live.id}</LtrText>
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
            color: "var(--text-tertiary)",
            paddingBottom: 8,
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div>{t("je_card.col_account")}</div>
          <div style={{ textAlign: "end" }}>{t("je_card.col_debit")}</div>
          <div style={{ textAlign: "end" }}>{t("je_card.col_credit")}</div>
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
                        color: "var(--semantic-danger)",
                        fontSize: 12,
                        padding: "4px 10px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {t("je_card.select_account")}
                    </button>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{line.account}</div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          fontFamily: "'DM Mono', monospace",
                          marginTop: 2,
                        }}
                      >
                        <LtrText>({line.code})</LtrText>
                      </div>
                    </>
                  )}
                </div>
                <div
                  style={{
                    textAlign: "end",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 13,
                    color: line.debit != null ? "var(--semantic-danger)" : "var(--text-tertiary)",
                    opacity: line.debit != null ? 0.85 : 1,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {line.debit != null ? Number(line.debit).toFixed(3) : "—"}
                </div>
                <div
                  style={{
                    textAlign: "end",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 13,
                    color: line.credit != null ? "var(--accent-primary)" : "var(--text-tertiary)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {line.credit != null ? Number(line.credit).toFixed(3) : "—"}
                </div>
              </div>
              {pickerLineIdx === i && (
                <div style={{ padding: "8px 0 12px" }}>
                  <AccountPicker onSelect={handlePicked} />
                  <div style={{ marginTop: 6 }}>
                    <a
                      onClick={() => setPickerLineIdx(null)}
                      style={{ fontSize: 11, color: "var(--text-tertiary)", cursor: "pointer" }}
                    >
                      {t("je_card.cancel_picker")}
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
            borderTop: "1px solid var(--border-default)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.10em",
            color: "var(--text-secondary)",
          }}
        >
          <div>{t("je_card.total")}</div>
          <div
            style={{
              textAlign: "end",
              fontFamily: "'DM Mono', monospace",
              color: "var(--text-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatKWD(live.totalDebit)}
          </div>
          <div
            style={{
              textAlign: "end",
              fontFamily: "'DM Mono', monospace",
              color: "var(--text-primary)",
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
          borderTop: "1px solid var(--border-subtle)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.10em",
          color: "var(--text-tertiary)",
          flexWrap: "wrap",
        }}
      >
        <span>{t("je_card.mapping", { version: live.mappingVersion })}</span>
        <span>·</span>
        <span style={{ color: balanced ? "var(--accent-primary)" : "var(--semantic-danger)" }}>
          {balanced ? t("je_card.balanced") : t("je_card.incomplete")}
        </span>
        <span>·</span>
        <span>{t("je_card.created_at", { time: fmtCreated(live.createdAt) })}</span>
        <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ShieldIcon />
          {t("je_card.hash_chain", { suffix: hashSuffix })}
        </span>
      </div>

      {/* Posted footer */}
      {isPosted && (
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--border-subtle)",
            fontSize: 11,
            color: "var(--text-tertiary)",
          }}
        >
          {t("je_card.posted_by")} <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{postedByLabel}</span>{" "}
          {t("je_card.posted_at_time", { time: fmtCreated(live.createdAt) })} ·{" "}
          <a style={{ color: "var(--accent-primary)", cursor: "pointer" }}>{t("je_card.view_audit_trail")}</a>
        </div>
      )}

      {/* Actions */}
      {!isLocked && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 16px",
            borderTop: "1px solid var(--border-subtle)",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => canConfirm && onConfirm && onConfirm(live)}
            disabled={!canConfirm}
            style={{
              background: canConfirm ? "var(--accent-primary)" : "rgba(0,196,140,0.25)",
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
            {t("je_card.confirm_post")}
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
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-strong)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {t("je_card.choose_different")}
              </button>
              <button
                onClick={onAskAminah}
                style={{
                  background: "transparent",
                  color: "var(--role-owner)",
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
                {t("je_card.ask_aminah_btn")}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onEdit}
                style={{
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-strong)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {t("je_card.edit_btn")}
              </button>
              <button
                onClick={onDiscard}
                style={{
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-strong)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {t("je_card.discard_btn")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
