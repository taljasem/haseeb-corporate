import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import AccountPicker from "../cfo/AccountPicker";
import { createCategorizationRule, updateCategorizationRule } from "../../engine/mockEngine";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";

const inputStyle = {
  width: "100%",
  background: "var(--bg-surface-sunken)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

function FieldDot({ filled }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: filled ? "var(--accent-primary)" : "transparent",
        border: `1px solid ${filled ? "var(--accent-primary)" : "var(--border-strong)"}`,
        marginInlineEnd: 8,
        flexShrink: 0,
      }}
    />
  );
}
function FieldLabel({ filled, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.15em",
        color: "var(--text-tertiary)",
        marginBottom: 6,
      }}
    >
      <FieldDot filled={filled} />
      {children}
    </div>
  );
}

function SegBtn({ on, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 10px",
        background: on ? "var(--accent-primary-subtle)" : "transparent",
        border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
        color: on ? "var(--accent-primary)" : "var(--text-secondary)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        cursor: "pointer",
        borderRadius: 6,
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

const MODE_IDS = ["auto-apply", "suggest-only", "ask-each-time"];
const MODE_KEYS = {
  "auto-apply": { label: "mode_auto_apply", desc: "mode_auto_apply_desc" },
  "suggest-only": { label: "mode_suggest_only", desc: "mode_suggest_only_desc" },
  "ask-each-time": { label: "mode_ask_each", desc: "mode_ask_each_desc" },
};

export default function NewCategorizationRuleModal({ open, onClose, onCreated, prefill = null, editingRule = null }) {
  const { t } = useTranslation("rules");
  useEscapeKey(onClose, open);
  const [name, setName] = useState("");
  const [patternType, setPatternType] = useState("contains");
  const [patternValue, setPatternValue] = useState("");
  const [debitAccount, setDebitAccount] = useState(null);
  const [creditAccount, setCreditAccount] = useState(null);
  const [mode, setMode] = useState("auto-apply");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [approvalThreshold, setApprovalThreshold] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingRule) {
      setName(editingRule.name || "");
      setPatternType(editingRule.merchantPattern?.type || "contains");
      setPatternValue(editingRule.merchantPattern?.value || "");
      setDebitAccount(editingRule.debitAccount || null);
      setCreditAccount(editingRule.creditAccount || null);
      setMode(editingRule.mode || "auto-apply");
      setAmountMin(editingRule.conditions?.amountMin != null ? String(editingRule.conditions.amountMin) : "");
      setAmountMax(editingRule.conditions?.amountMax != null ? String(editingRule.conditions.amountMax) : "");
      setApprovalThreshold(editingRule.approvalThreshold != null ? String(editingRule.approvalThreshold) : "");
    } else if (prefill) {
      setName(prefill.name || "");
      setPatternValue(prefill.merchant || "");
    } else {
      setName("");
      setPatternType("contains");
      setPatternValue("");
      setDebitAccount(null);
      setCreditAccount(null);
      setMode("auto-apply");
      setAmountMin("");
      setAmountMax("");
      setApprovalThreshold("");
    }
  }, [open, editingRule, prefill]);

  if (!open) return null;

  const canCreate = name.trim() && patternValue.trim() && debitAccount && creditAccount;

  const handleCreate = async () => {
    setSending(true);
    const params = {
      name,
      merchantPattern: { type: patternType, value: patternValue },
      debitAccount: { code: debitAccount.code, name: debitAccount.name },
      creditAccount: { code: creditAccount.code, name: creditAccount.name },
      mode,
      conditions: {
        amountMin: amountMin ? Number(amountMin) : null,
        amountMax: amountMax ? Number(amountMax) : null,
        sourceAccount: null,
      },
      approvalThreshold: approvalThreshold ? Number(approvalThreshold) : null,
    };
    const rule = editingRule
      ? await updateCategorizationRule(editingRule.id, params)
      : await createCategorizationRule(params);
    setSending(false);
    onCreated && onCreated(rule);
    onClose && onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 560,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 80px)",
          background: "var(--bg-surface-raised)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          zIndex: 301,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {editingRule ? t("cat_modal.edit_label") : t("cat_modal.new_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                letterSpacing: "-0.2px",
                marginTop: 2,
              }}
            >
              {editingRule ? t("cat_modal.update_title") : t("cat_modal.create_title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("cat_modal.close")}
            style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={!!name.trim()}>{t("cat_modal.rule_name")}</FieldLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("cat_modal.rule_name_placeholder")}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={!!patternValue.trim()}>{t("cat_modal.merchant_pattern")}</FieldLabel>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <SegBtn on={patternType === "exact"}    onClick={() => setPatternType("exact")}>{t("cat_modal.pattern_exact")}</SegBtn>
              <SegBtn on={patternType === "contains"} onClick={() => setPatternType("contains")}>{t("cat_modal.pattern_contains")}</SegBtn>
              <SegBtn on={patternType === "regex"}    onClick={() => setPatternType("regex")}>{t("cat_modal.pattern_regex")}</SegBtn>
            </div>
            <input
              value={patternValue}
              onChange={(e) => setPatternValue(e.target.value)}
              placeholder={t("cat_modal.pattern_placeholder")}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={!!debitAccount}>{t("cat_modal.debit_account")}</FieldLabel>
            <AccountPicker onSelect={setDebitAccount} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={!!creditAccount}>{t("cat_modal.credit_account")}</FieldLabel>
            <AccountPicker onSelect={setCreditAccount} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={true}>{t("cat_modal.mode")}</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {MODE_IDS.map((mId) => {
                const on = mode === mId;
                const mKeys = MODE_KEYS[mId];
                return (
                  <button
                    key={mId}
                    onClick={() => setMode(mId)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "10px 12px",
                      background: on ? "var(--bg-selected)" : "var(--bg-surface)",
                      border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 8,
                      cursor: "pointer",
                      textAlign: "start",
                      fontFamily: "inherit",
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        border: `2px solid ${on ? "var(--accent-primary)" : "var(--border-strong)"}`,
                        background: on ? "var(--accent-primary)" : "transparent",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{t(`cat_modal.${mKeys.label}`)}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{t(`cat_modal.${mKeys.desc}`)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <details style={{ marginBottom: 14 }}>
            <summary
              style={{
                fontSize: 11,
                color: "var(--accent-primary)",
                cursor: "pointer",
                padding: "8px 0",
                listStyle: "none",
              }}
            >
              {t("cat_modal.conditions_toggle")}
            </summary>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <FieldLabel filled={!!amountMin}>{t("cat_modal.min_amount_kwd")}</FieldLabel>
                <input
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  placeholder={t("cat_modal.min_placeholder")}
                  style={inputStyle}
                />
              </div>
              <div>
                <FieldLabel filled={!!amountMax}>{t("cat_modal.max_amount_kwd")}</FieldLabel>
                <input
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  placeholder={t("cat_modal.max_placeholder")}
                  style={inputStyle}
                />
              </div>
            </div>
          </details>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={!!approvalThreshold}>{t("cat_modal.approval_threshold")}</FieldLabel>
            <input
              value={approvalThreshold}
              onChange={(e) => setApprovalThreshold(e.target.value)}
              placeholder={t("cat_modal.approval_placeholder")}
              style={inputStyle}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            padding: "14px 22px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "9px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            {t("cat_modal.cancel")}
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || sending}
            style={{
              background: canCreate ? "var(--accent-primary)" : "rgba(0,196,140,0.25)",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 6,
              cursor: canCreate ? "pointer" : "not-allowed",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {sending ? <><Spinner size={13} />&nbsp;{t("cat_modal.saving")}</> : editingRule ? t("cat_modal.save_changes") : t("cat_modal.create_rule")}
          </button>
        </div>
      </div>
    </>
  );
}
