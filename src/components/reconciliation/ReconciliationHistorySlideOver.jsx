import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { History, X, ChevronRight } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import { getReconciliationHistory } from "../../engine/mockEngine";
import { formatKWDAmount, formatDate } from "../../utils/format";

const STATUS_COLORS = {
  completed: "var(--accent-primary)",
  locked: "var(--text-tertiary)",
  "in-progress": "var(--semantic-warning)",
  "not-started": "var(--text-tertiary)",
  "pending-approval": "var(--semantic-info, #3b82f6)",
};

export default function ReconciliationHistorySlideOver({ open, onClose, accountId, accountName, onSelectHistorical }) {
  const { t } = useTranslation("reconciliation");
  const [records, setRecords] = useState(null);
  useEscapeKey(onClose, open);

  useEffect(() => {
    if (open && accountId) {
      setRecords(null);
      getReconciliationHistory(accountId).then(setRecords);
    }
  }, [open, accountId]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: 0, insetInlineEnd: 0, bottom: 0, width: 480, maxWidth: "calc(100vw - 32px)", background: "var(--panel-bg)", borderInlineStart: "1px solid var(--border-default)", zIndex: 301, boxShadow: "-24px 0 60px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <History size={16} color="var(--accent-primary)" />
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)" }}>{t("history.title")}</div>
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{t("history.subtitle", { account: accountName || accountId })}</div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
          {!records ? (
            <div style={{ padding: "20px 22px", color: "var(--text-tertiary)", fontSize: 12 }}>...</div>
          ) : records.length === 0 ? (
            <div style={{ padding: "40px 22px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{t("history.empty_title")}</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>{t("history.empty_body")}</div>
            </div>
          ) : (
            records.map((rec) => {
              const statusColor = STATUS_COLORS[rec.status] || "var(--text-tertiary)";
              return (
                <button key={rec.id} onClick={() => { onSelectHistorical(rec); onClose(); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 22px", background: "transparent", border: "none", borderBottom: "1px solid var(--border-subtle)", cursor: "pointer", fontFamily: "inherit", textAlign: "start", color: "var(--text-primary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,196,140,0.04)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{rec.period.label}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: statusColor, background: `${statusColor}1A`, border: `1px solid ${statusColor}40`, padding: "2px 6px", borderRadius: 3 }}>{rec.status.toUpperCase()}</span>
                    </div>
                    <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-tertiary)" }}>
                      <span>{t("history.matched_count_column")}: <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{rec.matchedCount}/{rec.totalBankItems}</span></span>
                      {rec.exceptionCount > 0 && <span>{t("history.exceptions_column")}: <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{rec.exceptionCount}</span></span>}
                      {rec.completedBy && <span>{rec.completedBy}</span>}
                      {rec.completedAt && <span>{formatDate(rec.completedAt)}</span>}
                    </div>
                    {Math.abs(rec.reconciliationDifference) > 0.001 && (
                      <div style={{ fontSize: 11, color: "var(--semantic-warning)", fontWeight: 500, marginTop: 3 }}>
                        {t("history.difference_column")}: {formatKWDAmount(rec.reconciliationDifference)}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={14} color="var(--text-tertiary)" className="rtl-flip" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
