import { useEffect, useState } from "react";
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
  // expense
  under:      { fg: "#00C48C", bg: "rgba(0,196,140,0.10)",  label: "UNDER" },
  "on-track": { fg: "#00C48C", bg: "rgba(0,196,140,0.10)",  label: "ON TRACK" },
  over:       { fg: "#D4A84B", bg: "rgba(212,168,75,0.10)", label: "APPROACHING" },
  critical:   { fg: "#FF5A5F", bg: "rgba(255,90,95,0.10)",  label: "OVER" },
  // revenue
  behind:     { fg: "#FF5A5F", bg: "rgba(255,90,95,0.10)",  label: "BEHIND" },
  ahead:      { fg: "#00C48C", bg: "rgba(0,196,140,0.10)",  label: "AHEAD" },
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
    onToast && onToast(`${row.name} approved`);
    onRefresh && onRefresh();
  };

  const handleRequestRevisions = async () => {
    if (!revisionText.trim()) return;
    await requestDepartmentRevision(budget.id, row.id, revisionText.trim());
    setShowRevisionComposer(false);
    setRevisionText("");
    onToast && onToast(`Revision request sent`);
    onRefresh && onRefresh();
  };

  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div
        onClick={() => onToggle && onToggle(row)}
        onMouseEnter={(e) => {
          if (!expanded) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
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
          background: expanded ? "rgba(255,255,255,0.03)" : "transparent",
          transition: "background 0.12s ease",
        }}
      >
        <div style={{ fontSize: 13, color: "#E6EDF3", fontWeight: 500 }}>{row.name}</div>
        <div style={{ fontSize: 12, color: "#5B6570" }}>{ownerName || "—"}</div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            color: "#E6EDF3",
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatKWD(row.budgetAnnual)}
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            color: "#5B6570",
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatKWD(row.budgetYtd)}
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            color: "#E6EDF3",
            textAlign: "right",
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
              ? (row.varianceAmount < 0 ? "#FF5A5F" : "#00C48C")
              : (row.varianceAmount > 0 ? "#FF5A5F" : "#00C48C"),
            textAlign: "right",
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
          {status.label}
        </span>
        <span style={{ color: "#5B6570" }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {expanded && (isEdit || isReview) && department && (
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
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
                borderLeft: "2px solid #00C48C",
                borderRadius: 6,
                padding: "10px 14px",
                marginBottom: 12,
                fontSize: 12,
                color: "#8B98A5",
              }}
            >
              Submitted by <span style={{ color: "#E6EDF3", fontWeight: 500 }}>{ownerName}</span>
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
                    flashLineId === l.id ? "rgba(0,196,140,0.10)" : "transparent",
                  transition: "background 0.4s ease",
                }}
              >
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    color: "#5B6570",
                  }}
                >
                  {l.glAccountCode}
                </span>
                <span style={{ fontSize: 13, color: "#E6EDF3" }}>{l.glAccountName}</span>
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
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 5,
                      padding: "6px 10px",
                      color: "#E6EDF3",
                      fontSize: 13,
                      fontFamily: "'DM Mono', monospace",
                      textAlign: "right",
                      outline: "none",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 13,
                      color: "#E6EDF3",
                      textAlign: "right",
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
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <input
                value={submitNote}
                onChange={(e) => setSubmitNote(e.target.value)}
                placeholder="Add a note to the CFO (optional)"
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 6,
                  padding: "8px 12px",
                  color: "#E6EDF3",
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
                  background: "#00C48C",
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
                  ? "Submit revised draft"
                  : "Submit to CFO"}
              </button>
            </div>
          )}

          {/* Edit mode — already submitted */}
          {isEdit && department.workflowStatus === "submitted" && (
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                fontSize: 12,
                color: "#5B6570",
                fontStyle: "italic",
              }}
            >
              Awaiting CFO review
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
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleApproveDept();
                }}
                style={{
                  background: "#00C48C",
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
                Approve department
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRevisionComposer(true);
                }}
                style={{
                  background: "transparent",
                  color: "#D4A84B",
                  border: "1px solid rgba(212,168,75,0.30)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                Request revisions
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
                  color: "#D4A84B",
                  marginBottom: 8,
                }}
              >
                REVISION NOTES FOR {(ownerName || "").toUpperCase()}
              </div>
              <textarea
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                rows={3}
                placeholder="Describe what needs to change…"
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 6,
                  padding: "8px 10px",
                  color: "#E6EDF3",
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
                    color: "#8B98A5",
                    border: "1px solid rgba(255,255,255,0.15)",
                    padding: "7px 14px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestRevisions}
                  disabled={!revisionText.trim()}
                  style={{
                    background: revisionText.trim() ? "#D4A84B" : "rgba(212,168,75,0.25)",
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
                  Send revision request
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
              onToast && onToast(`Submitted ${row.name} to CFO`);
              onRefresh && onRefresh();
            }}
          />
        </div>
      )}

      {expanded && !isEdit && !isReview && (
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            padding: "8px 0 14px",
          }}
        >
          {!lines ? (
            <div style={{ padding: "10px 32px", color: "#5B6570", fontSize: 12 }}>Loading…</div>
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
                  <div style={{ color: "#8B98A5" }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", color: "#5B6570", marginRight: 8 }}>
                      {l.glAccountCode}
                    </span>
                    {l.glAccountName}
                  </div>
                  <div />
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: "#8B98A5",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatKWD(l.budgetAnnual)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: "#5B6570",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatKWD(l.budgetYtd)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: "#8B98A5",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatKWD(l.actualYtd)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: l.varianceAmount > 0 ? "#FF5A5F" : "#00C48C",
                      textAlign: "right",
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
                    {s.label}
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
