import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatKWD } from "../../utils/format";
import BudgetVarianceBar from "./BudgetVarianceBar";
import {
  getBudgetVarianceByLineItem,
  updateBudgetLineItemValue,
  approveDepartment,
  requestDepartmentRevision,
  submitDepartment,
} from "../../engine/mockEngine";
import RevisionNotesCard from "./RevisionNotesCard";
import SubmitDraftConfirmationModal from "./SubmitDraftConfirmationModal";
import Avatar from "../taskbox/Avatar";
import { formatRelativeTime } from "../../utils/relativeTime";

const STATUS_PILL = {
  under:      { fg: "var(--accent-primary)", bg: "var(--accent-primary-subtle)",  key: "under" },
  "on-track": { fg: "var(--accent-primary)", bg: "var(--accent-primary-subtle)",  key: "on_track" },
  over:       { fg: "var(--semantic-warning)", bg: "var(--semantic-warning-subtle)", key: "approaching" },
  critical:   { fg: "var(--semantic-danger)", bg: "var(--semantic-danger-subtle)",  key: "over" },
  behind:     { fg: "var(--semantic-danger)", bg: "var(--semantic-danger-subtle)",  key: "behind" },
  ahead:      { fg: "var(--accent-primary)", bg: "var(--accent-primary-subtle)",  key: "ahead" },
};

const COLS = "minmax(160px, 1.4fr) minmax(140px, 1fr) 130px 130px 130px 130px 180px 110px 18px";

function fmtSigned(n) {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  if (n === 0) return "0.000";
  return n > 0 ? `+${abs}` : `-${abs}`;
}

export default function DepartmentRow({
  row,
  expanded,
  onToggle,
  ownerName,
  mode = "view",
  budget,
  department, // full department object (includes lineItems) for edit/review modes
  currentUserId = "cfo",
  onRefresh,
  onToast,
}) {
  const { t } = useTranslation("budget");
  const [lines, setLines] = useState(null);
  const [flashLineId, setFlashLineId] = useState(null);
  const [showRevisionComposer, setShowRevisionComposer] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitNote, setSubmitNote] = useState("");
  const isEdit = mode === "edit";
  const isReview = mode === "review";
  const status = STATUS_PILL[row.status] || STATUS_PILL["on-track"];

  useEffect(() => {
    if (expanded && !lines && !isEdit && !isReview) {
      getBudgetVarianceByLineItem(row.id).then(setLines);
    }
  }, [expanded, lines, row.id, isEdit, isReview]);

  const handleLineEdit = async (lineId, newAnnual) => {
    if (!budget || isNaN(newAnnual)) return;
    await updateBudgetLineItemValue(budget.id, row.id, lineId, newAnnual);
    setFlashLineId(lineId);
    setTimeout(() => setFlashLineId(null), 900);
    onRefresh && onRefresh();
  };

  const handleApproveDept = async () => {
    await approveDepartment(budget.id, row.id);
    onToast && onToast(t("toast.approved", { name: row.name }));
    onRefresh && onRefresh();
  };

  const handleRequestRevisions = async () => {
    if (!revisionText.trim()) return;
    await requestDepartmentRevision(budget.id, row.id, revisionText.trim());
    setShowRevisionComposer(false);
    setRevisionText("");
    onToast && onToast(t("toast.revision_sent"));
    onRefresh && onRefresh();
  };

  return (
    <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div
        onClick={() => onToggle && onToggle(row)}
        onMouseEnter={(e) => {
          if (!expanded) e.currentTarget.style.background = "var(--bg-surface-sunken)";
        }}
        onMouseLeave={(e) => {
          if (!expanded) e.currentTarget.style.background = "transparent";
        }}
        style={{
          display: "grid",
          gridTemplateColumns: COLS,
          gap: 12,
          alignItems: "center",
          padding: "14px 18px",
          cursor: "pointer",
          background: expanded ? "var(--bg-surface-sunken)" : "transparent",
          transition: "background 0.12s ease",
        }}
      >
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{row.name}</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{ownerName || "—"}</div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            color: "var(--text-primary)",
            textAlign: "end",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatKWD(row.budgetAnnual)}
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            color: "var(--text-tertiary)",
            textAlign: "end",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatKWD(row.budgetYtd)}
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            color: "var(--text-primary)",
            textAlign: "end",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatKWD(row.actualYtd)}
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            color: row.category === "revenue"
              ? (row.varianceAmount < 0 ? "var(--semantic-danger)" : "var(--accent-primary)")
              : (row.varianceAmount > 0 ? "var(--semantic-danger)" : "var(--accent-primary)"),
            textAlign: "end",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtSigned(row.varianceAmount)}
        </div>
        <BudgetVarianceBar percent={row.variancePercent} status={row.status} />
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.10em",
            color: status.fg,
            background: status.bg,
            border: `1px solid ${status.fg}55`,
            padding: "3px 8px",
            borderRadius: 3,
            textAlign: "center",
          }}
        >
          {t(`row_status.${status.key}`)}
        </span>
        <span style={{ color: "var(--text-tertiary)" }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {expanded && (isEdit || isReview) && department && (
        <div
          style={{
            background: "var(--bg-surface)",
            borderTop: "1px solid var(--border-subtle)",
            padding: "14px 24px 16px 36px",
          }}
        >
          {/* Revision notes banner — edit mode + needs-revision */}
          {isEdit && department.workflowStatus === "needs-revision" && department.revisionNotes && (
            <RevisionNotesCard
              notes={department.revisionNotes}
              timestamp={department.reviewedAt}
            />
          )}

          {/* Submitted banner — review mode */}
          {isReview && department.workflowStatus === "submitted" && (
            <div
              style={{
                background: "rgba(0,196,140,0.04)",
                border: "1px solid rgba(0,196,140,0.20)",
                borderInlineStart: "2px solid #00C48C",
                borderRadius: 6,
                padding: "10px 14px",
                marginBottom: 12,
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              {t("dept_row.review_submitted")} <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{ownerName}</span>
              {department.submittedAt && (
                <> · {formatRelativeTime(department.submittedAt)}</>
              )}
            </div>
          )}

          {/* Line items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(department.lineItems || []).map((l) => (
              <div
                key={l.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 160px",
                  gap: 12,
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 4,
                  background:
                    flashLineId === l.id ? "var(--accent-primary-subtle)" : "transparent",
                  transition: "background 0.4s ease",
                }}
              >
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                  }}
                >
                  {l.glAccountCode}
                </span>
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{l.glAccountName}</span>
                {isEdit ? (
                  <input
                    type="number"
                    defaultValue={l.annual}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== l.annual) handleLineEdit(l.id, v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    style={{
                      background: "var(--bg-surface-sunken)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 5,
                      padding: "6px 10px",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      fontFamily: "'DM Mono', monospace",
                      textAlign: "end",
                      outline: "none",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 13,
                      color: "var(--text-primary)",
                      textAlign: "end",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatKWD(l.annual)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Edit mode action bar */}
          {isEdit && (department.workflowStatus === "assigned" || department.workflowStatus === "in-progress" || department.workflowStatus === "needs-revision") && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              <input
                value={submitNote}
                onChange={(e) => setSubmitNote(e.target.value)}
                placeholder={t("dept_row.note_placeholder")}
                style={{
                  flex: 1,
                  background: "var(--bg-surface-sunken)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  padding: "8px 12px",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSubmitModalOpen(true);
                }}
                style={{
                  background: "var(--accent-primary)",
                  color: "#fff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                {department.workflowStatus === "needs-revision"
                  ? t("dept_row.submit_revised")
                  : t("dept_row.submit_to_cfo")}
              </button>
            </div>
          )}

          {/* Edit mode — already submitted */}
          {isEdit && department.workflowStatus === "submitted" && (
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1px solid var(--border-subtle)",
                fontSize: 12,
                color: "var(--text-tertiary)",
                fontStyle: "italic",
              }}
            >
              {t("dept_row.awaiting_review")}
            </div>
          )}

          {/* Review mode action bar */}
          {isReview && department.workflowStatus === "submitted" && !showRevisionComposer && (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleApproveDept();
                }}
                style={{
                  background: "var(--accent-primary)",
                  color: "#fff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                {t("dept_row.approve_department")}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRevisionComposer(true);
                }}
                style={{
                  background: "transparent",
                  color: "var(--semantic-warning)",
                  border: "1px solid rgba(212,168,75,0.30)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {t("dept_row.request_revisions")}
              </button>
            </div>
          )}

          {/* Revision composer */}
          {isReview && showRevisionComposer && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                background: "rgba(212,168,75,0.04)",
                border: "1px solid rgba(212,168,75,0.25)",
                borderRadius: 8,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  color: "var(--semantic-warning)",
                  marginBottom: 8,
                }}
              >
                {t("dept_row.revision_notes_for", { name: (ownerName || "").toUpperCase() })}
              </div>
              <textarea
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                rows={3}
                placeholder={t("dept_row.revision_placeholder")}
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
                  marginBottom: 10,
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setShowRevisionComposer(false);
                    setRevisionText("");
                  }}
                  style={{
                    background: "transparent",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-strong)",
                    padding: "7px 14px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "inherit",
                  }}
                >
                  {t("dept_row.cancel")}
                </button>
                <button
                  onClick={handleRequestRevisions}
                  disabled={!revisionText.trim()}
                  style={{
                    background: revisionText.trim() ? "var(--semantic-warning)" : "rgba(212,168,75,0.25)",
                    color: "#fff",
                    border: "none",
                    padding: "7px 14px",
                    borderRadius: 6,
                    cursor: revisionText.trim() ? "pointer" : "not-allowed",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "inherit",
                  }}
                >
                  {t("dept_row.send_revision_request")}
                </button>
              </div>
            </div>
          )}

          <SubmitDraftConfirmationModal
            open={submitModalOpen}
            departmentName={row.name}
            note={submitNote}
            onClose={() => setSubmitModalOpen(false)}
            onConfirm={async () => {
              await submitDepartment(budget.id, row.id, currentUserId, submitNote || null);
              setSubmitModalOpen(false);
              setSubmitNote("");
              onToast && onToast(t("toast.submitted", { name: row.name }));
              onRefresh && onRefresh();
            }}
          />
        </div>
      )}

      {expanded && !isEdit && !isReview && (
        <div
          style={{
            background: "var(--bg-surface)",
            borderTop: "1px solid var(--border-subtle)",
            padding: "8px 0 14px",
          }}
        >
          {!lines ? (
            <div style={{ padding: "10px 32px", color: "var(--text-tertiary)", fontSize: 12 }}>{t("dept_row.loading")}</div>
          ) : (
            lines.map((l) => {
              const s = STATUS_PILL[l.status] || STATUS_PILL["on-track"];
              return (
                <div
                  key={l.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: COLS,
                    gap: 12,
                    alignItems: "center",
                    padding: "8px 18px 8px 36px",
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: "var(--text-secondary)" }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", color: "var(--text-tertiary)", marginInlineEnd: 8 }}>
                      {l.glAccountCode}
                    </span>
                    {l.glAccountName}
                  </div>
                  <div />
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: "var(--text-secondary)",
                      textAlign: "end",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatKWD(l.budgetAnnual)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: "var(--text-tertiary)",
                      textAlign: "end",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatKWD(l.budgetYtd)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: "var(--text-secondary)",
                      textAlign: "end",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatKWD(l.actualYtd)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: l.varianceAmount > 0 ? "var(--semantic-danger)" : "var(--accent-primary)",
                      textAlign: "end",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmtSigned(l.varianceAmount)}
                  </div>
                  <BudgetVarianceBar percent={l.variancePercent} status={l.status} />
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: "0.10em",
                      color: s.fg,
                      background: s.bg,
                      border: `1px solid ${s.fg}55`,
                      padding: "2px 6px",
                      borderRadius: 3,
                      textAlign: "center",
                    }}
                  >
                    {t(`row_status.${s.key}`)}
                  </span>
                  <span />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
