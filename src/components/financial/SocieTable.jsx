/**
 * @file SocieTable.jsx
 *
 * HASEEB-213 / AUDIT-ACC-039 — Statement of Changes in Equity (IAS 1
 * paragraph 106) matrix renderer.
 *
 * The backend envelope is long-form: one `SOCIEComponent` per equity
 * column, each carrying all movement fields (opening, profit/loss, OCI,
 * transactions-with-owners, transfers-between-components, closing) as
 * named fields. This component reconstructs the standard IAS 1 matrix:
 *   rows    = movement categories
 *   columns = equity components + total
 *
 * Prior-year comparative is rendered alongside the current period when
 * the envelope carries `priorPeriod`. Per-component IAS 8 markers are
 * stamped via `restatedAccountCodes` passed by the caller (the
 * FinancialStatementsScreen supplies this from `watermark.restatedComponents`)
 * OR via the component's own `restatedMarker === 'RESTATED_IAS8'` field
 * shipped by AUDIT-ACC-038.
 *
 * All monetary rendering uses Decimal.js — amounts are Numbers from the
 * backend (which narrows Decimal at the HTTP boundary per the existing
 * report convention) but we wrap them in `new Decimal(...)` before any
 * arithmetic / totals to preserve precision.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Decimal from "decimal.js";
import LtrText from "../shared/LtrText";
import { RestatedLineMarker } from "./RestatementWatermark";

// Movement-row structure per IAS 1 para 106. Keys match the
// SOCIEComponent field names on the backend envelope.
const MOVEMENT_ROWS = [
  { key: "openingBalance", i18nKey: "socie.rows.opening", bold: true },
  { key: "profitLoss", i18nKey: "socie.rows.profitForPeriod" },
  { key: "otherComprehensiveIncome", i18nKey: "socie.rows.oci" },
  {
    key: "transactionsWithOwners",
    i18nKey: "socie.rows.transactionsWithOwners",
  },
  {
    key: "transfersBetweenComponents",
    i18nKey: "socie.rows.transfers",
    italic: true,
  },
  { key: "closingBalance", i18nKey: "socie.rows.closing", bold: true },
];

function fmtDecimal(value) {
  if (value == null) return "\u2014";
  try {
    const d = new Decimal(value);
    if (d.isZero()) return "0.000";
    const abs = d.abs().toFixed(3);
    // Inject thousands separators (DM Mono tabular-nums handles alignment).
    const [intPart, decPart] = abs.split(".");
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const formatted = `${withCommas}.${decPart}`;
    return d.isNegative() ? `(${formatted})` : formatted;
  } catch {
    return "\u2014";
  }
}

/**
 * Compute per-row total across components as a Decimal. Retains precision.
 */
function sumRow(components, field) {
  return components.reduce(
    (acc, c) => acc.plus(new Decimal(c[field] == null ? 0 : c[field])),
    new Decimal(0),
  );
}

function componentLabel(component, lang) {
  if (!component) return "";
  if (lang === "ar" && component.labelAr) return component.labelAr;
  return component.labelEn || component.category || "";
}

/**
 * Render a single SOCIE period (current or prior) as an IAS 1 matrix.
 *
 * Props:
 *   period — `{ components, totalOpeningBalance, ... }`
 *   restatedAccountCodes — string[] of account codes flagged by IAS 8
 *                          watermark; used for per-component markers.
 *   caption — optional caption rendered above (e.g. current-year label)
 */
function SociePeriodMatrix({ period, restatedAccountCodes, caption }) {
  const { t, i18n } = useTranslation("financial");
  const isArabic = i18n.language === "ar";
  const components = Array.isArray(period?.components)
    ? period.components
    : [];

  // Column structure: first column = row label, one column per
  // component, final column = total.
  const columnCount = components.length + 2; // label + components + total
  const gridTemplateColumns = `minmax(180px, 1.2fr) repeat(${components.length}, minmax(110px, 1fr)) minmax(120px, 1.1fr)`;

  const rowTotals = useMemo(() => {
    const totals = {};
    for (const row of MOVEMENT_ROWS) {
      totals[row.key] = sumRow(components, row.key);
    }
    return totals;
  }, [components]);

  if (components.length === 0) {
    return (
      <div
        style={{
          padding: "16px 18px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 10,
          color: "var(--text-tertiary)",
          fontSize: 12,
        }}
      >
        {t("socie.empty")}
      </div>
    );
  }

  return (
    <div
      data-testid="socie-matrix"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {caption && (
        <div
          style={{
            padding: "10px 18px",
            borderBottom: "1px solid var(--border-default)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
          }}
        >
          {caption}
        </div>
      )}
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns,
          gap: 12,
          padding: "12px 18px",
          background: "var(--bg-surface-sunken)",
          borderBottom: "1px solid var(--border-default)",
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.12em",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
        }}
      >
        <div>{t("socie.columns.movement")}</div>
        {components.map((c, i) => (
          <div
            key={`h-${i}`}
            style={{
              textAlign: "end",
              display: "inline-flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>{componentLabel(c, isArabic ? "ar" : "en")}</span>
            <RestatedLineMarker
              code={c.accountCodes?.[0]}
              restatedAccountCodes={
                restatedAccountCodes || []
              }
              labelCode={c.restatedMarker}
            />
          </div>
        ))}
        <div style={{ textAlign: "end" }}>{t("socie.columns.total")}</div>
      </div>
      {/* Movement rows */}
      {MOVEMENT_ROWS.map((row) => {
        const isSubtotal = row.bold;
        return (
          <div
            key={row.key}
            style={{
              display: "grid",
              gridTemplateColumns,
              gap: 12,
              padding: "10px 18px",
              borderBottom: "1px solid var(--border-subtle)",
              background: isSubtotal
                ? "var(--bg-surface-sunken)"
                : "transparent",
              alignItems: "baseline",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: isSubtotal ? 600 : 400,
                fontStyle: row.italic ? "italic" : "normal",
                color: isSubtotal
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
              }}
            >
              {t(row.i18nKey)}
            </div>
            {components.map((c, i) => {
              const v = c[row.key];
              // profitLoss is null for non-RETAINED_EARNINGS components
              if (v == null) {
                return (
                  <div
                    key={`${row.key}-${i}`}
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 12,
                      textAlign: "end",
                      color: "var(--text-tertiary)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <LtrText>{"\u2014"}</LtrText>
                  </div>
                );
              }
              return (
                <div
                  key={`${row.key}-${i}`}
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                    textAlign: "end",
                    color: isSubtotal
                      ? "var(--text-primary)"
                      : "var(--text-primary)",
                    fontWeight: isSubtotal ? 600 : 400,
                    fontStyle: row.italic ? "italic" : "normal",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <LtrText>{fmtDecimal(v)}</LtrText>
                </div>
              );
            })}
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 12,
                textAlign: "end",
                color: "var(--text-primary)",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <LtrText>{fmtDecimal(rowTotals[row.key])}</LtrText>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Top-level SOCIE table. Renders current period and (when present)
 * prior-period comparative.
 */
export default function SocieTable({
  report,
  restatedAccountCodes,
}) {
  const { t } = useTranslation("financial");
  if (!report) return null;

  const currentCaption = t("socie.columns.currentYear", {
    from: report.fromDate || "",
    to: report.toDate || "",
  });
  const priorCaption = report.priorPeriod
    ? t("socie.columns.priorYear", {
        from: report.priorPeriod.fromDate || "",
        to: report.priorPeriod.toDate || "",
      })
    : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <SociePeriodMatrix
        period={report}
        restatedAccountCodes={restatedAccountCodes}
        caption={currentCaption}
      />
      {report.priorPeriod && (
        <SociePeriodMatrix
          period={report.priorPeriod}
          restatedAccountCodes={restatedAccountCodes}
          caption={priorCaption}
        />
      )}
    </div>
  );
}
