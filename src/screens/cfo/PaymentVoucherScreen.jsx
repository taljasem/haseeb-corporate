/**
 * PaymentVoucherScreen — AUDIT-ACC-002 (2026-04-22).
 *
 * Primary surface for the FN-274 vendor / employee payment workflow.
 * Renders three views driven by internal state:
 *
 *   1. LIST   — 4 filter tabs + data grid. Tabs bucket the 8 voucher
 *               statuses:
 *                 - Drafts              → DRAFT
 *                 - Awaiting Action     → PENDING_REVIEW +
 *                                         PENDING_APPROVAL +
 *                                         PENDING_SIGNATORIES
 *                 - Approved or Signed  → APPROVED
 *                 - Terminal            → PAID + REJECTED + CANCELLED
 *   2. COMPOSER — single-beneficiary form (HASEEB-209 scope cut per
 *               Tarek 2026-04-22). beneficiaryType → beneficiaryId →
 *               amountKwd → paymentMethod → mandate → issueDate →
 *               description. Mandate selection surfaces required-
 *               signatory-count inline + banner when cheque + Σcount<2
 *               (HASEEB-274 two-signatory compliance surface).
 *   3. DETAIL — header + key facts + signatory progress block (3 tiles:
 *               Required / Assigned / Signed) when status is
 *               PENDING_SIGNATORIES on a cheque voucher, + lifecycle
 *               timeline (audit surface sourced from the voucher row's
 *               per-stage timestamps + actors — the backend response
 *               does not expose a separate audit-entry array, so the
 *               timeline is rendered from those canonical fields), +
 *               role-gated action bar.
 *
 * Role gating (Junior read-only):
 *   - Junior (VIEWER / AUDITOR): list + detail, zero mutation buttons.
 *   - Owner / CFO / Senior: composer button + lifecycle actions, subject
 *     to backend SoD enforcement (`preparedBy ≠ reviewedBy ≠
 *     approvedBy`). The Review button hides when `preparedBy ===
 *     currentUserId` as a defense-in-depth client check (backend 403s
 *     regardless), and Approve hides when `reviewedBy === currentUserId`.
 *   - Cancel post-APPROVED is Owner-only per backend service; the
 *     detail surface hides it for CFO/Senior in that state.
 *
 * Payment-method branch (backend behavior mirrored client-side for
 * progressive disclosure):
 *   - CHEQUE_IMMEDIATE / CHEQUE_POST_DATED → approve takes the voucher
 *     to PENDING_SIGNATORIES + auto-creates a linked FN-228 Cheque
 *     (voucher.chequeId). The signatory progress block renders.
 *   - BANK_TRANSFER_KNET / CASH → approve goes straight to APPROVED;
 *     no cheque, no signatory block.
 *
 * Wall preservation: frontend never calls an LLM or writes outside the
 * backend. All mutations go through engine wrappers
 * (src/engine/index.js → src/api/paymentVouchers.js /
 * src/api/bankMandates.js).
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FilePlus,
  ArrowLeft,
  X,
  AlertTriangle,
  CheckCircle2,
  Send,
  ShieldCheck,
  Ban,
  PenLine,
  PencilLine,
  UserCheck,
  Wallet,
  ChevronRight,
} from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import LtrText from '../../components/shared/LtrText';
import { normalizeRole, canEditAdmin, ROLES } from '../../utils/role';
import {
  listVouchers,
  getVoucher,
  createVoucher,
  submitVoucher,
  reviewVoucher,
  approveVoucher,
  assignSignatories,
  signVoucher,
  markVoucherPaid,
  rejectVoucher,
  cancelVoucher,
  listMandates,
  getMandate,
} from '../../engine';

// ── Constants ─────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { key: 'CHEQUE_IMMEDIATE', labelKey: 'payment_method.cheque_immediate' },
  { key: 'CHEQUE_POST_DATED', labelKey: 'payment_method.cheque_post_dated' },
  { key: 'BANK_TRANSFER_KNET', labelKey: 'payment_method.bank_transfer_knet' },
  { key: 'CASH', labelKey: 'payment_method.cash' },
];
const BENEFICIARY_TYPES = [
  { key: 'Vendor', labelKey: 'beneficiary_type.vendor' },
  { key: 'Employee', labelKey: 'beneficiary_type.employee' },
  { key: 'Other', labelKey: 'beneficiary_type.other' },
];
const CHEQUE_METHODS = new Set(['CHEQUE_IMMEDIATE', 'CHEQUE_POST_DATED']);
const METHODS_REQUIRING_MANDATE = new Set([
  'CHEQUE_IMMEDIATE',
  'CHEQUE_POST_DATED',
  'BANK_TRANSFER_KNET',
]);

const STATUS_TONE = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  PENDING_APPROVAL: 'warning',
  PENDING_SIGNATORIES: 'warning',
  APPROVED: 'info',
  PAID: 'success',
  REJECTED: 'danger',
  CANCELLED: 'danger',
};

const TAB_KEYS = ['drafts', 'awaiting_action', 'approved', 'terminal'];
const TAB_STATUSES = {
  drafts: new Set(['DRAFT']),
  awaiting_action: new Set([
    'PENDING_REVIEW',
    'PENDING_APPROVAL',
    'PENDING_SIGNATORIES',
  ]),
  approved: new Set(['APPROVED']),
  terminal: new Set(['PAID', 'REJECTED', 'CANCELLED']),
};

const KWD_AMOUNT_RE = /^\d+(\.\d{1,3})?$/;

// ── Helpers ───────────────────────────────────────────────────────
function formatKwd(value) {
  if (value == null) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function isoSlice(ts) {
  if (!ts) return '—';
  return String(ts).slice(0, 10);
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

function sumRequiredSignatories(mandate) {
  const requires = mandate?.mandateRules?.requires;
  if (!Array.isArray(requires)) return 0;
  return requires.reduce((acc, r) => acc + Number(r?.count || 0), 0);
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

// ── Error banner ──────────────────────────────────────────────────
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
// PaymentVoucherScreen
// ══════════════════════════════════════════════════════════════════

export default function PaymentVoucherScreen({ role = 'CFO', currentUserId = 'user-cfo-1' }) {
  const { t } = useTranslation('paymentVouchers');
  const normalizedRole = normalizeRole(role);
  const isOwner = normalizedRole === ROLES.OWNER;
  const canEdit = isOwner || canEditAdmin(role);
  const [view, setView] = useState('list'); // 'list' | 'composer' | 'detail'
  const [activeTab, setActiveTab] = useState('drafts');
  const [selectedVoucherId, setSelectedVoucherId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (text, tone = 'success') => setToast({ text, tone });

  const openDetail = (id) => {
    setSelectedVoucherId(id);
    setView('detail');
  };
  const openComposer = () => {
    setSelectedVoucherId(null);
    setView('composer');
  };
  const backToList = () => {
    setSelectedVoucherId(null);
    setView('list');
  };

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
          {view === 'list' && canEdit && (
            <button
              type="button"
              onClick={openComposer}
              aria-label={t('aria.new_voucher')}
              style={btnPrimary}
            >
              <FilePlus size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
              {t('list.action_new')}
            </button>
          )}
          {view !== 'list' && (
            <button
              type="button"
              onClick={backToList}
              aria-label={t('detail.back_to_list')}
              style={btnSecondary}
            >
              <ArrowLeft size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
              {t('detail.back_to_list')}
            </button>
          )}
        </div>

        {view === 'list' && (
          <ListView
            t={t}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onOpenDetail={openDetail}
          />
        )}
        {view === 'composer' && (
          <ComposerView
            t={t}
            onCancel={backToList}
            onCreated={(created) => {
              showToast(t('toast.created'));
              if (created?.id) openDetail(created.id);
              else backToList();
            }}
            onError={(msg) => showToast(msg || t('toast.error_generic'), 'error')}
          />
        )}
        {view === 'detail' && selectedVoucherId && (
          <DetailView
            t={t}
            voucherId={selectedVoucherId}
            role={normalizedRole}
            isOwner={isOwner}
            canEdit={canEdit}
            currentUserId={currentUserId}
            showToast={showToast}
            onBack={backToList}
          />
        )}
      </div>

      <Toast text={toast?.text} tone={toast?.tone} onClear={() => setToast(null)} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// List view
// ══════════════════════════════════════════════════════════════════

function ListView({ t, activeTab, setActiveTab, onOpenDetail }) {
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reload = async () => {
    setLoadError(null);
    try {
      const res = await listVouchers({});
      setRows(res?.rows || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t('toast.error_load'));
    }
  };
  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const allowed = TAB_STATUSES[activeTab];
    return rows.filter((r) => allowed.has(r.status));
  }, [rows, activeTab]);

  return (
    <div>
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
        {TAB_KEYS.map((key) => {
          const on = activeTab === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={on}
              onClick={() => setActiveTab(key)}
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
              {t(`tabs.${key}`)}
            </button>
          );
        })}
      </div>

      {loadError && <ErrorBanner text={loadError} />}
      {rows === null && (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>
      )}
      {rows && filtered && filtered.length === 0 && !loadError && (
        <EmptyState
          icon={Wallet}
          title={t('list.empty_title')}
          description={t('list.empty_description')}
        />
      )}

      {rows && filtered && filtered.length > 0 && (
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
              gridTemplateColumns: '1fr 1.6fr 1fr 1.1fr 1.1fr 0.9fr 40px',
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
            <div>{t('list.column_voucher_number')}</div>
            <div>{t('list.column_beneficiary')}</div>
            <div style={{ textAlign: 'end' }}>{t('list.column_amount')}</div>
            <div>{t('list.column_status')}</div>
            <div>{t('list.column_method')}</div>
            <div>{t('list.column_issue_date')}</div>
            <div />
          </div>
          {filtered.map((v) => {
            const tone = toneStyle(STATUS_TONE[v.status]);
            return (
              <button
                key={v.id}
                type="button"
                data-testid={`voucher-row-${v.id}`}
                onClick={() => onOpenDetail(v.id)}
                aria-label={t('aria.open_voucher_detail', { number: v.voucherNumber })}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.6fr 1fr 1.1fr 1.1fr 0.9fr 40px',
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
                    fontWeight: 600,
                  }}
                >
                  <LtrText>{v.voucherNumber}</LtrText>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {v.beneficiaryNameSnapshot}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      marginTop: 2,
                    }}
                  >
                    {t(`beneficiary_type.${v.beneficiaryType.toLowerCase()}`)}
                  </div>
                </div>
                <div
                  style={{
                    textAlign: 'end',
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 600,
                  }}
                >
                  <LtrText>{formatKwd(v.amountKwd)}</LtrText>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: tone.bg,
                      color: tone.color,
                      border: `1px solid ${tone.border}`,
                    }}
                  >
                    {t(`status.${v.status.toLowerCase()}`)}
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {t(`payment_method.${v.paymentMethod.toLowerCase()}`)}
                </div>
                <div
                  style={{
                    color: 'var(--text-tertiary)',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  <LtrText>{isoSlice(v.issueDate)}</LtrText>
                </div>
                <div
                  style={{
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'end',
                  }}
                >
                  <ChevronRight size={14} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Composer view
// ══════════════════════════════════════════════════════════════════

function ComposerView({ t, onCancel, onCreated, onError }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState({
    beneficiaryType: 'Vendor',
    beneficiaryId: '',
    beneficiaryNameSnapshot: '',
    amountKwd: '',
    paymentMethod: 'CHEQUE_IMMEDIATE',
    issueDate: today,
    description: '',
    bankAccountMandateId: '',
  });
  const [mandates, setMandates] = useState(null);
  const [mandateDetail, setMandateDetail] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Load ACTIVE mandates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listMandates({ status: 'ACTIVE' });
        if (!cancelled) setMandates(res?.rows || []);
      } catch {
        if (!cancelled) setMandates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When a mandate is picked, fetch its detail for rule-count display.
  useEffect(() => {
    let cancelled = false;
    if (!form.bankAccountMandateId) {
      setMandateDetail(null);
      return undefined;
    }
    (async () => {
      try {
        const d = await getMandate(form.bankAccountMandateId);
        if (!cancelled) setMandateDetail(d);
      } catch {
        if (!cancelled) setMandateDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.bankAccountMandateId]);

  const requiredCount = sumRequiredSignatories(mandateDetail);
  const isCheque = CHEQUE_METHODS.has(form.paymentMethod);
  const showLowSigBanner =
    isCheque && mandateDetail && requiredCount > 0 && requiredCount < 2;
  const methodRequiresMandate = METHODS_REQUIRING_MANDATE.has(form.paymentMethod);
  const showMandateRequired =
    methodRequiresMandate && !form.bankAccountMandateId;

  const validate = () => {
    const errors = {};
    if (!form.beneficiaryId.trim()) errors.beneficiaryId = true;
    if (!form.beneficiaryNameSnapshot.trim()) errors.beneficiaryNameSnapshot = true;
    if (!KWD_AMOUNT_RE.test(form.amountKwd) || Number(form.amountKwd) <= 0) {
      errors.amountKwd = true;
    }
    if (!form.issueDate) errors.issueDate = true;
    if (methodRequiresMandate && !form.bankAccountMandateId) {
      errors.bankAccountMandateId = true;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async () => {
    setSubmitError(null);
    if (!validate()) {
      setSubmitError(t('composer.error_validation'));
      return;
    }
    setBusy(true);
    try {
      const created = await createVoucher({
        beneficiaryType: form.beneficiaryType,
        beneficiaryId: form.beneficiaryId.trim(),
        beneficiaryNameSnapshot: form.beneficiaryNameSnapshot.trim(),
        amountKwd: form.amountKwd,
        paymentMethod: form.paymentMethod,
        issueDate: form.issueDate,
        description: form.description?.trim() || null,
        bankAccountMandateId: form.bankAccountMandateId || null,
      });
      onCreated?.(created);
    } catch (err) {
      setSubmitError(err?.message || t('composer.error_generic'));
      onError?.(err?.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 22,
          color: 'var(--text-primary)',
        }}
      >
        {t('composer.heading_new')}
      </div>

      {submitError && <ErrorBanner text={submitError} />}

      {/* Beneficiary type + id + name */}
      <div style={gridTwoCol}>
        <LabeledField label={t('beneficiary_type.label')}>
          <select
            value={form.beneficiaryType}
            onChange={(e) => setForm({ ...form, beneficiaryType: e.target.value })}
            style={inputSelect}
            aria-label={t('beneficiary_type.label')}
          >
            {BENEFICIARY_TYPES.map((b) => (
              <option key={b.key} value={b.key}>
                {t(b.labelKey)}
              </option>
            ))}
          </select>
        </LabeledField>
        <LabeledField
          label={t('composer.field_beneficiary_id')}
          invalid={!!fieldErrors.beneficiaryId}
        >
          <input
            type="text"
            value={form.beneficiaryId}
            onChange={(e) => setForm({ ...form, beneficiaryId: e.target.value })}
            placeholder={t('composer.field_beneficiary_id_placeholder')}
            style={inputText}
            aria-invalid={!!fieldErrors.beneficiaryId}
          />
        </LabeledField>
      </div>

      <LabeledField
        label={t('composer.field_beneficiary_name')}
        invalid={!!fieldErrors.beneficiaryNameSnapshot}
      >
        <input
          type="text"
          value={form.beneficiaryNameSnapshot}
          onChange={(e) =>
            setForm({ ...form, beneficiaryNameSnapshot: e.target.value })
          }
          placeholder={t('composer.field_beneficiary_name_placeholder')}
          style={inputText}
          aria-invalid={!!fieldErrors.beneficiaryNameSnapshot}
        />
      </LabeledField>

      {/* Amount + issue date */}
      <div style={gridTwoCol}>
        <LabeledField
          label={t('composer.field_amount')}
          hint={t('composer.field_amount_hint')}
          invalid={!!fieldErrors.amountKwd}
          errorText={fieldErrors.amountKwd ? t('composer.field_amount_error') : null}
        >
          <input
            type="text"
            inputMode="decimal"
            value={form.amountKwd}
            onChange={(e) => setForm({ ...form, amountKwd: e.target.value })}
            placeholder={t('composer.field_amount_placeholder')}
            style={{ ...inputText, fontFamily: "'DM Mono', monospace" }}
            aria-invalid={!!fieldErrors.amountKwd}
          />
        </LabeledField>
        <LabeledField label={t('composer.field_issue_date')} invalid={!!fieldErrors.issueDate}>
          <input
            type="date"
            value={form.issueDate}
            onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
            style={inputText}
            aria-invalid={!!fieldErrors.issueDate}
          />
        </LabeledField>
      </div>

      {/* Payment method */}
      <LabeledField label={t('payment_method.label')}>
        <div
          role="radiogroup"
          aria-label={t('payment_method.label')}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
        >
          {PAYMENT_METHODS.map((m) => {
            const on = form.paymentMethod === m.key;
            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setForm({ ...form, paymentMethod: m.key })}
                style={{
                  padding: '8px 14px',
                  background: on ? 'var(--accent-primary-subtle)' : 'transparent',
                  color: on ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  border: `1px solid ${on ? 'var(--accent-primary-border)' : 'var(--border-strong)'}`,
                  borderRadius: 6,
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t(m.labelKey)}
              </button>
            );
          })}
        </div>
      </LabeledField>

      {/* Mandate */}
      <LabeledField
        label={t('composer.field_mandate')}
        invalid={!!fieldErrors.bankAccountMandateId}
      >
        <select
          value={form.bankAccountMandateId}
          onChange={(e) =>
            setForm({ ...form, bankAccountMandateId: e.target.value })
          }
          style={inputSelect}
          aria-label={t('composer.field_mandate')}
          aria-invalid={!!fieldErrors.bankAccountMandateId}
        >
          <option value="">
            {mandates && mandates.length === 0
              ? t('composer.field_mandate_none')
              : t('composer.field_mandate_placeholder')}
          </option>
          {(mandates || []).map((m) => (
            <option key={m.id} value={m.id}>
              {`${m.bankName} · ${m.accountReference}`}
            </option>
          ))}
        </select>
      </LabeledField>

      {/* Mandate required-count read-out */}
      {mandateDetail && (
        <div
          data-testid="composer-mandate-required-count"
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            padding: '8px 12px',
            background: 'var(--bg-surface-sunken)',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ fontWeight: 700, letterSpacing: '0.08em' }}>
            {t('composer.mandate_required_count_label')}:
          </span>{' '}
          <span
            style={{
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            <LtrText>{String(requiredCount)}</LtrText>
          </span>
        </div>
      )}

      {/* HASEEB-274 surface: warning banner when cheque + Σcount<2 */}
      {showLowSigBanner && (
        <div
          data-testid="composer-low-signatory-warning"
          role="alert"
          style={{
            display: 'flex',
            gap: 10,
            padding: '12px 14px',
            background: 'var(--semantic-warning-subtle)',
            border: '1px solid var(--semantic-warning)',
            borderRadius: 8,
            color: 'var(--semantic-warning)',
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>{t('composer.mandate_warning_low_signatories')}</div>
        </div>
      )}

      {showMandateRequired && (
        <div
          role="alert"
          style={{
            padding: '10px 12px',
            background: 'var(--semantic-warning-subtle)',
            border: '1px solid var(--semantic-warning)',
            borderRadius: 8,
            color: 'var(--semantic-warning)',
            fontSize: 12,
          }}
        >
          {t('composer.mandate_required_for_method')}
        </div>
      )}

      {/* Description */}
      <LabeledField
        label={t('composer.field_description')}
        hint={t('composer.field_description_hint')}
      >
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder={t('composer.field_description_placeholder')}
          maxLength={1000}
          rows={3}
          style={{ ...inputText, resize: 'vertical' }}
        />
      </LabeledField>

      {/* Footer actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 8,
        }}
      >
        <button type="button" onClick={onCancel} style={btnSecondary}>
          {t('composer.action_cancel')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}
        >
          {t('composer.action_submit')}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Detail view
// ══════════════════════════════════════════════════════════════════

function DetailView({
  t,
  voucherId,
  role,
  isOwner,
  canEdit,
  currentUserId,
  showToast,
  onBack,
}) {
  const [voucher, setVoucher] = useState(null);
  const [mandate, setMandate] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const reload = async () => {
    setLoadError(null);
    try {
      const v = await getVoucher(voucherId);
      setVoucher(v);
      if (v?.bankAccountMandateId) {
        try {
          const m = await getMandate(v.bankAccountMandateId);
          setMandate(m);
        } catch {
          setMandate(null);
        }
      } else {
        setMandate(null);
      }
    } catch (err) {
      setLoadError(err?.message || t('toast.error_load'));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherId]);

  const runAction = async (name, fn, successToast) => {
    setBusyAction(name);
    try {
      await fn();
      showToast(successToast);
      await reload();
    } catch (err) {
      showToast(err?.message || t('toast.error_generic'), 'error');
    } finally {
      setBusyAction(null);
    }
  };

  if (!voucher && !loadError) {
    return <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>;
  }
  if (loadError) return <ErrorBanner text={loadError} />;
  if (!voucher) return null;

  const tone = toneStyle(STATUS_TONE[voucher.status]);
  const isCheque = CHEQUE_METHODS.has(voucher.paymentMethod);
  const sigs = Array.isArray(voucher.signatories) ? voucher.signatories : [];
  const requiredCount = sumRequiredSignatories(mandate);
  const assignedCount = sigs.length;
  const signedCount = sigs.filter((s) => s.signedAt).length;

  // Role-gate per stage (defense-in-depth; backend is authoritative).
  const hideReviewForSoD = voucher.preparedBy === currentUserId;
  const hideApproveForSoD =
    voucher.preparedBy === currentUserId || voucher.reviewedBy === currentUserId;

  const actions = [];
  if (canEdit) {
    if (voucher.status === 'DRAFT') {
      actions.push({
        key: 'submit',
        label: t('actions.submit_for_review'),
        aria: t('aria.submit_voucher', { number: voucher.voucherNumber }),
        icon: Send,
        run: () =>
          runAction(
            'submit',
            () => submitVoucher(voucherId),
            t('toast.submitted'),
          ),
      });
      actions.push({
        key: 'cancel',
        label: t('actions.cancel'),
        aria: t('aria.cancel_voucher', { number: voucher.voucherNumber }),
        icon: Ban,
        tone: 'danger',
        onClick: () => setCancelOpen(true),
      });
    } else if (voucher.status === 'PENDING_REVIEW') {
      if (!hideReviewForSoD) {
        actions.push({
          key: 'review',
          label: t('actions.review'),
          aria: t('aria.review_voucher', { number: voucher.voucherNumber }),
          icon: PencilLine,
          run: () =>
            runAction(
              'review',
              () => reviewVoucher(voucherId),
              t('toast.reviewed'),
            ),
        });
      }
      actions.push({
        key: 'reject',
        label: t('actions.reject'),
        aria: t('aria.reject_voucher', { number: voucher.voucherNumber }),
        icon: Ban,
        tone: 'danger',
        onClick: () => setRejectOpen(true),
      });
      actions.push({
        key: 'cancel',
        label: t('actions.cancel'),
        aria: t('aria.cancel_voucher', { number: voucher.voucherNumber }),
        icon: Ban,
        onClick: () => setCancelOpen(true),
      });
    } else if (voucher.status === 'PENDING_APPROVAL') {
      if (!hideApproveForSoD) {
        actions.push({
          key: 'approve',
          label: t('actions.approve'),
          aria: t('aria.approve_voucher', { number: voucher.voucherNumber }),
          icon: ShieldCheck,
          run: () =>
            runAction(
              'approve',
              () => approveVoucher(voucherId),
              t('toast.approved'),
            ),
        });
      }
      actions.push({
        key: 'reject',
        label: t('actions.reject'),
        aria: t('aria.reject_voucher', { number: voucher.voucherNumber }),
        icon: Ban,
        tone: 'danger',
        onClick: () => setRejectOpen(true),
      });
      actions.push({
        key: 'cancel',
        label: t('actions.cancel'),
        aria: t('aria.cancel_voucher', { number: voucher.voucherNumber }),
        icon: Ban,
        onClick: () => setCancelOpen(true),
      });
    } else if (voucher.status === 'PENDING_SIGNATORIES') {
      if (assignedCount === 0) {
        actions.push({
          key: 'assign',
          label: t('actions.assign_signatories'),
          aria: t('aria.assign_signatories', { number: voucher.voucherNumber }),
          icon: UserCheck,
          onClick: () => setAssignOpen(true),
        });
      }
      if (isOwner) {
        actions.push({
          key: 'cancel',
          label: t('actions.cancel'),
          aria: t('aria.cancel_voucher', { number: voucher.voucherNumber }),
          icon: Ban,
          tone: 'danger',
          onClick: () => setCancelOpen(true),
        });
      }
    } else if (voucher.status === 'APPROVED') {
      actions.push({
        key: 'mark_paid',
        label: t('actions.mark_paid'),
        aria: t('aria.mark_paid', { number: voucher.voucherNumber }),
        icon: CheckCircle2,
        run: () =>
          runAction(
            'mark_paid',
            () => markVoucherPaid(voucherId),
            t('toast.paid'),
          ),
      });
      if (isOwner) {
        actions.push({
          key: 'cancel',
          label: t('actions.cancel'),
          aria: t('aria.cancel_voucher', { number: voucher.voucherNumber }),
          icon: Ban,
          onClick: () => setCancelOpen(true),
        });
      }
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
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
            {t('detail.heading_voucher')}
          </div>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 26,
              color: 'var(--text-primary)',
              marginTop: 2,
            }}
          >
            <LtrText>{voucher.voucherNumber}</LtrText>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginTop: 4,
            }}
          >
            {voucher.beneficiaryNameSnapshot} ·{' '}
            {t(`beneficiary_type.${voucher.beneficiaryType.toLowerCase()}`)}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            padding: '4px 12px',
            borderRadius: 12,
            background: tone.bg,
            color: tone.color,
            border: `1px solid ${tone.border}`,
          }}
        >
          {t(`status.${voucher.status.toLowerCase()}`)}
        </span>
      </div>

      {/* Key facts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
        }}
      >
        <KeyFact
          label={t('list.column_amount')}
          value={
            <LtrText>
              {t('currency_kwd')} {formatKwd(voucher.amountKwd)}
            </LtrText>
          }
          strong
        />
        <KeyFact
          label={t('list.column_method')}
          value={t(`payment_method.${voucher.paymentMethod.toLowerCase()}`)}
        />
        <KeyFact
          label={t('list.column_issue_date')}
          value={<LtrText>{isoSlice(voucher.issueDate)}</LtrText>}
        />
        {mandate && (
          <KeyFact
            label={t('detail.label_mandate')}
            value={`${mandate.bankName} · ${mandate.accountReference}`}
          />
        )}
        {voucher.linkedJournalEntryId && (
          <KeyFact
            label={t('detail.label_journal_entry')}
            value={
              <LtrText>
                <span style={{ fontFamily: "'DM Mono', monospace" }}>
                  {voucher.linkedJournalEntryId}
                </span>
              </LtrText>
            }
          />
        )}
      </div>

      {voucher.description && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--bg-surface-sunken)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            color: 'var(--text-secondary)',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: 'var(--text-tertiary)',
              marginBottom: 4,
            }}
          >
            {t('detail.label_description')}
          </div>
          {voucher.description}
        </div>
      )}

      {/* Signatory progress — only for cheque methods */}
      {isCheque && (
        <div data-testid="detail-signatory-block">
          <SectionHeading text={t('detail.heading_signatories')} />
          {/* HASEEB-274 surface on detail: required-count and
              banner if below-2 + cheque. */}
          {mandate && requiredCount > 0 && requiredCount < 2 && (
            <div
              role="alert"
              style={{
                display: 'flex',
                gap: 10,
                padding: '10px 12px',
                marginBottom: 10,
                background: 'var(--semantic-warning-subtle)',
                border: '1px solid var(--semantic-warning)',
                borderRadius: 8,
                color: 'var(--semantic-warning)',
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              {t('composer.mandate_warning_low_signatories')}
            </div>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}
          >
            <StatTile
              label={t('detail.signatories_required')}
              value={String(requiredCount || '—')}
            />
            <StatTile
              label={t('detail.signatories_assigned')}
              value={String(assignedCount)}
            />
            <StatTile
              label={t('detail.signatories_signed')}
              value={`${signedCount} / ${assignedCount || '—'}`}
            />
          </div>

          {assignedCount === 0 ? (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: 'var(--text-tertiary)',
              }}
            >
              {t('detail.signatories_none_assigned')}
            </div>
          ) : (
            <ul
              style={{
                marginTop: 10,
                listStyle: 'none',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {sigs.map((s, i) => {
                const signed = !!s.signedAt;
                const canSignHere =
                  canEdit &&
                  !signed &&
                  voucher.status === 'PENDING_SIGNATORIES' &&
                  (isOwner || s.userId === currentUserId);
                return (
                  <li
                    key={s.userId || i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: 'var(--bg-surface-sunken)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        <LtrText>{s.userId}</LtrText>
                      </div>
                      <div
                        style={{
                          color: signed
                            ? 'var(--accent-primary)'
                            : 'var(--text-tertiary)',
                          fontSize: 10,
                          marginTop: 2,
                        }}
                      >
                        {signed
                          ? t('detail.signatory_signed_at', { at: isoSlice(s.signedAt) })
                          : t('detail.signatory_pending')}{' '}
                        · {s.signatoryClass}
                      </div>
                    </div>
                    {canSignHere && (
                      <button
                        type="button"
                        onClick={() =>
                          runAction(
                            `sign-${s.userId}`,
                            () => signVoucher(voucherId, s.userId),
                            t('toast.signed'),
                          )
                        }
                        disabled={!!busyAction}
                        aria-label={t('aria.sign_voucher', {
                          number: voucher.voucherNumber,
                        })}
                        style={{
                          ...btnMini,
                          color: 'var(--accent-primary)',
                          borderColor: 'var(--accent-primary-border)',
                        }}
                      >
                        <PenLine size={12} style={{ marginInlineEnd: 4, verticalAlign: 'middle' }} />
                        {t('actions.sign_as', { name: s.userId })}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Linked cheque section — cheque methods post-approval */}
      {isCheque && (voucher.chequeId || voucher.status === 'PENDING_SIGNATORIES' || voucher.status === 'APPROVED' || voucher.status === 'PAID') && (
        <div>
          <SectionHeading text={t('detail.heading_cheque')} />
          {voucher.chequeId ? (
            <div
              style={{
                padding: '10px 12px',
                background: 'var(--bg-surface-sunken)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontFamily: "'DM Mono', monospace",
              }}
            >
              <LtrText>{voucher.chequeId}</LtrText>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('detail.cheque_none')}
            </div>
          )}
        </div>
      )}

      {/* Lifecycle audit surface */}
      <div>
        <SectionHeading text={t('detail.heading_audit_trail')} />
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
          <LifecycleRow
            label={t('detail.label_prepared_by')}
            actor={voucher.preparedBy}
            at={voucher.preparedAt}
          />
          {voucher.reviewedBy && (
            <LifecycleRow
              label={t('detail.label_reviewed_by')}
              actor={voucher.reviewedBy}
              at={voucher.reviewedAt}
            />
          )}
          {voucher.approvedBy && (
            <LifecycleRow
              label={t('detail.label_approved_by')}
              actor={voucher.approvedBy}
              at={voucher.approvedAt}
            />
          )}
          {voucher.paidAt && (
            <LifecycleRow
              label={t('detail.label_paid_at')}
              actor={voucher.approvedBy}
              at={voucher.paidAt}
            />
          )}
          {voucher.rejectedBy && (
            <LifecycleRow
              label={t('detail.label_rejected_by')}
              actor={voucher.rejectedBy}
              at={voucher.rejectedAt}
              note={voucher.rejectionReason}
              noteLabel={t('detail.label_rejection_reason')}
              tone="danger"
            />
          )}
          {voucher.cancelledBy && (
            <LifecycleRow
              label={t('detail.label_cancelled_by')}
              actor={voucher.cancelledBy}
              at={voucher.cancelledAt}
              note={voucher.cancellationReason}
              noteLabel={t('detail.label_cancellation_reason')}
              tone="danger"
            />
          )}
        </ul>
      </div>

      {/* Role-gated action bar */}
      {actions.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            borderTop: '1px solid var(--border-default)',
            paddingTop: 16,
            flexWrap: 'wrap',
          }}
        >
          {actions.map((a) => {
            const Icon = a.icon;
            const style =
              a.tone === 'danger'
                ? {
                    ...btnSecondary,
                    color: 'var(--semantic-danger)',
                    borderColor: 'var(--semantic-danger)',
                  }
                : btnPrimary;
            return (
              <button
                key={a.key}
                type="button"
                onClick={a.onClick || a.run}
                disabled={!!busyAction}
                aria-label={a.aria}
                data-testid={`detail-action-${a.key}`}
                style={{ ...style, opacity: busyAction ? 0.6 : 1 }}
              >
                <Icon size={13} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
                {a.label}
              </button>
            );
          })}
        </div>
      )}

      {assignOpen && (
        <AssignSignatoriesModal
          t={t}
          busy={!!busyAction}
          onCancel={() => setAssignOpen(false)}
          onConfirm={(userIds) =>
            runAction(
              'assign',
              () => assignSignatories(voucherId, userIds),
              t('toast.signatories_assigned'),
            ).then(() => setAssignOpen(false))
          }
        />
      )}
      {rejectOpen && (
        <ReasonModal
          t={t}
          mode="reject"
          busy={!!busyAction}
          onCancel={() => setRejectOpen(false)}
          onConfirm={(reason) =>
            runAction(
              'reject',
              () => rejectVoucher(voucherId, reason),
              t('toast.rejected'),
            ).then(() => setRejectOpen(false))
          }
        />
      )}
      {cancelOpen && (
        <ReasonModal
          t={t}
          mode="cancel"
          busy={!!busyAction}
          onCancel={() => setCancelOpen(false)}
          onConfirm={(reason) =>
            runAction(
              'cancel',
              () => cancelVoucher(voucherId, reason),
              t('toast.cancelled'),
            ).then(() => setCancelOpen(false))
          }
        />
      )}
    </div>
  );
}

// ── Small subcomponents ───────────────────────────────────────────

function SectionHeading({ text }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: 'var(--text-tertiary)',
        marginBottom: 10,
      }}
    >
      {text}
    </div>
  );
}

function KeyFact({ label, value, strong }) {
  return (
    <div
      style={{
        padding: '10px 14px',
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
        {label}
      </div>
      <div
        style={{
          fontSize: strong ? 16 : 13,
          fontWeight: strong ? 700 : 600,
          color: 'var(--text-primary)',
          marginTop: 4,
          fontFamily: strong ? "'DM Mono', monospace" : 'inherit',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'var(--bg-surface-sunken)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'var(--text-tertiary)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginTop: 4,
          fontFamily: "'DM Mono', monospace",
        }}
      >
        <LtrText>{value}</LtrText>
      </div>
    </div>
  );
}

function LifecycleRow({ label, actor, at, note, noteLabel, tone }) {
  const color = tone === 'danger' ? 'var(--semantic-danger)' : 'var(--text-secondary)';
  return (
    <li
      style={{
        padding: '8px 12px',
        background: 'var(--bg-surface-sunken)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          fontSize: 12,
          color,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
              marginInlineEnd: 6,
            }}
          >
            {label}:
          </span>
          <LtrText>{actor || '—'}</LtrText>
        </div>
        <LtrText>
          <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--text-tertiary)' }}>
            {isoSlice(at)}
          </span>
        </LtrText>
      </div>
      {note && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          <span style={{ fontWeight: 700, marginInlineEnd: 6 }}>{noteLabel}:</span>
          {note}
        </div>
      )}
    </li>
  );
}

function LabeledField({ label, children, hint, invalid, errorText }) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: invalid ? 'var(--semantic-danger)' : 'var(--text-tertiary)',
      }}
    >
      {label}
      {children}
      {hint && !errorText && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: 0,
            color: 'var(--text-tertiary)',
          }}
        >
          {hint}
        </span>
      )}
      {errorText && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 0,
            color: 'var(--semantic-danger)',
          }}
        >
          {errorText}
        </span>
      )}
    </label>
  );
}

// ── Modals ────────────────────────────────────────────────────────

function AssignSignatoriesModal({ t, busy, onCancel, onConfirm }) {
  const [raw, setRaw] = useState('');
  const [err, setErr] = useState(null);
  const submit = () => {
    const ids = raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length < 1) {
      setErr(t('assign_signatories_modal.error_empty'));
      return;
    }
    if (ids.length > 10) {
      setErr(t('assign_signatories_modal.error_too_many'));
      return;
    }
    setErr(null);
    onConfirm(ids);
  };
  return (
    <ModalShell title={t('assign_signatories_modal.title')} onCancel={onCancel}>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 10,
          lineHeight: 1.5,
        }}
      >
        {t('assign_signatories_modal.description')}
      </div>
      <LabeledField
        label={t('assign_signatories_modal.field_user_ids')}
        errorText={err}
        invalid={!!err}
      >
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={t('assign_signatories_modal.field_user_ids_placeholder')}
          rows={4}
          style={{ ...inputText, resize: 'vertical', fontFamily: "'DM Mono', monospace" }}
        />
      </LabeledField>
      <ModalFooter>
        <button type="button" onClick={onCancel} style={btnSecondary}>
          {t('assign_signatories_modal.cancel')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}
        >
          {t('assign_signatories_modal.confirm')}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

function ReasonModal({ t, mode, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState(null);
  const titleKey = mode === 'reject' ? 'reject_title' : 'cancel_title';
  const descKey = mode === 'reject' ? 'reject_description' : 'cancel_description';
  const submit = () => {
    if (!reason.trim()) {
      setErr(t('reason_modal.error_required'));
      return;
    }
    setErr(null);
    onConfirm(reason.trim());
  };
  return (
    <ModalShell title={t(`reason_modal.${titleKey}`)} onCancel={onCancel}>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 10,
          lineHeight: 1.5,
        }}
      >
        {t(`reason_modal.${descKey}`)}
      </div>
      <LabeledField
        label={t('reason_modal.field_reason')}
        errorText={err}
        invalid={!!err}
      >
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('reason_modal.field_reason_placeholder')}
          rows={3}
          style={{ ...inputText, resize: 'vertical' }}
        />
      </LabeledField>
      <ModalFooter>
        <button type="button" onClick={onCancel} style={btnSecondary}>
          {t('reason_modal.cancel')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          style={{
            ...btnPrimary,
            background: 'var(--semantic-danger)',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {t('reason_modal.confirm')}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

function ModalShell({ title, children, onCancel }) {
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
          width: 480,
          maxWidth: '92vw',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: 22,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
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
              fontSize: 20,
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={title}
            style={btnIcon}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ children }) {
  return (
    <div
      style={{
        marginTop: 10,
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const gridTwoCol = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
};

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
  padding: '6px 10px',
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
const inputText = {
  background: 'var(--bg-surface-sunken)',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  padding: '8px 10px',
  fontFamily: 'inherit',
  fontSize: 12,
};
