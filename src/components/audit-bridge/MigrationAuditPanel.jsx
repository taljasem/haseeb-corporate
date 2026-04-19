import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import LtrText from "../shared/LtrText";
import {
  listMigrationAudits,
  getMigrationSchemaChain,
} from "../../engine";

// Read-only migration-audit trail panel (FN-245). Sits on the Audit
// Bridge landing alongside the FN-226 Data Inalterability panel —
// migration audit integrity is one of the signals that feeds the
// inalterability report. OWNER + AUDITOR only (backend-enforced).
//
// Shows the most recent migrations by default with their outcome,
// trigger source, duration, and per-row schema-hash chain integrity.
// Chain breaks are surfaced prominently because they indicate a
// migration was applied outside the recording path.

const OUTCOME_COLORS = {
  SUCCESS: {
    color: "var(--accent-primary)",
    bg: "var(--accent-primary-subtle)",
  },
  FAILED: {
    color: "var(--semantic-danger)",
    bg: "var(--semantic-danger-subtle)",
  },
  ROLLED_BACK: {
    color: "var(--semantic-warning)",
    bg: "var(--semantic-warning-subtle)",
  },
};

function shortHash(hash) {
  if (!hash) return "—";
  return hash.length <= 12 ? hash : `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

function formatDurationMs(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function MigrationAuditPanel() {
  const { t } = useTranslation("audit");
  const [audits, setAudits] = useState(null);
  const [chain, setChain] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [expandedRows, setExpandedRows] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listMigrationAudits({ limit: 50 }).catch((err) => {
        if (!cancelled) setError(err?.message || "load failed");
        return [];
      }),
      getMigrationSchemaChain().catch(() => []),
    ]).then(([list, chainLinks]) => {
      if (cancelled) return;
      setAudits(list || []);
      setChain(chainLinks || []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Build a map from audit.id → chainsToPrevious for per-row status.
  const chainByAuditId = new Map();
  (chain || []).forEach((link) => {
    chainByAuditId.set(link.audit?.id, link);
  });

  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const chainBreakCount = (chain || []).filter(
    (l) => l.previousAuditId && !l.chainsToPrevious,
  ).length;
  const chainIntact = chain && chainBreakCount === 0;
  const successCount = (audits || []).filter(
    (a) => a.outcome === "SUCCESS",
  ).length;
  const failedCount = (audits || []).filter(
    (a) => a.outcome === "FAILED" || a.outcome === "ROLLED_BACK",
  ).length;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        marginBottom: 18,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-primary)",
          fontFamily: "inherit",
          textAlign: "start",
          borderBottom: expanded ? "1px solid var(--border-subtle)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {expanded ? (
            <ChevronDown size={14} color="var(--text-tertiary)" />
          ) : (
            <ChevronRight size={14} color="var(--text-tertiary)" />
          )}
          <Database size={16} color="var(--accent-primary)" />
          <div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 18,
                letterSpacing: "-0.2px",
              }}
            >
              {t("migration_audit.title")}
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                marginTop: 2,
              }}
            >
              {t("migration_audit.subtitle")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {audits && (
            <>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                }}
              >
                {t("migration_audit.summary_count", {
                  count: audits.length,
                })}
              </span>
              {chain && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: chainIntact
                      ? "var(--accent-primary-subtle)"
                      : "var(--semantic-danger-subtle)",
                    color: chainIntact
                      ? "var(--accent-primary)"
                      : "var(--semantic-danger)",
                    border: "1px solid",
                    borderColor: chainIntact
                      ? "var(--accent-primary-border)"
                      : "var(--semantic-danger)",
                  }}
                >
                  {chainIntact ? (
                    <CheckCircle2 size={11} />
                  ) : (
                    <AlertTriangle size={11} />
                  )}
                  {chainIntact
                    ? t("migration_audit.chain_intact")
                    : t("migration_audit.chain_breaks", {
                        count: chainBreakCount,
                      })}
                </span>
              )}
              {failedCount > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: "var(--semantic-danger-subtle)",
                    color: "var(--semantic-danger)",
                    border: "1px solid var(--semantic-danger)",
                  }}
                >
                  {t("migration_audit.failed_count", { count: failedCount })}
                </span>
              )}
            </>
          )}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div style={{ padding: "14px 18px" }}>
          {error && (
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
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {audits === null && !error && (
            <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
              {t("migration_audit.loading")}
            </div>
          )}

          {audits && audits.length === 0 && !error && (
            <div
              style={{
                color: "var(--text-tertiary)",
                fontSize: 12,
                padding: "14px",
                textAlign: "center",
              }}
            >
              {t("migration_audit.empty")}
            </div>
          )}

          {audits && audits.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {/* Summary row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 10,
                  padding: "10px 12px",
                  background: "var(--bg-surface-sunken)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  marginBottom: 6,
                }}
              >
                <SummaryCell
                  label={t("migration_audit.summary_total")}
                  value={String(audits.length)}
                  tone="default"
                />
                <SummaryCell
                  label={t("migration_audit.summary_success")}
                  value={String(successCount)}
                  tone={successCount === audits.length ? "success" : "default"}
                />
                <SummaryCell
                  label={t("migration_audit.summary_failed")}
                  value={String(failedCount)}
                  tone={failedCount > 0 ? "danger" : "default"}
                />
                <SummaryCell
                  label={t("migration_audit.summary_chain_status")}
                  value={
                    chainIntact
                      ? t("migration_audit.chain_intact_short")
                      : t("migration_audit.chain_break_short", {
                          count: chainBreakCount,
                        })
                  }
                  tone={chainIntact ? "success" : "danger"}
                />
              </div>

              {/* Rows */}
              <div
                style={{
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  overflow: "hidden",
                  maxHeight: 480,
                  overflowY: "auto",
                }}
              >
                {audits.map((audit, idx) => {
                  const outcomeColors =
                    OUTCOME_COLORS[audit.outcome] ||
                    OUTCOME_COLORS.SUCCESS;
                  const link = chainByAuditId.get(audit.id);
                  const chainBroken = link && link.previousAuditId && !link.chainsToPrevious;
                  const isExpanded = expandedRows.has(audit.id);
                  return (
                    <div
                      key={audit.id}
                      style={{
                        borderBottom:
                          idx === audits.length - 1
                            ? "none"
                            : "1px solid var(--border-subtle)",
                      }}
                    >
                      <button
                        onClick={() => toggleRow(audit.id)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 14px",
                          background: chainBroken
                            ? "var(--semantic-danger-subtle)"
                            : "transparent",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "start",
                          fontFamily: "inherit",
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
                            {isExpanded ? (
                              <ChevronDown
                                size={12}
                                color="var(--text-tertiary)"
                              />
                            ) : (
                              <ChevronRight
                                size={12}
                                color="var(--text-tertiary)"
                              />
                            )}
                            <div
                              style={{
                                fontSize: 12,
                                fontFamily: "'DM Mono', monospace",
                                fontWeight: 600,
                              }}
                            >
                              <LtrText>{audit.migrationName}</LtrText>
                            </div>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: "0.1em",
                                padding: "2px 8px",
                                borderRadius: 10,
                                background: outcomeColors.bg,
                                color: outcomeColors.color,
                                border: "1px solid",
                              }}
                            >
                              {t(`migration_audit.outcome_${audit.outcome}`)}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: "0.1em",
                                padding: "2px 8px",
                                borderRadius: 10,
                                background: "var(--bg-surface)",
                                color: "var(--text-tertiary)",
                                border: "1px solid var(--border-default)",
                              }}
                            >
                              {t(
                                `migration_audit.trigger_${audit.triggerSource}`,
                              )}
                            </span>
                            {chainBroken && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.1em",
                                  padding: "2px 8px",
                                  borderRadius: 10,
                                  background: "var(--semantic-danger-subtle)",
                                  color: "var(--semantic-danger)",
                                  border: "1px solid var(--semantic-danger)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <XCircle size={10} />
                                {t("migration_audit.chain_broken")}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 14,
                              marginTop: 4,
                              marginInlineStart: 20,
                              fontSize: 10,
                              color: "var(--text-tertiary)",
                            }}
                          >
                            <LtrText>
                              <span
                                style={{
                                  fontFamily: "'DM Mono', monospace",
                                }}
                              >
                                {audit.appliedAt}
                              </span>
                            </LtrText>
                            <span>
                              {t("migration_audit.label_by")}:{" "}
                              <span style={{ color: "var(--text-secondary)" }}>
                                {audit.appliedBy}
                              </span>
                            </span>
                            {audit.durationMs != null && (
                              <LtrText>
                                <span
                                  style={{
                                    fontFamily: "'DM Mono', monospace",
                                  }}
                                >
                                  {formatDurationMs(audit.durationMs)}
                                </span>
                              </LtrText>
                            )}
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <div
                          style={{
                            padding: "6px 14px 14px 42px",
                            fontSize: 11,
                            color: "var(--text-secondary)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          {audit.diffSummary && (
                            <div>
                              <span style={{ color: "var(--text-tertiary)" }}>
                                {t("migration_audit.label_diff")}:
                              </span>{" "}
                              <span style={{ whiteSpace: "pre-wrap" }}>
                                {audit.diffSummary}
                              </span>
                            </div>
                          )}
                          <div>
                            <span style={{ color: "var(--text-tertiary)" }}>
                              {t("migration_audit.label_hash_before")}:
                            </span>{" "}
                            <LtrText>
                              <span
                                style={{ fontFamily: "'DM Mono', monospace" }}
                              >
                                {shortHash(audit.schemaHashBefore)}
                              </span>
                            </LtrText>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-tertiary)" }}>
                              {t("migration_audit.label_hash_after")}:
                            </span>{" "}
                            <LtrText>
                              <span
                                style={{ fontFamily: "'DM Mono', monospace" }}
                              >
                                {shortHash(audit.schemaHashAfter)}
                              </span>
                            </LtrText>
                          </div>
                          {audit.errorMessage && (
                            <div
                              style={{
                                color: "var(--semantic-danger)",
                                padding: "6px 10px",
                                background: "var(--semantic-danger-subtle)",
                                borderRadius: 6,
                                border: "1px solid var(--semantic-danger)",
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>
                                {t("migration_audit.label_error")}:
                              </span>{" "}
                              {audit.errorMessage}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCell({ label, value, tone }) {
  const color =
    tone === "success"
      ? "var(--accent-primary)"
      : tone === "danger"
      ? "var(--semantic-danger)"
      : "var(--text-primary)";
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 14,
          fontWeight: 700,
          color,
        }}
      >
        <LtrText>{value}</LtrText>
      </div>
    </div>
  );
}
