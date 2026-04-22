/**
 * PIFSSReconciliationScreen — AUDIT-ACC-058 (2026-04-22).
 *
 * ANNUAL PIFSS reconciliation surface (FN-251). Distinct from the
 * PayrollScreen monthly PIFSS Submissions tab (outbound SIF generation
 * per payroll month). This surface drives the year-end compliance
 * workflow:
 *
 *   Year list ──▶ Per-year detail
 *                  ├── Step 1: Import PIFSS authority annual statement
 *                  ├── Step 2: Run reconciliation compare
 *                  └── Step 3: Variance review grouped by employee
 *                               └── Variance resolution modal (PATCH)
 *                  └── Auditor report view (GET /report, print-friendly)
 *
 * Role gating (midsize model, midsize canEditAdmin predicate):
 *   - Owner / CFO / Senior: import + run + resolve.
 *   - Owner-only: reopen closed variance (RESOLVED/IN_DISPUTE → UNRESOLVED).
 *   - Junior: read-only; zero write affordances.
 *
 * Backend contract: 5 endpoints at /api/pifss-reconciliation/*. All
 * monetary fields are KWD Decimal(18,3) strings — string-safe
 * fixed-point math is used for client-side rollups.
 *
 * Wall preservation: frontend never calls an LLM. All mutations go
 * through `src/engine` → `src/api/pifssReconciliation.js`.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FilePlus,
  ArrowLeft,
  Upload,
  Play,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Printer,
  RefreshCcw,
  Calendar,
} from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import LtrText from '../../components/shared/LtrText';
import { normalizeRole, canEditAdmin, ROLES } from '../../utils/role';
import VarianceResolutionModal from '../../components/pifss/VarianceResolutionModal';
import {
  listReconciliationYears,
  getReconciliation,
  getReconciliationReport,
  importStatement,
  runReconciliation,
} from '../../engine';

// ── Constants ─────────────────────────────────────────────────────

/**
 * Variance type → tone used for badge colour. The 4 backend enum values
 * map to 4 tones that render via design-system tokens (no hex literals).
 */
const VARIANCE_TYPE_TONE = {
  COMPANY_ONLY: 'warning',
  PORTAL_ONLY: 'warning',
  CONTRIBUTION_AMOUNT_DIFFERS: 'danger',
  SALARY_BASE_DIFFERS: 'info',
};

const VARIANCE_STATUS_TONE = {
  UNRESOLVED: 'warning',
  UNDER_INVESTIGATION: 'info',
  RESOLVED: 'success',
  IN_DISPUTE: 'danger',
};

/**
 * Parser-version registry on the frontend. Seeded from the backend's
 * current parser registry (only `kuwait-pifss-annual-v1-csv` is
 * registered today per 2026-04-22). When the backend adds more parsers,
 * update this list alongside. HASEEB-216 logged to track exposing the
 * parser list via a backend endpoint so the frontend stops maintaining
 * a parallel constant.
 */
const PARSER_VERSIONS = ['kuwait-pifss-annual-v1-csv'];
const DEFAULT_PARSER_VERSION = 'kuwait-pifss-annual-v1-csv';

// ── Helpers ───────────────────────────────────────────────────────

function formatKwd(value) {
  if (value == null) return '—';
  const s = String(value);
  // If already a 3dp string, render as-is. If a number, format to 3dp
  // with grouping. Note: we deliberately do NOT parseFloat — the
  // backend emits Decimal-safe strings.
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function isoTimestamp(ts) {
  if (!ts) return '—';
  const d = String(ts);
  // "2026-04-22T10:15:33.000Z" → "2026-04-22 10:15"
  return d.slice(0, 10) + ' ' + d.slice(11, 16);
}

function periodString(year, month) {
  if (year == null || month == null) return '—';
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Fixed-point integer rollup of KWD Decimal(18,3) string values.
 * Returns a 3dp string with grouping. Uses BigInt to avoid FP drift.
 * Values are absolute-summed (Σ|Δ|) per the spec.
 */
function sumAbsKwd(values) {
  let total = 0n;
  for (const v of values || []) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    // Parse sign.
    let rest = s;
    let neg = false;
    if (rest.startsWith('-')) {
      neg = true;
      rest = rest.slice(1);
    } else if (rest.startsWith('+')) {
      rest = rest.slice(1);
    }
    // Split integer / fraction.
    const dot = rest.indexOf('.');
    let intPart = rest;
    let fracPart = '';
    if (dot >= 0) {
      intPart = rest.slice(0, dot);
      fracPart = rest.slice(dot + 1);
    }
    // Normalize fraction to exactly 3 digits.
    if (fracPart.length < 3) fracPart = fracPart + '0'.repeat(3 - fracPart.length);
    else if (fracPart.length > 3) fracPart = fracPart.slice(0, 3);
    // Guard: only digits.
    if (!/^\d*$/.test(intPart) || !/^\d{3}$/.test(fracPart)) continue;
    let scaled = BigInt((intPart || '0') + fracPart);
    // Absolute value — suppress sign (we ignore `neg` for the abs sum).
    if (scaled < 0n) scaled = -scaled; // defensive; parseable shouldn't produce negative but belt-and-braces.
    if (neg) {
      // still absolute
    }
    total += scaled;
  }
  // Reverse to string.
  const str = total.toString().padStart(4, '0');
  const intStr = str.slice(0, -3);
  const fracStr = str.slice(-3);
  const n = Number(intStr); // intStr fits in Number up to 2^53; totals are unlikely to overflow in a single-year rollup.
  const intFormatted = n.toLocaleString('en-US');
  return `${intFormatted}.${fracStr}`;
}

function varianceTypeTone(type) {
  return VARIANCE_TYPE_TONE[type] || 'neutral';
}

function varianceStatusTone(status) {
  return VARIANCE_STATUS_TONE[status] || 'neutral';
}

function toneStyle(tone) {
  switch (tone) {
    case 'success':
      return {
        color: 'var(--accent-primary)',
        bg: 'var(--accent-primary-subtle)',
        border: 'var(--accent-primary-border)',
      };
    case 'warning':
      return {
        color: 'var(--semantic-warning)',
        bg: 'var(--semantic-warning-subtle)',
        border: 'var(--semantic-warning)',
      };
    case 'danger':
      return {
        color: 'var(--semantic-danger)',
        bg: 'var(--semantic-danger-subtle)',
        border: 'var(--semantic-danger)',
      };
    case 'info':
      return {
        color: 'var(--accent-primary)',
        bg: 'var(--accent-primary-subtle)',
        border: 'var(--accent-primary-border)',
      };
    default:
      return {
        color: 'var(--text-secondary)',
        bg: 'var(--bg-surface-sunken)',
        border: 'var(--border-strong)',
      };
  }
}

// ── Toast ─────────────────────────────────────────────────────────

function Toast({ text, tone, onClear }) {
  useEffect(() => {
    if (!text) return;
    const id = setTimeout(onClear, 3200);
    return () => clearTimeout(id);
  }, [text, onClear]);
  if (!text) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 24,
        insetInlineEnd: 24,
        background:
          tone === 'error' ? 'var(--semantic-danger)' : 'var(--accent-primary)',
        color: '#fff',
        padding: '10px 16px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        zIndex: 210,
        boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
      }}
    >
      {text}
    </div>
  );
}

function ErrorBanner({ text }) {
  if (!text) return null;
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: 8,
        padding: '10px 12px',
        background: 'var(--semantic-danger-subtle)',
        border: '1px solid var(--semantic-danger)',
        borderRadius: 8,
        color: 'var(--semantic-danger)',
        fontSize: 12,
        marginBottom: 12,
      }}
    >
      <AlertTriangle size={14} /> {text}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// PIFSSReconciliationScreen
// ══════════════════════════════════════════════════════════════════

export default function PIFSSReconciliationScreen({ role = 'CFO' }) {
  const { t } = useTranslation('pifssReconciliation');
  const normalizedRole = normalizeRole(role);
  const isOwner = normalizedRole === ROLES.OWNER;
  const canEdit = isOwner || canEditAdmin(role);

  const [view, setView] = useState('year_list'); // 'year_list' | 'detail' | 'report'
  const [selectedYear, setSelectedYear] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((text, tone = 'success') => {
    setToast({ text, tone });
  }, []);

  const openYear = (year) => {
    setSelectedYear(year);
    setView('detail');
  };
  const openReport = (year) => {
    setSelectedYear(year);
    setView('report');
  };
  const backToList = () => {
    setSelectedYear(null);
    setView('year_list');
  };
  const backToDetail = () => setView('detail');

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Page Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 18,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.15em',
                color: 'var(--accent-primary)',
              }}
            >
              {t('view_label')}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 28,
                color: 'var(--text-primary)',
                letterSpacing: '-0.3px',
                marginTop: 2,
                lineHeight: 1,
              }}
            >
              {t('title')}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.15em',
                color: 'var(--text-tertiary)',
                marginTop: 6,
              }}
            >
              {t('subtitle')}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                marginTop: 6,
                fontStyle: 'italic',
              }}
            >
              {t('distinction_note')}
            </div>
          </div>
          {view !== 'year_list' && (
            <button
              type="button"
              onClick={view === 'report' ? backToDetail : backToList}
              style={btnSecondary}
            >
              <ArrowLeft size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
              {view === 'report' ? t('report.action_back') : t('detail.back_to_list')}
            </button>
          )}
        </div>

        {view === 'year_list' && (
          <YearListView
            t={t}
            canEdit={canEdit}
            onOpenYear={openYear}
            showToast={showToast}
          />
        )}

        {view === 'detail' && selectedYear != null && (
          <YearDetailView
            t={t}
            fiscalYear={selectedYear}
            role={normalizedRole}
            isOwner={isOwner}
            canEdit={canEdit}
            onOpenReport={() => openReport(selectedYear)}
            showToast={showToast}
          />
        )}

        {view === 'report' && selectedYear != null && (
          <AuditorReportView
            t={t}
            fiscalYear={selectedYear}
            onBack={backToDetail}
            showToast={showToast}
          />
        )}
      </div>

      <Toast text={toast?.text} tone={toast?.tone} onClear={() => setToast(null)} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Year List view
// ══════════════════════════════════════════════════════════════════

function YearListView({ t, canEdit, onOpenYear, showToast }) {
  const [years, setYears] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptValue, setPromptValue] = useState(String(new Date().getUTCFullYear()));
  const [promptError, setPromptError] = useState(null);

  const reload = async () => {
    setLoadError(null);
    try {
      const res = await listReconciliationYears();
      setYears(res?.years || []);
    } catch (err) {
      setYears([]);
      setLoadError(err?.message || t('toast.error_load'));
    }
  };
  useEffect(() => {
    reload();
  }, []);

  const sorted = useMemo(() => {
    if (!years) return null;
    return [...years].sort((a, b) => (b.fiscalYear || 0) - (a.fiscalYear || 0));
  }, [years]);

  // Empty state: all probe slots returned reconciliation=null (no imports).
  const allEmpty = useMemo(() => {
    if (!sorted) return false;
    return sorted.every((y) => !y.reconciliation);
  }, [sorted]);

  const handleOpenPrompt = () => {
    setPromptValue(String(new Date().getUTCFullYear()));
    setPromptError(null);
    setPromptOpen(true);
  };
  const handleConfirmPrompt = () => {
    const n = Number(promptValue);
    if (!Number.isInteger(n) || n < 2000 || n > 2100) {
      setPromptError(t('year_list.new_year_error_invalid'));
      return;
    }
    setPromptOpen(false);
    onOpenYear(n);
  };

  return (
    <div>
      {/* Action bar */}
      {canEdit && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={handleOpenPrompt}
            style={btnPrimary}
            aria-label={t('year_list.action_new')}
          >
            <FilePlus size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
            {t('year_list.action_new')}
          </button>
        </div>
      )}

      {loadError && <ErrorBanner text={loadError} />}
      {years === null && (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>
      )}

      {sorted && sorted.length > 0 && !allEmpty && (
        <div
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            role="row"
            style={{
              display: 'grid',
              gridTemplateColumns: '0.8fr 1fr 1fr 0.9fr 0.9fr 1.2fr 1.2fr',
              gap: 12,
              padding: '10px 16px',
              background: 'var(--bg-surface-sunken)',
              borderBottom: '1px solid var(--border-default)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
            }}
          >
            <div>{t('year_list.column_fiscal_year')}</div>
            <div>{t('year_list.column_statement_imported')}</div>
            <div>{t('year_list.column_reconciliation_run')}</div>
            <div style={{ textAlign: 'end' }}>{t('year_list.column_total_variances')}</div>
            <div style={{ textAlign: 'end' }}>{t('year_list.column_unresolved')}</div>
            <div style={{ textAlign: 'end' }}>
              {t('year_list.column_total_delta_employer')}
            </div>
            <div style={{ textAlign: 'end' }}>
              {t('year_list.column_total_delta_employee')}
            </div>
          </div>
          {sorted.map((row) => {
            const recon = row.reconciliation;
            const variances = row.variances || [];
            const totalEmployer = sumAbsKwd(
              variances.map((v) => v.deltaEmployerKwd),
            );
            const totalEmployee = sumAbsKwd(
              variances.map((v) => v.deltaEmployeeKwd),
            );
            const unresolvedCount = variances.filter(
              (v) => v.status === 'UNRESOLVED',
            ).length;
            const statementImported = !!recon?.statementId;
            const reconRun = !!recon?.runAt;
            return (
              <button
                key={row.fiscalYear}
                type="button"
                data-testid={`year-row-${row.fiscalYear}`}
                onClick={() => onOpenYear(row.fiscalYear)}
                aria-label={t('aria.open_year', { year: row.fiscalYear })}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '0.8fr 1fr 1fr 0.9fr 0.9fr 1.2fr 1.2fr',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  borderTop: 'none',
                  borderInlineStart: 'none',
                  borderInlineEnd: 'none',
                  borderBottom: '1px solid var(--border-subtle)',
                  width: '100%',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  textAlign: 'start',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-surface-sunken)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 700,
                  }}
                >
                  <LtrText>{row.fiscalYear}</LtrText>
                </div>
                <div>
                  {statementImported
                    ? t('year_list.imported_yes')
                    : t('year_list.imported_no')}
                  {statementImported && recon?.statementImportedAt && (
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      <LtrText>{isoTimestamp(recon.statementImportedAt)}</LtrText>
                    </div>
                  )}
                </div>
                <div>
                  {reconRun
                    ? t('year_list.run_yes')
                    : t('year_list.run_no')}
                  {reconRun && recon?.runAt && (
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      <LtrText>{isoTimestamp(recon.runAt)}</LtrText>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'end', fontFamily: "'DM Mono', monospace" }}>
                  <LtrText>{recon ? variances.length : '—'}</LtrText>
                </div>
                <div style={{ textAlign: 'end', fontFamily: "'DM Mono', monospace" }}>
                  <LtrText>{recon ? unresolvedCount : '—'}</LtrText>
                </div>
                <div
                  style={{
                    textAlign: 'end',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  <LtrText>{recon ? totalEmployer : '—'}</LtrText>
                </div>
                <div
                  style={{
                    textAlign: 'end',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  <LtrText>{recon ? totalEmployee : '—'}</LtrText>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {sorted && (sorted.length === 0 || allEmpty) && !loadError && (
        <EmptyState
          icon={Calendar}
          title={t('year_list.empty_title')}
          description={t('year_list.empty_description')}
        />
      )}

      {/* New-year prompt (inline modal) */}
      {promptOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPromptOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 10,
              padding: '20px 22px',
            }}
          >
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: 'var(--text-primary)',
                letterSpacing: '-0.3px',
                marginBottom: 8,
              }}
            >
              {t('year_list.new_year_prompt_title')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
              {t('year_list.new_year_prompt_description')}
            </div>
            <label style={labelStyle} htmlFor="new-year-input">
              {t('year_list.new_year_input_label')}
            </label>
            <input
              id="new-year-input"
              type="number"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              min={2000}
              max={2100}
              style={inputStyle}
            />
            {promptError && (
              <div
                role="alert"
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: 'var(--semantic-danger)',
                }}
              >
                {promptError}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 14,
              }}
            >
              <button
                type="button"
                onClick={() => setPromptOpen(false)}
                style={btnSecondary}
              >
                {t('year_list.new_year_action_cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmPrompt}
                style={btnPrimary}
              >
                {t('year_list.new_year_action_open')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Per-year Detail view
// ══════════════════════════════════════════════════════════════════

function YearDetailView({
  t,
  fiscalYear,
  role,
  isOwner,
  canEdit,
  onOpenReport,
  showToast,
}) {
  const [state, setState] = useState(null); // { reconciliation, variances }
  const [loadError, setLoadError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [running, setRunning] = useState(false);
  const [reimportMode, setReimportMode] = useState(false);

  const reload = async () => {
    setLoadError(null);
    try {
      const res = await getReconciliation(fiscalYear);
      setState(res || { reconciliation: null, variances: [] });
    } catch (err) {
      setState({ reconciliation: null, variances: [] });
      setLoadError(err?.message || t('toast.error_load'));
    }
  };
  useEffect(() => {
    reload();
  }, [fiscalYear]);

  const recon = state?.reconciliation;
  const variances = state?.variances || [];
  const statementImported = !!recon?.statementId;
  const reconRun = !!recon?.runAt;

  const totalEmployer = sumAbsKwd(variances.map((v) => v.deltaEmployerKwd));
  const totalEmployee = sumAbsKwd(variances.map((v) => v.deltaEmployeeKwd));
  const unresolvedCount = variances.filter(
    (v) => v.status === 'UNRESOLVED',
  ).length;

  const handleImport = async (payload) => {
    setImporting(true);
    try {
      await importStatement(fiscalYear, payload);
      showToast(t('toast.imported'));
      setReimportMode(false);
      await reload();
    } catch (err) {
      showToast(err?.message || t('toast.error_import'), 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      await runReconciliation(fiscalYear);
      showToast(t('toast.ran'));
      await reload();
    } catch (err) {
      showToast(err?.message || t('toast.error_run'), 'error');
    } finally {
      setRunning(false);
    }
  };

  const statusBadge = () => {
    if (!statementImported) {
      return { label: t('year_list.imported_no'), tone: 'neutral' };
    }
    if (!reconRun) {
      return { label: t('detail.header_status_imported'), tone: 'info' };
    }
    if (unresolvedCount === 0) {
      return { label: t('detail.header_status_all_resolved'), tone: 'success' };
    }
    return {
      label: t('detail.header_status_unresolved', { count: unresolvedCount }),
      tone: 'warning',
    };
  };

  const badge = statusBadge();
  const tone = toneStyle(badge.tone);

  return (
    <div>
      {loadError && <ErrorBanner text={loadError} />}

      {/* Detail header card */}
      <div
        style={{
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          borderRadius: 8,
          padding: '16px 18px',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: 'var(--text-tertiary)',
              }}
            >
              {t('detail.header_fiscal_year')}
            </div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: 4,
              }}
            >
              <LtrText>{fiscalYear}</LtrText>
            </div>
            <div style={{ marginTop: 10 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  padding: '3px 10px',
                  borderRadius: 10,
                  background: tone.bg,
                  color: tone.color,
                  border: `1px solid ${tone.border}`,
                }}
              >
                {badge.label}
              </span>
            </div>
            {reconRun && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                }}
              >
                <span>{t('detail.run_by')}: </span>
                <LtrText>{recon.runBy || '—'}</LtrText>
                <span style={{ marginInlineStart: 12 }}>
                  {t('detail.run_at')}:{' '}
                </span>
                <LtrText>{isoTimestamp(recon.runAt)}</LtrText>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              columnGap: 16,
              rowGap: 4,
              alignSelf: 'center',
            }}
          >
            <div>
              <div style={kpiLabelStyle}>
                {t('detail.header_total_delta_employer')}
              </div>
              <div style={kpiValueStyle}>
                <LtrText>{totalEmployer}</LtrText>
              </div>
            </div>
            <div>
              <div style={kpiLabelStyle}>
                {t('detail.header_total_delta_employee')}
              </div>
              <div style={kpiValueStyle}>
                <LtrText>{totalEmployee}</LtrText>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignSelf: 'center' }}>
            {reconRun && (
              <button
                type="button"
                onClick={onOpenReport}
                style={btnSecondary}
              >
                <FileText size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
                {t('detail.header_action_view_report')}
              </button>
            )}
            {canEdit && statementImported && !reimportMode && (
              <button
                type="button"
                onClick={() => setReimportMode(true)}
                style={btnSecondary}
              >
                <RefreshCcw
                  size={14}
                  style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}
                />
                {t('detail.header_action_reimport')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Step 1 — Import */}
      {(!statementImported || reimportMode) && (
        <Step1Import
          t={t}
          canEdit={canEdit}
          importing={importing}
          onImport={handleImport}
          onCancelReimport={reimportMode ? () => setReimportMode(false) : null}
        />
      )}

      {/* Step 2 — Run */}
      {statementImported && !reimportMode && (
        <Step2Run
          t={t}
          canEdit={canEdit}
          running={running}
          reconRun={reconRun}
          onRun={handleRun}
          summary={recon}
        />
      )}

      {/* Step 3 — Variance review */}
      {statementImported && reconRun && !reimportMode && (
        <Step3Variances
          t={t}
          variances={variances}
          canEdit={canEdit}
          isOwner={isOwner}
          role={role}
          onResolved={async () => {
            showToast(t('toast.resolved'));
            await reload();
          }}
        />
      )}

      {/* Step 3 placeholder when statement imported but not yet run */}
      {statementImported && !reconRun && !reimportMode && (
        <SectionCard title={t('step3.title')} description={t('step3.description')}>
          <div style={{ padding: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
            {t('step3.placeholder_awaiting')}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Section card wrapper ────────────────────────────────────────

function SectionCard({ title, description, children }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-default)',
        background: 'var(--bg-surface)',
        borderRadius: 8,
        marginBottom: 16,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface-sunken)',
        }}
      >
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 18,
            color: 'var(--text-primary)',
            letterSpacing: '-0.2px',
            lineHeight: 1,
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              marginTop: 6,
            }}
          >
            {description}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Step 1 — Import authority statement
// ══════════════════════════════════════════════════════════════════

function Step1Import({ t, canEdit, importing, onImport, onCancelReimport }) {
  const [fileContents, setFileContents] = useState(null);
  const [fileName, setFileName] = useState('');
  const [parserVersion, setParserVersion] = useState(DEFAULT_PARSER_VERSION);
  const [portalReference, setPortalReference] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [validationError, setValidationError] = useState(null);

  if (!canEdit) {
    return (
      <SectionCard title={t('step1.title')} description={t('step1.description')}>
        <div style={{ padding: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
          {t('step1.placeholder_awaiting')}
        </div>
      </SectionCard>
    );
  }

  const handleFileChange = async (e) => {
    setValidationError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setFileContents(null);
      setFileName('');
      return;
    }
    setFileName(file.name);
    try {
      const text = await file.text();
      setFileContents(text);
    } catch (err) {
      setValidationError(t('step1.error_file_read'));
      setFileContents(null);
    }
  };

  const handleSubmit = () => {
    setValidationError(null);
    if (!fileContents) {
      setValidationError(t('step1.error_file_required'));
      return;
    }
    if (!parserVersion) {
      setValidationError(t('step1.error_parser_required'));
      return;
    }
    const payload = {
      rawBody: fileContents,
      parserVersion,
    };
    if (portalReference.trim()) payload.portalReference = portalReference.trim();
    if (fileUrl.trim()) payload.fileUrl = fileUrl.trim();
    onImport(payload);
  };

  return (
    <SectionCard title={t('step1.title')} description={t('step1.description')}>
      <div style={{ padding: '16px 18px' }}>
        {/* File */}
        <label style={labelStyle} htmlFor="pifss-statement-file">
          {t('step1.field_file')}
        </label>
        <input
          id="pifss-statement-file"
          type="file"
          accept=".csv,text/csv,.pdf,application/pdf,.txt,text/plain"
          onChange={handleFileChange}
          disabled={importing}
          style={{ ...inputStyle, padding: '6px 8px' }}
        />
        {fileName && (
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {fileName}
          </div>
        )}
        <div style={hintStyle}>{t('step1.field_file_hint')}</div>

        {/* Parser version */}
        <label
          style={{ ...labelStyle, marginTop: 14 }}
          htmlFor="pifss-parser-version"
        >
          {t('step1.field_parser_version')}
        </label>
        <select
          id="pifss-parser-version"
          value={parserVersion}
          onChange={(e) => setParserVersion(e.target.value)}
          disabled={importing}
          style={inputStyle}
        >
          {PARSER_VERSIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <div style={hintStyle}>{t('step1.field_parser_version_hint')}</div>

        {/* Portal reference */}
        <label
          style={{ ...labelStyle, marginTop: 14 }}
          htmlFor="pifss-portal-reference"
        >
          {t('step1.field_portal_reference')}
        </label>
        <input
          id="pifss-portal-reference"
          type="text"
          value={portalReference}
          onChange={(e) => setPortalReference(e.target.value)}
          disabled={importing}
          maxLength={200}
          style={inputStyle}
        />
        <div style={hintStyle}>{t('step1.field_portal_reference_hint')}</div>

        {/* File URL */}
        <label
          style={{ ...labelStyle, marginTop: 14 }}
          htmlFor="pifss-file-url"
        >
          {t('step1.field_file_url')}
        </label>
        <input
          id="pifss-file-url"
          type="url"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          disabled={importing}
          maxLength={2000}
          placeholder="https://…"
          style={inputStyle}
        />
        <div style={hintStyle}>{t('step1.field_file_url_hint')}</div>

        {validationError && (
          <div
            role="alert"
            style={{
              display: 'flex',
              gap: 8,
              padding: '10px 12px',
              marginTop: 12,
              background: 'var(--semantic-danger-subtle)',
              border: '1px solid var(--semantic-danger)',
              borderRadius: 8,
              color: 'var(--semantic-danger)',
              fontSize: 12,
            }}
          >
            <AlertTriangle size={14} /> {validationError}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 14,
          }}
        >
          {onCancelReimport && (
            <button
              type="button"
              onClick={onCancelReimport}
              disabled={importing}
              style={btnSecondary}
            >
              {t('year_list.new_year_action_cancel')}
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={importing}
            style={btnPrimary}
          >
            <Upload size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
            {importing ? t('step1.importing') : t('step1.action_import')}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ══════════════════════════════════════════════════════════════════
// Step 2 — Run reconciliation
// ══════════════════════════════════════════════════════════════════

function Step2Run({ t, canEdit, running, reconRun, onRun, summary }) {
  return (
    <SectionCard title={t('step2.title')} description={t('step2.description')}>
      <div style={{ padding: '16px 18px' }}>
        {canEdit ? (
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            style={btnPrimary}
          >
            <Play size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
            {running ? t('step2.running') : t('step2.action_run')}
          </button>
        ) : (
          !reconRun && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('step2.placeholder_awaiting')}
            </div>
          )
        )}

        {reconRun && summary && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 12,
              marginTop: canEdit ? 16 : 0,
            }}
          >
            <SummaryTile
              label={t('step2.summary_total_variances')}
              value={summary.totalVariances ?? '—'}
            />
            <SummaryTile
              label={t('step2.summary_unresolved')}
              value={summary.unresolvedCount ?? '—'}
              tone="warning"
            />
            <SummaryTile
              label={t('step2.summary_preserved')}
              value={summary.preservedResolutionCount ?? '—'}
            />
            <SummaryTile
              label={t('step2.summary_new')}
              value={summary.newVarianceCount ?? '—'}
            />
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function SummaryTile({ label, value, tone = 'neutral' }) {
  const s = toneStyle(tone);
  return (
    <div
      style={{
        padding: '12px 14px',
        background: tone === 'neutral' ? 'var(--bg-surface-sunken)' : s.bg,
        border:
          tone === 'neutral'
            ? '1px solid var(--border-default)'
            : `1px solid ${s.border}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'var(--text-tertiary)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 22,
          fontWeight: 700,
          color: tone === 'neutral' ? 'var(--text-primary)' : s.color,
          marginTop: 4,
        }}
      >
        <LtrText>{value}</LtrText>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Step 3 — Variance review (grouped by employee)
// ══════════════════════════════════════════════════════════════════

function Step3Variances({ t, variances, canEdit, isOwner, role, onResolved }) {
  const [expandedCivilIds, setExpandedCivilIds] = useState(() => new Set());
  const [modalVariance, setModalVariance] = useState(null);

  const toggleExpanded = (civilId) => {
    setExpandedCivilIds((prev) => {
      const next = new Set(prev);
      if (next.has(civilId)) next.delete(civilId);
      else next.add(civilId);
      return next;
    });
  };

  // Group by civilId, sort groups by total Σ|Δ| desc (employer + employee).
  const groups = useMemo(() => {
    const byId = new Map();
    for (const v of variances) {
      const key = v.civilId || '_unknown';
      if (!byId.has(key)) {
        byId.set(key, {
          civilId: v.civilId,
          employeeNameSnapshot: v.employeeNameSnapshot || '',
          variances: [],
        });
      }
      byId.get(key).variances.push(v);
    }
    const arr = Array.from(byId.values()).map((g) => {
      const totalEmployer = sumAbsKwd(
        g.variances.map((v) => v.deltaEmployerKwd),
      );
      const totalEmployee = sumAbsKwd(
        g.variances.map((v) => v.deltaEmployeeKwd),
      );
      const unresolvedCount = g.variances.filter(
        (v) => v.status === 'UNRESOLVED',
      ).length;
      return { ...g, totalEmployer, totalEmployee, unresolvedCount };
    });
    // Sort by total employer descending (as a proxy for severity) then by name.
    return arr.sort((a, b) => {
      const na = Number(String(a.totalEmployer).replace(/,/g, '')) || 0;
      const nb = Number(String(b.totalEmployer).replace(/,/g, '')) || 0;
      if (nb !== na) return nb - na;
      return (a.employeeNameSnapshot || '').localeCompare(
        b.employeeNameSnapshot || '',
      );
    });
  }, [variances]);

  if (!variances || variances.length === 0) {
    return (
      <SectionCard title={t('step3.title')} description={t('step3.description')}>
        <EmptyState
          icon={CheckCircle2}
          title={t('step3.empty_title')}
          description={t('step3.empty_description')}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title={t('step3.title')} description={t('step3.description')}>
      {/* Employee header row */}
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns:
            '24px 1.2fr 1.6fr 0.8fr 0.8fr 1fr 1fr',
          gap: 8,
          padding: '8px 16px',
          background: 'var(--bg-surface-sunken)',
          borderBottom: '1px solid var(--border-default)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--text-tertiary)',
        }}
      >
        <div />
        <div>{t('step3.employee_header_civil_id')}</div>
        <div>{t('step3.employee_header_name')}</div>
        <div style={{ textAlign: 'end' }}>
          {t('step3.employee_header_variance_count')}
        </div>
        <div style={{ textAlign: 'end' }}>
          {t('step3.employee_header_unresolved')}
        </div>
        <div style={{ textAlign: 'end' }}>
          {t('step3.employee_header_delta_employer')}
        </div>
        <div style={{ textAlign: 'end' }}>
          {t('step3.employee_header_delta_employee')}
        </div>
      </div>

      {groups.map((g) => {
        const expanded = expandedCivilIds.has(g.civilId);
        return (
          <div key={g.civilId || 'unknown'}>
            <button
              type="button"
              onClick={() => toggleExpanded(g.civilId)}
              aria-label={
                expanded
                  ? t('aria.collapse_employee', { name: g.employeeNameSnapshot })
                  : t('aria.expand_employee', { name: g.employeeNameSnapshot })
              }
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '24px 1.2fr 1.6fr 0.8fr 0.8fr 1fr 1fr',
                gap: 8,
                padding: '10px 16px',
                background: 'transparent',
                color: 'var(--text-primary)',
                border: 'none',
                borderBottom: '1px solid var(--border-subtle)',
                width: '100%',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                textAlign: 'start',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-surface-sunken)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ color: 'var(--text-tertiary)' }}>
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                <LtrText>{g.civilId}</LtrText>
              </div>
              <div style={{ fontWeight: 600 }}>
                {g.employeeNameSnapshot || '—'}
              </div>
              <div
                style={{
                  textAlign: 'end',
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                <LtrText>{g.variances.length}</LtrText>
              </div>
              <div
                style={{
                  textAlign: 'end',
                  fontFamily: "'DM Mono', monospace",
                  color:
                    g.unresolvedCount > 0
                      ? 'var(--semantic-warning)'
                      : 'var(--text-tertiary)',
                }}
              >
                <LtrText>{g.unresolvedCount}</LtrText>
              </div>
              <div
                style={{
                  textAlign: 'end',
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                <LtrText>{g.totalEmployer}</LtrText>
              </div>
              <div
                style={{
                  textAlign: 'end',
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                <LtrText>{g.totalEmployee}</LtrText>
              </div>
            </button>

            {expanded && (
              <div
                style={{
                  background: 'var(--bg-surface-sunken)',
                  borderBottom: '1px solid var(--border-default)',
                  padding: '8px 16px 14px 40px',
                }}
              >
                {g.variances.map((v) => (
                  <VarianceRow
                    key={v.id}
                    t={t}
                    variance={v}
                    canEdit={canEdit}
                    onResolveClick={() => setModalVariance(v)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <VarianceResolutionModal
        open={!!modalVariance}
        onClose={() => setModalVariance(null)}
        variance={modalVariance}
        role={role}
        onResolved={() => {
          setModalVariance(null);
          if (onResolved) onResolved();
        }}
      />
    </SectionCard>
  );
}

function VarianceRow({ t, variance, canEdit, onResolveClick }) {
  const typeTone = toneStyle(varianceTypeTone(variance.varianceType));
  const statusTone = toneStyle(varianceStatusTone(variance.status));
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          '0.8fr 1.2fr 1.4fr 1.4fr 1fr 1fr 90px',
        gap: 8,
        padding: '10px 12px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
        marginBottom: 8,
        fontSize: 12,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          color: 'var(--text-secondary)',
        }}
      >
        <LtrText>{periodString(variance.periodYear, variance.periodMonth)}</LtrText>
      </div>
      <div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '2px 8px',
            borderRadius: 10,
            background: typeTone.bg,
            color: typeTone.color,
            border: `1px solid ${typeTone.border}`,
          }}
        >
          {t(`variance_type.${variance.varianceType?.toLowerCase()}`)}
        </span>
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
        <div>
          <span style={{ color: 'var(--text-tertiary)', marginInlineEnd: 6 }}>
            {t('step3.side_employer')}:
          </span>
          <LtrText>{formatKwd(variance.companyEmployerKwd)}</LtrText>
        </div>
        <div>
          <span style={{ color: 'var(--text-tertiary)', marginInlineEnd: 6 }}>
            {t('step3.side_employee')}:
          </span>
          <LtrText>{formatKwd(variance.companyEmployeeKwd)}</LtrText>
        </div>
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
        <div>
          <span style={{ color: 'var(--text-tertiary)', marginInlineEnd: 6 }}>
            {t('step3.side_employer')}:
          </span>
          <LtrText>{formatKwd(variance.portalEmployerKwd)}</LtrText>
        </div>
        <div>
          <span style={{ color: 'var(--text-tertiary)', marginInlineEnd: 6 }}>
            {t('step3.side_employee')}:
          </span>
          <LtrText>{formatKwd(variance.portalEmployeeKwd)}</LtrText>
        </div>
      </div>
      <div
        style={{
          textAlign: 'end',
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
        }}
      >
        <div>
          <LtrText>{formatKwd(variance.deltaEmployerKwd)}</LtrText>
        </div>
        <div style={{ color: 'var(--text-tertiary)' }}>
          <LtrText>{formatKwd(variance.deltaEmployeeKwd)}</LtrText>
        </div>
      </div>
      <div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '2px 8px',
            borderRadius: 10,
            background: statusTone.bg,
            color: statusTone.color,
            border: `1px solid ${statusTone.border}`,
          }}
        >
          {t(`variance_status.${variance.status?.toLowerCase()}`)}
        </span>
      </div>
      <div style={{ textAlign: 'end' }}>
        {canEdit && (
          <button
            type="button"
            onClick={onResolveClick}
            aria-label={t('aria.resolve_variance', {
              period: periodString(variance.periodYear, variance.periodMonth),
            })}
            style={btnSmall}
          >
            {t('step3.variance_action_resolve')}
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Auditor Report view
// ══════════════════════════════════════════════════════════════════

function AuditorReportView({ t, fiscalYear, onBack, showToast }) {
  const [report, setReport] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const r = await getReconciliationReport(fiscalYear);
        if (!cancelled) setReport(r);
      } catch (err) {
        if (!cancelled) {
          setReport(null);
          setLoadError(err?.message || t('toast.error_load'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fiscalYear]);

  const handlePrint = () => {
    try {
      window.print();
    } catch (err) {
      showToast(t('toast.error_generic'), 'error');
    }
  };

  if (loadError) {
    return (
      <div>
        <ErrorBanner text={loadError} />
        <EmptyState
          icon={FileText}
          title={t('report.empty_title')}
          description={t('report.empty_description')}
        />
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>
    );
  }

  const employees = report.employees || [];
  const byType = report.byType || {};

  return (
    <div
      data-testid="pifss-auditor-report"
      className="pifss-auditor-report"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        padding: '20px 22px',
      }}
    >
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .pifss-auditor-report, .pifss-auditor-report * { visibility: visible; }
          .pifss-auditor-report { position: absolute; inset-inline-start: 0; top: 0; width: 100%; border: none; padding: 0; }
          .pifss-auditor-report .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          borderBottom: '1px solid var(--border-default)',
          paddingBottom: 14,
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 22,
              color: 'var(--text-primary)',
              letterSpacing: '-0.3px',
              lineHeight: 1,
            }}
          >
            {t('report.title')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
            {t('report.subtitle')}
          </div>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={handlePrint} style={btnSecondary}>
            <Printer
              size={14}
              style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}
            />
            {t('report.action_print')}
          </button>
        </div>
      </div>

      {/* Summary facts grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 14,
        }}
      >
        <ReportFact label={t('report.summary_fiscal_year')} value={report.fiscalYear} />
        <ReportFact label={t('report.summary_run_by')} value={report.runBy} />
        <ReportFact
          label={t('report.summary_run_at')}
          value={isoTimestamp(report.runAt)}
        />
        <ReportFact
          label={t('report.summary_reconciliation_id')}
          value={report.reconciliationId}
          mono
        />
        <ReportFact
          label={t('report.summary_statement_id')}
          value={report.statementId}
          mono
        />
        <ReportFact
          label={t('report.summary_total_variances')}
          value={report.totalVariances ?? 0}
        />
        <ReportFact
          label={t('report.summary_unresolved')}
          value={report.unresolvedCount ?? 0}
        />
        <ReportFact
          label={t('report.summary_total_delta_employer')}
          value={formatKwd(report.totalDeltaEmployerKwd)}
        />
        <ReportFact
          label={t('report.summary_total_delta_employee')}
          value={formatKwd(report.totalDeltaEmployeeKwd)}
        />
      </div>

      {/* By-type table */}
      <div style={{ marginBottom: 18 }}>
        <div style={sectionHeadingStyle}>{t('report.by_type_heading')}</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {['COMPANY_ONLY', 'PORTAL_ONLY', 'CONTRIBUTION_AMOUNT_DIFFERS', 'SALARY_BASE_DIFFERS'].map((type) => (
            <div
              key={type}
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                padding: '10px 12px',
                background: 'var(--bg-surface-sunken)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--text-tertiary)',
                }}
              >
                {t(`variance_type.${type.toLowerCase()}`)}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginTop: 4,
                }}
              >
                <LtrText>{byType[type] ?? 0}</LtrText>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Employee sections */}
      {employees.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={t('step3.empty_title')}
          description={t('step3.empty_description')}
        />
      ) : (
        employees.map((emp) => (
          <div
            key={emp.civilId}
            style={{
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              marginBottom: 14,
              overflow: 'hidden',
            }}
          >
            {/* Employee header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr 1fr 1fr',
                gap: 12,
                padding: '10px 14px',
                background: 'var(--bg-surface-sunken)',
                borderBottom: '1px solid var(--border-default)',
              }}
            >
              <div>
                <div style={kpiLabelStyle}>{t('report.employee_civil_id')}</div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  <LtrText>{emp.civilId}</LtrText>
                </div>
              </div>
              <div>
                <div style={kpiLabelStyle}>{t('report.employee_name')}</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {emp.employeeNameSnapshot || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'end' }}>
                <div style={kpiLabelStyle}>{t('step3.employee_header_delta_employer')}</div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  <LtrText>{formatKwd(emp.totalDeltaEmployerKwd)}</LtrText>
                </div>
              </div>
              <div style={{ textAlign: 'end' }}>
                <div style={kpiLabelStyle}>{t('step3.employee_header_delta_employee')}</div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  <LtrText>{formatKwd(emp.totalDeltaEmployeeKwd)}</LtrText>
                </div>
              </div>
            </div>

            {/* Variance rows */}
            {(emp.variances || []).map((v) => {
              const typeTone = toneStyle(varianceTypeTone(v.varianceType));
              const statusTone = toneStyle(varianceStatusTone(v.status));
              return (
                <div
                  key={v.id}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 11,
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '0.8fr 1.1fr 1fr 1fr',
                      gap: 10,
                      marginBottom: 6,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-tertiary)', marginInlineEnd: 4 }}>
                        {t('report.variance_period')}:
                      </span>
                      <LtrText>{periodString(v.periodYear, v.periodMonth)}</LtrText>
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: typeTone.bg,
                          color: typeTone.color,
                          border: `1px solid ${typeTone.border}`,
                        }}
                      >
                        {t(`variance_type.${v.varianceType?.toLowerCase()}`)}
                      </span>
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: statusTone.bg,
                          color: statusTone.color,
                          border: `1px solid ${statusTone.border}`,
                        }}
                      >
                        {t(`variance_status.${v.status?.toLowerCase()}`)}
                      </span>
                    </div>
                    <div
                      style={{
                        textAlign: 'end',
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 10,
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {v.resolvedBy && (
                        <>
                          <span>{t('report.variance_resolved_by')}: </span>
                          <LtrText>{v.resolvedBy}</LtrText>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                      gap: 10,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    <ReportCell
                      label={t('report.variance_company_employer')}
                      value={formatKwd(v.companyEmployerKwd)}
                    />
                    <ReportCell
                      label={t('report.variance_portal_employer')}
                      value={formatKwd(v.portalEmployerKwd)}
                    />
                    <ReportCell
                      label={t('report.variance_delta_employer')}
                      value={formatKwd(v.deltaEmployerKwd)}
                      emphasis
                    />
                    <ReportCell
                      label={t('report.variance_resolution_note')}
                      value={v.resolutionNote || '—'}
                    />
                    <ReportCell
                      label={t('report.variance_company_employee')}
                      value={formatKwd(v.companyEmployeeKwd)}
                    />
                    <ReportCell
                      label={t('report.variance_portal_employee')}
                      value={formatKwd(v.portalEmployeeKwd)}
                    />
                    <ReportCell
                      label={t('report.variance_delta_employee')}
                      value={formatKwd(v.deltaEmployeeKwd)}
                      emphasis
                    />
                    <ReportCell
                      label={t('report.variance_likely_cause')}
                      value={v.likelyCause || '—'}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

function ReportFact({ label, value, mono }) {
  return (
    <div>
      <div style={kpiLabelStyle}>{label}</div>
      <div
        style={{
          fontFamily: mono ? "'DM Mono', monospace" : 'inherit',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginTop: 2,
        }}
      >
        <LtrText>{value ?? '—'}</LtrText>
      </div>
    </div>
  );
}

function ReportCell({ label, value, emphasis }) {
  return (
    <div>
      <div style={{ ...kpiLabelStyle, fontSize: 9 }}>{label}</div>
      <div
        style={{
          fontSize: 11,
          fontWeight: emphasis ? 700 : 500,
          color: emphasis ? 'var(--text-primary)' : 'var(--text-secondary)',
          marginTop: 2,
        }}
      >
        <LtrText>{value}</LtrText>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const labelStyle = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.1em',
  color: 'var(--text-tertiary)',
  marginBottom: 6,
};

const hintStyle = {
  fontSize: 10,
  color: 'var(--text-tertiary)',
  marginTop: 4,
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--bg-surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  fontSize: 13,
  boxSizing: 'border-box',
};

const btnPrimary = {
  padding: '8px 16px',
  background: 'var(--accent-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.05em',
  cursor: 'pointer',
};

const btnSecondary = {
  padding: '8px 14px',
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 6,
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnSmall = {
  padding: '4px 10px',
  background: 'var(--accent-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};

const kpiLabelStyle = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)',
};

const kpiValueStyle = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginTop: 2,
};

const sectionHeadingStyle = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.1em',
  color: 'var(--text-tertiary)',
  marginBottom: 8,
  textTransform: 'uppercase',
};
