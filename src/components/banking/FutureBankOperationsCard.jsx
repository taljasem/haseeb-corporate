import { ArrowLeftRight, Send, FileText, CreditCard } from "lucide-react";

const OPS = [
  { icon: ArrowLeftRight, label: "Transfer between accounts" },
  { icon: Send,           label: "Initiate wire" },
  { icon: FileText,       label: "Request statement" },
  { icon: CreditCard,     label: "Card management" },
];

export default function FutureBankOperationsCard() {
  return (
    <div
      style={{
        marginTop: 20,
        padding: "18px 20px",
        background: "rgba(255,255,255,0.02)",
        border: "1px dashed rgba(255,255,255,0.10)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "#5B6570",
          marginBottom: 12,
        }}
      >
        MORE BANK OPERATIONS
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
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              color: "#5B6570",
              fontSize: 12,
              fontFamily: "inherit",
              opacity: 0.5,
              cursor: "not-allowed",
              textAlign: "left",
            }}
          >
            <op.icon size={14} strokeWidth={2.2} />
            <span style={{ flex: 1 }}>{op.label}</span>
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#D4A84B",
                background: "rgba(212,168,75,0.10)",
                border: "1px solid rgba(212,168,75,0.30)",
                padding: "2px 6px",
                borderRadius: 3,
              }}
            >
              COMING NEXT
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
