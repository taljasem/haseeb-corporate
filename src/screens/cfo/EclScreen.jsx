/**
 * EclScreen — IFRS 9 Expected Credit Loss surface (HASEEB-409 frontend).
 *
 * Companion to backend HASEEB-408 (FN-265 Sarah audit-fatal fix). Three
 * things live on this screen:
 *
 *   1. Provision Matrix — 6 customer classes × 7 aging buckets = 42
 *      cells. Each cell renders `adjustedLossRate || historicalLossRate`
 *      as a percent; an "adjusted" tag appears where adjustedLossRate is
 *      non-null. Owner can click a cell to edit the adjusted rate (inline
 *      input, save on blur / Enter); non-Owner roles see read-only cells.
 *      The backend enforces OWNER-only at PATCH; the UI affordance mirror-
 *      hides for non-OWNER to avoid surfacing a button that would 403.
 *
 *   2. Compute Section — Run ECL Computation button hits POST
 *      /api/ecl/compute. Dry-run by default (no fiscalYear+Quarter).
 *      The "Persist as quarterly review" toggle promotes the call to the
 *      persisted path which creates an EclQuarterlyComputation audit row
 *      and (when adjustment != 0) a DRAFT adjustment journal entry. The
 *      "Create Adjustment Entry" button is a shortcut that sets persist
 *      to on, infers the current fiscal year + quarter, and runs.
 *
 *   3. Last Computation Card — populated from the most recent in-session
 *      compute run. Quarterly-filing history is a separate read surface
 *      not yet shipped (HASEEB-NNN follow-up); this screen only reflects
 *      the current browser session's runs. An "empty" placeholder renders
 *      before the first compute.
 *
 * Role gating:
 *   - Owner      → full access, including matrix-edit affordance.
 *   - CFO/Senior → read-only on the matrix, can run compute.
 *   - Junior     → role-gate panel, no engine reads.
 *
 * All labels localized via the `ecl` i18n namespace. Bilingual (EN + AR).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Shield,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Info,
  Play,
  Edit2,
  Check,
  X,
  Calendar,
  FileText,
} from "lucide-react";
import Decimal from "decimal.js";
import EmptyState from "../../components/shared/EmptyState";
import LtrText from "../../components/shared/LtrText";
import { normalizeRole, ROLES } from "../../utils/role";
import {
  getEclMatrix,
  updateEclMatrixRow,
  computeEcl,
} from "../../engine";

// ── Constants ─────────────────────────────────────────────────────

const CUSTOMER_CLASSES = [
  "GOVERNMENT",
  "PRIVATE_CORPORATE",
  "PRIVATE_SME",
  "AFFILIATE",
  "RELATED_PARTY",
  "INDIVIDUAL",
];

const AGING_BUCKETS = [
  "CURRENT",
  "D1_30",
  "D31_60",
  "D61_90",
  "D91_180",
  "D181_365",
  "OVER_365",
];

// ── Helpers ───────────────────────────────────────────────────────

/** Render a decimal [0, 1] loss-rate string as a percent, up to 3 dp. */
function formatRateAsPercent(rateString) {
  if (rateString == null || rateString === "") return "—";
  try {
    const d = new Decimal(String(rateString));
    const pct = d.times(100);
    // Trim trailing zeros so 2.500 → 2.5, but keep at least 1 dp
    // for small values so 0.1% stays legible.
    const raw = pct.toFixed(3);
    const trimmed = raw.replace(/\.?0+$/, "");
    return `${trimmed}%`;
  } catch {
    return "—";
  }
}

/** Parse a percent input string ("2.5") to a decimal rate string ("0.025").
 *  Rejects empty strings, NaN, and values outside [0, 100]. */
function percentInputToRateString(input) {
  const s = String(input ?? "").trim();
  if (s === "") return { ok: false, clear: true };
  try {
    const n = new Decimal(s);
    if (n.lessThan(0) || n.greaterThan(100)) return { ok: false, clear: false };
    const rate = n.dividedBy(100);
    return { ok: true, rateString: rate.toFixed(6) };
  } catch {
    return { ok: false, clear: false };
  }
}

/** Format a KWD amount string with 3 dp + thousands separators. */
function formatKwd(value) {
  if (value == null || value === "") return "—";
  try {
    const d = new Decimal(String(value));
    const fixed = d.toFixed(3);
    const [intPart, frac] = fixed.split(".");
    const sign = d.isNegative() ? "-" : "";
    const absInt = intPart.replace(/^-/, "");
    const grouped = absInt.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${sign}${grouped}.${frac}`;
  } catch {
    return "—";
  }
}

/** Current-quarter computation (UTC). Q1 = Jan-Mar, etc. */
function currentFiscalYearQuarter() {
  const now = new Date();
  return {
    fiscalYear: now.getUTCFullYear(),
    fiscalQuarter: Math.floor(now.getUTCMonth() / 3) + 1,
  };
}

// ── Role gate panel ───────────────────────────────────────────────

function RoleGate() {
  const { t } = useTranslation("ecl");
  return (
    <div
      data-testid="ecl-role-gate"
      style={{
        padding: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
      }}
    >
      <EmptyState
        icon={Shield}
        title={t("role_gate.title")}
        description={t("role_gate.description")}
      />
    </div>
  );
}

// ── Matrix cell ───────────────────────────────────────────────────

function MatrixCell({
  row,
  canEdit,
  onSave,
  t,
  saving,
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const hasAdjustment = row.adjustedLossRate != null;
  const displayRate = row.adjustedLossRate ?? row.historicalLossRate;

  const startEdit = () => {
    if (!canEdit || saving) return;
    // Pre-fill with the current adjusted rate as a percent, else empty.
    if (row.adjustedLossRate != null) {
      try {
        const d = new Decimal(String(row.adjustedLossRate)).times(100);
        const raw = d.toFixed(3);
        setInput(raw.replace(/\.?0+$/, ""));
      } catch {
        setInput("");
      }
    } else {
      setInput("");
    }
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setInput("");
    setError(null);
  };

  const save = async () => {
    setError(null);
    const parsed = percentInputToRateString(input);
    if (!parsed.ok && !parsed.clear) {
      setError(t("matrix.edit.error_invalid"));
      return;
    }
    try {
      await onSave(row.id, parsed.clear ? null : parsed.rateString);
      setEditing(false);
      setInput("");
    } catch (err) {
      setError(t("matrix.edit.error_save_failed", { message: err?.message || String(err) }));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <div
        data-testid={`ecl-cell-editing-${row.id}`}
        style={{
          padding: 6,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={t("matrix.edit.input_aria")}
            placeholder={t("matrix.edit.input_placeholder")}
            disabled={saving}
            style={{
              flex: 1,
              minWidth: 0,
              width: "100%",
              padding: "4px 6px",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--accent-primary)",
              borderRadius: 4,
            }}
          />
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>%</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            data-testid={`ecl-cell-save-${row.id}`}
            onClick={save}
            disabled={saving}
            aria-label={t("matrix.edit.save")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              padding: "2px 6px",
              background: "var(--semantic-success)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: 10,
              cursor: saving ? "progress" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <Check size={10} strokeWidth={2.5} aria-hidden="true" />
            {saving ? t("matrix.edit.saving") : t("matrix.edit.save")}
          </button>
          <button
            data-testid={`ecl-cell-cancel-${row.id}`}
            onClick={cancel}
            disabled={saving}
            aria-label={t("matrix.edit.cancel")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              padding: "2px 6px",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              fontSize: 10,
              cursor: saving ? "progress" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <X size={10} strokeWidth={2.5} aria-hidden="true" />
            {t("matrix.edit.cancel")}
          </button>
        </div>
        {error && (
          <div
            role="alert"
            style={{
              color: "var(--semantic-danger)",
              fontSize: 10,
              lineHeight: 1.3,
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      data-testid={`ecl-cell-${row.id}`}
      data-has-adjustment={hasAdjustment ? "true" : "false"}
      onClick={startEdit}
      disabled={!canEdit}
      aria-label={
        canEdit
          ? t("matrix.edit.aria_label", {
              cls: t(`matrix.class.${row.customerClass}`),
              bucket: t(`matrix.bucket.${row.agingBucket}`),
            })
          : undefined
      }
      style={{
        padding: "8px 6px",
        width: "100%",
        minHeight: 44,
        background: hasAdjustment
          ? "var(--accent-primary-subtle, rgba(0, 196, 140, 0.10))"
          : "var(--bg-surface)",
        color: "var(--text-primary)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 4,
        cursor: canEdit ? "pointer" : "default",
        fontFamily: "'DM Mono', monospace",
        fontSize: 12,
        fontWeight: 600,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        transition: "background 0.12s ease",
      }}
      onMouseEnter={(e) => {
        if (canEdit) e.currentTarget.style.background = "var(--bg-surface-sunken)";
      }}
      onMouseLeave={(e) => {
        if (canEdit) {
          e.currentTarget.style.background = hasAdjustment
            ? "var(--accent-primary-subtle, rgba(0, 196, 140, 0.10))"
            : "var(--bg-surface)";
        }
      }}
    >
      <LtrText>{formatRateAsPercent(displayRate)}</LtrText>
      {hasAdjustment && (
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--accent-primary)",
          }}
        >
          {t("matrix.legend_adjusted").split(" ")[0]}
        </span>
      )}
    </button>
  );
}

// ── Matrix table ──────────────────────────────────────────────────

function MatrixTable({ rows, canEdit, onSaveRow, savingId, t }) {
  // Organise the rows into a {class -> {bucket -> row}} lookup for
  // deterministic grid rendering (the backend returns unsorted on edit
  // because each PATCH creates a new row with a new id).
  const lookup = useMemo(() => {
    const m = {};
    for (const r of rows) {
      if (!m[r.customerClass]) m[r.customerClass] = {};
      m[r.customerClass][r.agingBucket] = r;
    }
    return m;
  }, [rows]);

  if (!rows || rows.length === 0) {
    return (
      <div
        data-testid="ecl-matrix-empty"
        style={{
          padding: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <EmptyState
          icon={TrendingDown}
          title={t("matrix.empty.title")}
          description={t("matrix.empty.description")}
        />
      </div>
    );
  }

  return (
    <div data-testid="ecl-matrix-table" style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 4,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <thead>
          <tr>
            <th
              scope="col"
              style={{
                textAlign: "start",
                padding: "6px 8px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
                minWidth: 140,
              }}
            >
              {t("matrix.column_class")}
            </th>
            {AGING_BUCKETS.map((bucket) => (
              <th
                key={bucket}
                scope="col"
                style={{
                  textAlign: "center",
                  padding: "6px 4px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-tertiary)",
                  minWidth: 72,
                }}
              >
                <div>{t(`matrix.bucket.${bucket}`)}</div>
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 500,
                    letterSpacing: "0.05em",
                    textTransform: "none",
                    color: "var(--text-tertiary)",
                    marginTop: 2,
                  }}
                >
                  {t("matrix.bucket_header_unit")}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CUSTOMER_CLASSES.map((cls) => (
            <tr key={cls} data-testid={`ecl-row-${cls}`}>
              <th
                scope="row"
                style={{
                  textAlign: "start",
                  padding: "8px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {t(`matrix.class.${cls}`)}
              </th>
              {AGING_BUCKETS.map((bucket) => {
                const row = lookup[cls]?.[bucket];
                if (!row) {
                  return (
                    <td
                      key={bucket}
                      style={{ padding: 0, textAlign: "center", color: "var(--text-tertiary)" }}
                    >
                      —
                    </td>
                  );
                }
                return (
                  <td key={bucket} style={{ padding: 0 }}>
                    <MatrixCell
                      row={row}
                      canEdit={canEdit}
                      onSave={onSaveRow}
                      t={t}
                      saving={savingId === row.id}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Compute summary card ──────────────────────────────────────────

function ComputeSummaryCard({ result, t }) {
  if (!result?.computation) {
    return (
      <div
        data-testid="ecl-compute-empty"
        style={{
          padding: 18,
          borderRadius: 10,
          border: "1px dashed var(--border-subtle)",
          background: "var(--bg-surface-sunken)",
          color: "var(--text-tertiary)",
          fontSize: 13,
          textAlign: "center",
        }}
      >
        {t("compute.result.empty_placeholder")}
      </div>
    );
  }

  const c = result.computation;
  const dirKey = `compute.result.direction_${c.direction}`;

  return (
    <div
      data-testid="ecl-compute-summary"
      style={{
        padding: 18,
        borderRadius: 10,
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-surface-raised)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <FileText size={14} strokeWidth={1.8} color="var(--text-secondary)" aria-hidden="true" />
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          {t("compute.result.title")}
        </div>
        <div
          style={{
            marginInlineStart: "auto",
            fontSize: 11,
            color: "var(--text-tertiary)",
          }}
        >
          <LtrText>{t("compute.result.as_of", { asOf: (c.asOf || "").slice(0, 10) })}</LtrText>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        {[
          { label: t("compute.result.total_exposure"), value: c.totalExposureKwd },
          { label: t("compute.result.total_computed_ecl"), value: c.totalComputedEclKwd },
          { label: t("compute.result.current_allowance"), value: c.currentAllowanceKwd },
          { label: t("compute.result.adjustment"), value: c.adjustmentKwd, accent: true },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: s.accent ? 20 : 16,
                fontWeight: 700,
                color: s.accent ? "var(--accent-primary)" : "var(--text-primary)",
              }}
            >
              <LtrText>{formatKwd(s.value)}</LtrText>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          fontSize: 12,
          color:
            c.direction === "NONE"
              ? "var(--text-secondary)"
              : "var(--accent-primary)",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {t(dirKey)}
      </div>

      {result.persistedRowId && (
        <div
          data-testid="ecl-persisted-banner"
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: "var(--bg-surface-sunken)",
            border: "1px solid var(--border-subtle)",
            fontSize: 12,
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Check size={12} strokeWidth={2} color="var(--semantic-success)" aria-hidden="true" />
          <span>
            <LtrText>{t("compute.result.persisted_row", { id: result.persistedRowId })}</LtrText>
          </span>
          {result.jeId && (
            <span>
              — <LtrText>{t("compute.result.draft_je_created", { jeId: result.jeId })}</LtrText>
            </span>
          )}
          {!result.jeId && c.direction === "NONE" && (
            <span>— {t("compute.result.draft_je_not_needed")}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Bucket breakdown table ────────────────────────────────────────

function BucketsBreakdownTable({ buckets, t }) {
  if (!buckets || buckets.length === 0) return null;

  const nonZero = buckets.filter((b) => {
    try {
      return !new Decimal(String(b.eclKwd || 0)).isZero();
    } catch {
      return true;
    }
  });
  const rows = nonZero.length > 0 ? nonZero : buckets;

  return (
    <div
      data-testid="ecl-buckets-table"
      style={{
        borderRadius: 10,
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-surface-raised)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>{t("compute.result.buckets_title")}</span>
        {nonZero.length > 0 && nonZero.length < buckets.length && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.04em",
              textTransform: "none",
              color: "var(--text-tertiary)",
            }}
          >
            {t("compute.result.only_non_zero")}
          </span>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ background: "var(--bg-surface-sunken)" }}>
              {[
                t("compute.result.column_class"),
                t("compute.result.column_bucket"),
                t("compute.result.column_exposure"),
                t("compute.result.column_rate"),
                t("compute.result.column_rate_source"),
                t("compute.result.column_ecl"),
              ].map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: i >= 2 ? "end" : "start",
                    padding: "8px 12px",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-tertiary)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr
                key={`${b.customerClass}-${b.agingBucket}-${i}`}
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <td style={{ padding: "8px 12px", color: "var(--text-primary)" }}>
                  {t(`matrix.class.${b.customerClass}`)}
                </td>
                <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>
                  {t(`matrix.bucket.${b.agingBucket}`)}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "end",
                    fontFamily: "'DM Mono', monospace",
                    color: "var(--text-primary)",
                  }}
                >
                  <LtrText>{formatKwd(b.exposureKwd)}</LtrText>
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "end",
                    fontFamily: "'DM Mono', monospace",
                    color: "var(--text-secondary)",
                  }}
                >
                  <LtrText>{formatRateAsPercent(b.lossRate)}</LtrText>
                </td>
                <td style={{ padding: "8px 12px", textAlign: "end", color: "var(--text-tertiary)", fontSize: 11 }}>
                  {t(`compute.result.rate_source_${b.rateSource}`)}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "end",
                    fontFamily: "'DM Mono', monospace",
                    color: "var(--accent-primary)",
                    fontWeight: 600,
                  }}
                >
                  <LtrText>{formatKwd(b.eclKwd)}</LtrText>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────

export default function EclScreen({ role = "CFO" }) {
  const { t } = useTranslation("ecl");
  const normRole = normalizeRole(role);
  const canAccess =
    normRole === ROLES.CFO ||
    normRole === ROLES.SENIOR ||
    normRole === ROLES.OWNER;
  const canEditMatrix = normRole === ROLES.OWNER;

  const [matrix, setMatrix] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const [computeResult, setComputeResult] = useState(null);
  const [computing, setComputing] = useState(false);
  const [computeError, setComputeError] = useState(null);

  const [persistMode, setPersistMode] = useState(false);
  const [fiscalYear, setFiscalYear] = useState(() => currentFiscalYearQuarter().fiscalYear);
  const [fiscalQuarter, setFiscalQuarter] = useState(() => currentFiscalYearQuarter().fiscalQuarter);
  const [asOfDate, setAsOfDate] = useState("");

  const loadMatrix = useCallback(async () => {
    setMatrixLoading(true);
    setMatrixError(null);
    try {
      const rows = await getEclMatrix();
      setMatrix(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setMatrixError(e?.message || String(e));
      setMatrix([]);
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canAccess) return;
    loadMatrix();
  }, [canAccess, loadMatrix]);

  const onSaveRow = useCallback(
    async (rowId, rateString) => {
      setSavingId(rowId);
      try {
        await updateEclMatrixRow(rowId, { adjustedLossRate: rateString });
        // Reload the matrix so the new row id + rate replace the prior
        // entry (supersession pattern — backend returns the NEW row).
        await loadMatrix();
      } finally {
        setSavingId(null);
      }
    },
    [loadMatrix],
  );

  const runCompute = useCallback(
    async ({ persist } = {}) => {
      setComputing(true);
      setComputeError(null);
      try {
        const input = {};
        if (asOfDate) input.asOf = asOfDate;
        const wantsPersist = persist ?? persistMode;
        if (wantsPersist) {
          const fy = Number(fiscalYear);
          const fq = Number(fiscalQuarter);
          if (!Number.isInteger(fy) || fy < 1900 || fy > 2999) {
            throw new Error(t("compute.errors.invalid_fy"));
          }
          if (!Number.isInteger(fq) || fq < 1 || fq > 4) {
            throw new Error(t("compute.errors.invalid_fq"));
          }
          input.fiscalYear = fy;
          input.fiscalQuarter = fq;
        }
        const result = await computeEcl(input);
        setComputeResult(result);
      } catch (e) {
        setComputeError(e?.message || String(e));
      } finally {
        setComputing(false);
      }
    },
    [asOfDate, persistMode, fiscalYear, fiscalQuarter, t],
  );

  const onCreateAdjustmentEntry = useCallback(async () => {
    // Shortcut: ensure persist mode, use current FY+Q, run compute.
    const { fiscalYear: fy, fiscalQuarter: fq } = currentFiscalYearQuarter();
    setFiscalYear(fy);
    setFiscalQuarter(fq);
    setPersistMode(true);
    await runCompute({ persist: true });
  }, [runCompute]);

  if (!canAccess) return <RoleGate />;

  const adjustmentDirection = computeResult?.computation?.direction;
  const adjustmentIsNonZero =
    adjustmentDirection === "INCREASE" || adjustmentDirection === "DECREASE";
  const canCreateAdjustmentEntry =
    adjustmentIsNonZero &&
    !computeResult?.persistedRowId &&
    !computing;

  return (
    <div
      data-testid="ecl-screen"
      style={{
        flex: 1,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        overflowY: "auto",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <TrendingDown size={20} strokeWidth={1.8} color="var(--text-primary)" aria-hidden="true" />
            <h1
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 22,
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              {t("title")}
            </h1>
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              maxWidth: 720,
            }}
          >
            {t("description")}
          </div>
        </div>
        <button
          data-testid="ecl-reload"
          onClick={loadMatrix}
          disabled={matrixLoading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid var(--border-default)",
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
            fontSize: 12,
            cursor: matrixLoading ? "progress" : "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <RefreshCw size={14} strokeWidth={2} aria-hidden="true" />
          {t("reload")}
        </button>
      </div>

      {/* ── Owner-only hint ── */}
      {!canEditMatrix && (
        <div
          data-testid="ecl-read-only-note"
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-surface-sunken)",
            color: "var(--text-secondary)",
            fontSize: 12,
            lineHeight: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Info size={14} strokeWidth={1.8} aria-hidden="true" />
          <span>{t("owner_only_hint")}</span>
        </div>
      )}

      {/* ── Matrix error ── */}
      {matrixError && (
        <div
          data-testid="ecl-matrix-error"
          role="alert"
          style={{
            padding: "12px 14px",
            border: "1px solid var(--semantic-danger)",
            background: "var(--semantic-danger-subtle, rgba(253, 54, 28, 0.08))",
            borderRadius: 8,
            color: "var(--semantic-danger)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={14} strokeWidth={2} aria-hidden="true" />
          <span>{matrixError}</span>
        </div>
      )}

      {/* ── Provision Matrix ── */}
      <section
        data-testid="ecl-matrix-section"
        style={{
          borderRadius: 12,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-raised)",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Edit2 size={14} strokeWidth={1.8} aria-hidden="true" />
              {t("matrix.title")}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 720, lineHeight: 1.5 }}>
              {t("matrix.subtitle")}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--text-tertiary)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                }}
              />
              {t("matrix.legend_historical")}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: "var(--accent-primary-subtle, rgba(0, 196, 140, 0.15))",
                  border: "1px solid var(--accent-primary)",
                }}
              />
              {t("matrix.legend_adjusted")}
            </span>
          </div>
        </div>

        {matrixLoading && !matrix && (
          <div
            data-testid="ecl-matrix-loading"
            style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}
          >
            {t("loading")}
          </div>
        )}

        {matrix && (
          <MatrixTable
            rows={matrix}
            canEdit={canEditMatrix}
            onSaveRow={onSaveRow}
            savingId={savingId}
            t={t}
          />
        )}
      </section>

      {/* ── Compute section ── */}
      <section
        data-testid="ecl-compute-section"
        style={{
          borderRadius: 12,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-raised)",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Play size={14} strokeWidth={1.8} aria-hidden="true" />
            {t("compute.title")}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 720, lineHeight: 1.5 }}>
            {t("compute.subtitle")}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
              {t("compute.as_of_label")}
            </span>
            <input
              data-testid="ecl-as-of"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              style={{
                padding: "6px 10px",
                fontFamily: "'DM Mono', monospace",
                fontSize: 12,
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
              }}
            />
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{t("compute.as_of_hint")}</span>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
              <Calendar size={10} style={{ display: "inline", marginInlineEnd: 4 }} aria-hidden="true" />
              {t("compute.persist_label")}
            </span>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-primary)" }}>
              <input
                data-testid="ecl-persist-toggle"
                type="checkbox"
                checked={persistMode}
                onChange={(e) => setPersistMode(e.target.checked)}
              />
              <span>{persistMode ? t("compute.persist_label") : t("compute.dry_run_note")}</span>
            </label>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{t("compute.persist_hint")}</span>
          </label>

          {persistMode && (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
                  {t("compute.fiscal_year_label")}
                </span>
                <input
                  data-testid="ecl-fiscal-year"
                  type="number"
                  min={1900}
                  max={2999}
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 6,
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
                  {t("compute.fiscal_quarter_label")}
                </span>
                <select
                  data-testid="ecl-fiscal-quarter"
                  value={fiscalQuarter}
                  onChange={(e) => setFiscalQuarter(Number(e.target.value))}
                  style={{
                    padding: "6px 10px",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 6,
                  }}
                >
                  <option value={1}>Q1</option>
                  <option value={2}>Q2</option>
                  <option value={3}>Q3</option>
                  <option value={4}>Q4</option>
                </select>
              </label>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            data-testid="ecl-run-compute"
            onClick={() => runCompute()}
            disabled={computing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent-primary)",
              color: "#0B0F14",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700,
              fontSize: 13,
              cursor: computing ? "progress" : "pointer",
            }}
          >
            <Play size={14} strokeWidth={2} aria-hidden="true" />
            {computing ? t("compute.running") : t("compute.run_button")}
          </button>
          {canCreateAdjustmentEntry && (
            <button
              data-testid="ecl-create-adjustment"
              onClick={onCreateAdjustmentEntry}
              disabled={computing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid var(--accent-primary)",
                background: "transparent",
                color: "var(--accent-primary)",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 700,
                fontSize: 13,
                cursor: computing ? "progress" : "pointer",
              }}
              title={t("compute.result.create_adjustment_hint")}
            >
              <FileText size={14} strokeWidth={2} aria-hidden="true" />
              {t("compute.result.create_adjustment_entry")}
            </button>
          )}
        </div>

        {computeError && (
          <div
            data-testid="ecl-compute-error"
            role="alert"
            style={{
              padding: "10px 14px",
              border: "1px solid var(--semantic-danger)",
              background: "var(--semantic-danger-subtle, rgba(253, 54, 28, 0.08))",
              borderRadius: 8,
              color: "var(--semantic-danger)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertTriangle size={14} strokeWidth={2} aria-hidden="true" />
            <span>{t("compute.errors.run_failed", { message: computeError })}</span>
          </div>
        )}

        <ComputeSummaryCard result={computeResult} t={t} />
        {computeResult?.computation?.buckets && (
          <BucketsBreakdownTable buckets={computeResult.computation.buckets} t={t} />
        )}
      </section>
    </div>
  );
}
