import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileSearch,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit3,
  Save,
  Sparkles,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import Spinner from "../../components/shared/Spinner";
import useEscapeKey from "../../hooks/useEscapeKey";
import {
  listOcrExtractions,
  getOcrExtraction,
  correctOcrField,
  approveOcrExtraction,
  rejectOcrExtraction,
} from "../../engine";

const STATUS_FILTERS = ["ALL", "PENDING_REVIEW", "APPROVED", "REJECTED"];

const STATUS_COLORS = {
  PENDING_REVIEW: {
    color: "var(--semantic-warning)",
    bg: "var(--semantic-warning-subtle)",
  },
  APPROVED: {
    color: "var(--accent-primary)",
    bg: "var(--accent-primary-subtle)",
  },
  REJECTED: {
    color: "var(--semantic-danger)",
    bg: "var(--semantic-danger-subtle)",
  },
};

function confidenceTone(conf, threshold) {
  if (conf >= threshold) return "ok";
  if (conf >= Math.max(0, threshold - 20)) return "warn";
  return "danger";
}

function Toast({ text, onClear }) {
  useEffect(() => {
    if (!text) return;
    const id = setTimeout(onClear, 3000);
    return () => clearTimeout(id);
  }, [text, onClear]);
  if (!text) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        insetInlineEnd: 24,
        background: "var(--accent-primary)",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        zIndex: 200,
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      }}
    >
      {text}
    </div>
  );
}

export default function OcrReviewScreen({ role = "CFO" }) {
  const { t } = useTranslation("ocr");
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState("PENDING_REVIEW");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reloadList = async () => {
    setLoadError(null);
    try {
      const filters = {};
      if (statusFilter !== "ALL") filters.status = statusFilter;
      if (flaggedOnly) filters.hasFlagged = true;
      const list = await listOcrExtractions(filters);
      setRows(list || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t("error_load"));
    }
  };

  useEffect(() => {
    reloadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, flaggedOnly]);

  const refreshSelected = async () => {
    if (!selected) return;
    try {
      const fresh = await getOcrExtraction(selected.id);
      if (fresh) setSelected(fresh);
    } catch {
      // stale selection is OK
    }
    reloadList();
  };

  const openExtraction = async (row) => {
    try {
      const fresh = await getOcrExtraction(row.id);
      setSelected(fresh || row);
    } catch {
      setSelected(row);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            marginBottom: 18,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--accent-primary)",
              }}
            >
              {t("view_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 28,
                color: "var(--text-primary)",
                letterSpacing: "-0.3px",
                marginTop: 2,
                lineHeight: 1,
              }}
            >
              {t("title")}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                marginTop: 6,
              }}
            >
              {t("subtitle")}
            </div>
          </div>
        </div>

        <Toast text={toast} onClear={() => setToast(null)} />

        {/* Filter pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          {STATUS_FILTERS.map((s) => {
            const on = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  ...btnMini,
                  background: on
                    ? "var(--accent-primary-subtle)"
                    : "transparent",
                  borderColor: on
                    ? "var(--accent-primary-border)"
                    : "var(--border-strong)",
                  color: on
                    ? "var(--accent-primary)"
                    : "var(--text-secondary)",
                }}
              >
                {t(`filter_${s}`)}
              </button>
            );
          })}
          <button
            onClick={() => setFlaggedOnly((v) => !v)}
            style={{
              ...btnMini,
              marginInlineStart: 10,
              background: flaggedOnly
                ? "var(--semantic-warning-subtle)"
                : "transparent",
              borderColor: flaggedOnly
                ? "var(--semantic-warning)"
                : "var(--border-strong)",
              color: flaggedOnly
                ? "var(--semantic-warning)"
                : "var(--text-secondary)",
            }}
          >
            {flaggedOnly ? t("flagged_on") : t("flagged_off")}
          </button>
        </div>

        {loadError && (
          <div
            role="alert"
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 12px",
              background: "var(--semantic-danger-subtle)",
              border: "1px solid var(--semantic-danger)",
              borderRadius: 8,
              color: "var(--semantic-danger)",
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            <AlertTriangle size={14} /> {loadError}
          </div>
        )}

        {rows === null && (
          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
        )}

        {rows && rows.length === 0 && !loadError && (
          <EmptyState
            icon={FileSearch}
            title={t("empty_title")}
            description={t("empty_description")}
          />
        )}

        {rows && rows.length > 0 && (
          <div
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {rows.map((row, idx) => {
              const colors =
                STATUS_COLORS[row.status] || STATUS_COLORS.PENDING_REVIEW;
              const flaggedCount = (row.fields || []).filter(
                (f) => f.flagged,
              ).length;
              const isSelected = selected?.id === row.id;
              return (
                <button
                  key={row.id}
                  onClick={() => openExtraction(row)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 14,
                    padding: "14px 18px",
                    borderBottom:
                      idx === rows.length - 1
                        ? "none"
                        : "1px solid var(--border-subtle)",
                    background: isSelected
                      ? "var(--bg-surface-sunken)"
                      : "transparent",
                    border: "none",
                    borderBottomStyle: "solid",
                    width: "100%",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "start",
                    color: "var(--text-primary)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {row.documentLabel}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: colors.bg,
                          color: colors.color,
                          border: "1px solid",
                        }}
                      >
                        {t(`status_${row.status}`)}
                      </span>
                      {flaggedCount > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: "var(--semantic-warning-subtle)",
                            color: "var(--semantic-warning)",
                            border: "1px solid var(--semantic-warning)",
                          }}
                        >
                          {t("flagged_count", { count: flaggedCount })}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 14,
                        marginTop: 6,
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                      }}
                    >
                      <div>
                        {t("label_engine")}:{" "}
                        <LtrText>
                          <span
                            style={{
                              color: "var(--text-secondary)",
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {row.engineName} · {row.engineVersion}
                          </span>
                        </LtrText>
                      </div>
                      <div>
                        {t("label_overall")}:{" "}
                        <LtrText>
                          <span
                            style={{
                              color: "var(--text-secondary)",
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {row.overallConfidence}%
                          </span>
                        </LtrText>
                      </div>
                      <div>
                        {t("label_threshold")}:{" "}
                        <LtrText>
                          <span
                            style={{
                              color: "var(--text-secondary)",
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {row.reviewThreshold}%
                          </span>
                        </LtrText>
                      </div>
                      <div>
                        {t("label_fields")}:{" "}
                        <LtrText>
                          <span
                            style={{
                              color: "var(--text-secondary)",
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {(row.fields || []).length}
                          </span>
                        </LtrText>
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t("row.open")} →
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selected && (
          <OcrExtractionDrawer
            extraction={selected}
            onClose={() => setSelected(null)}
            onUpdated={refreshSelected}
            setToast={setToast}
          />
        )}
      </div>
    </div>
  );
}

function OcrExtractionDrawer({ extraction, onClose, onUpdated, setToast }) {
  const { t } = useTranslation("ocr");
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [acting, setActing] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEscapeKey(onClose, !!extraction);

  const isPending = extraction.status === "PENDING_REVIEW";

  const handleCorrectField = async (field) => {
    setActionError(null);
    if (!editValue.trim()) {
      setActionError(t("drawer.error_corrected_empty"));
      return;
    }
    setActing(`correct-${field.id}`);
    try {
      await correctOcrField(field.id, editValue.trim());
      setToast(t("drawer.corrected_toast"));
      setEditingFieldId(null);
      setEditValue("");
      if (onUpdated) await onUpdated();
    } catch (err) {
      setActionError(err?.message || t("drawer.error_correct"));
    } finally {
      setActing(null);
    }
  };

  const handleApprove = async () => {
    setActionError(null);
    setActing("approve");
    try {
      await approveOcrExtraction(extraction.id);
      setToast(t("drawer.approved_toast"));
      if (onUpdated) await onUpdated();
    } catch (err) {
      setActionError(err?.message || t("drawer.error_approve"));
    } finally {
      setActing(null);
    }
  };

  const handleReject = async () => {
    setActionError(null);
    if (!rejectNote.trim()) {
      setActionError(t("drawer.error_reject_note_required"));
      return;
    }
    setActing("reject");
    try {
      await rejectOcrExtraction(extraction.id, rejectNote.trim());
      setToast(t("drawer.rejected_toast"));
      setShowRejectForm(false);
      setRejectNote("");
      if (onUpdated) await onUpdated();
    } catch (err) {
      setActionError(err?.message || t("drawer.error_reject"));
    } finally {
      setActing(null);
    }
  };

  const statusColors =
    STATUS_COLORS[extraction.status] || STATUS_COLORS.PENDING_REVIEW;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          insetInlineEnd: 0,
          height: "100vh",
          width: 620,
          background: "var(--panel-bg)",
          borderInlineStart: "1px solid var(--border-default)",
          zIndex: 301,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
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
              {t("drawer.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {extraction.documentLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("drawer.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <XCircle size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Meta */}
          <div
            style={{
              padding: "12px 14px",
              background: "var(--bg-surface-sunken)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: statusColors.bg,
                  color: statusColors.color,
                  border: "1px solid",
                }}
              >
                {t(`status_${extraction.status}`)}
              </span>
              <LtrText>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: "var(--text-primary)",
                  }}
                >
                  {extraction.overallConfidence}% overall · ≥
                  {extraction.reviewThreshold}% threshold
                </span>
              </LtrText>
            </div>
            <div style={{ color: "var(--text-tertiary)" }}>
              {t("drawer.engine_label")}:{" "}
              <LtrText>
                <span style={{ fontFamily: "'DM Mono', monospace" }}>
                  {extraction.engineName} · {extraction.engineVersion}
                </span>
              </LtrText>
            </div>
            <div style={{ color: "var(--text-tertiary)" }}>
              {t("drawer.source_label")}:{" "}
              <LtrText>
                <span style={{ fontFamily: "'DM Mono', monospace" }}>
                  {extraction.sourceFilePath}
                </span>
              </LtrText>
            </div>
            {extraction.reviewNote && (
              <div
                style={{
                  color: "var(--text-secondary)",
                  fontStyle: "italic",
                  marginTop: 4,
                }}
              >
                "{extraction.reviewNote}"
              </div>
            )}
          </div>

          {actionError && (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 12px",
                background: "var(--semantic-danger-subtle)",
                border: "1px solid var(--semantic-danger)",
                borderRadius: 8,
                color: "var(--semantic-danger)",
                fontSize: 12,
              }}
            >
              <AlertTriangle size={14} /> {actionError}
            </div>
          )}

          {/* Fields list */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                marginBottom: 8,
              }}
            >
              {t("drawer.fields_heading", {
                count: (extraction.fields || []).length,
              })}
            </div>
            <div
              style={{
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {(extraction.fields || []).map((field, idx) => {
                const tone = confidenceTone(
                  field.confidence,
                  extraction.reviewThreshold,
                );
                const confColor =
                  tone === "ok"
                    ? "var(--accent-primary)"
                    : tone === "warn"
                    ? "var(--semantic-warning)"
                    : "var(--semantic-danger)";
                const isEditing = editingFieldId === field.id;
                return (
                  <div
                    key={field.id}
                    style={{
                      padding: "12px 14px",
                      borderBottom:
                        idx === (extraction.fields || []).length - 1
                          ? "none"
                          : "1px solid var(--border-subtle)",
                      background: field.flagged
                        ? "rgba(212, 168, 75, 0.05)"
                        : "transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          color: "var(--text-tertiary)",
                          textTransform: "uppercase",
                        }}
                      >
                        <LtrText>{field.fieldKey}</LtrText>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <LtrText>
                          <span
                            style={{
                              fontSize: 11,
                              color: confColor,
                              fontFamily: "'DM Mono', monospace",
                              fontWeight: 600,
                            }}
                          >
                            {field.confidence}%
                          </span>
                        </LtrText>
                        {field.flagged && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: "0.1em",
                              padding: "2px 6px",
                              borderRadius: 8,
                              background: "var(--semantic-warning-subtle)",
                              color: "var(--semantic-warning)",
                              border: "1px solid var(--semantic-warning)",
                            }}
                          >
                            {t("drawer.flagged")}
                          </span>
                        )}
                        {field.corrected && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: "0.1em",
                              padding: "2px 6px",
                              borderRadius: 8,
                              background: "var(--accent-primary-subtle)",
                              color: "var(--accent-primary)",
                              border: "1px solid var(--accent-primary-border)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <Sparkles size={9} /> {t("drawer.corrected")}
                          </span>
                        )}
                      </div>
                    </div>

                    {!isEditing && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          color: "var(--text-primary)",
                          fontFamily: "'DM Mono', monospace",
                          wordBreak: "break-word",
                        }}
                      >
                        <LtrText>{field.fieldValue || "—"}</LtrText>
                      </div>
                    )}
                    {isEditing && (
                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          gap: 6,
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                        }}
                      >
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          maxLength={5000}
                          style={{
                            flex: 1,
                            minWidth: 200,
                            background: "var(--bg-surface-sunken)",
                            border: "1px solid var(--border-default)",
                            borderRadius: 6,
                            padding: "8px 10px",
                            color: "var(--text-primary)",
                            fontSize: 12,
                            fontFamily: "'DM Mono', monospace",
                            outline: "none",
                          }}
                        />
                        <button
                          onClick={() => handleCorrectField(field)}
                          disabled={acting === `correct-${field.id}`}
                          style={btnMiniPrimary}
                        >
                          {acting === `correct-${field.id}` ? (
                            <Spinner size={11} />
                          ) : (
                            <>
                              <Save
                                size={11}
                                style={{
                                  verticalAlign: "middle",
                                  marginInlineEnd: 4,
                                }}
                              />
                              {t("drawer.save_correction")}
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditingFieldId(null);
                            setEditValue("");
                          }}
                          style={btnMini}
                        >
                          {t("drawer.cancel_edit")}
                        </button>
                      </div>
                    )}

                    {!isEditing &&
                      field.originalValue &&
                      field.originalValue !== field.fieldValue && (
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 10,
                            color: "var(--text-tertiary)",
                            fontStyle: "italic",
                          }}
                        >
                          {t("drawer.original_label")}:{" "}
                          <LtrText>
                            <span style={{ fontFamily: "'DM Mono', monospace" }}>
                              {field.originalValue}
                            </span>
                          </LtrText>
                        </div>
                      )}

                    {!isEditing && isPending && (
                      <div style={{ marginTop: 6 }}>
                        <button
                          onClick={() => {
                            setEditingFieldId(field.id);
                            setEditValue(field.fieldValue || "");
                          }}
                          style={btnMini}
                        >
                          <Edit3
                            size={10}
                            style={{
                              verticalAlign: "middle",
                              marginInlineEnd: 4,
                            }}
                          />
                          {t("drawer.action_correct")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reject form */}
          {showRejectForm && (
            <div
              style={{
                padding: "12px 14px",
                background: "var(--semantic-danger-subtle)",
                border: "1px solid var(--semantic-danger)",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  color: "var(--semantic-danger)",
                  marginBottom: 6,
                }}
              >
                {t("drawer.reject_heading")}
              </div>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder={t("drawer.reject_note_placeholder")}
                style={{
                  width: "100%",
                  background: "var(--bg-surface-sunken)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  padding: "8px 10px",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  fontFamily: "inherit",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>
          )}
        </div>

        {/* Action bar */}
        {isPending && (
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              padding: "14px 22px",
              borderTop: "1px solid var(--border-subtle)",
              flexWrap: "wrap",
            }}
          >
            {!showRejectForm ? (
              <>
                <button
                  onClick={() => setShowRejectForm(true)}
                  style={{
                    ...btnSecondary,
                    color: "var(--semantic-danger)",
                    borderColor: "rgba(208,90,90,0.30)",
                  }}
                  disabled={acting != null}
                >
                  <XCircle
                    size={13}
                    style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
                  />
                  {t("drawer.action_reject")}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={acting != null}
                  style={btnPrimary(acting === "approve")}
                >
                  {acting === "approve" ? (
                    <>
                      <Spinner size={13} />
                      &nbsp;{t("drawer.approving")}
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={13}
                        style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
                      />
                      {t("drawer.action_approve")}
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectNote("");
                  }}
                  style={btnSecondary}
                  disabled={acting != null}
                >
                  {t("drawer.cancel_reject")}
                </button>
                <button
                  onClick={handleReject}
                  disabled={acting != null}
                  style={{
                    ...btnPrimary(acting === "reject"),
                    background: "var(--semantic-danger)",
                  }}
                >
                  {acting === "reject" ? (
                    <>
                      <Spinner size={13} />
                      &nbsp;{t("drawer.rejecting")}
                    </>
                  ) : (
                    t("drawer.confirm_reject")
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

const btnMini = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)",
  padding: "6px 12px",
  borderRadius: 5,
  cursor: "pointer",
  fontSize: 11,
  fontFamily: "inherit",
  fontWeight: 600,
};
const btnMiniPrimary = {
  background: "var(--accent-primary)",
  color: "#fff",
  border: "none",
  padding: "6px 12px",
  borderRadius: 5,
  cursor: "pointer",
  fontSize: 11,
  fontFamily: "inherit",
  fontWeight: 600,
};
const btnSecondary = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)",
  padding: "9px 16px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
  fontWeight: 600,
};
const btnPrimary = (l) => ({
  background: "var(--accent-primary)",
  color: "#fff",
  border: "none",
  padding: "9px 18px",
  borderRadius: 6,
  cursor: l ? "not-allowed" : "pointer",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "inherit",
});
