import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength } from "../../utils/validation";
import { escalateTask, bulkEscalateTasks, getRecipientsForRole } from "../../engine/mockEngine";

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

function normalizeRoleFromRecipient(task) {
  // Decide which roles the current assignee can escalate TO.
  const role = task?.recipient?.role || "";
  if (role === "Owner") return null;
  if (role === "CFO")   return ["owner"];
  // Junior
  return ["cfo", "owner"];
}

export default function EscalateTaskModal({ open, task, bulkTaskIds, onClose, onEscalated }) {
  const { t } = useTranslation("taskbox");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [targets, setTargets] = useState([]);
  const [toUserId, setToUserId] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState("current");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const isBulk = Array.isArray(bulkTaskIds) && bulkTaskIds.length > 0;

  useEffect(() => {
    if (!open) return;
    setReason(""); setPriority("current"); setErrors({});
    // Always offer owner + cfo in bulk mode since tasks may vary; for single,
    // derive from the task's current recipient role.
    const ids = isBulk ? ["cfo", "owner"] : normalizeRoleFromRecipient(task);
    if (!ids || ids.length === 0) {
      setTargets([]);
      setToUserId("");
      return;
    }
    // Pull recipient details from the engine (uses CFO role as a superset)
    getRecipientsForRole("Junior").then((people) => {
      const map = {};
      for (const p of people) map[p.id] = p;
      // Add owner + cfo fallbacks
      const list = ids.map((id) => map[id] || { id, name: id.toUpperCase(), role: id === "owner" ? "Owner" : "CFO" });
      setTargets(list);
      setToUserId(list[0]?.id || "");
    }).catch(() => {
      const fallback = ids.map((id) => ({ id, name: id.toUpperCase(), role: id === "owner" ? "Owner" : "CFO" }));
      setTargets(fallback);
      setToUserId(fallback[0]?.id || "");
    });
  }, [open, task, isBulk]);

  if (!open) return null;

  const noTarget = !isBulk && targets.length === 0;

  const handleSubmit = async () => {
    if (noTarget) return;
    const e = runValidators({ reason, toUserId }, { reason: [required(), minLength(10)], toUserId: [required()] });
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    const resolvedPriority = priority === "current" ? undefined : priority;
    if (isBulk) {
      const r = await bulkEscalateTasks(bulkTaskIds, toUserId, reason, resolvedPriority);
      if (onEscalated) onEscalated({ ...r, toUserId });
    } else if (task) {
      const r = await escalateTask(task.id, toUserId, reason, resolvedPriority);
      if (onEscalated) onEscalated({ ...r, toUserId });
    }
    setSubmitting(false);
    if (onClose) onClose();
  };

  const err = (k) =>
    errors[k] ? (
      <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>
        {tc(errors[k].key, errors[k].values || {})}
      </div>
    ) : null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 520, maxWidth: "calc(100vw - 32px)",
          background: "var(--panel-bg)", border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12, zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {t("escalate.label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>
              {isBulk ? t("escalate.bulk_title", { count: bulkTaskIds.length }) : t("escalate.title")}
            </div>
          </div>
          <button onClick={onClose} aria-label={t("escalate.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {noTarget && (
            <div style={{ display: "flex", gap: 8, padding: "12px 14px", background: "var(--semantic-warning-subtle)", border: "1px solid rgba(212,168,75,0.30)", borderRadius: 8, color: "var(--semantic-warning)", fontSize: 12 }}>
              <AlertTriangle size={14} /> {t("escalate.no_target")}
            </div>
          )}
          {!noTarget && (
            <>
              <Field label={t("escalate.field_to")}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {targets.map((p) => {
                    const on = toUserId === p.id;
                    return (
                      <button key={p.id} onClick={() => { setToUserId(p.id); if (errors.toUserId) setErrors({ ...errors, toUserId: null }); }} style={{ padding: "8px 14px", borderRadius: 8, background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)", border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)", color: on ? "var(--accent-primary)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        {p.name} <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginInlineStart: 4 }}>({p.role})</span>
                      </button>
                    );
                  })}
                </div>
                {err("toUserId")}
              </Field>
              <Field label={t("escalate.field_reason")}>
                <textarea
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); if (errors.reason) setErrors({ ...errors, reason: null }); }}
                  placeholder={t("escalate.reason_placeholder")}
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical", ...(errors.reason ? { borderColor: "var(--semantic-danger)" } : {}) }}
                />
                {err("reason")}
              </Field>
              <Field label={t("escalate.field_priority")}>
                <div style={{ display: "flex", gap: 6 }}>
                  {["current", "high", "urgent"].map((p) => {
                    const on = priority === p;
                    return (
                      <button key={p} onClick={() => setPriority(p)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, background: on ? "var(--accent-primary-subtle)" : "transparent", border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)", color: on ? "var(--accent-primary)" : "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        {t(`escalate.priority_${p}`)}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("escalate.cancel")}</button>
          <button onClick={handleSubmit} disabled={submitting || noTarget} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: submitting || noTarget ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {submitting ? <><Spinner size={13} />&nbsp;{t("escalate.submitting")}</> : t("escalate.submit")}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return <div><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{label}</div>{children}</div>;
}
