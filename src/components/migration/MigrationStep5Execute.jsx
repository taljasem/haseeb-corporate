/**
 * Migration Wizard Step 5 — Post from staging.
 *
 * Iterates sequentially over READY_TO_POST staged rows across all
 * ingested entity types. One POST per row; backend is idempotent on
 * already-POSTED. Failed rows (FAILED_POST) can be retried or rejected.
 *
 * UX decisions (Phase 4 autonomy):
 *   - Sequential posting with live progress bar. No async job support,
 *     so UI-driven polling is not needed; each POST returns the result
 *     synchronously.
 *   - Failed rows show the failureReason inline and expose Retry /
 *     Reject actions. Reject opens a lightweight prompt for a reason.
 *   - Summary panel flips between "complete" (all posted) and "partial"
 *     (some failed) once the run finishes.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Upload,
  Check,
  X,
  AlertCircle,
  RotateCw,
  ArrowLeft,
  Clock,
} from "lucide-react";
import LtrText from "../shared/LtrText";
import Spinner from "../shared/Spinner";
import EmptyState from "../shared/EmptyState";
import {
  listStagedInvoices,
  listStagedBills,
  listStagedJournalEntries,
  postStagedItem,
  rejectStagedItem,
} from "../../engine";

function kindForEntity(entity) {
  if (entity === "invoices") return "invoice";
  if (entity === "bills") return "bill";
  return "journal-entry";
}

export default function MigrationStep5Execute({
  readOnly,
  accent,
  importJobId,
  ingestedEntities,
  goBack,
}) {
  const { t } = useTranslation("migration");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queue, setQueue] = useState([]); // [{ kind, id, title, status: 'pending'|'posting'|'posted'|'failed', failureReason? }]
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [rejectPromptFor, setRejectPromptFor] = useState(null); // id
  const [rejectReason, setRejectReason] = useState("");

  const loadQueue = async () => {
    if (!importJobId) return;
    setLoading(true);
    setError(null);
    try {
      const tasks = [];
      if (ingestedEntities.has("invoices")) {
        tasks.push(
          listStagedInvoices({
            importJobId,
            status: "READY_TO_POST",
            limit: 500,
          }).then((r) => ({ entity: "invoices", rows: r || [] })),
        );
      }
      if (ingestedEntities.has("bills")) {
        tasks.push(
          listStagedBills({
            importJobId,
            status: "READY_TO_POST",
            limit: 500,
          }).then((r) => ({ entity: "bills", rows: r || [] })),
        );
      }
      if (ingestedEntities.has("journal-entries")) {
        tasks.push(
          listStagedJournalEntries({
            importJobId,
            status: "READY_TO_POST",
            limit: 500,
          }).then((r) => ({ entity: "journal-entries", rows: r || [] })),
        );
      }
      const results = await Promise.all(tasks);
      const assembled = [];
      for (const { entity, rows } of results) {
        for (const row of rows) {
          assembled.push({
            kind: kindForEntity(entity),
            id: row.id,
            entity,
            title:
              row.invoiceNumber ||
              row.billNumber ||
              row.reference ||
              row.description ||
              `#${row.rowNumber ?? row.id}`,
            status: "pending",
            failureReason: null,
          });
        }
      }
      setQueue(assembled);
      setDoneCount(0);
    } catch (err) {
      setError(err?.message || t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importJobId, ingestedEntities]);

  const counts = useMemo(() => {
    let posted = 0;
    let failed = 0;
    let pending = 0;
    for (const r of queue) {
      if (r.status === "posted") posted++;
      else if (r.status === "failed") failed++;
      else pending++;
    }
    return { posted, failed, pending, total: queue.length };
  }, [queue]);

  // Per-entity counts for the description line at top.
  const entityCounts = useMemo(() => {
    const out = { invoices: 0, bills: 0, "journal-entries": 0 };
    for (const r of queue) out[r.entity] = (out[r.entity] || 0) + 1;
    return out;
  }, [queue]);

  const runPosting = async (targetRows = null) => {
    if (readOnly) return;
    const rowsToPost = targetRows || queue.filter((r) => r.status === "pending");
    if (rowsToPost.length === 0) return;
    setRunning(true);
    setError(null);
    let localDone = 0;
    // Sequential so progress is meaningful and backend isn't hammered.
    for (const row of rowsToPost) {
      // Mark row as posting
      setQueue((q) =>
        q.map((r) => (r.id === row.id ? { ...r, status: "posting" } : r)),
      );
      try {
        const result = await postStagedItem(row.kind, row.id);
        const success = result?.status === "POSTED";
        const failureReason = !success ? result?.failureReason || null : null;
        setQueue((q) =>
          q.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  status: success ? "posted" : "failed",
                  failureReason,
                }
              : r,
          ),
        );
      } catch (err) {
        const msg = err?.message || t("errors.generic");
        setQueue((q) =>
          q.map((r) =>
            r.id === row.id
              ? { ...r, status: "failed", failureReason: msg }
              : r,
          ),
        );
      }
      localDone++;
      setDoneCount((d) => d + 1);
    }
    setRunning(false);
  };

  const retryFailed = () => {
    const failed = queue
      .filter((r) => r.status === "failed")
      .map((r) => ({ ...r, status: "pending", failureReason: null }));
    if (failed.length === 0) return;
    // Put them back to pending and re-run.
    setQueue((q) =>
      q.map((r) =>
        r.status === "failed"
          ? { ...r, status: "pending", failureReason: null }
          : r,
      ),
    );
    setDoneCount(counts.posted);
    // Use a microtask so state updates settle.
    setTimeout(() => runPosting(failed), 0);
  };

  const confirmReject = async () => {
    if (!rejectPromptFor || !rejectReason.trim()) return;
    const row = queue.find((r) => r.id === rejectPromptFor);
    if (!row) return;
    try {
      await rejectStagedItem(row.kind, row.id, rejectReason.trim());
      setQueue((q) => q.filter((r) => r.id !== row.id));
      setRejectPromptFor(null);
      setRejectReason("");
    } catch (err) {
      setError(err?.message || t("errors.generic"));
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <Spinner size={24} color="var(--text-secondary)" />
      </div>
    );
  }

  const isComplete =
    counts.total > 0 &&
    counts.pending === 0 &&
    !running &&
    doneCount >= counts.total;
  const progressPct =
    counts.total === 0
      ? 0
      : Math.round(((counts.posted + counts.failed) / counts.total) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionHeader
        title={t("step5.title")}
        description={t("step5.description", {
          invoices: entityCounts.invoices,
          bills: entityCounts.bills,
          journalEntries: entityCounts["journal-entries"],
        })}
      />

      {error && <ErrorBanner text={error} />}

      {counts.total === 0 ? (
        <EmptyState icon={Upload} title={t("step5.no_ready_rows")} />
      ) : (
        <>
          {/* Progress bar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              <span>
                {t("step5.progress", {
                  done: counts.posted + counts.failed,
                  total: counts.total,
                })}
              </span>
              <LtrText style={{ fontFamily: "'DM Mono', monospace", color: "var(--text-tertiary)" }}>
                {progressPct}%
              </LtrText>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{
                width: "100%",
                height: 6,
                background: "var(--bg-surface-sunken)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: "100%",
                  background: accent,
                  transition: "width 0.25s ease",
                }}
              />
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => runPosting()}
              disabled={readOnly || running || counts.pending === 0}
              style={{
                ...primaryBtnStyle(accent),
                opacity:
                  readOnly || running || counts.pending === 0 ? 0.55 : 1,
                cursor:
                  readOnly || running || counts.pending === 0
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {running ? (
                <>
                  <Spinner size={14} color="#fff" />
                  {t("step5.posting")}
                </>
              ) : (
                <>
                  <Upload size={14} />
                  {t("step5.start")}
                </>
              )}
            </button>
            {counts.failed > 0 && !running && (
              <button
                type="button"
                onClick={retryFailed}
                disabled={readOnly}
                style={{
                  ...secondaryBtnStyle,
                  opacity: readOnly ? 0.55 : 1,
                }}
              >
                <RotateCw size={14} />
                {t("step5.retry_failed")}
              </button>
            )}
          </div>

          {/* Row list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {queue.map((row) => (
              <RowLine
                key={row.id}
                row={row}
                readOnly={readOnly}
                onReject={() => {
                  setRejectPromptFor(row.id);
                  setRejectReason("");
                }}
              />
            ))}
          </div>

          {/* Summary panel */}
          {isComplete && (
            <div
              role="status"
              style={{
                padding: "14px 16px",
                background:
                  counts.failed === 0
                    ? "var(--accent-primary-subtle)"
                    : "var(--semantic-warning-subtle)",
                border: `1px solid ${
                  counts.failed === 0
                    ? "var(--accent-primary-border)"
                    : "var(--semantic-warning-border)"
                }`,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                color:
                  counts.failed === 0
                    ? "var(--accent-primary)"
                    : "var(--semantic-warning)",
              }}
            >
              {counts.failed === 0
                ? t("step5.summary_complete", { posted: counts.posted })
                : t("step5.summary_partial", {
                    posted: counts.posted,
                    failed: counts.failed,
                  })}
            </div>
          )}
        </>
      )}

      {rejectPromptFor && (
        <RejectModal
          reason={rejectReason}
          setReason={setRejectReason}
          onCancel={() => {
            setRejectPromptFor(null);
            setRejectReason("");
          }}
          onConfirm={confirmReject}
          accent={accent}
        />
      )}

      <NavRow goBack={goBack} accent={accent} />
    </div>
  );
}

function RowLine({ row, readOnly, onReject }) {
  const { t } = useTranslation("migration");
  const iconBg =
    row.status === "posted"
      ? "var(--accent-primary-subtle)"
      : row.status === "failed"
      ? "var(--semantic-danger-subtle)"
      : row.status === "posting"
      ? "var(--semantic-info-subtle)"
      : "var(--bg-surface-sunken)";
  const iconColor =
    row.status === "posted"
      ? "var(--accent-primary)"
      : row.status === "failed"
      ? "var(--semantic-danger)"
      : row.status === "posting"
      ? "var(--semantic-info)"
      : "var(--text-tertiary)";
  const Icon =
    row.status === "posted"
      ? Check
      : row.status === "failed"
      ? X
      : row.status === "posting"
      ? RotateCw
      : Clock;
  const labelKey =
    row.status === "posted"
      ? "step5.row_posted"
      : row.status === "failed"
      ? "step5.row_failed"
      : "step5.row_pending";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 6,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: iconBg,
          color: iconColor,
          flexShrink: 0,
          animation:
            row.status === "posting" ? "haseeb-spin 1s linear infinite" : "none",
        }}
        aria-hidden="true"
      >
        <Icon size={12} strokeWidth={2.5} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <LtrText
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "block",
          }}
        >
          {row.title}
        </LtrText>
        {row.failureReason && (
          <div
            style={{
              fontSize: 11,
              color: "var(--semantic-danger)",
              marginTop: 2,
            }}
          >
            {row.failureReason}
          </div>
        )}
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: iconColor,
          flexShrink: 0,
        }}
      >
        {t(labelKey)}
      </span>
      {row.status === "failed" && (
        <button
          type="button"
          onClick={onReject}
          disabled={readOnly}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            background: "transparent",
            border: "1px solid var(--border-default)",
            borderRadius: 4,
            fontFamily: "inherit",
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-secondary)",
            cursor: readOnly ? "not-allowed" : "pointer",
            opacity: readOnly ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          {t("step5.reject_row")}
        </button>
      )}
    </div>
  );
}

function RejectModal({ reason, setReason, onCancel, onConfirm, accent }) {
  const { t } = useTranslation("migration");
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("step5.reject_row")}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 480,
          width: "100%",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 10,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {t("step5.reject_reason_prompt")}
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            padding: "10px 12px",
            background: "var(--bg-surface-sunken)",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 13,
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button type="button" onClick={onCancel} style={secondaryBtnStyle}>
            {t("nav.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!reason.trim()}
            style={{
              ...primaryBtnStyle(accent),
              opacity: !reason.trim() ? 0.55 : 1,
              cursor: !reason.trim() ? "not-allowed" : "pointer",
            }}
          >
            {t("step5.reject_row")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 18,
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          marginTop: 4,
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </div>
  );
}

function ErrorBanner({ text }) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        background: "var(--semantic-danger-subtle)",
        border: "1px solid var(--semantic-danger-border)",
        borderRadius: 6,
        fontSize: 13,
        color: "var(--semantic-danger)",
      }}
    >
      <AlertCircle size={14} />
      <span>{text}</span>
    </div>
  );
}

function NavRow({ goBack, accent }) {
  const { t } = useTranslation("migration");
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 12,
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <button type="button" onClick={goBack} style={secondaryBtnStyle}>
        <ArrowLeft size={14} />
        {t("nav.back")}
      </button>
      <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{t("step5.done")}</div>
    </div>
  );
}

const secondaryBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  background: "transparent",
  border: "1px solid var(--border-default)",
  borderRadius: 6,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-secondary)",
};

function primaryBtnStyle(accent) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    background: accent,
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
  };
}
