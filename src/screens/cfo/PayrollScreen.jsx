/**
 * PayrollScreen — AUDIT-ACC-013 (2026-04-22).
 *
 * Primary surface for the payroll module. Renders three tabs:
 *   1. Employees       — roster, YTD/EOS slide-over, role-gated lifecycle
 *                        actions (create / edit / terminate / rehire).
 *   2. Payroll Runs    — DRAFT → APPROVED → PAID lifecycle; per-employee
 *                        line items; Approve / Pay / Download WPS actions.
 *   3. PIFSS           — monthly submissions; Generate file + Update
 *                        status (OWNER only).
 *
 * The screen consumes the engine-routed payroll surface (23 wrappers in
 * `src/engine/index.js`), which means it works identically against the
 * LIVE corporate-api and the MOCK seed data. Role gating is defense-in-
 * depth only — the backend is authoritative. The three write actions
 * on a payroll run (approve / pay) AND the WPS download (OWNER + CFO /
 * Senior, who need to submit the SIF to the bank) follow the dispatch
 * spec; Junior sees read-only view always.
 *
 * HASEEB-221 (2026-04-22): per-employee payslip PDF download now wired
 * (backend HASEEB-205 merge `109d377`). APPROVED / PAID runs render a
 * "Download Payslip" action on each employee line item; visible to
 * Owner / CFO / Senior, hidden for Junior. Bulk-ZIP download and the
 * employee-self-download path remain as HASEEB-221 Wave follow-up items;
 * not shipped here. The "Download WPS" run-level action continues to
 * exist alongside the new per-employee action.
 *
 * WPS download mechanics: the backend returns raw `text/plain` SIF
 * content (NOT the HASEEB-180 base64-envelope pattern). The engine
 * wrapper returns `{blob, filename}` directly and we trigger the
 * browser download via anchor + URL.createObjectURL. A small inline
 * helper keeps the screen self-contained — no utility file for one use.
 */

import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet,
  Users,
  FileSpreadsheet,
  Plus,
  AlertTriangle,
  Download,
  X,
  CheckCircle2,
  Play,
} from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import LtrText from '../../components/shared/LtrText';
import { normalizeRole, canEditAdmin, ROLES } from '../../utils/role';
import {
  listEmployees,
  getEmployee,
  getEmployeeEos,
  getEmployeeEosHistory,
  getEmployeeAdvances,
  getPayrollHistory,
  getPayrollRun,
  runPayroll,
  approvePayroll,
  payPayroll,
  downloadWpsFile,
  downloadPayslip,
  listPifssSubmissions,
  generatePifssFile,
} from '../../engine';

// ── status palettes ────────────────────────────────────────────────
const RUN_STATUS_COLORS = {
  DRAFT: {
    color: 'var(--text-secondary)',
    bg: 'var(--bg-surface-sunken)',
    border: 'var(--border-strong)',
  },
  APPROVED: {
    color: 'var(--accent-primary)',
    bg: 'var(--accent-primary-subtle)',
    border: 'var(--accent-primary-border)',
  },
  PAID: {
    color: 'var(--accent-primary)',
    bg: 'var(--accent-primary-subtle)',
    border: 'var(--accent-primary-border)',
  },
};

const PIFSS_STATUS_COLORS = {
  GENERATED: {
    color: 'var(--text-secondary)',
    bg: 'var(--bg-surface-sunken)',
    border: 'var(--border-strong)',
  },
  SUBMITTED: {
    color: 'var(--semantic-warning)',
    bg: 'var(--semantic-warning-subtle)',
    border: 'var(--semantic-warning)',
  },
  ACCEPTED: {
    color: 'var(--accent-primary)',
    bg: 'var(--accent-primary-subtle)',
    border: 'var(--accent-primary-border)',
  },
  REJECTED: {
    color: 'var(--semantic-danger)',
    bg: 'var(--semantic-danger-subtle)',
    border: 'var(--semantic-danger)',
  },
  PAID: {
    color: 'var(--accent-primary)',
    bg: 'var(--accent-primary-subtle)',
    border: 'var(--accent-primary-border)',
  },
};

// ── utility renderers ─────────────────────────────────────────────
function formatKwd(value) {
  const n = Number(value || 0);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}
function formatPeriod(year, month) {
  if (!year || !month) return '—';
  return `${year}-${String(month).padStart(2, '0')}`;
}
function maskCivilId(civilId) {
  if (!civilId) return '—';
  const s = String(civilId);
  if (s.length <= 4) return s;
  if (s.includes('•')) return s; // already masked from backend
  return `••••${s.slice(-4)}`;
}

// ── toast ──────────────────────────────────────────────────────────
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
          tone === 'error'
            ? 'var(--semantic-danger)'
            : 'var(--accent-primary)',
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

// ── PayrollScreen ─────────────────────────────────────────────────
export default function PayrollScreen({ role = 'CFO' }) {
  const { t } = useTranslation('payroll');
  const normalizedRole = normalizeRole(role);
  const isOwner = normalizedRole === ROLES.OWNER;
  const canEdit = isOwner || canEditAdmin(role); // Owner + CFO + Senior
  const [activeTab, setActiveTab] = useState('runs');
  const [toast, setToast] = useState(null);

  const showToast = (text, tone = 'success') => setToast({ text, tone });

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Header */}
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
          </div>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label={t('title')}
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 16,
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          {[
            { key: 'runs', icon: Wallet, label: t('tabs.runs') },
            { key: 'employees', icon: Users, label: t('tabs.employees') },
            { key: 'pifss', icon: FileSpreadsheet, label: t('tabs.pifss') },
          ].map((tab) => {
            const on = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={on}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 14px',
                  background: 'transparent',
                  color: on ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderTop: 'none',
                  borderInlineStart: 'none',
                  borderInlineEnd: 'none',
                  borderBottom: on
                    ? '2px solid var(--accent-primary)'
                    : '2px solid transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <Icon size={14} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'runs' && (
          <RunsTab
            role={normalizedRole}
            isOwner={isOwner}
            canEdit={canEdit}
            showToast={showToast}
            t={t}
          />
        )}
        {activeTab === 'employees' && (
          <EmployeesTab
            role={normalizedRole}
            isOwner={isOwner}
            canEdit={canEdit}
            showToast={showToast}
            t={t}
          />
        )}
        {activeTab === 'pifss' && (
          <PifssTab
            role={normalizedRole}
            isOwner={isOwner}
            canEdit={canEdit}
            showToast={showToast}
            t={t}
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
// Runs tab
// ══════════════════════════════════════════════════════════════════
function RunsTab({ isOwner, canEdit, showToast, t }) {
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [openRun, setOpenRun] = useState(null);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);

  const reload = async () => {
    setLoadError(null);
    try {
      const res = await getPayrollHistory({});
      setRows(res?.data || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t('errors.load_runs'));
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const onRunSubmit = async ({ year, month }) => {
    try {
      await runPayroll({ year, month });
      setPeriodPickerOpen(false);
      showToast(t('runs.toast_run_success', { period: formatPeriod(year, month) }));
      reload();
    } catch (err) {
      showToast(err?.message || t('runs.toast_run_error'), 'error');
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginBottom: 12,
        }}
      >
        {canEdit && (
          <button
            type="button"
            onClick={() => setPeriodPickerOpen(true)}
            aria-label={t('aria.run_payroll')}
            style={btnPrimary}
          >
            <Plus size={13} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
            {t('runs.action_run')}
          </button>
        )}
      </div>

      {loadError && <ErrorBanner text={loadError} />}
      {rows === null && (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>
      )}
      {rows && rows.length === 0 && !loadError && (
        <EmptyState
          icon={Wallet}
          title={t('runs.empty_title')}
          description={t('runs.empty_description')}
        />
      )}

      {rows && rows.length > 0 && (
        <div
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {/* Header row */}
          <div
            role="row"
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.8fr 1.1fr 1.1fr 1.3fr 1fr 1fr',
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
            <div>{t('runs.column_period')}</div>
            <div>{t('runs.column_status')}</div>
            <div style={{ textAlign: 'end' }}>{t('runs.column_gross')}</div>
            <div style={{ textAlign: 'end' }}>{t('runs.column_net')}</div>
            <div style={{ textAlign: 'end' }}>{t('runs.column_pifss')}</div>
            <div>{t('runs.column_processed')}</div>
            <div>{t('runs.column_approver')}</div>
          </div>

          {rows.map((row) => {
            const colors =
              RUN_STATUS_COLORS[row.status] || RUN_STATUS_COLORS.DRAFT;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setOpenRun(row)}
                aria-label={t('aria.open_run_detail', {
                  period: formatPeriod(row.periodYear, row.periodMonth),
                })}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 0.8fr 1.1fr 1.1fr 1.3fr 1fr 1fr',
                  gap: 12,
                  padding: '14px 16px',
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
                  e.currentTarget.style.background =
                    'var(--bg-surface-sunken)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  <LtrText>{formatPeriod(row.periodYear, row.periodMonth)}</LtrText>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: colors.bg,
                      color: colors.color,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {t(`runs.status_${row.status.toLowerCase()}`)}
                  </span>
                </div>
                <div
                  style={{
                    textAlign: 'end',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  <LtrText>{formatKwd(row.totalGross)}</LtrText>
                </div>
                <div
                  style={{
                    textAlign: 'end',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  <LtrText>{formatKwd(row.totalNet)}</LtrText>
                </div>
                <div
                  style={{
                    textAlign: 'end',
                    fontFamily: "'DM Mono', monospace",
                    color: 'var(--text-tertiary)',
                  }}
                >
                  <LtrText>
                    {formatKwd(row.totalPifssEmployer)} +{' '}
                    {formatKwd(row.totalPifssEmployee)}
                  </LtrText>
                </div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                  {row.processedAt ? String(row.processedAt).slice(0, 10) : '—'}
                </div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                  {row.approvedBy || '—'}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {openRun && (
        <PayrollRunDetailDrawer
          runId={openRun.id}
          initial={openRun}
          isOwner={isOwner}
          canEdit={canEdit}
          onClose={() => setOpenRun(null)}
          onUpdated={() => {
            reload();
          }}
          showToast={showToast}
          t={t}
        />
      )}

      {periodPickerOpen && (
        <PeriodPickerModal
          title={t('runs.period_picker_title')}
          confirmLabel={t('runs.period_picker_run')}
          onCancel={() => setPeriodPickerOpen(false)}
          onConfirm={onRunSubmit}
          t={t}
        />
      )}
    </div>
  );
}

// ── Payroll run detail drawer ────────────────────────────────────
function PayrollRunDetailDrawer({
  runId,
  initial,
  isOwner,
  canEdit,
  onClose,
  onUpdated,
  showToast,
  t,
}) {
  const [run, setRun] = useState(initial);
  const [loadError, setLoadError] = useState(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const fresh = await getPayrollRun(runId);
        if (!cancelled && fresh) setRun(fresh);
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || t('errors.load_run_detail'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const entries = run?.entries || [];

  const doApprove = async () => {
    setBusy(true);
    try {
      await approvePayroll(runId);
      showToast(t('runs.toast_approved'));
      setApproveOpen(false);
      const fresh = await getPayrollRun(runId);
      setRun(fresh || run);
      onUpdated?.();
    } catch (err) {
      showToast(err?.message || t('runs.toast_approve_error'), 'error');
    } finally {
      setBusy(false);
    }
  };
  const doPay = async () => {
    setBusy(true);
    try {
      await payPayroll(runId);
      showToast(t('runs.toast_paid'));
      setPayOpen(false);
      const fresh = await getPayrollRun(runId);
      setRun(fresh || run);
      onUpdated?.();
    } catch (err) {
      showToast(err?.message || t('runs.toast_pay_error'), 'error');
    } finally {
      setBusy(false);
    }
  };
  const doDownloadWps = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await downloadWpsFile(runId);
      // Browser-download dance. Inline helper per dispatch §4.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        filename ||
        `WPS_${run?.periodYear}_${String(run?.periodMonth || 1).padStart(2, '0')}.sif`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast(
        t('download_wps.toast_success', {
          filename: a.download,
        }),
      );
    } catch (err) {
      showToast(err?.message || t('download_wps.toast_error'), 'error');
    } finally {
      setDownloading(false);
    }
  };

  // HASEEB-221 (2026-04-22): per-employee payslip PDF download. Same
  // browser-download dance as doDownloadWps above. Row-level busy state
  // keeps one button at a time disabled without blocking the rest of
  // the drawer. 404 is the common "not approved" / "employee not in
  // run" case and surfaces a distinct i18n message.
  const [payslipBusyEmpId, setPayslipBusyEmpId] = useState(null);
  const doDownloadPayslip = async (empId) => {
    setPayslipBusyEmpId(empId);
    try {
      const { blob, filename } = await downloadPayslip(runId, empId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `payslip_${empId}_${runId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast(t('toasts.payslipDownloaded'));
    } catch (err) {
      const msg =
        err?.status === 404
          ? t('errors.payslipNotFound')
          : err?.message || t('errors.downloadPayslipFailed');
      showToast(msg, 'error');
    } finally {
      setPayslipBusyEmpId(null);
    }
  };

  const canApprove = isOwner && run?.status === 'DRAFT';
  const canPay = isOwner && run?.status === 'APPROVED';
  // WPS is written at pay-time; both APPROVED and PAID are downloadable
  // per dispatch §4 (backend allows either). OWNER + ACCOUNTANT-level
  // roles can download to submit to the bank.
  const canDownload =
    canEdit && run && (run.status === 'APPROVED' || run.status === 'PAID');
  // HASEEB-221: per-employee payslip download is available once the run
  // is APPROVED (backend enforces the same guard). Visible to Owner /
  // CFO / Senior (`canEdit`); hidden for Junior per dispatch spec even
  // though the backend admits AUDITOR role.
  const canDownloadPayslip =
    canEdit && run && (run.status === 'APPROVED' || run.status === 'PAID');

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 100,
        }}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label={t('aria.open_run_detail', {
          period: formatPeriod(run?.periodYear, run?.periodMonth),
        })}
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          insetInlineEnd: 0,
          width: 'min(960px, 90vw)',
          background: 'var(--bg-surface)',
          borderInlineStart: '1px solid var(--border-default)',
          boxShadow: '-16px 0 40px rgba(0,0,0,0.4)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.15em',
                color: 'var(--text-tertiary)',
              }}
            >
              {t('runs.column_period').toUpperCase()}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 24,
                color: 'var(--text-primary)',
                marginTop: 2,
              }}
            >
              <LtrText>{formatPeriod(run?.periodYear, run?.periodMonth)}</LtrText>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {canDownload && (
              <button
                type="button"
                onClick={doDownloadWps}
                disabled={downloading}
                aria-label={t('aria.download_wps', {
                  period: formatPeriod(run?.periodYear, run?.periodMonth),
                })}
                style={{ ...btnSecondary, opacity: downloading ? 0.6 : 1 }}
              >
                <Download size={13} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
                {downloading ? t('download_wps.preparing') : t('runs.action_download_wps')}
              </button>
            )}
            {canApprove && (
              <button
                type="button"
                onClick={() => setApproveOpen(true)}
                disabled={busy}
                aria-label={t('aria.approve_run')}
                style={btnPrimary}
              >
                <CheckCircle2 size={13} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
                {t('runs.action_approve')}
              </button>
            )}
            {canPay && (
              <button
                type="button"
                onClick={() => setPayOpen(true)}
                disabled={busy}
                aria-label={t('aria.pay_run')}
                style={btnPrimary}
              >
                <Play size={13} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
                {t('runs.action_pay')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('aria.close_panel')}
              style={btnIcon}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loadError && <ErrorBanner text={loadError} />}

          {/* Metadata row */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 24,
              marginBottom: 16,
              fontSize: 11,
              color: 'var(--text-tertiary)',
            }}
          >
            <div>
              {t('runs.detail.processed_by')}:{' '}
              <span style={{ color: 'var(--text-secondary)' }}>
                {run?.processedBy || '—'}
              </span>
            </div>
            <div>
              {t('runs.detail.approved_by')}:{' '}
              <span style={{ color: 'var(--text-secondary)' }}>
                {run?.approvedBy || '—'}
              </span>
            </div>
            {run?.journalEntryId && (
              <div>
                {t('runs.detail.journal_entry_label')}:{' '}
                <LtrText>
                  <span
                    style={{
                      color: 'var(--text-secondary)',
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {run.journalEntryId}
                  </span>
                </LtrText>
              </div>
            )}
            {run?.paidAt && (
              <div>
                {t('runs.detail.paid_at')}:{' '}
                <span style={{ color: 'var(--text-secondary)' }}>
                  {String(run.paidAt).slice(0, 10)}
                </span>
              </div>
            )}
          </div>

          {/* Entries table */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
              marginBottom: 8,
            }}
          >
            {t('runs.detail.heading_entries')}
          </div>
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
                gridTemplateColumns: canDownloadPayslip
                  ? '1.6fr 0.8fr 0.8fr 0.8fr 1fr 1fr 0.8fr 1fr 0.8fr 1fr'
                  : '1.6fr 0.8fr 0.8fr 0.8fr 1fr 1fr 0.8fr 1fr 0.8fr',
                gap: 10,
                padding: '10px 14px',
                background: 'var(--bg-surface-sunken)',
                borderBottom: '1px solid var(--border-default)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: 'var(--text-tertiary)',
              }}
            >
              <div>{t('runs.detail.column_employee')}</div>
              <div style={{ textAlign: 'end' }}>{t('runs.detail.column_basic')}</div>
              <div style={{ textAlign: 'end' }}>{t('runs.detail.column_allowances')}</div>
              <div style={{ textAlign: 'end' }}>{t('runs.detail.column_gross')}</div>
              <div style={{ textAlign: 'end' }}>{t('runs.detail.column_pifss_employee')}</div>
              <div style={{ textAlign: 'end' }}>{t('runs.detail.column_pifss_employer')}</div>
              <div style={{ textAlign: 'end' }}>{t('runs.detail.column_deductions')}</div>
              <div style={{ textAlign: 'end' }}>{t('runs.detail.column_net')}</div>
              <div>{t('runs.detail.column_flags')}</div>
              {canDownloadPayslip && <div />}
            </div>
            {entries.map((e) => {
              const nonKuwaiti = !e.employee?.isKuwaiti;
              const warnings = Array.isArray(e.warnings) ? e.warnings : [];
              const empName =
                e.employee?.nameEn || e.employee?.nameAr || e.employeeId;
              const isPayslipBusy = payslipBusyEmpId === e.employeeId;
              return (
                <div
                  key={e.id || e.employeeId}
                  role="row"
                  data-testid={`payroll-entry-row-${e.employeeId}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: canDownloadPayslip
                      ? '1.6fr 0.8fr 0.8fr 0.8fr 1fr 1fr 0.8fr 1fr 0.8fr 1fr'
                      : '1.6fr 0.8fr 0.8fr 0.8fr 1fr 1fr 0.8fr 1fr 0.8fr',
                    gap: 10,
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 12,
                    color: 'var(--text-primary)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {e.employee?.nameEn || e.employee?.nameAr || e.employeeId}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: nonKuwaiti
                          ? 'var(--semantic-warning)'
                          : 'var(--text-tertiary)',
                        marginTop: 2,
                      }}
                    >
                      {nonKuwaiti
                        ? t('employees.nationality_non_kuwaiti')
                        : t('employees.nationality_kuwaiti')}
                    </div>
                  </div>
                  <div
                    style={{
                      textAlign: 'end',
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    <LtrText>{formatKwd(e.basicSalary)}</LtrText>
                  </div>
                  <div
                    style={{
                      textAlign: 'end',
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    <LtrText>{formatKwd(e.allowances)}</LtrText>
                  </div>
                  <div
                    style={{
                      textAlign: 'end',
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    <LtrText>{formatKwd(e.grossSalary)}</LtrText>
                  </div>
                  <div
                    style={{
                      textAlign: 'end',
                      fontFamily: "'DM Mono', monospace",
                      color: nonKuwaiti
                        ? 'var(--text-tertiary)'
                        : 'var(--text-primary)',
                    }}
                    title={
                      nonKuwaiti ? t('runs.detail.na_non_kuwaiti_tooltip') : undefined
                    }
                  >
                    {nonKuwaiti ? t('dash') : <LtrText>{formatKwd(e.pifssEmployee)}</LtrText>}
                  </div>
                  <div
                    style={{
                      textAlign: 'end',
                      fontFamily: "'DM Mono', monospace",
                      color: nonKuwaiti
                        ? 'var(--text-tertiary)'
                        : 'var(--text-primary)',
                    }}
                    title={
                      nonKuwaiti ? t('runs.detail.na_non_kuwaiti_tooltip') : undefined
                    }
                  >
                    {nonKuwaiti ? t('dash') : <LtrText>{formatKwd(e.pifssEmployer)}</LtrText>}
                  </div>
                  <div
                    style={{
                      textAlign: 'end',
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    <LtrText>{formatKwd(e.otherDeductions)}</LtrText>
                  </div>
                  <div
                    style={{
                      textAlign: 'end',
                      fontFamily: "'DM Mono', monospace",
                      fontWeight: 600,
                    }}
                  >
                    <LtrText>{formatKwd(e.netSalary)}</LtrText>
                  </div>
                  <div>
                    {warnings.length > 0 && (
                      <span
                        title={warnings.map((w) => w.message || w).join('\n')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          padding: '2px 6px',
                          borderRadius: 10,
                          color: 'var(--semantic-warning)',
                          background: 'var(--semantic-warning-subtle)',
                          border: '1px solid var(--semantic-warning)',
                        }}
                      >
                        <AlertTriangle size={11} />
                        {t('runs.detail.warning_badge')}
                      </span>
                    )}
                  </div>
                  {canDownloadPayslip && (
                    <div style={{ textAlign: 'end' }}>
                      <button
                        type="button"
                        onClick={() => doDownloadPayslip(e.employeeId)}
                        disabled={isPayslipBusy}
                        aria-label={t('aria.download_payslip', { name: empName })}
                        data-testid={`download-payslip-${e.employeeId}`}
                        style={{
                          ...btnMini,
                          opacity: isPayslipBusy ? 0.6 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Download size={11} aria-hidden="true" />
                        {t('actions.downloadPayslip')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div
            style={{
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {[
              { label: t('runs.detail.total_gross'), value: run?.totalGross },
              { label: t('runs.detail.total_deductions'), value: run?.totalDeductions },
              { label: t('runs.detail.total_net'), value: run?.totalNet, strong: true },
              {
                label: t('runs.detail.total_pifss_employee'),
                value: run?.totalPifssEmployee,
              },
              {
                label: t('runs.detail.total_pifss_employer'),
                value: run?.totalPifssEmployer,
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface-sunken)',
                  border: '1px solid var(--border-subtle)',
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
                  {card.label}
                </div>
                <div
                  style={{
                    fontSize: card.strong ? 18 : 15,
                    fontWeight: card.strong ? 700 : 600,
                    color: 'var(--text-primary)',
                    fontFamily: "'DM Mono', monospace",
                    marginTop: 4,
                  }}
                >
                  <LtrText>
                    {t('currency_kwd')} {formatKwd(card.value)}
                  </LtrText>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {approveOpen && (
        <ConfirmModal
          title={t('runs.confirm_approve_title')}
          description={t('runs.confirm_approve_description')}
          confirmLabel={t('runs.confirm_approve_confirm')}
          onConfirm={doApprove}
          onCancel={() => setApproveOpen(false)}
          busy={busy}
          t={t}
        />
      )}
      {payOpen && (
        <ConfirmModal
          title={t('runs.confirm_pay_title')}
          description={t('runs.confirm_pay_description')}
          confirmLabel={t('runs.confirm_pay_confirm')}
          onConfirm={doPay}
          onCancel={() => setPayOpen(false)}
          busy={busy}
          t={t}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// Employees tab
// ══════════════════════════════════════════════════════════════════
function EmployeesTab({ canEdit, showToast, t }) {
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [loadError, setLoadError] = useState(null);
  const [openEmp, setOpenEmp] = useState(null);

  const reload = async () => {
    setLoadError(null);
    try {
      const res = await listEmployees({
        search: search.trim() || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setRows(res?.data || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t('errors.load_employees'));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('employees.search_placeholder')}
          aria-label={t('employees.search_placeholder')}
          style={{
            flex: '1 1 280px',
            minWidth: 240,
            padding: '8px 12px',
            background: 'var(--bg-surface-sunken)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            fontSize: 12,
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'ALL', label: t('employees.status_filter_all') },
            { key: 'ACTIVE', label: t('employees.status_filter_active') },
            { key: 'TERMINATED', label: t('employees.status_filter_terminated') },
          ].map((f) => {
            const on = statusFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                style={{
                  ...btnMini,
                  background: on ? 'var(--accent-primary-subtle)' : 'transparent',
                  borderColor: on
                    ? 'var(--accent-primary-border)'
                    : 'var(--border-strong)',
                  color: on
                    ? 'var(--accent-primary)'
                    : 'var(--text-secondary)',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        {canEdit && (
          <button type="button" style={btnSecondary} disabled title={t('employees.action_create')}>
            <Plus size={13} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
            {t('employees.action_create')}
          </button>
        )}
      </div>

      {loadError && <ErrorBanner text={loadError} />}
      {rows === null && (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>
      )}
      {rows && rows.length === 0 && !loadError && (
        <EmptyState
          icon={Users}
          title={t('employees.empty_title')}
          description={t('employees.empty_description')}
        />
      )}

      {rows && rows.length > 0 && (
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
              gridTemplateColumns: '1.6fr 0.9fr 0.9fr 1.2fr 1fr 0.8fr',
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
            <div>{t('employees.column_employee')}</div>
            <div>{t('employees.column_civil_id')}</div>
            <div>{t('employees.column_nationality')}</div>
            <div>{t('employees.column_position')}</div>
            <div style={{ textAlign: 'end' }}>{t('employees.column_salary')}</div>
            <div>{t('employees.column_status')}</div>
          </div>
          {rows.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setOpenEmp(e)}
              aria-label={t('aria.open_employee_detail', { name: e.nameEn })}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.6fr 0.9fr 0.9fr 1.2fr 1fr 0.8fr',
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
              onMouseEnter={(ev) => {
                ev.currentTarget.style.background =
                  'var(--bg-surface-sunken)';
              }}
              onMouseLeave={(ev) => {
                ev.currentTarget.style.background = 'transparent';
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{e.nameEn}</div>
                {e.nameAr && (
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      marginTop: 2,
                    }}
                  >
                    {e.nameAr}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  color: 'var(--text-tertiary)',
                }}
              >
                <LtrText>{maskCivilId(e.civilId)}</LtrText>
              </div>
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: e.isKuwaiti
                      ? 'var(--accent-primary-subtle)'
                      : 'var(--bg-surface-sunken)',
                    color: e.isKuwaiti
                      ? 'var(--accent-primary)'
                      : 'var(--text-secondary)',
                    border: `1px solid ${
                      e.isKuwaiti
                        ? 'var(--accent-primary-border)'
                        : 'var(--border-strong)'
                    }`,
                  }}
                >
                  {e.isKuwaiti
                    ? t('employees.nationality_kuwaiti')
                    : t('employees.nationality_non_kuwaiti')}
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>{e.position || '—'}</div>
              <div
                style={{
                  textAlign: 'end',
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                <LtrText>
                  {t('currency_kwd')} {formatKwd(e.basicSalary)}
                </LtrText>
              </div>
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    padding: '2px 8px',
                    borderRadius: 10,
                    color:
                      e.status === 'ACTIVE'
                        ? 'var(--accent-primary)'
                        : 'var(--text-tertiary)',
                    background:
                      e.status === 'ACTIVE'
                        ? 'var(--accent-primary-subtle)'
                        : 'var(--bg-surface-sunken)',
                    border: `1px solid ${
                      e.status === 'ACTIVE'
                        ? 'var(--accent-primary-border)'
                        : 'var(--border-strong)'
                    }`,
                  }}
                >
                  {e.status === 'ACTIVE'
                    ? t('employees.status_active')
                    : t('employees.status_terminated')}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {openEmp && (
        <EmployeeDetailSlideOver
          emp={openEmp}
          onClose={() => setOpenEmp(null)}
          t={t}
        />
      )}
    </div>
  );
}

// ── Employee detail slide-over ───────────────────────────────────
function EmployeeDetailSlideOver({ emp, onClose, t }) {
  const [detail, setDetail] = useState(emp);
  const [eos, setEos] = useState(null);
  const [history, setHistory] = useState(null);
  const [advances, setAdvances] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const [d, e, h, a] = await Promise.all([
          getEmployee(emp.id).catch(() => null),
          getEmployeeEos(emp.id).catch(() => null),
          getEmployeeEosHistory(emp.id).catch(() => null),
          getEmployeeAdvances(emp.id).catch(() => null),
        ]);
        if (cancelled) return;
        if (d) setDetail(d);
        setEos(e);
        setHistory(h);
        setAdvances(a);
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || t('errors.load_employee_detail'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [emp.id]);

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 100,
        }}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label={t('aria.open_employee_detail', { name: detail?.nameEn })}
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          insetInlineEnd: 0,
          width: 'min(640px, 90vw)',
          background: 'var(--bg-surface)',
          borderInlineStart: '1px solid var(--border-default)',
          boxShadow: '-16px 0 40px rgba(0,0,0,0.4)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.15em',
                color: 'var(--text-tertiary)',
              }}
            >
              {detail?.employeeNumber}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: 'var(--text-primary)',
                marginTop: 2,
              }}
            >
              {detail?.nameEn}
            </div>
            {detail?.nameAr && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  marginTop: 2,
                }}
              >
                {detail.nameAr}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('aria.close_panel')}
            style={btnIcon}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loadError && <ErrorBanner text={loadError} />}

          {/* Key facts */}
          <KeyFactsGrid
            t={t}
            facts={[
              { label: t('employees.detail.civil_id_label'), value: maskCivilId(detail?.civilId) },
              { label: t('employees.column_nationality'), value: detail?.isKuwaiti ? t('employees.nationality_kuwaiti') : t('employees.nationality_non_kuwaiti') },
              { label: t('employees.column_position'), value: detail?.position || '—' },
              { label: t('employees.detail.hire_date'), value: detail?.hireDate || '—' },
              { label: t('employees.detail.iban_label'), value: detail?.bankAccountIban || '—' },
              detail?.status === 'TERMINATED'
                ? { label: t('employees.detail.termination_date'), value: detail?.terminationDate || '—' }
                : null,
            ].filter(Boolean)}
          />

          {/* EOS */}
          <SectionHeading text={t('employees.detail.heading_eos')} />
          {eos ? (
            <KeyFactsGrid
              t={t}
              facts={[
                { label: t('employees.detail.eos_years_of_service'), value: String(eos.yearsOfService ?? '—') },
                { label: t('employees.detail.eos_daily_rate'), value: `${t('currency_kwd')} ${formatKwd(eos.dailyRate)}` },
                { label: t('employees.detail.eos_total'), value: `${t('currency_kwd')} ${formatKwd(eos.totalEos)}` },
                { label: t('employees.detail.eos_accrued'), value: `${t('currency_kwd')} ${formatKwd(eos.accruedToDate)}` },
              ]}
            />
          ) : (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>
          )}

          {/* EOS history */}
          <SectionHeading text={t('employees.detail.heading_eos_history')} />
          {history && Array.isArray(history.events) && history.events.length > 0 ? (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {history.events.map((ev, i) => (
                <li
                  key={ev.id || i}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-surface-sunken)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <LtrText>{String(ev.occurredAt || ev.date || '').slice(0, 10)}</LtrText>{' '}
                  · {ev.type || ev.kind || ''}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
              {t('employees.detail.empty_eos_history')}
            </div>
          )}

          {/* Advances */}
          <SectionHeading text={t('employees.detail.heading_advances')} />
          {advances && Array.isArray(advances.advances) && advances.advances.length > 0 ? (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {advances.advances.map((a, i) => (
                <li
                  key={a.id || i}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-surface-sunken)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{a.purpose || a.reason || '—'}</span>
                  <LtrText>
                    {t('currency_kwd')} {formatKwd(a.balance || a.amount)}
                  </LtrText>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
              {t('employees.detail.empty_advances')}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// PIFSS tab
// ══════════════════════════════════════════════════════════════════
function PifssTab({ isOwner, canEdit, showToast, t }) {
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);

  const reload = async () => {
    setLoadError(null);
    try {
      const res = await listPifssSubmissions({});
      setRows(res?.data || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t('errors.load_pifss'));
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const onGenerate = async ({ year, month }) => {
    try {
      await generatePifssFile(year, month);
      setPeriodPickerOpen(false);
      showToast(t('pifss.toast_generated', { period: formatPeriod(year, month) }));
      reload();
    } catch (err) {
      showToast(err?.message || t('pifss.toast_generate_error'), 'error');
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginBottom: 12,
        }}
      >
        {canEdit && (
          <button
            type="button"
            onClick={() => setPeriodPickerOpen(true)}
            aria-label={t('aria.generate_pifss')}
            style={btnPrimary}
          >
            <Plus size={13} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
            {t('pifss.action_generate')}
          </button>
        )}
      </div>

      {loadError && <ErrorBanner text={loadError} />}
      {rows === null && (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>
      )}
      {rows && rows.length === 0 && !loadError && (
        <EmptyState
          icon={FileSpreadsheet}
          title={t('pifss.empty_title')}
          description={t('pifss.empty_description')}
        />
      )}
      {rows && rows.length > 0 && (
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
              gridTemplateColumns: '1fr 0.8fr 1.2fr 0.8fr 1fr 1.3fr 1fr',
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
            <div>{t('pifss.column_period')}</div>
            <div>{t('pifss.column_status')}</div>
            <div>{t('pifss.column_file')}</div>
            <div style={{ textAlign: 'end' }}>
              {t('pifss.column_total_employees')}
            </div>
            <div style={{ textAlign: 'end' }}>
              {t('pifss.column_total_pifss')}
            </div>
            <div>{t('pifss.column_portal_reference')}</div>
            <div>{t('pifss.column_submitted')}</div>
          </div>
          {rows.map((row) => {
            const colors =
              PIFSS_STATUS_COLORS[row.status] || PIFSS_STATUS_COLORS.GENERATED;
            return (
              <div
                key={row.id}
                role="row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 0.8fr 1.2fr 0.8fr 1fr 1.3fr 1fr',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
              >
                <div>
                  <LtrText>{formatPeriod(row.year, row.month)}</LtrText>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: colors.bg,
                      color: colors.color,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {t(`pifss.status_${row.status.toLowerCase()}`)}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <LtrText>{row.fileName || '—'}</LtrText>
                </div>
                <div
                  style={{
                    textAlign: 'end',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  <LtrText>{row.totalEmployees ?? '—'}</LtrText>
                </div>
                <div
                  style={{
                    textAlign: 'end',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  <LtrText>
                    {formatKwd(
                      Number(row.totalPifssEmployee || 0) +
                        Number(row.totalPifssEmployer || 0),
                    )}
                  </LtrText>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: 'var(--text-tertiary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <LtrText>{row.portalReference || '—'}</LtrText>
                </div>
                <div style={{ color: 'var(--text-tertiary)' }}>
                  {row.submittedAt ? String(row.submittedAt).slice(0, 10) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {periodPickerOpen && (
        <PeriodPickerModal
          title={t('pifss.confirm_generate_title')}
          confirmLabel={t('pifss.confirm_generate_confirm')}
          description={t('pifss.confirm_generate_description')}
          onCancel={() => setPeriodPickerOpen(false)}
          onConfirm={onGenerate}
          t={t}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Shared sub-components
// ══════════════════════════════════════════════════════════════════
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

function SectionHeading({ text }) {
  return (
    <div
      style={{
        marginTop: 20,
        marginBottom: 10,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: 'var(--text-tertiary)',
      }}
    >
      {text}
    </div>
  );
}

function KeyFactsGrid({ facts, t }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 10,
      }}
    >
      {facts.map((f) => (
        <div
          key={f.label}
          style={{
            padding: '8px 12px',
            background: 'var(--bg-surface-sunken)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
            }}
          >
            {f.label}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              marginTop: 3,
              wordBreak: 'break-word',
            }}
          >
            {f.value ?? t('dash')}
          </div>
        </div>
      ))}
    </div>
  );
}

function PeriodPickerModal({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  t,
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [busy, setBusy] = useState(false);

  const years = useMemo(() => {
    const y = now.getUTCFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm({ year, month });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: '92vw',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: 22,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
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
        {description && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            {description}
          </div>
        )}
        <div
          style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <label
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {t('runs.period_picker_year')}
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={inputSelect}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {t('runs.period_picker_month')}
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={inputSelect}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button type="button" onClick={onCancel} style={btnSecondary}>
            {t('runs.period_picker_cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  t,
}) {
  return (
    <div
      role="dialog"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: '92vw',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: 22,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
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
        {description && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            {description}
          </div>
        )}
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button type="button" onClick={onCancel} style={btnSecondary}>
            {t('runs.period_picker_cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── shared styles ──────────────────────────────────────────────────
const btnPrimary = {
  background: 'var(--accent-primary)',
  color: '#fff',
  border: 'none',
  padding: '9px 16px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
};
const btnSecondary = {
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-strong)',
  padding: '8px 14px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'inherit',
  fontWeight: 600,
};
const btnMini = {
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-strong)',
  padding: '6px 12px',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'inherit',
  fontWeight: 600,
};
const btnIcon = {
  background: 'transparent',
  color: 'var(--text-tertiary)',
  border: '1px solid var(--border-strong)',
  padding: 6,
  borderRadius: 6,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const inputSelect = {
  background: 'var(--bg-surface-sunken)',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  padding: '8px 10px',
  fontFamily: 'inherit',
  fontSize: 12,
};
