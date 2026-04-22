/**
 * YearEndCloseScreen — AUDIT-ACC-003 (2026-04-22).
 *
 * Kuwait annual fiscal-year close workflow (FN-271,
 * TASK-WAVE5-YEAR-END-ROLLOVER). Drives the 7-endpoint lifecycle:
 *   PENDING_PREP → PENDING_APPROVAL → CLOSING → CLOSED → (REVERSED).
 *
 * Distinct from MonthEndCloseScreen (monthly cadence); year-end close
 * rolls P&L to Retained Earnings once per fiscal year via three closing
 * JEs and locks the fiscal period end-to-end.
 *
 * Two views driven by internal state:
 *   - 'year_list' : default. Fiscal-year rows + prepare-new action.
 *   - 'detail'    : per-fiscal-year view. Pre-close checklist +
 *                   computed-figures block + action bar (role + state
 *                   gated) + audit trail + FS export group on
 *                   APPROVED (CLOSED) records.
 *
 * Role gating (midsize role model):
 *   - Owner         → OWNER          → prepare + approve + reverse +
 *                                      FS exports. Approve is SoD-
 *                                      gated: HIDDEN (with tooltip) on
 *                                      the Owner's own prepared record.
 *   - CFO / Senior  → ACCOUNTANT     → prepare only; reads.
 *   - Junior        → VIEWER/AUDITOR → reads only.
 *
 * SoD enforcement: backend enforces approver ≠ preparer at the service
 * layer. Frontend mirrors by hiding the Approve button (with inline
 * tooltip explanation) on the current Owner's own prepared record —
 * operators understand why the action isn't available rather than
 * hitting a 403.
 *
 * Governance friction on reverse: frontend demands a ≥10-char reason +
 * an Owner-reconfirm checkbox on top of the backend's reason-required
 * gate. Backend logs both the reason and the reversing Owner to the
 * audit stream.
 *
 * FS export reuse: the APPROVED-state detail view surfaces the
 * FinancialStatementsScreen's `exportStatement(tab, period, fmt)`
 * pattern for Balance Sheet / Income Statement / Cash Flow PDFs plus
 * the HASEEB-223 SOCIE + DisclosureNotes exports. Nothing is rebuilt;
 * we dispatch through the same engine wrapper.
 *
 * Wall preservation: frontend never calls an LLM. All mutations go
 * through `src/engine` → `src/api/yearEndClose.js` → backend routes.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  FilePlus,
  FileText,
  History,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  X,
} from 'lucide-react';
import Decimal from 'decimal.js';
import EmptyState from '../../components/shared/EmptyState';
import LtrText from '../../components/shared/LtrText';
import { normalizeRole, ROLES } from '../../utils/role';
import { useAuth } from '../../contexts/AuthContext';
import {
  listYearEndCloseRecords,
  prepareYearEndClose,
  approveYearEndClose,
  reverseYearEndClose,
  getYearEndClose,
} from '../../engine';
// FinancialStatementsScreen sources exportStatement from mockEngine
// directly (the engine router doesn't re-export it; it's a mock-only
// metadata helper today — filename+timestamp stub until the real
// server-side export lands). We mirror that import so the FS-package
// button group on the APPROVED detail view doesn't need duplicate
// export logic. HASEEB-229 follow-up tracks wiring the server-side
// export; until then both screens use the same metadata stub.
import { exportStatement } from '../../engine/mockEngine';

// ── Constants ─────────────────────────────────────────────────────

/**
 * Backend YearEndCloseStatus enum (prisma/tenant/schema.prisma). All 5
 * values render via the yearEndClose.status.* keys — EN + AR. The
 * dispatch spec calls out DRAFT/PREPARED/APPROVED/REVERSED as the
 * visible lifecycle; we map the 5 backend values to those four
 * surface labels via the `status` namespace (PENDING_PREP → Draft,
 * PENDING_APPROVAL → Prepared, CLOSING → Closing (transient),
 * CLOSED → Approved, REVERSED → Reversed).
 */
const ALL_STATUSES = [
  'PENDING_PREP',
  'PENDING_APPROVAL',
  'CLOSING',
  'CLOSED',
  'REVERSED',
];

const STATUS_TONE = {
  PENDING_PREP: 'neutral',
  PENDING_APPROVAL: 'warning',
  CLOSING: 'info',
  CLOSED: 'success',
  REVERSED: 'danger',
};

const TERMINAL_STATUSES = new Set(['REVERSED']);
const APPROVED_STATUSES = new Set(['CLOSED']);
const DRAFT_STATUSES = new Set(['PENDING_PREP']);
const PREPARED_STATUSES = new Set(['PENDING_APPROVAL']);

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
 * Decimal-safe KWD formatter. Monetary values arrive as Decimal-safe
 * strings at the JSON boundary. Never parseFloat — use decimal.js for
 * any transform. Falsy values render as em-dash.
 */
function formatKwd(value) {
  if (value == null || value === '') return null;
  try {
    const d = new Decimal(String(value));
    const fixed = d.toFixed(3);
    const [intPart, fracPart] = fixed.split('.');
    const withSign = intPart.startsWith('-') ? '-' : '';
    const digits = withSign ? intPart.slice(1) : intPart;
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${withSign}${grouped}.${fracPart}`;
  } catch {
    return String(value);
  }
}

function formatDate(iso) {
  if (!iso) return null;
  return String(iso).slice(0, 10);
}

/**
 * Build the pre-close checklist items from the prepared record's
 * `prerequisites` payload (backend shape on YearEndCloseSnapshot) plus
 * the record's lifecycle state. Returns `[{ key, status, labelKey,
 * message, linkHint }]` — status is one of 'ready' | 'blocked' |
 * 'pending'. `labelKey` points into the yearEndClose namespace.
 */
function deriveChecklist(record) {
  // When the backend ships its `prerequisites` sub-object, mirror the
  // three gates documented in year-end-close.types.ts:
  //   statutoryReserveSatisfied
  //   noUnresolvedRestatements
  //   noOpenScopeExceptions
  const prereq = record?.prerequisites || {};
  const hasPrereq =
    'statutoryReserveSatisfied' in prereq ||
    'noUnresolvedRestatements' in prereq ||
    'noOpenScopeExceptions' in prereq;
  if (hasPrereq) {
    return [
      {
        key: 'statutoryReserveSatisfied',
        labelKey: 'detail.checklist_statutory_reserve',
        status: prereq.statutoryReserveSatisfied ? 'ready' : 'blocked',
      },
      {
        key: 'noUnresolvedRestatements',
        labelKey: 'detail.checklist_restatements',
        status: prereq.noUnresolvedRestatements ? 'ready' : 'blocked',
      },
      {
        key: 'noOpenScopeExceptions',
        labelKey: 'detail.checklist_scope_exceptions',
        status: prereq.noOpenScopeExceptions ? 'ready' : 'blocked',
      },
    ];
  }
  // Fallback (record without prerequisites, e.g. legacy DTO): derive
  // readiness from record status. CLOSED/PENDING_APPROVAL → all ready;
  // REVERSED → terminal/no-op; PENDING_PREP → all pending.
  if (record?.status === 'CLOSED' || record?.status === 'PENDING_APPROVAL') {
    return [
      { key: 'statutoryReserveSatisfied', labelKey: 'detail.checklist_statutory_reserve', status: 'ready' },
      { key: 'noUnresolvedRestatements', labelKey: 'detail.checklist_restatements', status: 'ready' },
      { key: 'noOpenScopeExceptions', labelKey: 'detail.checklist_scope_exceptions', status: 'ready' },
    ];
  }
  return [
    { key: 'statutoryReserveSatisfied', labelKey: 'detail.checklist_statutory_reserve', status: 'pending' },
    { key: 'noUnresolvedRestatements', labelKey: 'detail.checklist_restatements', status: 'pending' },
    { key: 'noOpenScopeExceptions', labelKey: 'detail.checklist_scope_exceptions', status: 'pending' },
  ];
}

// ── Toast + Banner ────────────────────────────────────────────────

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
      data-testid={`yec-status-${status}`}
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

// ══════════════════════════════════════════════════════════════════
// YearEndCloseScreen
// ══════════════════════════════════════════════════════════════════

export default function YearEndCloseScreen({ role = 'CFO' }) {
  const { t } = useTranslation('yearEndClose');
  const normalizedRole = normalizeRole(role);
  const isOwner = normalizedRole === ROLES.OWNER;
  const canPrepare =
    normalizedRole === ROLES.OWNER ||
    normalizedRole === ROLES.CFO ||
    normalizedRole === ROLES.SENIOR;
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id || authUser?.userId || null;

  const [view, setView] = useState('year_list'); // 'year_list' | 'detail'
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((text, tone = 'success') => {
    setToast({ text, tone });
  }, []);

  const openDetail = (fiscalYear) => {
    setSelectedFiscalYear(Number(fiscalYear));
    setView('detail');
  };
  const backToList = () => {
    setSelectedFiscalYear(null);
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
            canPrepare={canPrepare}
            onOpenDetail={openDetail}
            showToast={showToast}
          />
        )}

        {view === 'detail' && selectedFiscalYear != null && (
          <DetailView
            t={t}
            fiscalYear={selectedFiscalYear}
            isOwner={isOwner}
            canPrepare={canPrepare}
            currentUserId={currentUserId}
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

function YearListView({ t, canPrepare, onOpenDetail, showToast }) {
  const [records, setRecords] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [prepareOpen, setPrepareOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await listYearEndCloseRecords();
      const arr = Array.isArray(list) ? list : [];
      arr.sort((a, b) => (b.fiscalYear || 0) - (a.fiscalYear || 0));
      setRecords(arr);
    } catch (err) {
      setRecords([]);
      setLoadError(err?.message || t('toast.error_load'));
    }
  }, [t]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          disabled={!canPrepare}
          data-owner-disabled={!canPrepare ? 'true' : undefined}
          data-testid="yec-action-prepare"
          onClick={canPrepare ? () => setPrepareOpen(true) : undefined}
          title={!canPrepare ? t('detail.sod_tooltip') : undefined}
          style={{
            ...btnPrimary,
            opacity: canPrepare ? 1 : 0.45,
            cursor: canPrepare ? 'pointer' : 'not-allowed',
          }}
        >
          <FilePlus
            size={14}
            style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}
          />
          {t('year_list.action_new')}
        </button>
      </div>

      {loadError && <ErrorBanner text={loadError} />}

      {records === null && (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>
      )}

      {records && records.length === 0 && !loadError && (
        <EmptyState
          icon={Clock}
          title={t('year_list.empty_title')}
          description={t('year_list.empty_description')}
        />
      )}

      {records && records.length > 0 && (
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
              gridTemplateColumns:
                '0.7fr 0.9fr 1fr 1fr 1fr 1fr 1fr',
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
            <div>{t('year_list.column_status')}</div>
            <div>{t('year_list.column_prepared_by')}</div>
            <div>{t('year_list.column_prepared_at')}</div>
            <div>{t('year_list.column_approved_by')}</div>
            <div>{t('year_list.column_approved_at')}</div>
            <div>{t('year_list.column_reversed_at')}</div>
          </div>

          {records.map((row, idx) => (
            <button
              key={row.id}
              type="button"
              data-testid={`yec-row-${row.fiscalYear}`}
              onClick={() => onOpenDetail(row.fiscalYear)}
              aria-label={t('year_list.row_open_detail')}
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '0.7fr 0.9fr 1fr 1fr 1fr 1fr 1fr',
                gap: 10,
                padding: '14px 16px',
                width: '100%',
                textAlign: 'start',
                background:
                  idx % 2 === 1 ? 'var(--bg-surface-sunken)' : 'transparent',
                border: 'none',
                borderBottom:
                  idx === records.length - 1
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
              <div>
                <StatusBadge status={row.status} t={t} />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.preparedBy || '—'}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                }}
              >
                <LtrText>{formatDate(row.preparedAt) || '—'}</LtrText>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.approvedBy || '—'}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                }}
              >
                <LtrText>{formatDate(row.approvedAt) || '—'}</LtrText>
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  color: row.reversedAt
                    ? 'var(--semantic-danger)'
                    : 'var(--text-tertiary)',
                }}
              >
                <LtrText>{formatDate(row.reversedAt) || '—'}</LtrText>
              </div>
            </button>
          ))}
        </div>
      )}

      <PrepareModal
        open={prepareOpen}
        t={t}
        onClose={() => setPrepareOpen(false)}
        onPrepared={(fy) => {
          setPrepareOpen(false);
          showToast(t('toast.prepared'));
          reload();
          onOpenDetail(fy);
        }}
        onError={(err) => showToast(err?.message || t('toast.error_transition'), 'error')}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Detail View
// ══════════════════════════════════════════════════════════════════

function DetailView({ t, fiscalYear, isOwner, canPrepare, currentUserId, onBack, showToast }) {
  const [record, setRecord] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const row = await getYearEndClose(fiscalYear);
      setRecord(row);
    } catch (err) {
      setLoadError(err?.message || t('toast.error_load'));
    }
  }, [fiscalYear, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Compute checklist BEFORE any conditional return so the hook order
  // is stable across renders. deriveChecklist tolerates a null record
  // (returns the pending fallback) — real rendering of the checklist
  // block is gated by record status inside the JSX branch below.
  const checklist = useMemo(() => deriveChecklist(record), [record]);

  if (loadError) {
    return (
      <div>
        <ErrorBanner text={loadError} />
        <button type="button" onClick={onBack} style={btnSecondary}>
          <ArrowLeft
            size={14}
            style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}
          />
          {t('year_list.action_back')}
        </button>
      </div>
    );
  }
  if (!record) {
    return <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>;
  }

  const isDraft = DRAFT_STATUSES.has(record.status);
  const isPrepared = PREPARED_STATUSES.has(record.status);
  const isApproved = APPROVED_STATUSES.has(record.status);
  const isTerminal = TERMINAL_STATUSES.has(record.status);
  // SoD gate: the Owner who called prepare cannot also approve. Hide
  // the Approve button on that Owner's own prepared record, with
  // inline tooltip explanation.
  const sodBlocked =
    isOwner && isPrepared && !!currentUserId && record.preparedBy === currentUserId;

  const blockedChecklist = checklist.filter((c) => c.status === 'blocked');
  const pendingChecklist = checklist.filter((c) => c.status === 'pending');
  const readyChecklist = checklist.filter((c) => c.status === 'ready');

  const handleReprepare = async () => {
    setBusy(true);
    try {
      await prepareYearEndClose(fiscalYear);
      showToast(t('toast.reprepared'));
      await reload();
    } catch (err) {
      showToast(err?.message || t('toast.error_transition'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    setBusy(true);
    try {
      await approveYearEndClose(record.id);
      setApproveOpen(false);
      showToast(t('toast.approved'));
      await reload();
    } catch (err) {
      showToast(err?.message || t('toast.error_transition'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReverse = async (reason) => {
    setBusy(true);
    try {
      await reverseYearEndClose(record.id, { reason });
      setReverseOpen(false);
      showToast(t('toast.reversed'));
      await reload();
    } catch (err) {
      showToast(err?.message || t('toast.error_transition'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async (tab, fmt) => {
    try {
      const meta = await exportStatement(tab, `FY${fiscalYear}`, fmt);
      showToast(
        t('toast.export_started', { filename: meta?.filename || `${tab}.${fmt}` }),
      );
    } catch (err) {
      showToast(err?.message || t('toast.error_transition'), 'error');
    }
  };

  return (
    <div
      data-testid="yec-detail-view"
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
            <LtrText>{t('detail.header_fiscal_year', { fiscalYear: record.fiscalYear })}</LtrText>
          </div>
          <StatusBadge status={record.status} t={t} />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            alignItems: 'flex-end',
            minWidth: 220,
            fontSize: 11,
            color: 'var(--text-tertiary)',
          }}
        >
          <div>
            {t('detail.header_prepared_by')}:{' '}
            <span style={{ color: 'var(--text-secondary)' }}>
              {record.preparedBy || '—'}
            </span>
          </div>
          {record.approvedBy && (
            <div>
              {t('detail.header_approved_by')}:{' '}
              <span style={{ color: 'var(--text-secondary)' }}>
                {record.approvedBy}
              </span>
            </div>
          )}
          {record.reversedAt && (
            <div>
              {t('detail.header_reversed_at')}:{' '}
              <LtrText>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: 'var(--semantic-danger)',
                  }}
                >
                  {formatDate(record.reversedAt)}
                </span>
              </LtrText>
            </div>
          )}
        </div>
      </div>

      {/* Pre-close checklist — DRAFT and PREPARED states only */}
      {(isDraft || isPrepared) && (
        <ChecklistBlock
          t={t}
          readyItems={readyChecklist}
          blockedItems={blockedChecklist}
          pendingItems={pendingChecklist}
        />
      )}

      {/* Computed figures block */}
      <FiguresBlock t={t} record={record} />

      {/* Audit trail */}
      <AuditTrail t={t} record={record} />

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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(isDraft || isPrepared) && (
              <button
                type="button"
                data-testid="yec-action-reprepare"
                disabled={!canPrepare || busy}
                data-owner-disabled={!canPrepare ? 'true' : undefined}
                onClick={canPrepare && !busy ? handleReprepare : undefined}
                title={!canPrepare ? t('detail.sod_tooltip') : undefined}
                style={{
                  ...btnSecondary,
                  opacity: !canPrepare || busy ? 0.6 : 1,
                  cursor: !canPrepare || busy ? 'not-allowed' : 'pointer',
                }}
              >
                <RefreshCw
                  size={13}
                  style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}
                />
                {t('detail.action_reprepare')}
              </button>
            )}
            {isPrepared && !sodBlocked && (
              <button
                type="button"
                data-testid="yec-action-approve"
                disabled={!isOwner || busy}
                data-owner-disabled={!isOwner ? 'true' : undefined}
                onClick={isOwner && !busy ? () => setApproveOpen(true) : undefined}
                title={!isOwner ? t('detail.sod_tooltip') : undefined}
                style={{
                  ...btnPrimary,
                  opacity: !isOwner || busy ? 0.6 : 1,
                  cursor: !isOwner || busy ? 'not-allowed' : 'pointer',
                }}
              >
                <CheckCircle2
                  size={13}
                  style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}
                />
                {t('detail.action_approve')}
              </button>
            )}
            {isPrepared && sodBlocked && (
              <span
                data-testid="yec-sod-tooltip"
                role="note"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  border: '1px solid var(--semantic-warning)',
                  borderRadius: 6,
                  background: 'var(--semantic-warning-subtle)',
                  color: 'var(--semantic-warning)',
                  fontSize: 11,
                  fontWeight: 600,
                  maxWidth: 520,
                }}
                title={t('detail.sod_tooltip')}
              >
                <ShieldAlert size={13} /> {t('detail.sod_tooltip')}
              </span>
            )}
            {isApproved && (
              <>
                <button
                  type="button"
                  data-testid="yec-action-reverse"
                  disabled={!isOwner || busy}
                  data-owner-disabled={!isOwner ? 'true' : undefined}
                  onClick={
                    isOwner && !busy ? () => setReverseOpen(true) : undefined
                  }
                  title={!isOwner ? t('detail.sod_tooltip') : undefined}
                  style={{
                    ...btnDangerOutline,
                    opacity: !isOwner || busy ? 0.6 : 1,
                    cursor: !isOwner || busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RotateCcw
                    size={13}
                    style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}
                  />
                  {t('detail.action_reverse')}
                </button>
                <ExportButtons t={t} onExport={handleExport} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Approve confirmation modal */}
      <ApproveConfirmModal
        open={approveOpen}
        t={t}
        fiscalYear={record.fiscalYear}
        busy={busy}
        onConfirm={handleApprove}
        onCancel={() => setApproveOpen(false)}
      />

      {/* Reverse modal */}
      <ReverseModal
        open={reverseOpen}
        t={t}
        fiscalYear={record.fiscalYear}
        busy={busy}
        onConfirm={handleReverse}
        onCancel={() => setReverseOpen(false)}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Sub-blocks
// ══════════════════════════════════════════════════════════════════

function ChecklistBlock({ t, readyItems, blockedItems, pendingItems }) {
  const [readyExpanded, setReadyExpanded] = useState(false);
  return (
    <div
      data-testid="yec-checklist-block"
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
        }}
      >
        {t('detail.checklist_title')}
      </div>
      <div
        style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12 }}
      >
        {t('detail.checklist_subtitle')}
      </div>

      {/* Blocked items — always expanded */}
      {blockedItems.length > 0 && (
        <div
          data-testid="yec-checklist-blocked"
          style={{
            marginBottom: 10,
            border: '1px solid var(--semantic-danger)',
            background: 'var(--semantic-danger-subtle)',
            borderRadius: 8,
            padding: '10px 14px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--semantic-danger)',
              marginBottom: 6,
            }}
          >
            {t('detail.checklist_blocked_expanded')}
          </div>
          {blockedItems.map((c) => (
            <ChecklistRow key={c.key} t={t} item={c} />
          ))}
        </div>
      )}

      {/* Pending items — visible inline */}
      {pendingItems.length > 0 && (
        <div data-testid="yec-checklist-pending" style={{ marginBottom: 10 }}>
          {pendingItems.map((c) => (
            <ChecklistRow key={c.key} t={t} item={c} />
          ))}
        </div>
      )}

      {/* Ready items — collapsed to count, expandable */}
      {readyItems.length > 0 && (
        <div data-testid="yec-checklist-ready">
          <button
            type="button"
            onClick={() => setReadyExpanded((x) => !x)}
            style={{
              background: 'transparent',
              border: '1px solid var(--accent-primary-border)',
              borderRadius: 6,
              padding: '6px 12px',
              color: 'var(--accent-primary)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CheckCircle2 size={13} />
            {t('detail.checklist_ready_collapsed', { count: readyItems.length })}
          </button>
          {readyExpanded && (
            <div style={{ marginTop: 8 }}>
              {readyItems.map((c) => (
                <ChecklistRow key={c.key} t={t} item={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChecklistRow({ t, item }) {
  const Icon =
    item.status === 'ready'
      ? CheckCircle2
      : item.status === 'blocked'
      ? AlertTriangle
      : Circle;
  const color =
    item.status === 'ready'
      ? 'var(--accent-primary)'
      : item.status === 'blocked'
      ? 'var(--semantic-danger)'
      : 'var(--text-tertiary)';
  return (
    <div
      data-testid={`yec-checklist-row-${item.key}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 0',
        fontSize: 12,
      }}
    >
      <Icon size={14} color={color} />
      <div style={{ flex: 1, color: 'var(--text-secondary)' }}>
        {t(item.labelKey)}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color,
        }}
      >
        {t(`detail.checklist_status_${item.status}`)}
      </div>
    </div>
  );
}

function FiguresBlock({ t, record }) {
  return (
    <div
      data-testid="yec-figures-block"
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
          marginBottom: 14,
        }}
      >
        <FigureCell
          label={t('detail.figure_revenue_total')}
          value={record.revenueTotalKwd}
          tone="info"
        />
        <FigureCell
          label={t('detail.figure_expense_total')}
          value={record.expenseTotalKwd}
          tone="warning"
        />
        <FigureCell
          label={t('detail.figure_net_income')}
          value={record.netIncomeKwd}
          tone="success"
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 18,
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 14,
        }}
      >
        <FigureCell
          label={t('detail.figure_opening_retained_earnings')}
          value={record.openingRetainedEarningsKwd}
          tone="neutral"
        />
        <FigureCell
          label={t('detail.figure_projected_ending_retained_earnings')}
          value={record.endingRetainedEarningsKwd}
          tone="success"
        />
      </div>
    </div>
  );
}

function FigureCell({ label, value, tone }) {
  const tk = toneTokens(tone || 'neutral');
  const formatted = value != null && value !== '' ? formatKwd(value) : '—';
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
          fontSize: 20,
          fontWeight: 700,
          color: value ? tk.color : 'var(--text-tertiary)',
        }}
      >
        <LtrText>{formatted}</LtrText>
        {value != null && value !== '' && (
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

function AuditTrail({ t, record }) {
  const events = [];
  if (record.preparedAt) {
    events.push({
      label: t('detail.audit_prepared'),
      actor: record.preparedBy,
      at: record.preparedAt,
      kind: 'prepared',
    });
  }
  if (record.approvedAt) {
    events.push({
      label: t('detail.audit_approved'),
      actor: record.approvedBy,
      at: record.approvedAt,
      kind: 'approved',
    });
  }
  if (record.reversedAt) {
    events.push({
      label: t('detail.audit_reversed'),
      actor: record.reversedBy,
      at: record.reversedAt,
      kind: 'reversed',
      reason: record.reversalReason,
    });
  }
  return (
    <div
      data-testid="yec-audit-trail"
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
              flexDirection: 'column',
              gap: 4,
              fontSize: 12,
              color: 'var(--text-secondary)',
              padding: '8px 0',
              borderBottom:
                i === events.length - 1 ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2
                size={12}
                style={{
                  color:
                    e.kind === 'reversed'
                      ? 'var(--semantic-danger)'
                      : 'var(--accent-primary)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>{e.label}</span>
                {e.actor && (
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {' '}· {e.actor}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                }}
              >
                <LtrText>{formatDate(e.at) || t('detail.audit_no_timestamp')}</LtrText>
              </div>
            </div>
            {e.reason && (
              <div
                style={{
                  marginInlineStart: 22,
                  padding: '6px 10px',
                  background: 'var(--bg-surface-sunken)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {t('detail.audit_reversal_reason')}:
                </span>{' '}
                {e.reason}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportButtons({ t, onExport }) {
  // Group the 5 export buttons under one visual cluster so the APPROVED
  // action bar remains scannable. Each button dispatches to the shared
  // exportStatement engine wrapper (FinancialStatementsScreen pattern).
  const exports = [
    { key: 'balance-sheet', tab: 'balance-sheet', fmt: 'pdf', labelKey: 'detail.action_export_balance_sheet' },
    { key: 'income-statement', tab: 'income-statement', fmt: 'pdf', labelKey: 'detail.action_export_income_statement' },
    { key: 'cash-flow', tab: 'cash-flow', fmt: 'pdf', labelKey: 'detail.action_export_cash_flow' },
    { key: 'socie', tab: 'socie', fmt: 'pdf', labelKey: 'detail.action_export_socie' },
    { key: 'disclosures', tab: 'disclosure-notes', fmt: 'docx', labelKey: 'detail.action_export_disclosures' },
  ];
  return (
    <div
      data-testid="yec-export-group"
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        alignItems: 'center',
        paddingInlineStart: 6,
        borderInlineStart: '1px solid var(--border-subtle)',
        marginInlineStart: 6,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'var(--text-tertiary)',
          marginInlineEnd: 4,
        }}
      >
        {t('detail.action_export_fs_package')}:
      </span>
      {exports.map((e) => (
        <button
          key={e.key}
          type="button"
          data-testid={`yec-export-${e.key}`}
          onClick={() => onExport(e.tab, e.fmt)}
          style={{
            ...btnSecondary,
            padding: '7px 12px',
            fontSize: 11,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Download size={11} /> {t(e.labelKey)}
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Modals
// ══════════════════════════════════════════════════════════════════

function PrepareModal({ open, t, onClose, onPrepared, onError }) {
  const [fiscalYear, setFiscalYear] = useState(
    new Date().getUTCFullYear() - 1,
  );
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setFiscalYear(new Date().getUTCFullYear() - 1);
      setBusy(false);
    }
  }, [open]);
  if (!open) return null;
  const handleConfirm = async () => {
    const fy = Number(fiscalYear);
    if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) return;
    setBusy(true);
    try {
      await prepareYearEndClose(fy);
      onPrepared(fy);
    } catch (err) {
      onError?.(err);
      setBusy(false);
    }
  };
  return (
    <>
      <div
        onClick={busy ? undefined : onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--overlay-backdrop, rgba(0,0,0,0.55))',
          backdropFilter: 'blur(4px)',
          zIndex: 300,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        data-testid="yec-prepare-modal"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 480,
          background: 'var(--panel-bg, var(--bg-surface-raised))',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          zIndex: 301,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 22,
              color: 'var(--text-primary)',
            }}
          >
            {t('year_list.prepare_modal_title')}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {t('year_list.prepare_modal_body')}
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.15em',
              color: 'var(--text-tertiary)',
            }}
          >
            {t('year_list.prepare_modal_fiscal_year_label')}
          </span>
          <input
            type="number"
            min={2000}
            max={2100}
            value={fiscalYear}
            data-testid="yec-prepare-fiscal-year"
            onChange={(e) => setFiscalYear(e.target.value)}
            style={{
              background: 'var(--bg-surface-sunken)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: "'DM Mono', monospace",
              outline: 'none',
            }}
          />
        </label>
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={btnSecondary}
          >
            {t('year_list.prepare_modal_cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            data-testid="yec-prepare-confirm"
            style={{
              ...btnPrimary,
              opacity: busy ? 0.6 : 1,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {t('year_list.prepare_modal_confirm')}
          </button>
        </div>
      </div>
    </>
  );
}

function ApproveConfirmModal({ open, t, fiscalYear, busy, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);
  if (!open) return null;
  const matches = typed.trim() === String(fiscalYear);
  return (
    <>
      <div
        onClick={busy ? undefined : onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--overlay-backdrop, rgba(0,0,0,0.55))',
          backdropFilter: 'blur(4px)',
          zIndex: 300,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        data-testid="yec-approve-modal"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 540,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--panel-bg, var(--bg-surface-raised))',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          zIndex: 301,
          padding: '22px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        }}
      >
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 22,
            color: 'var(--text-primary)',
          }}
        >
          {t('approve_modal.title', { fiscalYear })}
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.15em',
              color: 'var(--text-tertiary)',
              marginBottom: 8,
            }}
          >
            {t('approve_modal.summary_heading')}
          </div>
          <ul
            style={{
              margin: 0,
              paddingInlineStart: 18,
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            <li>{t('approve_modal.summary_point_1')}</li>
            <li>{t('approve_modal.summary_point_2')}</li>
            <li>{t('approve_modal.summary_point_3')}</li>
            <li>{t('approve_modal.summary_point_4')}</li>
          </ul>
        </div>
        <div
          role="note"
          data-testid="yec-approve-governance-notice"
          style={{
            display: 'flex',
            gap: 8,
            padding: '10px 14px',
            background: 'var(--semantic-warning-subtle)',
            border: '1px solid var(--semantic-warning)',
            borderRadius: 8,
            color: 'var(--semantic-warning)',
            fontSize: 11,
            alignItems: 'flex-start',
          }}
        >
          <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{t('approve_modal.governance_notice')}</span>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.15em',
              color: 'var(--text-tertiary)',
            }}
          >
            {t('approve_modal.confirm_label')}
          </span>
          <input
            type="text"
            value={typed}
            data-testid="yec-approve-type-to-confirm"
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t('approve_modal.confirm_placeholder', { fiscalYear })}
            style={{
              background: 'var(--bg-surface-sunken)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: "'DM Mono', monospace",
              outline: 'none',
            }}
          />
        </label>
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={btnSecondary}
          >
            {t('approve_modal.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || busy}
            data-testid="yec-approve-confirm"
            style={{
              ...btnPrimary,
              opacity: !matches || busy ? 0.5 : 1,
              cursor: !matches || busy ? 'not-allowed' : 'pointer',
            }}
          >
            {t('approve_modal.approve')}
          </button>
        </div>
      </div>
    </>
  );
}

function ReverseModal({ open, t, fiscalYear, busy, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    if (open) {
      setReason('');
      setAcknowledged(false);
    }
  }, [open]);
  if (!open) return null;
  const reasonValid = reason.trim().length >= 10;
  const canSubmit = reasonValid && acknowledged && !busy;
  return (
    <>
      <div
        onClick={busy ? undefined : onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--overlay-backdrop, rgba(0,0,0,0.55))',
          backdropFilter: 'blur(4px)',
          zIndex: 300,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        data-testid="yec-reverse-modal"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 540,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--panel-bg, var(--bg-surface-raised))',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          zIndex: 301,
          padding: '22px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        }}
      >
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 22,
            color: 'var(--text-primary)',
          }}
        >
          {t('reverse_modal.title', { fiscalYear })}
        </div>
        <div
          role="alert"
          data-testid="yec-reverse-warning"
          style={{
            display: 'flex',
            gap: 8,
            padding: '12px 14px',
            background: 'var(--semantic-danger-subtle)',
            border: '1px solid var(--semantic-danger)',
            borderRadius: 8,
            color: 'var(--semantic-danger)',
            fontSize: 12,
            alignItems: 'flex-start',
            lineHeight: 1.55,
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{t('reverse_modal.warning_banner')}</span>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.15em',
              color: 'var(--text-tertiary)',
            }}
          >
            {t('reverse_modal.reason_label')}
          </span>
          <textarea
            value={reason}
            data-testid="yec-reverse-reason"
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reverse_modal.reason_placeholder')}
            rows={4}
            style={{
              background: 'var(--bg-surface-sunken)',
              border: `1px solid ${reasonValid || reason.length === 0 ? 'var(--border-default)' : 'var(--semantic-warning)'}`,
              borderRadius: 6,
              padding: '9px 12px',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
            }}
          />
          {reason.length > 0 && !reasonValid && (
            <span
              style={{ fontSize: 11, color: 'var(--semantic-warning)' }}
            >
              {t('reverse_modal.reason_too_short')}
            </span>
          )}
        </label>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            data-testid="yec-reverse-acknowledge"
          />
          {t('reverse_modal.owner_reconfirm_label')}
        </label>
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={btnSecondary}
          >
            {t('reverse_modal.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            disabled={!canSubmit}
            data-testid="yec-reverse-confirm"
            style={{
              ...btnDangerOutline,
              background: canSubmit ? 'var(--semantic-danger)' : 'transparent',
              color: canSubmit ? '#fff' : 'var(--semantic-danger)',
              opacity: canSubmit ? 1 : 0.6,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {t('reverse_modal.reverse')}
          </button>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// Styles (design-system tokens only)
// ══════════════════════════════════════════════════════════════════

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
