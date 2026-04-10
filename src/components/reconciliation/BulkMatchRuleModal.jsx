import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import LtrText from "../shared/LtrText";
import { previewBulkMatchByRule, bulkMatchByRule } from "../../engine/mockEngine";
import { formatKWDAmount } from "../../utils/format";

export default function BulkMatchRuleModal({ open, onClose, reconciliationId, onApplied }) {
  const { t } = useTranslation("reconciliation");
  useEscapeKey(onClose, open);

  const [amountTolerance, setAmountTolerance] = useState(0.01);
  const [dateToleranceDays, setDateToleranceDays] = useState(2);
  const [descOverlap, setDescOverlap] = useState(0.2);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open || !reconciliationId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const result = await previewBulkMatchByRule(reconciliationId, {
        amountTolerance,
        dateToleranceDays,
        minDescriptionOverlap: descOverlap,
      });
      setPreview(result);
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [open, reconciliationId, amountTolerance, dateToleranceDays, descOverlap]);

  if (!open) return null;

  const handleApply = async () => {
    setApplying(true);
    const result = await bulkMatchByRule(reconciliationId, {
      amountTolerance,
      dateToleranceDays,
      minDescriptionOverlap: descOverlap,
    }, "cfo");
    setApplying(false);
    onApplied && onApplied(result);
    onClose();
  };

  const matchCount = preview?.matchCount || 0;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 520, maxHeight: "80vh", background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} color="var(--accent-primary)" />
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)" }}>{t("bulk_rule.title")}</div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{t("bulk_rule.subtitle")}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>

        {/* Inputs */}
        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
            <InputField label={t("bulk_rule.amount_tolerance_label")} help={t("bulk_rule.amount_tolerance_help")} value={amountTolerance} onChange={setAmountTolerance} step={0.001} min={0} />
            <InputField label={t("bulk_rule.date_tolerance_label")} help={t("bulk_rule.date_tolerance_help")} value={dateToleranceDays} onChange={setDateToleranceDays} step={1} min={0} max={30} />
            <InputField label={t("bulk_rule.desc_overlap_label")} help={t("bulk_rule.desc_overlap_help")} value={descOverlap} onChange={setDescOverlap} step={0.05} min={0} max={1} />
          </div>

          {/* Preview */}
          <div style={{ background: "var(--bg-surface-sunken)", borderRadius: 8, padding: "14px 16px", minHeight: 60 }}>
            {loading ? (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>...</div>
            ) : matchCount === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t("bulk_rule.preview_empty")}</div>
            ) : (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-primary)", marginBottom: 10 }}>
                  {t("bulk_rule.preview_count", { count: matchCount })}
                </div>
                {(preview?.matches || []).slice(0, 5).map((m, i) => (
                  <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{m.bankItem.description}</span>
                    <span style={{ color: "var(--text-tertiary)" }}>↔</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "end" }}>{m.ledgerEntry.description}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", flexShrink: 0, color: "var(--text-primary)" }}><LtrText>{formatKWDAmount(m.bankItem.amount)}</LtrText></span>
                  </div>
                ))}
                {matchCount > 5 && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6 }}>+{matchCount - 5} more</div>}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("bulk_rule.cancel_button")}</button>
          <button onClick={handleApply} disabled={matchCount === 0 || applying} style={{ background: matchCount > 0 ? "var(--accent-primary)" : "rgba(255,255,255,0.05)", color: matchCount > 0 ? "#fff" : "var(--text-tertiary)", border: "none", padding: "9px 18px", borderRadius: 6, cursor: matchCount > 0 ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{applying ? "..." : t("bulk_rule.apply_button")}</button>
        </div>
      </div>
    </>
  );
}

function InputField({ label, help, value, onChange, step, min, max }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 5 }}>{label}</div>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} step={step} min={min} max={max} style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13, fontFamily: "'DM Mono', monospace", outline: "none" }} />
      {help && <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 3, lineHeight: 1.4 }}>{help}</div>}
    </div>
  );
}
