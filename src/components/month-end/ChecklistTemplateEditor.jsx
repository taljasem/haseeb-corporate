/**
 * ChecklistTemplateEditor (FN-227, Phase 4 Wave 1 Item 3).
 *
 * OWNER-only modal for managing the monthly-close-checklist template.
 * Lives alongside SubmitCloseConfirmationModal / RejectCloseModal in
 * /components/month-end/.
 *
 * Behavior:
 *   • Lists existing template items in sortOrder asc.
 *   • Inline-edit any row (label / description / sortOrder /
 *     completeRoleGate / isActive).
 *   • Add-new row appended at the bottom.
 *   • Soft-delete by toggling `isActive=false` (backend supports
 *     PATCH /template/:id with isActive; there is no DELETE in scope).
 *   • After any mutation, calls onRefresh so the parent (instance panel)
 *     re-loads the template list.
 *
 * Role assumption: only OWNER gets here; the parent gates rendering.
 * The backend still enforces 403 authoritatively.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Save, Check, Trash2, RotateCcw } from "lucide-react";
import ActionButton from "../ds/ActionButton";
import Spinner from "../shared/Spinner";
import useEscapeKey from "../../hooks/useEscapeKey";
import {
  createTemplateItem,
  updateTemplateItem,
} from "../../engine";

const ROLE_GATES = ["OWNER", "ACCOUNTANT", "OWNER_OR_ACCOUNTANT"];

const inputStyle = {
  width: "100%",
  background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)",
  borderRadius: 6,
  padding: "8px 10px",
  color: "var(--text-primary)",
  fontSize: 12,
  fontFamily: "inherit",
  outline: "none",
};

export default function ChecklistTemplateEditor({ open, templates, onClose, onRefresh }) {
  const { t } = useTranslation("close");
  useEscapeKey(onClose, open);

  // draft rows keyed by id, plus a trailing "new" row when user clicks Add.
  const [drafts, setDrafts] = useState({});
  const [newRows, setNewRows] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setDrafts({});
      setNewRows([]);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const setField = (id, field, value) => {
    setDrafts((d) => ({
      ...d,
      [id]: { ...(d[id] || {}), [field]: value },
    }));
  };

  const startEditing = (tpl) => {
    setDrafts((d) => ({
      ...d,
      [tpl.id]: {
        label: tpl.label,
        description: tpl.description || "",
        sortOrder: tpl.sortOrder,
        completeRoleGate: tpl.completeRoleGate,
        isActive: tpl.isActive,
      },
    }));
  };

  const cancelEditing = (id) => {
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  };

  const handleSave = async (id) => {
    const draft = drafts[id];
    if (!draft) return;
    if (!draft.label || !draft.label.trim()) {
      setError(t("checklist.template.error.label_required"));
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      await updateTemplateItem(id, {
        label: draft.label.trim(),
        description: draft.description?.trim() || null,
        sortOrder: Number(draft.sortOrder) || 0,
        completeRoleGate: draft.completeRoleGate,
        isActive: !!draft.isActive,
      });
      cancelEditing(id);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err?.message || t("checklist.template.error.save_failed"));
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (tpl) => {
    setSavingId(tpl.id);
    setError(null);
    try {
      await updateTemplateItem(tpl.id, { isActive: !tpl.isActive });
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err?.message || t("checklist.template.error.save_failed"));
    } finally {
      setSavingId(null);
    }
  };

  const addNewRow = () => {
    const tempId = `new-${Date.now()}-${newRows.length}`;
    const maxOrder = templates.reduce((acc, t) => Math.max(acc, t.sortOrder || 0), 0);
    setNewRows((rows) => [
      ...rows,
      {
        tempId,
        label: "",
        description: "",
        sortOrder: maxOrder + 10,
        completeRoleGate: "OWNER_OR_ACCOUNTANT",
      },
    ]);
  };

  const updateNewRow = (tempId, field, value) => {
    setNewRows((rows) =>
      rows.map((r) => (r.tempId === tempId ? { ...r, [field]: value } : r))
    );
  };

  const removeNewRow = (tempId) => {
    setNewRows((rows) => rows.filter((r) => r.tempId !== tempId));
  };

  const saveNewRow = async (tempId) => {
    const row = newRows.find((r) => r.tempId === tempId);
    if (!row) return;
    if (!row.label || !row.label.trim()) {
      setError(t("checklist.template.error.label_required"));
      return;
    }
    setSavingId(tempId);
    setError(null);
    try {
      await createTemplateItem({
        label: row.label.trim(),
        description: row.description?.trim() || null,
        sortOrder: Number(row.sortOrder) || 0,
        completeRoleGate: row.completeRoleGate,
      });
      removeNewRow(tempId);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err?.message || t("checklist.template.error.save_failed"));
    } finally {
      setSavingId(null);
    }
  };

  const sorted = (templates || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--overlay-backdrop)",
          backdropFilter: "blur(4px)",
          zIndex: 320,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("checklist.template.modal_title")}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 720,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 48px)",
          background: "var(--bg-surface-raised)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          zIndex: 321,
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t("checklist.template.modal_label")}
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
              {t("checklist.template.modal_title")}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              {t("checklist.template.modal_subtitle")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("checklist.template.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
          {error && (
            <div
              role="alert"
              style={{
                background: "var(--semantic-danger-subtle)",
                border: "1px solid var(--semantic-danger)",
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 12,
                fontSize: 12,
                color: "var(--semantic-danger)",
              }}
            >
              {error}
            </div>
          )}

          {/* Column headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "48px 1fr 200px 64px 100px",
              gap: 10,
              padding: "0 4px 6px",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--text-tertiary)",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div>{t("checklist.template.header.order")}</div>
            <div>{t("checklist.template.header.label")}</div>
            <div>{t("checklist.template.header.gate")}</div>
            <div>{t("checklist.template.header.active")}</div>
            <div style={{ textAlign: "end" }}>{t("checklist.template.header.actions")}</div>
          </div>

          {sorted.length === 0 && newRows.length === 0 && (
            <div
              style={{
                padding: "22px 10px",
                textAlign: "center",
                fontSize: 12,
                color: "var(--text-tertiary)",
                fontStyle: "italic",
              }}
            >
              {t("checklist.template.none_yet")}
            </div>
          )}

          {sorted.map((tpl) => {
            const isEditing = drafts[tpl.id] !== undefined;
            const draft = drafts[tpl.id];
            const saving = savingId === tpl.id;
            return (
              <div
                key={tpl.id}
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                  padding: "10px 4px",
                  opacity: tpl.isActive ? 1 : 0.55,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr 200px 64px 100px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div>
                    {isEditing ? (
                      <input
                        type="number"
                        value={draft.sortOrder}
                        onChange={(e) => setField(tpl.id, "sortOrder", e.target.value)}
                        style={inputStyle}
                        aria-label={t("checklist.template.header.order")}
                      />
                    ) : (
                      <span
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 12,
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {tpl.sortOrder}
                      </span>
                    )}
                  </div>
                  <div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={draft.label}
                        onChange={(e) => setField(tpl.id, "label", e.target.value)}
                        style={inputStyle}
                        maxLength={200}
                        aria-label={t("checklist.template.header.label")}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--text-primary)",
                          fontWeight: 500,
                        }}
                      >
                        {tpl.label}
                      </div>
                    )}
                    {isEditing ? (
                      <textarea
                        value={draft.description || ""}
                        onChange={(e) => setField(tpl.id, "description", e.target.value)}
                        placeholder={t("checklist.template.description_placeholder")}
                        rows={2}
                        maxLength={500}
                        style={{ ...inputStyle, marginTop: 6, resize: "vertical" }}
                        aria-label={t("checklist.template.description_label")}
                      />
                    ) : tpl.description ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          marginTop: 2,
                          lineHeight: 1.5,
                        }}
                      >
                        {tpl.description}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    {isEditing ? (
                      <select
                        value={draft.completeRoleGate}
                        onChange={(e) => setField(tpl.id, "completeRoleGate", e.target.value)}
                        style={inputStyle}
                        aria-label={t("checklist.template.header.gate")}
                      >
                        {ROLE_GATES.map((g) => (
                          <option key={g} value={g}>
                            {t(`checklist.role_gate.${g}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          color: "var(--text-secondary)",
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: "var(--bg-surface-sunken)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {t(`checklist.role_gate.${tpl.completeRoleGate}`)}
                      </span>
                    )}
                  </div>
                  <div>
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={!!draft.isActive}
                        onChange={(e) => setField(tpl.id, "isActive", e.target.checked)}
                        aria-label={t("checklist.template.header.active")}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          color: tpl.isActive ? "var(--accent-primary)" : "var(--text-tertiary)",
                        }}
                      >
                        {tpl.isActive
                          ? t("checklist.template.active_yes")
                          : t("checklist.template.active_no")}
                      </span>
                    )}
                  </div>
                  <div
                    style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}
                  >
                    {isEditing ? (
                      <>
                        <ActionButton
                          variant="primary"
                          size="sm"
                          icon={saving ? undefined : Save}
                          label={saving ? t("checklist.template.saving") : t("checklist.template.save")}
                          disabled={saving}
                          onClick={() => handleSave(tpl.id)}
                        />
                        {!saving && (
                          <ActionButton
                            variant="tertiary"
                            size="sm"
                            label={t("checklist.template.cancel")}
                            onClick={() => cancelEditing(tpl.id)}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          label={t("checklist.template.edit")}
                          onClick={() => startEditing(tpl)}
                          disabled={saving}
                        />
                        <ActionButton
                          variant="tertiary"
                          size="sm"
                          icon={tpl.isActive ? Trash2 : RotateCcw}
                          label={
                            tpl.isActive
                              ? t("checklist.template.deactivate")
                              : t("checklist.template.reactivate")
                          }
                          disabled={saving}
                          onClick={() => handleToggleActive(tpl)}
                        />
                      </>
                    )}
                    {saving && <Spinner size={12} />}
                  </div>
                </div>
              </div>
            );
          })}

          {/* New rows */}
          {newRows.map((row) => {
            const saving = savingId === row.tempId;
            return (
              <div
                key={row.tempId}
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                  padding: "10px 4px",
                  background: "var(--bg-surface-sunken)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr 200px 64px 100px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="number"
                    value={row.sortOrder}
                    onChange={(e) => updateNewRow(row.tempId, "sortOrder", e.target.value)}
                    style={inputStyle}
                    aria-label={t("checklist.template.header.order")}
                  />
                  <div>
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => updateNewRow(row.tempId, "label", e.target.value)}
                      placeholder={t("checklist.template.new_row_label_placeholder")}
                      style={inputStyle}
                      maxLength={200}
                      aria-label={t("checklist.template.header.label")}
                    />
                    <textarea
                      value={row.description}
                      onChange={(e) => updateNewRow(row.tempId, "description", e.target.value)}
                      placeholder={t("checklist.template.description_placeholder")}
                      rows={2}
                      maxLength={500}
                      style={{ ...inputStyle, marginTop: 6, resize: "vertical" }}
                      aria-label={t("checklist.template.description_label")}
                    />
                  </div>
                  <select
                    value={row.completeRoleGate}
                    onChange={(e) => updateNewRow(row.tempId, "completeRoleGate", e.target.value)}
                    style={inputStyle}
                    aria-label={t("checklist.template.header.gate")}
                  >
                    {ROLE_GATES.map((g) => (
                      <option key={g} value={g}>
                        {t(`checklist.role_gate.${g}`)}
                      </option>
                    ))}
                  </select>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: "var(--accent-primary)",
                    }}
                  >
                    {t("checklist.template.active_yes")}
                  </span>
                  <div
                    style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}
                  >
                    <ActionButton
                      variant="primary"
                      size="sm"
                      icon={saving ? undefined : Check}
                      label={saving ? t("checklist.template.saving") : t("checklist.template.create")}
                      disabled={saving}
                      onClick={() => saveNewRow(row.tempId)}
                    />
                    {!saving && (
                      <ActionButton
                        variant="tertiary"
                        size="sm"
                        label={t("checklist.template.cancel")}
                        onClick={() => removeNewRow(row.tempId)}
                      />
                    )}
                    {saving && <Spinner size={12} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 22px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <ActionButton
            variant="secondary"
            icon={Plus}
            label={t("checklist.template.add_row")}
            onClick={addNewRow}
          />
          <ActionButton variant="secondary" label={t("checklist.template.done")} onClick={onClose} />
        </div>
      </div>
    </>
  );
}
