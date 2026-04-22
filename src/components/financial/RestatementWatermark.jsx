/**
 * @file RestatementWatermark.jsx
 *
 * HASEEB-216 / AUDIT-ACC-038 — IAS 8 paragraph 22 watermark rendering
 * for the four primary financial statements (Balance Sheet, Income
 * Statement, Cash Flow, SOCIE).
 *
 * Consumes the `restatementWatermark` envelope field shipped by the
 * backend at `src/modules/reports/report.types.ts::RestatementWatermark`.
 * Returns null when `isRestated: false` — no empty banner, no empty
 * footnote section.
 *
 * Bilingual labels come directly from the watermark (`labelEn`, `labelAr`)
 * so the backend's Kuwait-Arabic terminology stays authoritative.
 */
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import LtrText from "../shared/LtrText";

/**
 * Top-of-statement banner. Component returns null when `watermark` is
 * absent or `isRestated` is false.
 *
 * Props:
 *   watermark — RestatementWatermark envelope; nullable.
 */
export default function RestatementWatermark({ watermark }) {
  const { t, i18n } = useTranslation("financial");
  if (!watermark || !watermark.isRestated) return null;

  const isArabic = i18n.language === "ar";
  const label = isArabic ? watermark.labelAr : watermark.labelEn;
  const reasons = Array.isArray(watermark.restatementReasons)
    ? watermark.restatementReasons
    : [];
  const effectiveDate = watermark.restatementEffectiveDate || null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="restatement-watermark"
      style={{
        marginBottom: 14,
        background: "var(--bg-warning-subtle, rgba(212,168,75,0.10))",
        border: "1px solid var(--semantic-warning, #D4A84B)",
        borderRadius: 10,
        padding: "14px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AlertTriangle
          size={18}
          color="var(--semantic-warning, #D4A84B)"
          aria-hidden="true"
        />
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 18,
            letterSpacing: "0.05em",
            color: "var(--semantic-warning, #D4A84B)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        {effectiveDate && (
          <div
            style={{
              marginInlineStart: "auto",
              fontSize: 11,
              color: "var(--text-tertiary)",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            <LtrText>{effectiveDate}</LtrText>
          </div>
        )}
      </div>
      {reasons.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            paddingInlineStart: 28,
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
            {t("restatement.footnoteHeader")}
          </div>
          <ol
            style={{
              margin: 0,
              paddingInlineStart: 20,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {reasons.map((reason, i) => (
              <li
                key={i}
                style={{
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: "var(--text-secondary)",
                }}
              >
                {reason}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/**
 * Per-line restated marker — small inline badge rendered alongside a
 * row label whose account code appears in `restatedAccountCodes`.
 * Uses design-system warning tone; never a hex literal.
 */
export function RestatedLineMarker({ code, restatedAccountCodes, labelCode }) {
  const { t } = useTranslation("financial");
  if (!restatedAccountCodes || restatedAccountCodes.length === 0) return null;
  const match = code && restatedAccountCodes.includes(code);
  // Also honour a synthetic marker (e.g. SOCIE component restatedMarker).
  const synthetic = labelCode === "RESTATED_IAS8";
  if (!match && !synthetic) return null;
  return (
    <span
      data-testid="restated-line-marker"
      title={t("restatement.lineMarker")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        marginInlineStart: 6,
        padding: "2px 6px",
        borderRadius: 10,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: "var(--bg-warning-subtle, rgba(212,168,75,0.12))",
        color: "var(--semantic-warning, #D4A84B)",
        border: "1px solid var(--semantic-warning, #D4A84B)",
        flexShrink: 0,
      }}
    >
      {t("restatement.lineMarkerBadge")}
    </span>
  );
}
