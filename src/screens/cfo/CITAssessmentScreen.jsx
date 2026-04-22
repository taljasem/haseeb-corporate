/**
 * CITAssessmentScreen — AUDIT-ACC-057 (2026-04-22).
 *
 * Standalone Kuwait CIT authority-case tracker (FN-249). When MOC&I /
 * the Kuwait Tax Authority raises a CIT assessment on a foreign-
 * ownership tenant, the operator tracks filed → assessed → final
 * figures per fiscal year along with objection history and statute-of-
 * limitations deadlines.
 *
 * Two views driven by internal state:
 *   - 'year_list'  : default. Fiscal-year rows + approaching-statute
 *                    warning highlighting + status/year filters.
 *   - 'detail'     : per-case view. Three-figure read-out (filed /
 *                    assessed / final) + dates + audit trail +
 *                    action bar.
 *
 * Role gating (midsize role model):
 *   - Owner         → OWNER          → writes enabled.
 *   - CFO / Senior  → ACCOUNTANT     → read-only (disabled-with-tooltip).
 *   - Junior        → VIEWER/AUDITOR → read-only (disabled-with-tooltip).
 *
 * Per dispatch: non-Owner users see disabled buttons with tooltip
 * explaining the OWNER-only requirement, NOT missing actions — so
 * operators understand why the action isn't available.
 *
 * Wall preservation: frontend never calls an LLM. All mutations go
 * through `src/engine` → `src/api/cit-assessment.js` → backend routes.
 *
 * Distinct from quarterly CIT self-assessment (future dispatch,
 * tracked under HASEEB-225).
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Gavel,
  FilePlus,
  ArrowLeft,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Archive,
  XCircle,
  History,
  FileText,
} from 'lucide-react';
import Decimal from 'decimal.js';
import EmptyState from '../../components/shared/EmptyState';
import LtrText from '../../components/shared/LtrText';
import CitAssessmentCreateModal from '../../components/setup/CitAssessmentCreateModal';
import CitAssessmentTransitionModal from '../../components/setup/CitAssessmentTransitionModal';
import { normalizeRole, ROLES } from '../../utils/role';
import {
  listCitAssessments,
  getCitAssessment,
  listApproachingStatute,
  closeCitAssessment,
  markCitAssessmentStatuteExpired,
} from '../../engine';

// ── Constants ─────────────────────────────────────────────────────

/**
 * Backend CitAssessmentStatus enum (prisma/tenant/schema.prisma). All 7
 * values rendered via the citAssessment.status.* keys — both EN + AR.
 */
const ALL_STATUSES = [
  'FILED',
  'UNDER_REVIEW',
  'ASSESSED',
  'OBJECTED',
  'FINAL',
  'CLOSED',
  'STATUTE_EXPIRED',
];

const STATUS_TONE = {
  FILED: 'neutral',
  UNDER_REVIEW: 'warning',
  ASSESSED: 'info',
  OBJECTED: 'warning',
  FINAL: 'info',
  CLOSED: 'muted',
  STATUTE_EXPIRED: 'danger',
};

const TERMINAL_STATUSES = new Set(['CLOSED', 'STATUTE_EXPIRED']);
const NON_TERMINAL_STATUSES = new Set([
  'FILED',
  'UNDER_REVIEW',
  'ASSESSED',
  'OBJECTED',
]);

const APPROACHING_WARN_DAYS = 180;
const APPROACHING_FETCH_DAYS = 180;

// ── Helpers ───────────────────────────────────────────────────────

function toneTokens(tone) {
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
    case 'muted':
      return {
        color: 'var(--text-tertiary)',
        bg: 'var(--bg-surface-sunken)',
        border: 'var(--border-default)',
      };
    default:
      return {
        color: 'var(--text-secondary)',
        bg: 'var(--bg-surface-sunken)',
        border: 'var(--border-strong)',
      };
  }
}

/**
 * Decimal-safe KWD formatter. Backend emits Decimal-safe strings; we
 * never parseFloat per the dispatch. Instead, use Decimal.js to format
 * to 3dp with thousands separators.
 */
function formatKwd(value) {
  if (value == null || value === '') return null;
  try {
    const d = new Decimal(String(value));
    const fixed = d.toFixed(3);
    // Split on decimal then group integer part with commas (LTR
    // display; LtrText wrapper handles RTL context).
    const [intPart, fracPart] = fixed.split('.');
    const withSign = intPart.startsWith('-') ? '-' : '';
    const digits = withSign ? intPart.slice(1) : intPart;
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${withSign}${grouped}.${fracPart}`;
  } catch {
    return String(value);
  }
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / 86400000);
  return diff;
}

/**
 * Decimal-safe comparison for variance sign-coloring. Returns one of
 * 'positive' | 'negative' | 'zero' | null.
 */
function varianceSign(value) {
  if (value == null || value === '') return null;
  try {
    const d = new Decimal(String(value));
    if (d.gt(0)) return 'positive';
    if (d.lt(0)) return 'negative';
    return 'zero';
  } catch {
    return null;
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
        alignItems: 'center',
      }}
    >
      <AlertTriangle size={14} /> {text}
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────

function StatusBadge({ status, t }) {
  const tone = STATUS_TONE[status] || 'neutral';
  const tk = toneTokens(tone);
  return (
    <span
      data-testid={`cit-status-${status}`}
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.1em',
        padding: '3px 8px',
        borderRadius: 10,
        background: tk.bg,
        color: tk.color,
        border: `1px solid ${tk.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {t(`status.${status}`)}
    </span>
  );
}

// ── Confirmation Modal ────────────────────────────────────────────

function ConfirmModal({ open, title, body, confirmLabel, cancelLabel, tone, onConfirm, onCancel, busy }) {
  if (!open) return null;
  const tk = toneTokens(tone || 'danger');
  return (
    <>
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 300,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 460,
          background: 'var(--panel-bg)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          zIndex: 301,
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        }}
      >
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 20,
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{body}</div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            marginTop: 4,
          }}
        >
          <button type="button" onClick={onCancel} style={btnSecondary}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              ...btnPrimary,
              background: tk.color,
              opacity: busy ? 0.6 : 1,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// CITAssessmentScreen
// ══════════════════════════════════════════════════════════════════

export default function CITAssessmentScreen({ role = 'CFO' }) {
  const { t } = useTranslation('citAssessment');
  const normalizedRole = normalizeRole(role);
  const isOwner = normalizedRole === ROLES.OWNER;

  const [view, setView] = useState('year_list'); // 'year_list' | 'detail'
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((text, tone = 'success') => {
    setToast({ text, tone });
  }, []);

  const openDetail = (id) => {
    setSelectedId(id);
    setView('detail');
  };
  const backToList = () => {
    setSelectedId(null);
    setView('year_list');
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Page header */}
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
                maxWidth: 720,
              }}
            >
              {t('distinction_note')}
            </div>
          </div>
          {view === 'detail' && (
            <button type="button" onClick={backToList} style={btnSecondary}>
              <ArrowLeft
                size={14}
                style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}
              />
              {t('year_list.action_back')}
            </button>
          )}
        </div>

        {view === 'year_list' && (
          <YearListView
            t={t}
            isOwner={isOwner}
            onOpenCase={openDetail}
            showToast={showToast}
          />
        )}

        {view === 'detail' && selectedId != null && (
          <DetailView
            t={t}
            caseId={selectedId}
            isOwner={isOwner}
            onBack={backToList}
            showToast={showToast}
          />
        )}
      </div>

      <Toast
        text={toast?.text}
        tone={toast?.tone}
        onClear={() => setToast(null)}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Year List View
// ══════════════════════════════════════════════════════════════════

function YearListView({ t, isOwner, onOpenCase, showToast }) {
  const [cases, setCases] = useState(null);
  const [approaching, setApproaching] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [openOnly, setOpenOnly] = useState(false);
  const [fyFrom, setFyFrom] = useState('');
  const [fyTo, setFyTo] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const filters = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      if (openOnly) filters.openOnly = true;
      if (fyFrom) filters.fiscalYearFrom = Number(fyFrom);
      if (fyTo) filters.fiscalYearTo = Number(fyTo);
      const [list, sweep] = await Promise.all([
        listCitAssessments(filters),
        listApproachingStatute({ withinDays: APPROACHING_FETCH_DAYS }).catch(
          () => [],
        ),
      ]);
      const arr = Array.isArray(list) ? list : [];
      // Sort desc by fiscal year per spec.
      arr.sort((a, b) => (b.fiscalYear || 0) - (a.fiscalYear || 0));
      setCases(arr);
      // Normalize approaching response: backend returns
      // StatuteSweepResult[] { assessment, daysUntilExpiry }; mock
      // returns raw case rows. Support both shapes.
      const approachingRows = (sweep || []).map((row) =>
        row.assessment ? row.assessment : row,
      );
      setApproaching(approachingRows);
    } catch (err) {
      setCases([]);
      setApproaching([]);
      setLoadError(err?.message || t('toast.error_load'));
    }
  }, [statusFilter, openOnly, fyFrom, fyTo, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const approachingIds = useMemo(
    () => new Set(approaching.map((c) => c.id)),
    [approaching],
  );

  return (
    <div>
      {/* Action bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 12,
        }}
      >
        <OwnerButton
          isOwner={isOwner}
          onClick={() => setCreateOpen(true)}
          variant="primary"
          tooltip={t('ownerOnly.tooltip')}
          testId="cit-action-new-case"
        >
          <FilePlus
            size={14}
            style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}
          />
          {t('year_list.action_new')}
        </OwnerButton>
      </div>

      {loadError && <ErrorBanner text={loadError} />}

      {/* Approaching-statute banner */}
      {approaching.length > 0 && (
        <div
          role="status"
          data-testid="cit-approaching-banner"
          style={{
            display: 'flex',
            gap: 10,
            padding: '12px 14px',
            background: 'var(--semantic-warning-subtle)',
            border: '1px solid var(--semantic-warning)',
            borderRadius: 8,
            color: 'var(--semantic-warning)',
            fontSize: 12,
            marginBottom: 12,
            alignItems: 'flex-start',
          }}
        >
          <Clock size={14} style={{ marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {t('approaching_banner.title', { count: approaching.length })}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
              }}
            >
              {t('approaching_banner.subtitle')}
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--text-tertiary)',
          }}
        >
          <span>{t('year_list.filter_status_label')}:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t('year_list.filter_status_label')}
            style={selectStyle}
          >
            <option value="ALL">{t('year_list.filter_status_ALL')}</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--text-tertiary)',
          }}
        >
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
          />
          {t('year_list.filter_open_only')}
        </label>

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--text-tertiary)',
          }}
        >
          <span>{t('year_list.filter_fiscal_year_from')}:</span>
          <input
            type="number"
            min={2000}
            max={2100}
            value={fyFrom}
            onChange={(e) => setFyFrom(e.target.value)}
            style={{ ...inputStyle, width: 90 }}
          />
        </label>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--text-tertiary)',
          }}
        >
          <span>{t('year_list.filter_fiscal_year_to')}:</span>
          <input
            type="number"
            min={2000}
            max={2100}
            value={fyTo}
            onChange={(e) => setFyTo(e.target.value)}
            style={{ ...inputStyle, width: 90 }}
          />
        </label>
      </div>

      {cases === null && (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>
      )}

      {cases && cases.length === 0 && !loadError && (
        <EmptyState
          icon={Gavel}
          title={t('year_list.empty_title')}
          description={t('year_list.empty_description')}
        />
      )}

      {cases && cases.length > 0 && (
        <div
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {/* Column header */}
          <div
            role="row"
            style={{
              display: 'grid',
              gridTemplateColumns:
                '0.7fr 1fr 1fr 1fr 1.2fr 0.9fr 1.1fr 1fr',
              gap: 10,
              padding: '10px 16px',
              background: 'var(--bg-surface-sunken)',
              borderBottom: '1px solid var(--border-default)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.12em',
              color: 'var(--text-tertiary)',
            }}
          >
            <div>{t('year_list.column_fiscal_year')}</div>
            <div>{t('year_list.column_filed')}</div>
            <div>{t('year_list.column_assessed')}</div>
            <div>{t('year_list.column_final')}</div>
            <div>{t('year_list.column_authority_case')}</div>
            <div>{t('year_list.column_filed_on')}</div>
            <div>{t('year_list.column_statute_expires')}</div>
            <div>{t('year_list.column_status')}</div>
          </div>

          {cases.map((row, idx) => {
            const isApproaching = approachingIds.has(row.id);
            const days = daysUntil(row.statuteExpiresOn);
            const overdue = days != null && days < 0;
            return (
              <button
                key={row.id}
                type="button"
                data-testid={`cit-row-${row.fiscalYear}`}
                onClick={() => onOpenCase(row.id)}
                aria-label={t('year_list.row_open_detail')}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '0.7fr 1fr 1fr 1fr 1.2fr 0.9fr 1.1fr 1fr',
                  gap: 10,
                  padding: '14px 16px',
                  width: '100%',
                  textAlign: 'start',
                  background: isApproaching
                    ? 'var(--semantic-warning-subtle)'
                    : idx % 2 === 1
                    ? 'var(--bg-surface-sunken)'
                    : 'transparent',
                  border: 'none',
                  borderBottom:
                    idx === cases.length - 1
                      ? 'none'
                      : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: 'var(--text-primary)',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <LtrText>FY{row.fiscalYear}</LtrText>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <LtrText>{formatKwd(row.filedAmountKwd) || '—'}</LtrText>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <LtrText>{formatKwd(row.assessedAmountKwd) || '—'}</LtrText>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <LtrText>{formatKwd(row.finalAmountKwd) || '—'}</LtrText>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <LtrText>{row.authorityCaseNumber || '—'}</LtrText>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  <LtrText>{row.filedOnDate}</LtrText>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    color: isApproaching
                      ? 'var(--semantic-warning)'
                      : 'var(--text-tertiary)',
                    fontWeight: isApproaching ? 700 : 400,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <LtrText>{row.statuteExpiresOn}</LtrText>
                  {isApproaching && days != null && (
                    <span
                      data-testid={`cit-statute-countdown-${row.fiscalYear}`}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {overdue
                        ? t('year_list.statute_overdue', {
                            count: Math.abs(days),
                          })
                        : t('year_list.days_remaining', { count: days })}
                    </span>
                  )}
                </div>
                <div>
                  <StatusBadge status={row.status} t={t} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <CitAssessmentCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          reload();
          showToast(t('toast.created'));
        }}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Detail View
// ══════════════════════════════════════════════════════════════════

function DetailView({ t, caseId, isOwner, onBack, showToast }) {
  const [caseRow, setCaseRow] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [transitionState, setTransitionState] = useState({
    open: false,
    transition: null,
  });
  const [confirmState, setConfirmState] = useState({
    open: false,
    kind: null, // 'close' | 'mark_statute_expired'
    busy: false,
  });

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const row = await getCitAssessment(caseId);
      setCaseRow(row);
    } catch (err) {
      setLoadError(err?.message || t('toast.error_load'));
    }
  }, [caseId, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loadError) {
    return <ErrorBanner text={loadError} />;
  }
  if (!caseRow) {
    return <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>;
  }

  const statuteDays = daysUntil(caseRow.statuteExpiresOn);
  const statuteOverdue = statuteDays != null && statuteDays < 0;
  const statuteApproaching =
    !TERMINAL_STATUSES.has(caseRow.status) &&
    statuteDays != null &&
    statuteDays <= APPROACHING_WARN_DAYS;

  const canOpenReview = caseRow.status === 'FILED';
  const canRecordAssessment =
    caseRow.status === 'FILED' || caseRow.status === 'UNDER_REVIEW';
  const canRecordObjection = caseRow.status === 'ASSESSED';
  const canFinalize =
    caseRow.status === 'ASSESSED' || caseRow.status === 'OBJECTED';
  const canClose = caseRow.status === 'FINAL';
  // Mark-statute-expired is only appropriate when the statute date has
  // passed AND the case is still in a non-terminal state (backend
  // enforces both; frontend mirrors for button-enablement). Also
  // allowed on FINAL per backend service (close requires FINAL or
  // STATUTE_EXPIRED).
  const canMarkStatuteExpired =
    NON_TERMINAL_STATUSES.has(caseRow.status) && statuteOverdue;
  const statuteButtonShown = NON_TERMINAL_STATUSES.has(caseRow.status);

  const isTerminal = TERMINAL_STATUSES.has(caseRow.status);

  const openTransition = (transition) =>
    setTransitionState({ open: true, transition });

  const closeTransition = () =>
    setTransitionState({ open: false, transition: null });

  const handleConfirm = async () => {
    setConfirmState((s) => ({ ...s, busy: true }));
    try {
      if (confirmState.kind === 'close') {
        await closeCitAssessment(caseRow.id);
        showToast(t('toast.closed'));
      } else if (confirmState.kind === 'mark_statute_expired') {
        await markCitAssessmentStatuteExpired(caseRow.id);
        showToast(t('toast.statute_expired'));
      }
      setConfirmState({ open: false, kind: null, busy: false });
      await reload();
    } catch (err) {
      setConfirmState({ open: false, kind: null, busy: false });
      showToast(err?.message || t('toast.error_transition'), 'error');
    }
  };

  const statuteTone = statuteOverdue
    ? 'danger'
    : statuteApproaching
    ? 'warning'
    : 'neutral';
  const statuteTk = toneTokens(statuteTone);

  const varianceS = varianceSign(caseRow.varianceKwd);
  const varianceColor =
    varianceS === 'positive'
      ? 'var(--semantic-danger)'
      : varianceS === 'negative'
      ? 'var(--accent-primary)'
      : 'var(--text-secondary)';

  return (
    <div
      data-testid="cit-detail-view"
      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      {/* Header card */}
      <div
        style={{
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: '18px 22px',
          background: 'var(--panel-bg)',
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 32,
              color: 'var(--text-primary)',
              letterSpacing: '-0.3px',
            }}
          >
            <LtrText>{t('detail.header_fiscal_year', { fiscalYear: caseRow.fiscalYear })}</LtrText>
          </div>
          <StatusBadge status={caseRow.status} t={t} />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            alignItems: 'flex-end',
            minWidth: 200,
          }}
        >
          {caseRow.authorityCaseNumber && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
              }}
            >
              {t('detail.header_authority_case')}:{' '}
              <LtrText>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: 'var(--text-secondary)',
                  }}
                >
                  {caseRow.authorityCaseNumber}
                </span>
              </LtrText>
            </div>
          )}
          {statuteDays != null && !isTerminal && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: statuteTk.color,
                background: statuteTk.bg,
                border: `1px solid ${statuteTk.border}`,
                padding: '4px 10px',
                borderRadius: 12,
              }}
              data-testid="cit-detail-statute-countdown"
            >
              {statuteOverdue
                ? t('detail.header_statute_overdue', {
                    count: Math.abs(statuteDays),
                  })
                : t('detail.header_statute_countdown', { count: statuteDays })}
            </div>
          )}
          {statuteApproaching && !statuteOverdue && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--semantic-warning)',
                fontWeight: 600,
              }}
            >
              {t('detail.header_statute_warning')}
            </div>
          )}
        </div>
      </div>

      {/* Three-figure read-out block */}
      <div
        style={{
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: '18px 22px',
          background: 'var(--panel-bg)',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.15em',
            color: 'var(--text-tertiary)',
            marginBottom: 12,
          }}
        >
          {t('detail.figures_title')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 18,
          }}
        >
          <FigureCell
            label={t('detail.figure_filed')}
            value={caseRow.filedAmountKwd}
            tone="neutral"
          />
          <FigureCell
            label={t('detail.figure_assessed')}
            value={caseRow.assessedAmountKwd}
            tone={caseRow.assessedAmountKwd ? 'info' : 'neutral'}
          />
          <FigureCell
            label={t('detail.figure_final')}
            value={caseRow.finalAmountKwd}
            tone={caseRow.finalAmountKwd ? 'success' : 'neutral'}
          />
        </div>
        {caseRow.varianceKwd != null && caseRow.varianceKwd !== '' && (
          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              color: 'var(--text-tertiary)',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 12,
            }}
          >
            {t('detail.figure_variance')}:{' '}
            <LtrText>
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  color: varianceColor,
                  fontWeight: 700,
                }}
              >
                {formatKwd(caseRow.varianceKwd)} KWD
              </span>
            </LtrText>
          </div>
        )}
      </div>

      {/* Dates block */}
      <div
        style={{
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: '18px 22px',
          background: 'var(--panel-bg)',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.15em',
            color: 'var(--text-tertiary)',
            marginBottom: 12,
          }}
        >
          {t('detail.dates_title')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 14,
          }}
        >
          <DateCell label={t('detail.date_filed_on')} value={caseRow.filedOnDate} />
          <DateCell
            label={t('detail.date_assessed_on')}
            value={caseRow.assessedOnDate}
          />
          <DateCell
            label={t('detail.date_objection_filed')}
            value={caseRow.objectionFiledOn}
          />
          <DateCell
            label={t('detail.date_finalized_on')}
            value={caseRow.finalizedOnDate}
          />
          <DateCell
            label={t('detail.date_statute_expires')}
            value={caseRow.statuteExpiresOn}
            highlight={statuteTone !== 'neutral' ? statuteTone : null}
          />
        </div>
      </div>

      {/* Notes */}
      <div
        style={{
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: '18px 22px',
          background: 'var(--panel-bg)',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.15em',
            color: 'var(--text-tertiary)',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <FileText size={12} /> {t('detail.notes_title')}
        </div>
        <div
          style={{
            fontSize: 12,
            color: caseRow.notes
              ? 'var(--text-secondary)'
              : 'var(--text-tertiary)',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}
        >
          {caseRow.notes || t('detail.notes_empty')}
        </div>
      </div>

      {/* Audit trail (derived from lifecycle timestamps) */}
      <AuditTrail t={t} caseRow={caseRow} />

      {/* Action bar */}
      <div
        style={{
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: '18px 22px',
          background: 'var(--panel-bg)',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.15em',
            color: 'var(--text-tertiary)',
            marginBottom: 10,
          }}
        >
          {t('detail.actions_title')}
        </div>
        {isTerminal ? (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              fontStyle: 'italic',
            }}
          >
            {t('detail.action_terminal')}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {canOpenReview && (
              <OwnerButton
                isOwner={isOwner}
                onClick={() => openTransition('open_review')}
                tooltip={t('ownerOnly.tooltip')}
                testId="cit-action-open-review"
              >
                {t('detail.action_open_review')}
              </OwnerButton>
            )}
            {canRecordAssessment && (
              <OwnerButton
                isOwner={isOwner}
                onClick={() => openTransition('record_assessment')}
                tooltip={t('ownerOnly.tooltip')}
                testId="cit-action-record-assessment"
              >
                {t('detail.action_record_assessment')}
              </OwnerButton>
            )}
            {canRecordObjection && (
              <OwnerButton
                isOwner={isOwner}
                onClick={() => openTransition('record_objection')}
                tooltip={t('ownerOnly.tooltip')}
                testId="cit-action-record-objection"
              >
                {t('detail.action_record_objection')}
              </OwnerButton>
            )}
            {canFinalize && (
              <OwnerButton
                isOwner={isOwner}
                onClick={() => openTransition('finalize')}
                tooltip={t('ownerOnly.tooltip')}
                testId="cit-action-finalize"
              >
                {t('detail.action_finalize')}
              </OwnerButton>
            )}
            {canClose && (
              <OwnerButton
                isOwner={isOwner}
                onClick={() =>
                  setConfirmState({ open: true, kind: 'close', busy: false })
                }
                tooltip={t('ownerOnly.tooltip')}
                testId="cit-action-close"
              >
                <Archive
                  size={13}
                  style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}
                />
                {t('detail.action_close')}
              </OwnerButton>
            )}
            {statuteButtonShown && (
              <OwnerButton
                isOwner={isOwner}
                disabledReason={
                  !canMarkStatuteExpired
                    ? t('detail.action_statute_not_yet')
                    : null
                }
                onClick={() =>
                  setConfirmState({
                    open: true,
                    kind: 'mark_statute_expired',
                    busy: false,
                  })
                }
                tooltip={t('ownerOnly.tooltip')}
                variant="danger-outline"
                testId="cit-action-mark-statute-expired"
              >
                <XCircle
                  size={13}
                  style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}
                />
                {t('detail.action_mark_statute_expired')}
              </OwnerButton>
            )}
          </div>
        )}
      </div>

      <CitAssessmentTransitionModal
        open={transitionState.open}
        transition={transitionState.transition}
        assessment={caseRow}
        onClose={closeTransition}
        onSaved={() => {
          reload();
          showToast(t('toast.transitioned'));
        }}
      />

      <ConfirmModal
        open={confirmState.open && confirmState.kind === 'close'}
        title={t('detail.confirm_close_title', { fiscalYear: caseRow.fiscalYear })}
        body={t('detail.confirm_close_body')}
        confirmLabel={t('detail.confirm_close_confirm')}
        cancelLabel={t('detail.confirm_close_cancel')}
        tone="info"
        busy={confirmState.busy}
        onConfirm={handleConfirm}
        onCancel={() =>
          setConfirmState({ open: false, kind: null, busy: false })
        }
      />
      <ConfirmModal
        open={
          confirmState.open && confirmState.kind === 'mark_statute_expired'
        }
        title={t('detail.confirm_statute_title', {
          fiscalYear: caseRow.fiscalYear,
        })}
        body={t('detail.confirm_statute_body')}
        confirmLabel={t('detail.confirm_statute_confirm')}
        cancelLabel={t('detail.confirm_statute_cancel')}
        tone="danger"
        busy={confirmState.busy}
        onConfirm={handleConfirm}
        onCancel={() =>
          setConfirmState({ open: false, kind: null, busy: false })
        }
      />
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────

function FigureCell({ label, value, tone }) {
  const tk = toneTokens(tone || 'neutral');
  const formatted = value ? formatKwd(value) : '—';
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.15em',
          color: 'var(--text-tertiary)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 22,
          fontWeight: 700,
          color: value ? tk.color : 'var(--text-tertiary)',
        }}
      >
        <LtrText>{formatted}</LtrText>
        {value && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              marginInlineStart: 6,
            }}
          >
            KWD
          </span>
        )}
      </div>
    </div>
  );
}

function DateCell({ label, value, highlight }) {
  const tk = highlight ? toneTokens(highlight) : null;
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.15em',
          color: 'var(--text-tertiary)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 13,
          color: tk ? tk.color : value ? 'var(--text-secondary)' : 'var(--text-tertiary)',
          fontWeight: tk ? 700 : 400,
        }}
      >
        <LtrText>{value || '—'}</LtrText>
      </div>
    </div>
  );
}

function AuditTrail({ t, caseRow }) {
  // Synthesize a lightweight audit timeline from lifecycle timestamps on
  // the case row. The true audit log lives server-side (logAudit writes
  // to an entityType='cit_assessment' stream) but isn't exposed via the
  // current GET endpoints; HASEEB-XYZ tracks surfacing it via
  // /api/cit-assessment/:id/audit. Until then, we derive a chronological
  // view from the per-transition timestamps stored on the row itself.
  const events = [];
  if (caseRow.createdAt) {
    events.push({
      label: t('detail.audit_created'),
      at: caseRow.createdAt,
      kind: 'created',
    });
  }
  if (caseRow.status !== 'FILED' && caseRow.filedOnDate) {
    // The transition UNDER_REVIEW doesn't have its own stored
    // timestamp; we skip it rather than fabricate one.
  }
  if (caseRow.assessedOnDate) {
    events.push({
      label: t('detail.audit_assessed'),
      at: caseRow.assessedOnDate,
      kind: 'assessed',
    });
  }
  if (caseRow.objectionFiledOn) {
    events.push({
      label: t('detail.audit_objected'),
      at: caseRow.objectionFiledOn,
      kind: 'objected',
    });
  }
  if (caseRow.finalizedOnDate) {
    events.push({
      label: t('detail.audit_final'),
      at: caseRow.finalizedOnDate,
      kind: 'final',
    });
  }
  if (caseRow.status === 'CLOSED') {
    events.push({
      label: t('detail.audit_closed'),
      at: caseRow.updatedAt,
      kind: 'closed',
    });
  }
  if (caseRow.status === 'STATUTE_EXPIRED') {
    events.push({
      label: t('detail.audit_statute_expired'),
      at: caseRow.updatedAt,
      kind: 'statute_expired',
    });
  }

  return (
    <div
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        padding: '18px 22px',
        background: 'var(--panel-bg)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.15em',
          color: 'var(--text-tertiary)',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <History size={12} /> {t('detail.audit_title')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.map((e, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
          >
            <CheckCircle2
              size={12}
              style={{ color: 'var(--accent-primary)', flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>{e.label}</div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                color: 'var(--text-tertiary)',
              }}
            >
              <LtrText>
                {e.at ? String(e.at).slice(0, 10) : t('detail.audit_no_timestamp')}
              </LtrText>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * OwnerButton — mirrors backend OWNER-only enforcement via a disabled-
 * with-tooltip pattern. Non-Owner users see the button present but
 * disabled + hover-tooltip explaining the role requirement (per Tarek's
 * "not missing actions" guidance so operators understand the gate).
 *
 * Variants:
 *   - 'primary'         : accent-primary filled.
 *   - 'secondary'       : outline (default).
 *   - 'danger-outline'  : red outline for destructive actions.
 */
function OwnerButton({
  isOwner,
  children,
  onClick,
  tooltip,
  testId,
  variant = 'secondary',
  disabledReason,
}) {
  const disabled = !isOwner || !!disabledReason;
  const title = !isOwner ? tooltip : disabledReason || undefined;
  const baseStyle =
    variant === 'primary'
      ? btnPrimary
      : variant === 'danger-outline'
      ? btnDangerOutline
      : btnSecondary;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      aria-label={typeof children === 'string' ? children : undefined}
      data-testid={testId}
      data-owner-disabled={!isOwner ? 'true' : undefined}
      style={{
        ...baseStyle,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

// ── Styles (design-system tokens only) ────────────────────────────

const inputStyle = {
  background: 'var(--bg-surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 6,
  padding: '6px 10px',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
};

const selectStyle = { ...inputStyle, appearance: 'none', paddingInlineEnd: 24 };

const btnPrimary = {
  background: 'var(--accent-primary)',
  color: '#fff',
  border: 'none',
  padding: '9px 16px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
};

const btnSecondary = {
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-strong)',
  padding: '9px 14px',
  borderRadius: 6,
  fontSize: 12,
  fontFamily: 'inherit',
  fontWeight: 600,
};

const btnDangerOutline = {
  background: 'transparent',
  color: 'var(--semantic-danger)',
  border: '1px solid var(--semantic-danger)',
  padding: '9px 14px',
  borderRadius: 6,
  fontSize: 12,
  fontFamily: 'inherit',
  fontWeight: 600,
};
