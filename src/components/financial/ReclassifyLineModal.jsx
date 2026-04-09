import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, ArrowRight } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import LtrText from "../shared/LtrText";
import { runValidators, required, minLength } from "../../utils/validation";
import { createReclassificationJE, getChartOfAccounts } from "../../engine/mockEngine";

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

function fmtKWD(n) {
  if (n == null || n === 0) return "0.000";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export default function ReclassifyLineModal({ open, sourceLine, onClose, onPosted }) {
  const { t } = useTranslation("financial");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [accounts, setAccounts] = useState([]);
  const [targetAccount, setTargetAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [effective, setEffective] = useState(new Date().toISOString().slice(0, 10));
  const [errors, setErrors] = useState({});
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!open) return;
    getChartOfAccounts().then(setAccounts);
    setAmount(sourceLine?.current != null ? String(Math.abs(sourceLine.current)) : "");
    setReason("");
    setTargetAccount("");
    setErrors({});
    setEffective(new Date().toISOString().slice(0, 10));
  }, [open, sourceLine]);

  const sourceLabel = useMemo(() => {
    if (!sourceLine) return "";
    return sourceLine.account || sourceLine.label || sourceLine.name || "—";
  }, [sourceLine]);

  if (!open) return null;

  const validate = () => {
    const e = runValidators(
      { targetAccount, reason, amount },
      {
        targetAccount: [required()],
        reason: [required(), minLength(10)],
        amount: [required()],
      }
    );
    if (!e.amount && (Number(amount) <= 0 || isNaN(Number(amount)))) {
      e.amount = { key: "validation.amount_required" };
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePost = async () => {
    if (!validate()) return;
    setPosting(true);
    const je = await createReclassificationJE(sourceLabel, targetAccount, Number(amount), reason, effective);
    setPosting(false);
    if (onPosted) onPosted(je);
    if (onClose) onClose();
  };

  const err = (k) =>
    errors[k] ? (
      <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>
        {tc(errors[k].key, errors[k].values || {})}
      </div>
    ) : null;
  const invalid = (k) => (errors[k] ? { borderColor: "var(--semantic-danger)" } : null);

  const previewAmount = Number(amount) || 0;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 560, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 80px)",
          background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12, zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {t("reclassify.label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.2px", marginTop: 2 }}>
              {t("reclassify.title")}
            </div>
          </div>
          <button onClick={onClose} aria-label={t("reclassify.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Label>{t("reclassify.field_source")}</Label>
            <div style={{ ...inputStyle, background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "default" }}>
              {sourceLabel}
            </div>
          </div>
          <div>
            <Label>{t("reclassify.field_target")}</Label>
            <select
              value={targetAccount}
              onChange={(e) => { setTargetAccount(e.target.value); if (errors.targetAccount) setErrors({ ...errors, targetAccount: null }); }}
              style={{ ...inputStyle, ...invalid("targetAccount"), appearance: "none" }}
            >
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.code} value={`${a.code} ${a.name}`}>{a.code} — {a.name}</option>
              ))}
            </select>
            {err("targetAccount")}
          </div>
          <div>
            <Label>{t("reclassify.field_amount")}</Label>
            <input
              value={amount}
              onChange={(e) => { setAmount(e.target.value); if (errors.amount) setErrors({ ...errors, amount: null }); }}
              inputMode="decimal"
              style={{ ...inputStyle, ...invalid("amount"), fontFamily: "'DM Mono', monospace" }}
            />
            {err("amount")}
          </div>
          <div>
            <Label>{t("reclassify.field_reason")}</Label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (errors.reason) setErrors({ ...errors, reason: null }); }}
              placeholder={t("reclassify.reason_placeholder")}
              rows={3}
              style={{ ...inputStyle, ...invalid("reason"), resize: "vertical" }}
            />
            {err("reason")}
          </div>
          <div>
            <Label>{t("reclassify.field_effective")}</Label>
            <input
              type="date"
              value={effective}
              onChange={(e) => setEffective(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}
            />
          </div>

          <div
            style={{
              background: "var(--bg-surface-sunken)",
              border: "1px solid rgba(0,196,140,0.20)",
              borderRadius: 8,
              padding: "12px 14px",
              marginTop: 4,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--accent-primary)", marginBottom: 8 }}>
              {t("reclassify.preview_title")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
              <div style={{ flex: 1, color: "var(--text-secondary)" }}>
                <div style={{ fontSize: 9, color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>{t("reclassify.preview_debit")}</div>
                <div>{targetAccount || "—"}</div>
              </div>
              <ArrowRight size={14} color="var(--text-tertiary)" className="rtl-flip" />
              <div style={{ flex: 1, color: "var(--text-secondary)" }}>
                <div style={{ fontSize: 9, color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>{t("reclassify.preview_credit")}</div>
                <div>{sourceLabel}</div>
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 600, color: "var(--accent-primary)" }}>
                <LtrText>{fmtKWD(previewAmount)}</LtrText>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={btnSecondary}>{t("reclassify.cancel")}</button>
          <button onClick={handlePost} disabled={posting} style={btnPrimary(posting)}>
            {posting ? <><Spinner size={13} />&nbsp;{t("reclassify.posting")}</> : t("reclassify.post")}
          </button>
        </div>
      </div>
    </>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{children}</div>;
}
const btnSecondary = { background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" };
const btnPrimary = (loading) => ({ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" });
