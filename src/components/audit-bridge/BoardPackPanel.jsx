import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileBarChart,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import LtrText from "../shared/LtrText";
import { getBoardPack } from "../../engine";

// Read-only Board Pack composite panel (FN-258). Sits on the Audit
// Bridge landing alongside InalterabilityPanel + MigrationAuditPanel.
// Q9 resolved: DATA-ONLY table; PDF render deferred to Phase 5 per
// the backend dispatch. No "Export PDF" button.
//
// OWNER + AUDITOR only (backend-gated; 403 surfaces as load error).

function currentFY() {
  // Default to the just-closed fiscal year (typical audit timing).
  return new Date().getFullYear() - 1;
}

function deltaTone(pct) {
  if (pct == null) return "neutral";
  const n = Number(pct);
  if (!Number.isFinite(n)) return "neutral";
  if (Math.abs(n) < 0.01) return "flat";
  return n > 0 ? "up" : "down";
}

export default function BoardPackPanel() {
  const { t } = useTranslation("audit");
  const [fiscalYear, setFiscalYear] = useState(currentFY());
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const load = async (fy) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBoardPack({ fiscalYear: fy });
      setPack(data);
    } catch (err) {
      setError(err?.message || "failed to generate pack");
      setPack(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) load(fiscalYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, fiscalYear]);

  const hasYoY = pack && (pack.yoyComparisons || []).length > 0;
  const hasCurrent = pack && (pack.currentReportVersions || []).length > 0;
  const hasPrior = pack && (pack.priorReportVersions || []).length > 0;

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
          <FileBarChart size={16} color="var(--accent-primary)" />
          <div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 18,
                letterSpacing: "-0.2px",
              }}
            >
              {t("board_pack.title")}
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
              {t("board_pack.subtitle")}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
          <LtrText>
            <span style={{ fontFamily: "'DM Mono', monospace" }}>
              FY{fiscalYear}
            </span>
          </LtrText>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: "14px 18px" }}>
          {/* FY picker */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t("board_pack.fiscal_year_label")}
            </div>
            <input
              type="number"
              min={2000}
              max={2100}
              step={1}
              value={fiscalYear}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 2000 && n <= 2100) {
                  setFiscalYear(n);
                }
              }}
              style={{
                width: 100,
                background: "var(--bg-surface-sunken)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                padding: "6px 10px",
                color: "var(--text-primary)",
                fontSize: 12,
                fontFamily: "'DM Mono', monospace",
                outline: "none",
              }}
            />
            {pack && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  marginInlineStart: 10,
                }}
              >
                {t("board_pack.prior_fy_label")}:{" "}
                <LtrText>
                  <span style={{ fontFamily: "'DM Mono', monospace" }}>
                    FY{pack.priorFiscalYear}
                  </span>
                </LtrText>{" "}
                ·{" "}
                {t("board_pack.generated_at_label")}:{" "}
                <LtrText>
                  <span style={{ fontFamily: "'DM Mono', monospace" }}>
                    {new Date(pack.generatedAt).toISOString().slice(0, 10)}
                  </span>
                </LtrText>
              </div>
            )}
          </div>

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

          {loading && (
            <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
              {t("board_pack.loading")}
            </div>
          )}

          {pack && !loading && (
            <>
              {/* Warnings */}
              {(pack.warnings || []).length > 0 && (
                <div
                  role="status"
                  style={{
                    padding: "10px 12px",
                    background: "var(--semantic-warning-subtle)",
                    border: "1px solid var(--semantic-warning)",
                    borderRadius: 8,
                    color: "var(--semantic-warning)",
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {t("board_pack.warnings_heading")}
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingInlineStart: 18,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {pack.warnings.map((w, i) => (
                      <li key={i} style={{ marginTop: 2 }}>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Summary counts */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12,
                  padding: "10px 12px",
                  background: "var(--bg-surface-sunken)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              >
                <SummaryCell
                  label={t("board_pack.count_current_reports")}
                  value={String(pack.currentReportVersions.length)}
                />
                <SummaryCell
                  label={t("board_pack.count_prior_reports")}
                  value={String(pack.priorReportVersions.length)}
                />
                <SummaryCell
                  label={t("board_pack.count_yoy")}
                  value={String(pack.yoyComparisons.length)}
                />
                <SummaryCell
                  label={t("board_pack.count_disclosure_runs")}
                  value={String((pack.disclosureSummaries || []).length)}
                />
              </div>

              {/* YoY comparison table */}
              {hasYoY && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      color: "var(--text-tertiary)",
                      marginBottom: 8,
                    }}
                  >
                    {t("board_pack.yoy_heading")}
                  </div>
                  <div
                    style={{
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    {pack.yoyComparisons.map((cmp, i) => (
                      <YoYReportBlock
                        key={`${cmp.reportType}-${cmp.reportKey}-${i}`}
                        comparison={cmp}
                        isLast={i === pack.yoyComparisons.length - 1}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Report-version lists */}
              {(hasCurrent || hasPrior) && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 10,
                  }}
                >
                  <ReportVersionList
                    heading={t("board_pack.current_reports_heading", {
                      year: pack.fiscalYear,
                    })}
                    versions={pack.currentReportVersions}
                    t={t}
                  />
                  <ReportVersionList
                    heading={t("board_pack.prior_reports_heading", {
                      year: pack.priorFiscalYear,
                    })}
                    versions={pack.priorReportVersions}
                    t={t}
                  />
                </div>
              )}

              {/* Disclosure runs */}
              {(pack.disclosureSummaries || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      color: "var(--text-tertiary)",
                      marginBottom: 8,
                    }}
                  >
                    {t("board_pack.disclosure_heading")}
                  </div>
                  <div
                    style={{
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    {pack.disclosureSummaries.map((d, i) => (
                      <div
                        key={d.runId}
                        style={{
                          padding: "10px 14px",
                          borderBottom:
                            i === pack.disclosureSummaries.length - 1
                              ? "none"
                              : "1px solid var(--border-subtle)",
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                        }}
                      >
                        <div>
                          <LtrText>
                            <span
                              style={{
                                fontFamily: "'DM Mono', monospace",
                                color: "var(--text-primary)",
                              }}
                            >
                              FY{d.fiscalYear} · {d.language}
                            </span>
                          </LtrText>
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--text-tertiary)",
                              marginTop: 2,
                            }}
                          >
                            {t("board_pack.material_notes", {
                              count: d.materialNoteCount,
                            })}
                            {d.approvedAt && (
                              <>
                                {" · "}
                                <LtrText>
                                  <span
                                    style={{
                                      fontFamily: "'DM Mono', monospace",
                                    }}
                                  >
                                    {new Date(d.approvedAt)
                                      .toISOString()
                                      .slice(0, 10)}
                                  </span>
                                </LtrText>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!hasCurrent && !hasPrior && !hasYoY && (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                    fontSize: 12,
                    border: "1px dashed var(--border-default)",
                    borderRadius: 8,
                  }}
                >
                  {t("board_pack.empty_pack")}
                </div>
              )}

              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  fontStyle: "italic",
                }}
              >
                {t("board_pack.pdf_deferred_note")}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function YoYReportBlock({ comparison, isLast }) {
  const { t } = useTranslation("audit");
  return (
    <div
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--text-primary)",
          fontFamily: "'DM Mono', monospace",
          marginBottom: 6,
        }}
      >
        <LtrText>
          {comparison.reportType} · {comparison.reportKey}
        </LtrText>
      </div>
      {(comparison.metrics || []).length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr 1fr 1fr 80px",
            gap: 8,
            fontSize: 11,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
            }}
          >
            {t("board_pack.metric_header")}
          </div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              textAlign: "end",
            }}
          >
            {t("board_pack.prior_header")}
          </div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              textAlign: "end",
            }}
          >
            {t("board_pack.current_header")}
          </div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              textAlign: "end",
            }}
          >
            {t("board_pack.delta_header")}
          </div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              textAlign: "end",
            }}
          >
            {t("board_pack.delta_pct_header")}
          </div>
          {comparison.metrics.map((m, i) => {
            const tone = deltaTone(m.deltaPercent);
            const toneColor =
              tone === "up"
                ? "var(--accent-primary)"
                : tone === "down"
                ? "var(--semantic-danger)"
                : "var(--text-tertiary)";
            const Icon =
              tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Minus;
            return (
              <ReactFragmentRow
                key={i}
                metric={m}
                toneColor={toneColor}
                Icon={Icon}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReactFragmentRow({ metric, toneColor, Icon }) {
  return (
    <>
      <div
        style={{
          color: "var(--text-primary)",
          fontSize: 11,
          padding: "3px 0",
        }}
      >
        {metric.metricName}
      </div>
      <div
        style={{
          color: "var(--text-secondary)",
          textAlign: "end",
          fontFamily: "'DM Mono', monospace",
          padding: "3px 0",
        }}
      >
        <LtrText>{metric.priorValue ?? "—"}</LtrText>
      </div>
      <div
        style={{
          color: "var(--text-primary)",
          textAlign: "end",
          fontFamily: "'DM Mono', monospace",
          fontWeight: 600,
          padding: "3px 0",
        }}
      >
        <LtrText>{metric.currentValue ?? "—"}</LtrText>
      </div>
      <div
        style={{
          color: toneColor,
          textAlign: "end",
          fontFamily: "'DM Mono', monospace",
          padding: "3px 0",
        }}
      >
        <LtrText>{metric.deltaAbsolute ?? "—"}</LtrText>
      </div>
      <div
        style={{
          color: toneColor,
          textAlign: "end",
          fontFamily: "'DM Mono', monospace",
          padding: "3px 0",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          justifyContent: "flex-end",
        }}
      >
        <Icon size={10} />
        <LtrText>
          {metric.deltaPercent != null ? `${metric.deltaPercent}%` : "—"}
        </LtrText>
      </div>
    </>
  );
}

function ReportVersionList({ heading, versions, t }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          marginBottom: 6,
        }}
      >
        {heading}
      </div>
      {versions.length === 0 ? (
        <div
          style={{
            padding: "12px",
            color: "var(--text-tertiary)",
            fontSize: 11,
            border: "1px dashed var(--border-default)",
            borderRadius: 6,
            textAlign: "center",
          }}
        >
          {t("board_pack.no_versions")}
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {versions.map((v, i) => (
            <div
              key={`${v.reportType}-${v.reportKey}-${v.version}`}
              style={{
                padding: "8px 12px",
                borderBottom:
                  i === versions.length - 1
                    ? "none"
                    : "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 11,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <FileText size={11} color="var(--text-tertiary)" />
                  <LtrText>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--text-primary)",
                        fontWeight: 600,
                      }}
                    >
                      {v.reportType}
                    </span>
                  </LtrText>
                  <LtrText>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      v{v.version}
                    </span>
                  </LtrText>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-tertiary)",
                    marginTop: 2,
                  }}
                >
                  <LtrText>
                    <span style={{ fontFamily: "'DM Mono', monospace" }}>
                      {v.reportKey}
                    </span>
                  </LtrText>
                  {v.publishedAt && (
                    <>
                      {" · "}
                      <LtrText>
                        <span style={{ fontFamily: "'DM Mono', monospace" }}>
                          {new Date(v.publishedAt).toISOString().slice(0, 10)}
                        </span>
                      </LtrText>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCell({ label, value }) {
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
          color: "var(--text-primary)",
        }}
      >
        <LtrText>{value}</LtrText>
      </div>
    </div>
  );
}
