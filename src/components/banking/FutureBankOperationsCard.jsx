import { useTranslation } from "react-i18next";
import { ArrowLeftRight, Send, FileText, CreditCard } from "lucide-react";

export default function FutureBankOperationsCard() {
  const { t } = useTranslation("bank-accounts");
  const OPS = [
    { icon: ArrowLeftRight, label: t("future_ops.transfer") },
    { icon: Send,           label: t("future_ops.wire") },
    { icon: FileText,       label: t("future_ops.statement") },
    { icon: CreditCard,     label: t("future_ops.card_mgmt") },
  ];
  return (
    <div
      style={{
        marginTop: 20,
        padding: "18px 20px",
        background: "var(--bg-surface)",
        border: "1px dashed var(--border-default)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          marginBottom: 12,
        }}
      >
        {t("future_ops.title")}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {OPS.map((op) => (
          <button
            key={op.label}
            disabled
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              color: "var(--text-tertiary)",
              fontSize: 12,
              fontFamily: "inherit",
              opacity: 0.5,
              cursor: "not-allowed",
              textAlign: "start",
            }}
          >
            <op.icon size={14} strokeWidth={2.2} />
            <span style={{ flex: 1 }}>{op.label}</span>
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "var(--semantic-warning)",
                background: "var(--semantic-warning-subtle)",
                border: "1px solid rgba(212,168,75,0.30)",
                padding: "2px 6px",
                borderRadius: 3,
              }}
            >
              {t("future_ops.coming_next")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
