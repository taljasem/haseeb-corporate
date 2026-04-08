import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

export default function SubmitDraftConfirmationModal({ open, departmentName, note, onClose, onConfirm }) {
  const { t } = useTranslation("budget");
  if (!open) return null;
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
          width: 480,
          maxWidth: "calc(100vw - 32px)",
          background: "#0C0E12",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          zIndex: 301,
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
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "#5B6570" }}>
              {t("submit_modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 20,
                color: "#E6EDF3",
                letterSpacing: "-0.2px",
                marginTop: 4,
              }}
            >
              {t("submit_modal.title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("submit_modal.close")}
            style={{ background: "transparent", border: "none", color: "#5B6570", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 14, color: "#E6EDF3", lineHeight: 1.6 }}>
            {t("submit_modal.body_prefix")}<strong style={{ color: "#00C48C" }}>{departmentName}</strong>{t("submit_modal.body_suffix")}
          </div>
          <div style={{ fontSize: 12, color: "#8B98A5", marginTop: 8, lineHeight: 1.6 }}>
            {t("submit_modal.revise_note")}
          </div>
          {note && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderLeft: "2px solid #00C48C",
                borderRadius: 6,
                fontSize: 12,
                color: "#8B98A5",
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.15em", color: "#5B6570", marginBottom: 4 }}>
                {t("submit_modal.your_note")}
              </div>
              {note}
            </div>
          )}
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
              color: "#8B98A5",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "9px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            {t("submit_modal.cancel")}
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: "#00C48C",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {t("submit_modal.submit")}
          </button>
        </div>
      </div>
    </>
  );
}
