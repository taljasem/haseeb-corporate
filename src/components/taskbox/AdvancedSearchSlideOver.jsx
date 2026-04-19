import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";

const inputStyle = {
  width: "100%",
  background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)",
  borderRadius: 8,
  padding: "9px 12px",
  color: "var(--text-primary)",
  fontSize: 12,
  fontFamily: "inherit",
  outline: "none",
};

const STATUSES = ["open", "in-progress", "completed", "rejected", "cancelled", "needs-revision", "escalated"];
const PRIORITIES = ["normal", "high", "urgent"];
const LINKED_TYPES = ["any", "budget", "journal-entry", "reconciliation", "month-end-close", "variance", "write-off"];

export default function AdvancedSearchSlideOver({ open, filters, people, taskTypes, onClose, onApply, onReset }) {
  const { t } = useTranslation("taskbox");
  useEscapeKey(onClose, open);
  const [draft, setDraft] = useState(filters || {});

  useEffect(() => {
    if (open) setDraft(filters || {});
  }, [open, filters]);

  if (!open) return null;

  const toggleInArray = (key, value) => {
    const cur = draft[key] || [];
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
    setDraft({ ...draft, [key]: next });
  };

  const setField = (key, value) => setDraft({ ...draft, [key]: value });

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div
        data-panel="aminah-slideover"
        style={{
          position: "fixed", top: 0, insetInlineEnd: 0, bottom: 0,
          width: 460, maxWidth: "calc(100vw - 32px)",
          background: "var(--panel-bg)",
          borderInlineStart: "1px solid var(--border-default)",
          zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)" }}>{t("search.slideover_title")}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{t("search.slideover_subtitle")}</div>
          </div>
          <button onClick={onClose} aria-label={t("search.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Row2
            leftLabel={t("search.field_date_from")}
            right={
              <input type="date" value={draft.createdAfter || ""} onChange={(e) => setField("createdAfter", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
            }
          />
          <Row2
            leftLabel={t("search.field_date_to")}
            right={
              <input type="date" value={draft.createdBefore || ""} onChange={(e) => setField("createdBefore", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
            }
          />
          <ChipField label={t("search.field_senders")} values={people} selected={draft.senderIds || []} onToggle={(v) => toggleInArray("senderIds", v)} renderLabel={(p) => p.name} keyFn={(p) => p.id} />
          <ChipField label={t("search.field_recipients")} values={people} selected={draft.recipientIds || []} onToggle={(v) => toggleInArray("recipientIds", v)} renderLabel={(p) => p.name} keyFn={(p) => p.id} />
          <ChipField label={t("search.field_types")} values={taskTypes} selected={draft.types || []} onToggle={(v) => toggleInArray("types", v)} renderLabel={(t2) => t2.label} keyFn={(t2) => t2.id} />
          <ChipField label={t("search.field_statuses")} values={STATUSES.map((s) => ({ id: s, label: s }))} selected={draft.statuses || []} onToggle={(v) => toggleInArray("statuses", v)} renderLabel={(s) => s.label} keyFn={(s) => s.id} />
          <ChipField label={t("search.field_priorities")} values={PRIORITIES.map((s) => ({ id: s, label: s }))} selected={draft.priorities || []} onToggle={(v) => toggleInArray("priorities", v)} renderLabel={(s) => s.label} keyFn={(s) => s.id} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>
              {t("search.field_has_attachments")}
            </div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={!!draft.hasAttachments} onChange={(e) => setField("hasAttachments", e.target.checked)} />
              <span>{t("search.field_has_attachments")}</span>
            </label>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>
              {t("search.field_linked_type")}
            </div>
            <select value={draft.linkedType || ""} onChange={(e) => setField("linkedType", e.target.value || null)} style={{ ...inputStyle, appearance: "none" }}>
              {LINKED_TYPES.map((lt) => (
                <option key={lt} value={lt === "any" ? "" : lt}>{lt === "any" ? t("search.linked_any") : lt}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={() => { onReset && onReset(); setDraft({}); }} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("search.reset")}</button>
          <button onClick={() => { onApply && onApply(draft); }} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{t("search.apply")}</button>
        </div>
      </div>
    </>
  );
}

function Row2({ leftLabel, right }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{leftLabel}</div>
      {right}
    </div>
  );
}

function ChipField({ label, values, selected, onToggle, renderLabel, keyFn }) {
  if (!values || values.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {values.map((v) => {
          const k = keyFn(v);
          const on = selected.includes(k);
          return (
            <button
              key={k}
              onClick={() => onToggle(k)}
              style={{
                padding: "5px 12px", borderRadius: 14,
                background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)",
                border: on ? "1px solid var(--accent-primary-border)" : "1px solid var(--border-default)",
                color: on ? "var(--accent-primary)" : "var(--text-secondary)",
                fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {renderLabel(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
