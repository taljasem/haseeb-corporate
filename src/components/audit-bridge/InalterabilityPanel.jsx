/**
 * InalterabilityPanel (FN-226, Phase 4 Wave 1 Item 2).
 *
 * Read-only composite proof that fuses three already-shipped integrity
 * signals into a single INALTERABLE / BROKEN assertion for the Audit
 * Bridge screen:
 *
 *   1. Audit chain dual-hash verify (FN-162b DUALCHAIN)
 *   2. Report-version inventory       (FN-244)
 *   3. Migration-audit schema-chain   (FN-245)
 *
 * Backend endpoint: GET /api/data-inalterability
 * Roles: OWNER + AUDITOR (backend 403s anyone else; the panel shows a
 * role-denied state rather than crashing).
 *
 * Design rules obeyed:
 *   • No new design-system primitives. Reuses the surrounding
 *     AuditBridgeScreen's Card/Field visual shapes inline + shared
 *     primitives (LtrText, Spinner).
 *   • No hex literals, no Tailwind hardcoded color classes — everything
 *     goes through `var(--*)` tokens.
 *   • RTL/Arabic from day one. Every mixed LTR/RTL sentence uses the
 *     split-fragment i18n pattern with <LtrText> wrapping ONLY the
 *     numeric / Latin tokens; Arabic prose is never force-LTR.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileText,
  GitBranch,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  Lock,
} from "lucide-react";
import LtrText from "../shared/LtrText";
import Spinner from "../shared/Spinner";
import { getDataInalterabilityReport } from "../../engine";
import { formatRelativeTime } from "../../utils/relativeTime";

function truncateHash(hash) {
  if (!hash || typeof hash !== "string") return "";
  if (hash.length <= 20) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

function formatAbsolute(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function InalterabilityPanel({ onOpenAminah }) {
  const { t } = useTranslation("audit");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [roleDenied, setRoleDenied] = useState(false);
  // Tick once a minute so "Generated N ago" auto-refreshes without a
  // full re-fetch. We don't use setInterval for the fetch itself —
  // refresh is user-driven via the header button.
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setRoleDenied(false);
    getDataInalterabilityReport()
      .then((report) => {
        setData(report);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        // Axios normalised errors come through as { ok, status, code, message }.
        // We specifically surface 403 as a role-denied panel, per the
        // OWNER + AUDITOR backend gate.
        if (err && err.status === 403) {
          setRoleDenied(true);
        } else {
          setError(err?.message || String(err || "Unknown error"));
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const overall = data?.overall;
  const isBroken = overall === "BROKEN";
  const accent = isBroken ? "var(--semantic-danger)" : "var(--accent-primary)";
  const accentSubtle = isBroken
    ? "var(--semantic-danger-subtle)"
    : "var(--accent-primary-subtle)";

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 20,
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Lock size={14} color="var(--text-tertiary)" />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t("inalterability.section_title")}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 2,
                lineHeight: 1.5,
              }}
            >
              {t("inalterability.section_desc")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {data?.generatedAt && (
            <div
              style={{
                fontSize: 10,
                color: "var(--text-tertiary)",
                fontFamily: "'DM Mono', monospace",
              }}
              // tick is read here so lint doesn't flag the useEffect state
              // as unused; the minute-ticker forces a re-render.
              data-tick={tick}
            >
              {t("inalterability.generated_prefix")}
              {formatRelativeTime(data.generatedAt)}
              {t("inalterability.generated_suffix")}
            </div>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label={t("inalterability.refresh")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "transparent",
              border: "1px solid var(--border-default)",
              color: "var(--text-secondary)",
              padding: "5px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? <Spinner size={12} /> : <RefreshCw size={12} />}
            {t("inalterability.refresh")}
          </button>
          {onOpenAminah && data && !roleDenied && (
            <button
              type="button"
              onClick={() =>
                onOpenAminah(
                  `Explain the current data-inalterability proof: overall=${overall}, rationale="${data.rationale}"`
                )
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "transparent",
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
                padding: "5px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <Sparkles size={12} />
              {t("inalterability.ask_aminah")}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 18px" }}>
        {/* Loading state */}
        {loading && !data && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: "28px 0",
              textAlign: "center",
              color: "var(--text-tertiary)",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Spinner size={14} /> {t("inalterability.loading")}
          </div>
        )}

        {/* Role-denied state */}
        {roleDenied && (
          <div
            role="alert"
            style={{
              background: "var(--semantic-warning-subtle)",
              border: "1px solid var(--semantic-warning)",
              borderRadius: 8,
              padding: "14px 16px",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <AlertTriangle
              size={18}
              color="var(--semantic-warning)"
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--semantic-warning)",
                  marginBottom: 4,
                }}
              >
                {t("inalterability.role_denied_title")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {t("inalterability.role_denied_desc")}
              </div>
            </div>
          </div>
        )}

        {/* Error state (non-403) */}
        {error && !roleDenied && !loading && (
          <div
            role="alert"
            style={{
              background: "var(--semantic-danger-subtle)",
              border: "1px solid var(--semantic-danger)",
              borderRadius: 8,
              padding: "14px 16px",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <AlertTriangle
              size={18}
              color="var(--semantic-danger)"
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--semantic-danger)",
                  marginBottom: 4,
                }}
              >
                {t("inalterability.error_title")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {error}
              </div>
            </div>
          </div>
        )}

        {/* Data present */}
        {data && !roleDenied && !error && (
          <>
            {/* Composite status banner */}
            <div
              style={{
                background: accentSubtle,
                border: `1px solid ${accent}`,
                borderRadius: 8,
                padding: "14px 16px",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                marginBottom: 14,
              }}
            >
              {isBroken ? (
                <AlertTriangle size={20} color={accent} style={{ flexShrink: 0, marginTop: 2 }} />
              ) : (
                <CheckCircle2 size={20} color={accent} style={{ flexShrink: 0, marginTop: 2 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "inline-block",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    color: accent,
                    background: "var(--bg-surface)",
                    border: `1px solid ${accent}`,
                    padding: "3px 8px",
                    borderRadius: 4,
                    marginBottom: 6,
                  }}
                >
                  {isBroken
                    ? t("inalterability.status_broken")
                    : t("inalterability.status_inalterable")}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                  }}
                >
                  {data.rationale}
                </div>
              </div>
            </div>

            {/* Three sub-cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              <AuditChainCard chain={data.auditChain} />
              <ReportVersionsCard versions={data.reportVersions} />
              <MigrationChainCard chain={data.migrationChain} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────── Sub-card: Audit chain ───────── */

function AuditChainCard({ chain }) {
  const { t } = useTranslation("audit");
  if (!chain) return null;
  const broken = !chain.fullValid || !chain.financialValid;
  const tone = broken ? "var(--semantic-danger)" : "var(--accent-primary)";

  return (
    <SubCard
      icon={ShieldCheck}
      title={t("inalterability.audit_chain.card_title")}
      tone={tone}
    >
      {chain.entriesCount === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
          {t("inalterability.audit_chain.no_entries")}
        </div>
      ) : broken && chain.brokenAtSequence != null ? (
        <div
          style={{
            fontSize: 12,
            color: "var(--semantic-danger)",
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          {t("inalterability.audit_chain.broken_prefix")}
          <LtrText>{chain.brokenAtSequence}</LtrText>
          {t("inalterability.audit_chain.broken_suffix")}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {t("inalterability.audit_chain.verified_prefix")}
          <LtrText>{chain.entriesCount.toLocaleString()}</LtrText>
          {t("inalterability.audit_chain.verified_middle")}
          {chain.financialValid
            ? t("inalterability.audit_chain.financial_ok")
            : t("inalterability.audit_chain.financial_broken")}
          {t("inalterability.audit_chain.verified_suffix")}
        </div>
      )}

      {(chain.lastFullHash || chain.lastFinancialHash) && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {chain.lastFullHash && (
            <HashLine
              label={t("inalterability.audit_chain.last_full_hash")}
              hash={chain.lastFullHash}
            />
          )}
          {chain.lastFinancialHash && (
            <HashLine
              label={t("inalterability.audit_chain.last_financial_hash")}
              hash={chain.lastFinancialHash}
            />
          )}
        </div>
      )}
    </SubCard>
  );
}

/* ───────── Sub-card: Report versions ───────── */

function ReportVersionsCard({ versions }) {
  const { t } = useTranslation("audit");
  if (!versions) return null;
  const byType = versions.byType || {};
  const typeKeys = Object.keys(byType);

  return (
    <SubCard icon={FileText} title={t("inalterability.report_versions.card_title")}>
      {versions.totalCount === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
          {t("inalterability.report_versions.no_versions")}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
            <CountStat
              label={t("inalterability.report_versions.total_label")}
              value={versions.totalCount}
            />
            <CountStat
              label={t("inalterability.report_versions.current_label")}
              value={versions.currentCount}
              tone="var(--accent-primary)"
            />
          </div>
          {versions.lastPublishedAt && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginBottom: 10,
              }}
            >
              {t("inalterability.report_versions.last_published_prefix")}
              <LtrText>{formatAbsolute(versions.lastPublishedAt)}</LtrText>
              {" · "}
              {formatRelativeTime(versions.lastPublishedAt)}
              {t("inalterability.report_versions.last_published_suffix")}
            </div>
          )}
          {typeKeys.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: "var(--text-tertiary)",
                  marginBottom: 6,
                }}
              >
                {t("inalterability.report_versions.by_type_title")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {typeKeys.map((type) => (
                  <div
                    key={type}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      padding: "3px 0",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    <span>{t(`inalterability.report_type_names.${type}`, { defaultValue: type })}</span>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--text-primary)",
                      }}
                    >
                      <LtrText>{byType[type]}</LtrText>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </SubCard>
  );
}

/* ───────── Sub-card: Migration chain ───────── */

function MigrationChainCard({ chain }) {
  const { t } = useTranslation("audit");
  if (!chain) return null;
  const hasGaps = chain.gapCount > 0;
  const tone = hasGaps ? "var(--semantic-danger)" : "var(--accent-primary)";

  return (
    <SubCard icon={GitBranch} title={t("inalterability.migration_chain.card_title")} tone={tone}>
      {chain.linkCount === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
          {t("inalterability.migration_chain.no_migrations")}
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {t("inalterability.migration_chain.links_prefix")}
              <LtrText>{chain.linkCount}</LtrText>
              {t("inalterability.migration_chain.links_middle")}
              <LtrText>{chain.gapCount}</LtrText>
              {t("inalterability.migration_chain.links_suffix")}
            </div>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: tone,
                background: hasGaps
                  ? "var(--semantic-danger-subtle)"
                  : "var(--accent-primary-subtle)",
                border: `1px solid ${tone}`,
                padding: "2px 7px",
                borderRadius: 4,
              }}
            >
              {hasGaps
                ? t("inalterability.migration_chain.gaps_badge")
                : t("inalterability.migration_chain.no_gaps_badge")}
            </span>
          </div>

          {chain.lastMigrationName && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginBottom: 4,
                wordBreak: "break-all",
              }}
            >
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  color: "var(--text-primary)",
                }}
              >
                <LtrText>{chain.lastMigrationName}</LtrText>
              </span>
            </div>
          )}

          {chain.lastAppliedAt && (
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>
              {t("inalterability.migration_chain.last_applied_prefix")}
              <LtrText>{formatAbsolute(chain.lastAppliedAt)}</LtrText>
              {" · "}
              {formatRelativeTime(chain.lastAppliedAt)}
              {t("inalterability.migration_chain.last_applied_suffix")}
            </div>
          )}

          {hasGaps && chain.firstGapMigrationName && (
            <div
              style={{
                fontSize: 11,
                color: "var(--semantic-danger)",
                marginTop: 6,
                wordBreak: "break-all",
              }}
            >
              {t("inalterability.migration_chain.first_gap_prefix")}
              <LtrText>{chain.firstGapMigrationName}</LtrText>
              {t("inalterability.migration_chain.first_gap_suffix")}
            </div>
          )}

          {chain.lastSchemaHashAfter && (
            <div style={{ marginTop: 10 }}>
              <HashLine
                label={t("inalterability.migration_chain.schema_hash_label")}
                hash={chain.lastSchemaHashAfter}
              />
            </div>
          )}
        </>
      )}
    </SubCard>
  );
}

/* ───────── Local helpers (no new DS primitives) ───────── */

function SubCard({ icon: Icon, title, tone, children }) {
  const accent = tone || "var(--text-tertiary)";
  return (
    <div
      style={{
        background: "var(--bg-surface-sunken)",
        border: "1px solid var(--border-subtle)",
        borderInlineStart: `3px solid ${accent}`,
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 10,
        }}
      >
        {Icon && <Icon size={12} color="var(--text-tertiary)" />}
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "var(--text-tertiary)",
          }}
        >
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

function CountStat({ label, value, tone }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: "var(--text-tertiary)",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontWeight: 600,
          fontSize: 18,
          color: tone || "var(--text-primary)",
          lineHeight: 1.1,
        }}
      >
        <LtrText>{typeof value === "number" ? value.toLocaleString() : value}</LtrText>
      </div>
    </div>
  );
}

function HashLine({ label, hash }) {
  const { t } = useTranslation("audit");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!hash) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(hash);
      } else {
        // Fallback for older browsers: synchronous document.execCommand.
        const ta = document.createElement("textarea");
        ta.value = hash;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Silent: copy-failure is cosmetic; the hash is visible on screen.
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: "var(--text-tertiary)",
          minWidth: 108,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          color: "var(--text-primary)",
          flex: 1,
          minWidth: 0,
        }}
        title={hash}
      >
        <LtrText>{truncateHash(hash)}</LtrText>
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? t("inalterability.copied") : t("inalterability.copy_hash")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "1px solid var(--border-default)",
          borderRadius: 5,
          padding: "3px 5px",
          color: copied ? "var(--accent-primary)" : "var(--text-tertiary)",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </div>
  );
}
