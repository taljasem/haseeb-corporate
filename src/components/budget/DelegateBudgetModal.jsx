import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { getBudgetById, delegateBudget, getTeamMembers } from "../../engine/mockEngine";
import { formatKWD } from "../../utils/format";

const DEFAULT_ASSIGNMENTS = {
  "Operations":    "noor",
  "Sales (Ops)":   "jasem",
  "Marketing":     "layla",
  "Tech & Infra":  "sara",
  "Admin":         "sara",
};

export default function DelegateBudgetModal({ open, budgetId, onClose, onDelegated }) {
  const { t } = useTranslation("budget");
  const [budget, setBudget] = useState(null);
  const [team, setTeam] = useState([]);
  const [assignments, setAssignments] = useState({}); // departmentId → juniorUserId
  const [notes, setNotes] = useState({});             // departmentId → note string
  const [expandedNotes, setExpandedNotes] = useState({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !budgetId) return;
    getBudgetById(budgetId).then((b) => {
      setBudget(b);
      if (b) {
        const init = {};
        b.departments
          .filter((d) => d.category === "expense")
          .forEach((d) => {
            init[d.id] = DEFAULT_ASSIGNMENTS[d.name] || "sara";
          });
        setAssignments(init);
      }
    });
    getTeamMembers().then((t) => setTeam(t.filter((m) => m.id !== "self")));
  }, [open, budgetId]);

  if (!open) return null;

  const expenseDepts = (budget?.departments || []).filter((d) => d.category === "expense");
  const canSend = budget && expenseDepts.every((d) => !!assignments[d.id]);

  const handleSend = async () => {
    setSending(true);
    const payload = expenseDepts.map((d) => ({
      departmentId: d.id,
      juniorUserId: assignments[d.id],
      notes: notes[d.id] || null,
    }));
    await delegateBudget(budgetId, payload);
    setSending(false);
    onDelegated && onDelegated(payload.length);
    onClose && onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600, maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 80px)",
          background: "#0C0E12",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12, zIndex: 301,
          display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "#5B6570" }}>
              {t("delegate_modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22, color: "#E6EDF3", letterSpacing: "-0.2px", marginTop: 2,
              }}
            >
              {t("delegate_modal.title")}
            </div>
            {budget && (
              <div style={{ fontSize: 11, color: "#5B6570", marginTop: 4 }}>
                {t("delegate_modal.sub", { period: budget.period.label, count: expenseDepts.length })}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t("delegate_modal.close")}
            style={{ background: "transparent", border: "none", color: "#5B6570", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "14px 22px 4px", overflowY: "auto", flex: 1 }}>
          {expenseDepts.map((d) => {
            const expanded = !!expandedNotes[d.id];
            return (
              <div
                key={d.id}
                style={{
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#E6EDF3", fontWeight: 500 }}>{d.name}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#5B6570",
                        fontFamily: "'DM Mono', monospace",
                        marginTop: 2,
                      }}
                    >
                      {formatKWD(d.totalAnnual)}
                    </div>
                  </div>
                  <select
                    value={assignments[d.id] || ""}
                    onChange={(e) => setAssignments({ ...assignments, [d.id]: e.target.value })}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "#E6EDF3",
                      fontSize: 12,
                      fontFamily: "inherit",
                      minWidth: 160,
                    }}
                  >
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() =>
                    setExpandedNotes({ ...expandedNotes, [d.id]: !expanded })
                  }
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#00C48C",
                    fontSize: 11,
                    cursor: "pointer",
                    padding: "6px 0 0",
                    fontFamily: "inherit",
                  }}
                >
                  {expanded ? t("delegate_modal.hide_notes") : t("delegate_modal.add_notes")}
                </button>
                {expanded && (
                  <textarea
                    value={notes[d.id] || ""}
                    onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })}
                    placeholder={t("delegate_modal.notes_placeholder", {
                      name: (team.find((m) => m.id === assignments[d.id]) || {}).name || t("delegate_modal.notes_fallback")
                    })}
                    rows={2}
                    style={{
                      width: "100%",
                      marginTop: 6,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "#E6EDF3",
                      fontSize: 12,
                      fontFamily: "inherit",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            padding: "14px 22px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "#5B6570",
              marginBottom: 10,
              fontStyle: "italic",
            }}
          >
            {t("delegate_modal.footnote", { count: expenseDepts.length })}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
              {t("delegate_modal.cancel")}
            </button>
            <button
              onClick={handleSend}
              disabled={!canSend || sending}
              style={{
                background: canSend ? "#00C48C" : "rgba(0,196,140,0.25)",
                color: "#fff",
                border: "none",
                padding: "9px 18px",
                borderRadius: 6,
                cursor: canSend ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              {sending ? t("delegate_modal.sending") : t("delegate_modal.send")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
