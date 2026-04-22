/**
 * BankMandateAdminScreen — HASEEB-211 (2026-04-22).
 *
 * Owner-side admin surface for Kuwait bank-mandate signatory rules
 * (FN-274 / corporate-api `/api/bank-mandates`). Closes the gap left by
 * the AUDIT-ACC-002 PaymentVoucherScreen composer, which reads ACTIVE
 * mandates but had no UI path to create/acknowledge/cancel them — a
 * new tenant onboarding previously had to seed mandate rows directly
 * in the tenant DB.
 *
 * Three internal views driven by `view` state:
 *
 *   1. LIST    — status filter + bank search + "New mandate" action.
 *                Rows render bank + account + status pill + tiered
 *                chip + rule summary + effective range + linked
 *                voucher count (computed on demand via listVouchers).
 *   2. COMPOSER — 4-step wizard: bank → rules → thresholds → review.
 *                 Also used as the "Create replacement mandate"
 *                 supersession shortcut on ACTIVE detail views
 *                 (HASEEB-232 tracks a future atomic cancel+create
 *                 wizard; this dispatch just opens a fresh composer).
 *   3. DETAIL   — rule breakdown + signatory roster (current +
 *                 historical) + linked payment vouchers + audit trail
 *                 + status-dependent action bar + supersession info
 *                 banner on ACTIVE mandates.
 *
 * Role gating (Section 13.1 midsize model):
 *   - Owner (OWNER): full access.
 *   - CFO / Senior (ACCOUNTANT): list + detail visible; all action
 *     buttons disabled with a read-only banner. Backend rejects
 *     mutations regardless (mandatesRouter OWNER-gate).
 *   - Junior (VIEWER / AUDITOR): screen hidden at the sidebar + route
 *     level. Direct route-case renders a null/redirect fallback.
 *
 * Supersession pattern (Kuwait banking convention): mandate rules are
 * IMMUTABLE once issued. There is intentionally NO Edit action. Rule
 * changes go through Cancel + Create (or the "Create replacement
 * mandate" shortcut). The info banner on ACTIVE detail views explains
 * this to operators. HASEEB-232 tracks a future wizard that bundles
 * cancel + create into one atomic flow.
 *
 * Wall preservation: frontend never calls an LLM or writes outside the
 * backend. All mutations go through engine wrappers
 * (`src/engine/index.js` → `src/api/bankMandates.js`).
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Decimal from 'decimal.js';
import {
  ArrowLeft,
  X,
  AlertTriangle,
  CheckCircle2,
  Ban,
  Plus,
  Trash2,
  UserPlus,
  UserMinus,
  ChevronRight,
  ScrollText,
  Info,
  FileText,
  Copy,
} from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import LtrText from '../../components/shared/LtrText';
import { normalizeRole, ROLES } from '../../utils/role';
import {
  listMandates,
  getMandate,
  listMandateSignatories,
  createMandate,
  acknowledgeMandate,
  cancelMandate,
  assignMandateSignatory,
  revokeMandateSignatory,
  listVouchers,
} from '../../engine';

// ── Constants ─────────────────────────────────────────────────────

const STATUS_KEYS = [
  'PENDING_BANK_ACKNOWLEDGMENT',
  'ACTIVE',
  'SUPERSEDED',
  'CANCELLED',
];

const STATUS_TONE = {
  PENDING_BANK_ACKNOWLEDGMENT: 'warning',
  ACTIVE: 'success',
  SUPERSEDED: 'neutral',
  CANCELLED: 'danger',
};

const KWD_AMOUNT_RE = /^\d+(\.\d{1,3})?$/;
const URL_RE = /^https?:\/\/\S+$/i;

// Common Kuwait banking classes. "custom" is a sentinel that swaps the
// dropdown for a free-text input so operators can type a tenant-
// specific class name. Backend accepts any 1-60 char string.
const SIGNATORY_CLASS_KEYS = [
  'OWNER',
  'CFO',
  'CHAIRMAN',
  'BOARD_MEMBER',
  'AUTHORIZED_SIGNATORY',
];

// ── Helpers ───────────────────────────────────────────────────────

function formatKwd(value) {
  if (value == null || value === '') return '—';
  try {
    const d = new Decimal(String(value));
    return d.toFixed(3);
  } catch {
    return String(value);
  }
}

function isoSlice(ts) {
  if (!ts) return '—';
  return String(ts).slice(0, 10);
}

function classLabel(t, rawClass) {
  if (!rawClass) return '';
  const key = rawClass.toString().toLowerCase();
  // Fall back to the raw class string if not in our canonical list.
  return t(`signatory_class.${key}`, { defaultValue: rawClass });
}

function renderRequiresSummary(t, requires) {
  if (!Array.isArray(requires) || requires.length === 0) return t('composer.rules_empty');
  return requires
    .map((r) =>
      t('detail.rule_class_count', {
        count: r.count,
        class: classLabel(t, r.signatoryClass),
      }),
    )
    .join(' + ');
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
// BankMandateAdminScreen
// ══════════════════════════════════════════════════════════════════

export default function BankMandateAdminScreen({ role = 'Owner' }) {
  const { t } = useTranslation('bankMandates');
  const normalizedRole = normalizeRole(role);
  const isOwner = normalizedRole === ROLES.OWNER;
  const isJunior = normalizedRole === ROLES.JUNIOR;

  // Hooks must be declared before any conditional early return
  // (rules-of-hooks). The Junior "no access" branch is rendered below
  // via the JSX tree, AFTER all hooks have been declared.
  const [view, setView] = useState('list'); // 'list' | 'composer' | 'detail'
  const [selectedMandateId, setSelectedMandateId] = useState(null);
  const [composerSeed, setComposerSeed] = useState(null);
  const [toast, setToast] = useState(null);

  // Junior is hidden at the screen level per dispatch spec. If the
  // route-case is reached directly (deep link) we render nothing —
  // the sidebar entry is also hidden for Junior, so this is a
  // defense-in-depth null.
  if (isJunior) {
    return (
      <div
        data-testid="bank-mandates-no-access"
        style={{
          flex: 1,
          padding: 24,
          color: 'var(--text-tertiary)',
          fontSize: 12,
        }}
      />
    );
  }

  const showToast = (text, tone = 'success') => setToast({ text, tone });

  const openDetail = (id) => {
    setSelectedMandateId(id);
    setView('detail');
  };
  const openComposer = (seed = null) => {
    setComposerSeed(seed);
    setSelectedMandateId(null);
    setView('composer');
  };
  const backToList = () => {
    setSelectedMandateId(null);
    setComposerSeed(null);
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
          {view === 'list' && (
            <button
              type="button"
              onClick={() => (isOwner ? openComposer() : undefined)}
              aria-label={t('aria.new_mandate')}
              disabled={!isOwner}
              title={!isOwner ? t('role_readonly_banner') : undefined}
              data-testid="bank-mandate-new-action"
              style={{ ...btnPrimary, opacity: isOwner ? 1 : 0.5, cursor: isOwner ? 'pointer' : 'not-allowed' }}
            >
              <Plus size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
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

        {!isOwner && (
          <div
            role="note"
            data-testid="readonly-banner"
            style={{
              display: 'flex',
              gap: 10,
              padding: '10px 14px',
              background: 'var(--bg-surface-sunken)',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              color: 'var(--text-secondary)',
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{t('role_readonly_banner')}</div>
          </div>
        )}

        {view === 'list' && (
          <ListView t={t} isOwner={isOwner} onOpenDetail={openDetail} />
        )}
        {view === 'composer' && (
          <ComposerView
            t={t}
            seed={composerSeed}
            onCancel={backToList}
            onCreated={(created) => {
              showToast(t('toast.created'));
              if (created?.id) openDetail(created.id);
              else backToList();
            }}
            onError={(msg) => showToast(msg || t('toast.error_generic'), 'error')}
          />
        )}
        {view === 'detail' && selectedMandateId && (
          <DetailView
            t={t}
            mandateId={selectedMandateId}
            isOwner={isOwner}
            onOpenMandate={openDetail}
            onOpenReplacementComposer={(seed) => openComposer(seed)}
            showToast={showToast}
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

function ListView({ t, isOwner, onOpenDetail }) {
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [bankFilter, setBankFilter] = useState('');

  const reload = async () => {
    setLoadError(null);
    try {
      const filter = {};
      if (statusFilter) filter.status = statusFilter;
      if (bankFilter.trim()) filter.bankName = bankFilter.trim();
      const res = await listMandates(filter);
      const sorted = (res?.rows || []).slice().sort((a, b) => {
        // Descending by effectiveFrom; fall back to createdAt.
        const ka = a.effectiveFrom || a.createdAt || '';
        const kb = b.effectiveFrom || b.createdAt || '';
        return kb.localeCompare(ka);
      });
      setRows(sorted);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t('toast.error_load'));
    }
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, bankFilter]);

  return (
    <div>
      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t('list.column_status')}
          style={{ ...inputSelect, minWidth: 220 }}
        >
          <option value="">{t('list.filter_status_all')}</option>
          {STATUS_KEYS.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s.toLowerCase()}`)}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={bankFilter}
          onChange={(e) => setBankFilter(e.target.value)}
          placeholder={t('list.filter_bank_placeholder')}
          aria-label={t('list.column_bank')}
          style={{ ...inputText, minWidth: 240, flex: 1, maxWidth: 360 }}
        />
      </div>

      {loadError && <ErrorBanner text={loadError} />}
      {rows === null && (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>
      )}
      {rows && rows.length === 0 && !loadError && (
        <EmptyState
          icon={ScrollText}
          title={t('list.empty_title')}
          description={t('list.empty_description')}
          action={
            isOwner ? (
              <button
                type="button"
                onClick={() => onOpenDetail(null)}
                style={{ ...btnSecondary, visibility: 'hidden' }}
                aria-hidden
              />
            ) : null
          }
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
              gridTemplateColumns: '1.3fr 1fr 1fr 1.6fr 1fr 40px',
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
            <div>{t('list.column_bank')}</div>
            <div>{t('list.column_account')}</div>
            <div>{t('list.column_status')}</div>
            <div>{t('list.column_rule_summary')}</div>
            <div>{t('list.column_effective')}</div>
            <div />
          </div>
          {rows.map((m) => {
            const tone = toneStyle(STATUS_TONE[m.status]);
            const tiered =
              Array.isArray(m.mandateRules?.amountThresholds) &&
              m.mandateRules.amountThresholds.length > 0;
            return (
              <button
                key={m.id}
                type="button"
                data-testid={`mandate-row-${m.id}`}
                onClick={() => onOpenDetail(m.id)}
                aria-label={t('aria.open_mandate_detail', {
                  bank: m.bankName,
                  account: m.accountReference,
                })}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.3fr 1fr 1fr 1.6fr 1fr 40px',
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
                <div style={{ fontWeight: 600 }}>{m.bankName}</div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: 'var(--text-secondary)',
                  }}
                >
                  <LtrText>{m.accountReference}</LtrText>
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
                    {t(`status.${m.status.toLowerCase()}`)}
                  </span>
                </div>
                <div>
                  <div>{renderRequiresSummary(t, m.mandateRules?.requires)}</div>
                  {tiered && (
                    <span
                      data-testid={`mandate-tiered-chip-${m.id}`}
                      style={{
                        display: 'inline-block',
                        marginTop: 4,
                        padding: '2px 8px',
                        borderRadius: 8,
                        background: 'var(--accent-primary-subtle)',
                        color: 'var(--accent-primary)',
                        border: '1px solid var(--accent-primary-border)',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                      }}
                    >
                      {t('list.tiered_chip')}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    color: 'var(--text-tertiary)',
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                  }}
                >
                  <LtrText>{isoSlice(m.effectiveFrom)}</LtrText>
                  {m.effectiveUntil && (
                    <>
                      <span style={{ marginInline: 4 }}>→</span>
                      <LtrText>{isoSlice(m.effectiveUntil)}</LtrText>
                    </>
                  )}
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
// Composer view (4-step wizard)
// ══════════════════════════════════════════════════════════════════

function ComposerView({ t, seed, onCancel, onCreated, onError }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [step, setStep] = useState(1);

  // Form state — seed from "Create replacement mandate" shortcut if
  // provided. We do NOT auto-cancel the source mandate (supersession
  // helper wizard is HASEEB-232 future work); this just pre-fills
  // convenient defaults.
  const [form, setForm] = useState(() => ({
    bankName: seed?.bankName || '',
    accountReference: seed?.accountReference || '',
    mandateDocumentUrl: '',
    effectiveFrom: today,
    effectiveUntil: '',
    rules: seed?.rules || [{ signatoryClass: 'OWNER', count: 1 }],
    // Each threshold: { minAmountKwd, extraRequires: [{ signatoryClass, count }] }
    thresholds: seed?.thresholds || [],
    markActiveImmediately: false,
  }));
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  const isReplacement = !!seed;

  const stepHeading = isReplacement
    ? t('composer.heading_supersede')
    : t('composer.heading_new');

  // ── Validation ──
  const validateBank = () => {
    const errs = {};
    if (!form.bankName.trim()) errs.bankName = t('composer.error_bank_name_required');
    if (!form.accountReference.trim()) errs.accountReference = t('composer.error_account_reference_required');
    if (!form.effectiveFrom) errs.effectiveFrom = t('composer.error_effective_from_required');
    if (form.mandateDocumentUrl.trim() && !URL_RE.test(form.mandateDocumentUrl.trim())) {
      errs.mandateDocumentUrl = t('composer.error_document_url_format');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateRules = () => {
    const errs = {};
    if (!Array.isArray(form.rules) || form.rules.length === 0) {
      errs.rules = t('composer.error_rules_required');
      setFieldErrors(errs);
      return false;
    }
    for (let i = 0; i < form.rules.length; i++) {
      const r = form.rules[i];
      if (!r.signatoryClass || !String(r.signatoryClass).trim()) {
        errs[`rules_class_${i}`] = t('composer.error_rules_required');
      }
      if (!Number.isFinite(Number(r.count)) || Number(r.count) < 1) {
        errs[`rules_count_${i}`] = t('composer.error_count_positive');
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateThresholds = () => {
    const errs = {};
    for (let i = 0; i < form.thresholds.length; i++) {
      const th = form.thresholds[i];
      if (!th.minAmountKwd || !String(th.minAmountKwd).trim()) {
        errs[`thresholds_amount_${i}`] = t('composer.error_min_amount_required');
      } else if (!KWD_AMOUNT_RE.test(String(th.minAmountKwd))) {
        errs[`thresholds_amount_${i}`] = t('composer.error_min_amount_format');
      }
      if (!Array.isArray(th.extraRequires) || th.extraRequires.length === 0) {
        errs[`thresholds_extra_${i}`] = t('composer.error_threshold_extra_required');
      } else {
        for (let j = 0; j < th.extraRequires.length; j++) {
          const er = th.extraRequires[j];
          if (!er.signatoryClass || !String(er.signatoryClass).trim()) {
            errs[`thresholds_class_${i}_${j}`] = t('composer.error_rules_required');
          }
          if (!Number.isFinite(Number(er.count)) || Number(er.count) < 1) {
            errs[`thresholds_count_${i}_${j}`] = t('composer.error_count_positive');
          }
        }
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    setSubmitError(null);
    if (step === 1 && !validateBank()) return;
    if (step === 2 && !validateRules()) return;
    if (step === 3 && !validateThresholds()) return;
    setFieldErrors({});
    setStep((s) => Math.min(4, s + 1));
  };
  const goBack = () => {
    setSubmitError(null);
    setFieldErrors({});
    setStep((s) => Math.max(1, s - 1));
  };

  const submit = async () => {
    setSubmitError(null);
    if (!validateBank() || !validateRules() || !validateThresholds()) {
      setSubmitError(t('composer.error_generic'));
      return;
    }
    setBusy(true);
    try {
      const mandateRules = {
        requires: form.rules.map((r) => ({
          signatoryClass: String(r.signatoryClass).trim(),
          count: Number(r.count),
        })),
      };
      if (form.thresholds.length > 0) {
        mandateRules.amountThresholds = form.thresholds.map((th) => ({
          minAmountKwd: String(th.minAmountKwd),
          extraRequires: th.extraRequires.map((er) => ({
            signatoryClass: String(er.signatoryClass).trim(),
            count: Number(er.count),
          })),
        }));
      }
      const body = {
        bankName: form.bankName.trim(),
        accountReference: form.accountReference.trim(),
        mandateRules,
        effectiveFrom: form.effectiveFrom,
      };
      if (form.mandateDocumentUrl.trim()) body.mandateDocumentUrl = form.mandateDocumentUrl.trim();
      if (form.effectiveUntil) body.effectiveUntil = form.effectiveUntil;
      if (form.markActiveImmediately) body.markActiveImmediately = true;

      const created = await createMandate(body);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 22,
            color: 'var(--text-primary)',
          }}
        >
          {stepHeading}
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: 'var(--text-tertiary)',
          }}
        >
          <LtrText>{t('composer.step_badge', { current: step, total: 4 })}</LtrText>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator
        t={t}
        current={step}
        steps={[
          { key: 1, label: t('composer.step_bank') },
          { key: 2, label: t('composer.step_rules') },
          { key: 3, label: t('composer.step_thresholds') },
          { key: 4, label: t('composer.step_review') },
        ]}
      />

      {submitError && <ErrorBanner text={submitError} />}

      {step === 1 && (
        <StepBank t={t} form={form} setForm={setForm} fieldErrors={fieldErrors} />
      )}
      {step === 2 && (
        <StepRules t={t} form={form} setForm={setForm} fieldErrors={fieldErrors} />
      )}
      {step === 3 && (
        <StepThresholds t={t} form={form} setForm={setForm} fieldErrors={fieldErrors} />
      )}
      {step === 4 && (
        <StepReview t={t} form={form} setForm={setForm} />
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          marginTop: 8,
        }}
      >
        <button type="button" onClick={onCancel} style={btnSecondary}>
          {t('composer.action_cancel')}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 1 && (
            <button type="button" onClick={goBack} style={btnSecondary}>
              {t('composer.action_back')}
            </button>
          )}
          {step < 4 && (
            <button type="button" onClick={goNext} style={btnPrimary}>
              {t('composer.action_next')}
            </button>
          )}
          {step === 4 && (
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}
            >
              {t('composer.action_submit')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ t, current, steps }) {
  return (
    <div
      role="list"
      aria-label={t('composer.step_badge', { current, total: steps.length })}
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--border-default)',
        paddingBottom: 10,
      }}
    >
      {steps.map((s, idx) => {
        const done = current > s.key;
        const on = current === s.key;
        return (
          <div
            key={s.key}
            role="listitem"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingInlineEnd: 16,
              marginInlineEnd: 16,
              borderInlineEnd:
                idx < steps.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              fontSize: 11,
              fontWeight: 600,
              color: on
                ? 'var(--accent-primary)'
                : done
                  ? 'var(--text-primary)'
                  : 'var(--text-tertiary)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: '50%',
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                fontWeight: 700,
                background: on
                  ? 'var(--accent-primary)'
                  : done
                    ? 'var(--accent-primary-subtle)'
                    : 'var(--bg-surface-sunken)',
                color: on ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${on ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
              }}
            >
              <LtrText>{s.key}</LtrText>
            </span>
            {s.label}
          </div>
        );
      })}
    </div>
  );
}

function StepBank({ t, form, setForm, fieldErrors }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={gridTwoCol}>
        <LabeledField
          label={t('composer.field_bank_name')}
          invalid={!!fieldErrors.bankName}
          errorText={fieldErrors.bankName}
        >
          <input
            type="text"
            value={form.bankName}
            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            placeholder={t('composer.field_bank_name_placeholder')}
            style={inputText}
            aria-invalid={!!fieldErrors.bankName}
          />
        </LabeledField>
        <LabeledField
          label={t('composer.field_account_reference')}
          invalid={!!fieldErrors.accountReference}
          errorText={fieldErrors.accountReference}
        >
          <input
            type="text"
            value={form.accountReference}
            onChange={(e) => setForm({ ...form, accountReference: e.target.value })}
            placeholder={t('composer.field_account_reference_placeholder')}
            style={inputText}
            aria-invalid={!!fieldErrors.accountReference}
          />
        </LabeledField>
      </div>
      <LabeledField
        label={t('composer.field_document_url')}
        invalid={!!fieldErrors.mandateDocumentUrl}
        errorText={fieldErrors.mandateDocumentUrl}
      >
        <input
          type="text"
          value={form.mandateDocumentUrl}
          onChange={(e) => setForm({ ...form, mandateDocumentUrl: e.target.value })}
          placeholder={t('composer.field_document_url_placeholder')}
          style={inputText}
          aria-invalid={!!fieldErrors.mandateDocumentUrl}
        />
      </LabeledField>
      <div style={gridTwoCol}>
        <LabeledField
          label={t('composer.field_effective_from')}
          invalid={!!fieldErrors.effectiveFrom}
          errorText={fieldErrors.effectiveFrom}
        >
          <input
            type="date"
            value={form.effectiveFrom}
            onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
            style={inputText}
            aria-invalid={!!fieldErrors.effectiveFrom}
          />
        </LabeledField>
        <LabeledField label={t('composer.field_effective_until')}>
          <input
            type="date"
            value={form.effectiveUntil}
            onChange={(e) => setForm({ ...form, effectiveUntil: e.target.value })}
            style={inputText}
          />
        </LabeledField>
      </div>
    </div>
  );
}

function StepRules({ t, form, setForm, fieldErrors }) {
  const addRule = () =>
    setForm({
      ...form,
      rules: [...form.rules, { signatoryClass: 'CFO', count: 1 }],
    });
  const removeRule = (idx) =>
    setForm({ ...form, rules: form.rules.filter((_, i) => i !== idx) });
  const updateRule = (idx, patch) =>
    setForm({
      ...form,
      rules: form.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {t('composer.rules_description')}
      </div>
      {fieldErrors.rules && <ErrorBanner text={fieldErrors.rules} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {form.rules.map((r, idx) => (
          <SignatoryClassRow
            key={idx}
            t={t}
            row={r}
            onChange={(patch) => updateRule(idx, patch)}
            onRemove={() => removeRule(idx)}
            classError={fieldErrors[`rules_class_${idx}`]}
            countError={fieldErrors[`rules_count_${idx}`]}
          />
        ))}
      </div>
      <div>
        <button type="button" onClick={addRule} style={btnSecondary}>
          <Plus size={12} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
          {t('composer.rules_add')}
        </button>
      </div>
      {form.rules.length > 0 && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            padding: '10px 14px',
            background: 'var(--bg-surface-sunken)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
          }}
        >
          <span style={{ fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
            {t('composer.rules_summary_any')}
          </span>{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {renderRequiresSummary(t, form.rules)}
          </span>
        </div>
      )}
    </div>
  );
}

function SignatoryClassRow({ t, row, onChange, onRemove, classError, countError }) {
  const isCustom = !SIGNATORY_CLASS_KEYS.includes(row.signatoryClass);
  const selectValue = isCustom ? 'custom' : row.signatoryClass;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 0.7fr auto',
        gap: 10,
        alignItems: 'flex-end',
      }}
    >
      <LabeledField
        label={t('composer.rules_class')}
        invalid={!!classError}
        errorText={classError}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={selectValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'custom') {
                onChange({ signatoryClass: '' });
              } else {
                onChange({ signatoryClass: v });
              }
            }}
            style={{ ...inputSelect, flex: 1 }}
            aria-label={t('composer.rules_class')}
          >
            {SIGNATORY_CLASS_KEYS.map((k) => (
              <option key={k} value={k}>
                {t(`signatory_class.${k.toLowerCase()}`)}
              </option>
            ))}
            <option value="custom">{t('signatory_class.custom')}</option>
          </select>
          {isCustom && (
            <input
              type="text"
              value={row.signatoryClass}
              onChange={(e) => onChange({ signatoryClass: e.target.value })}
              placeholder={t('signatory_class.custom_placeholder')}
              style={{ ...inputText, flex: 1 }}
              aria-label={t('signatory_class.custom_placeholder')}
            />
          )}
        </div>
      </LabeledField>
      <LabeledField
        label={t('composer.rules_count')}
        invalid={!!countError}
        errorText={countError}
      >
        <input
          type="number"
          min={1}
          value={row.count}
          onChange={(e) => onChange({ count: Number(e.target.value) })}
          style={{ ...inputText, fontFamily: "'DM Mono', monospace" }}
          aria-invalid={!!countError}
        />
      </LabeledField>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('composer.rules_remove')}
        style={{ ...btnIcon, marginBottom: 2 }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function StepThresholds({ t, form, setForm, fieldErrors }) {
  const addTier = () =>
    setForm({
      ...form,
      thresholds: [
        ...form.thresholds,
        {
          minAmountKwd: '',
          extraRequires: [{ signatoryClass: 'CHAIRMAN', count: 1 }],
        },
      ],
    });
  const removeTier = (i) =>
    setForm({ ...form, thresholds: form.thresholds.filter((_, k) => k !== i) });
  const updateTier = (i, patch) =>
    setForm({
      ...form,
      thresholds: form.thresholds.map((t, k) => (k === i ? { ...t, ...patch } : t)),
    });
  const addExtra = (i) =>
    updateTier(i, {
      extraRequires: [
        ...form.thresholds[i].extraRequires,
        { signatoryClass: 'OWNER', count: 1 },
      ],
    });
  const removeExtra = (i, j) =>
    updateTier(i, {
      extraRequires: form.thresholds[i].extraRequires.filter((_, k) => k !== j),
    });
  const updateExtra = (i, j, patch) =>
    updateTier(i, {
      extraRequires: form.thresholds[i].extraRequires.map((er, k) =>
        k === j ? { ...er, ...patch } : er,
      ),
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {t('composer.thresholds_description')}
      </div>
      {form.thresholds.length === 0 && (
        <div
          style={{
            padding: '10px 14px',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            background: 'var(--bg-surface-sunken)',
            borderRadius: 6,
            border: '1px dashed var(--border-subtle)',
          }}
        >
          {t('composer.thresholds_empty')}
        </div>
      )}
      {form.thresholds.map((th, i) => (
        <div
          key={i}
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 14,
            background: 'var(--bg-surface-sunken)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={gridTwoCol}>
            <LabeledField
              label={t('composer.thresholds_min_amount')}
              invalid={!!fieldErrors[`thresholds_amount_${i}`]}
              errorText={fieldErrors[`thresholds_amount_${i}`]}
            >
              <input
                type="text"
                inputMode="decimal"
                value={th.minAmountKwd}
                onChange={(e) => updateTier(i, { minAmountKwd: e.target.value })}
                placeholder={t('composer.thresholds_min_amount_placeholder')}
                style={{ ...inputText, fontFamily: "'DM Mono', monospace" }}
                aria-invalid={!!fieldErrors[`thresholds_amount_${i}`]}
              />
            </LabeledField>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
              <button
                type="button"
                onClick={() => removeTier(i)}
                aria-label={t('composer.thresholds_remove')}
                style={btnSecondary}
              >
                <Trash2 size={12} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
                {t('composer.thresholds_remove')}
              </button>
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
            }}
          >
            {t('composer.thresholds_extra_requires')}
          </div>
          {fieldErrors[`thresholds_extra_${i}`] && (
            <ErrorBanner text={fieldErrors[`thresholds_extra_${i}`]} />
          )}
          {th.extraRequires.map((er, j) => (
            <SignatoryClassRow
              key={j}
              t={t}
              row={er}
              onChange={(patch) => updateExtra(i, j, patch)}
              onRemove={() => removeExtra(i, j)}
              classError={fieldErrors[`thresholds_class_${i}_${j}`]}
              countError={fieldErrors[`thresholds_count_${i}_${j}`]}
            />
          ))}
          <div>
            <button
              type="button"
              onClick={() => addExtra(i)}
              style={{ ...btnSecondary, fontSize: 11 }}
            >
              <Plus size={12} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
              {t('composer.rules_add')}
            </button>
          </div>
        </div>
      ))}
      <div>
        <button type="button" onClick={addTier} style={btnSecondary}>
          <Plus size={12} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
          {t('composer.thresholds_add')}
        </button>
      </div>
    </div>
  );
}

function StepReview({ t, form, setForm }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 18,
          color: 'var(--text-primary)',
        }}
      >
        {t('composer.review_heading')}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        <KeyFact label={t('composer.field_bank_name')} value={form.bankName || '—'} />
        <KeyFact
          label={t('composer.field_account_reference')}
          value={<LtrText>{form.accountReference || '—'}</LtrText>}
        />
        <KeyFact
          label={t('composer.field_effective_from')}
          value={<LtrText>{form.effectiveFrom || '—'}</LtrText>}
        />
        <KeyFact
          label={t('composer.field_effective_until')}
          value={<LtrText>{form.effectiveUntil || '—'}</LtrText>}
        />
      </div>
      <div
        style={{
          padding: 14,
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          background: 'var(--bg-surface-sunken)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'var(--text-tertiary)',
            marginBottom: 8,
          }}
        >
          {t('composer.review_rule_breakdown')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, marginInlineEnd: 6 }}>
            {t('detail.rule_any_voucher')}
          </span>
          {renderRequiresSummary(t, form.rules)}
        </div>
        {form.thresholds.length > 0 && (
          <ul style={{ margin: 0, paddingInlineStart: 16, color: 'var(--text-secondary)', fontSize: 12 }}>
            {form.thresholds.map((th, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {t('composer.thresholds_tier_summary', {
                  amount: formatKwd(th.minAmountKwd),
                  extra: renderRequiresSummary(t, th.extraRequires),
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
      <label
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          padding: 12,
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          background: 'var(--bg-surface)',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={form.markActiveImmediately}
          onChange={(e) => setForm({ ...form, markActiveImmediately: e.target.checked })}
          style={{ marginTop: 2 }}
        />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('composer.review_active_immediately')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {t('composer.review_active_hint')}
          </div>
        </div>
      </label>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Detail view
// ══════════════════════════════════════════════════════════════════

function DetailView({
  t,
  mandateId,
  isOwner,
  onOpenMandate,
  onOpenReplacementComposer,
  showToast,
}) {
  const [mandate, setMandate] = useState(null);
  const [signatories, setSignatories] = useState([]);
  const [linkedVouchers, setLinkedVouchers] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [busyAction, setBusyAction] = useState(null);

  const [ackOpen, setAckOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const reload = async () => {
    setLoadError(null);
    try {
      const [m, sigs, vouchers] = await Promise.all([
        getMandate(mandateId),
        listMandateSignatories(mandateId).catch(() => ({ rows: [] })),
        listVouchers({ mandateId }).catch(() => ({ rows: [] })),
      ]);
      setMandate(m);
      setSignatories(sigs?.rows || []);
      setLinkedVouchers(vouchers?.rows || []);
    } catch (err) {
      setLoadError(err?.message || t('toast.error_load'));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mandateId]);

  const runAction = async (name, fn, successToastKey) => {
    setBusyAction(name);
    try {
      await fn();
      showToast(t(`toast.${successToastKey}`));
      await reload();
    } catch (err) {
      showToast(err?.message || t('toast.error_generic'), 'error');
    } finally {
      setBusyAction(null);
    }
  };

  if (!mandate && !loadError) {
    return <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>…</div>;
  }
  if (loadError) return <ErrorBanner text={loadError} />;
  if (!mandate) return null;

  const tone = toneStyle(STATUS_TONE[mandate.status]);
  const isPending = mandate.status === 'PENDING_BANK_ACKNOWLEDGMENT';
  const isActive = mandate.status === 'ACTIVE';
  const isSuperseded = mandate.status === 'SUPERSEDED';
  const isCancelled = mandate.status === 'CANCELLED';

  const today = new Date().toISOString().slice(0, 10);
  const currentSignatories = signatories.filter(
    (s) => !s.revokedAt && (!s.effectiveUntil || s.effectiveUntil >= today),
  );
  const historicalSignatories = signatories.filter(
    (s) => s.revokedAt || (s.effectiveUntil && s.effectiveUntil < today),
  );

  // Linked-voucher count is computed from the actual list; the cancel
  // confirmation modal reads this to render the warning with a real
  // number rather than a generic message.
  const activeVoucherStatuses = new Set([
    'DRAFT',
    'PENDING_REVIEW',
    'PENDING_APPROVAL',
    'PENDING_SIGNATORIES',
    'APPROVED',
  ]);
  const activeLinkedVouchers = linkedVouchers.filter((v) =>
    activeVoucherStatuses.has(v.status),
  );

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
            {t('detail.heading_mandate')}
          </div>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 26,
              color: 'var(--text-primary)',
              marginTop: 2,
            }}
          >
            {mandate.bankName}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginTop: 4,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            <LtrText>{mandate.accountReference}</LtrText>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '4px 10px',
              borderRadius: 12,
              background: tone.bg,
              color: tone.color,
              border: `1px solid ${tone.border}`,
            }}
          >
            {t(`status.${mandate.status.toLowerCase()}`)}
          </span>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              fontFamily: "'DM Mono', monospace",
            }}
          >
            <LtrText>{isoSlice(mandate.effectiveFrom)}</LtrText>
            {mandate.effectiveUntil && (
              <>
                <span style={{ marginInline: 4 }}>→</span>
                <LtrText>{isoSlice(mandate.effectiveUntil)}</LtrText>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Supersession info banner (ACTIVE only) */}
      {isActive && (
        <div
          role="note"
          data-testid="supersession-info-banner"
          style={{
            display: 'flex',
            gap: 10,
            padding: '12px 14px',
            background: 'var(--accent-primary-subtle)',
            border: '1px solid var(--accent-primary-border)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            fontSize: 12,
            lineHeight: 1.55,
          }}
        >
          <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent-primary)' }} />
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 12,
                color: 'var(--accent-primary)',
                marginBottom: 4,
                letterSpacing: '0.02em',
              }}
            >
              {t('detail.supersession_banner_title')}
            </div>
            <div>{t('detail.supersession_banner_body')}</div>
          </div>
        </div>
      )}

      {/* Cancelled reason readout */}
      {isCancelled && mandate.cancellationReason && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '10px 14px',
            background: 'var(--semantic-danger-subtle)',
            border: '1px solid var(--semantic-danger)',
            borderRadius: 8,
            color: 'var(--semantic-danger)',
            fontSize: 12,
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <span style={{ fontWeight: 700, marginInlineEnd: 6 }}>
              {t('detail.label_cancellation_reason')}:
            </span>
            {mandate.cancellationReason}
          </div>
        </div>
      )}

      {/* Superseded successor link */}
      {isSuperseded && mandate.supersededByMandateId && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '10px 14px',
            background: 'var(--bg-surface-sunken)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            color: 'var(--text-secondary)',
            fontSize: 12,
            alignItems: 'center',
          }}
        >
          <FileText size={14} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, marginInlineEnd: 6 }}>
              {t('detail.label_superseded_by')}:
            </span>
            <LtrText>{mandate.supersededByMandateId}</LtrText>
          </div>
          <button
            type="button"
            onClick={() => onOpenMandate(mandate.supersededByMandateId)}
            style={btnMini}
          >
            {t('detail.label_open_successor')}
          </button>
        </div>
      )}

      {/* Action bar */}
      {(isPending || isActive) && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '10px 12px',
            background: 'var(--bg-surface-sunken)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            flexWrap: 'wrap',
          }}
        >
          {isPending && (
            <button
              type="button"
              onClick={() => setAckOpen(true)}
              disabled={!isOwner || !!busyAction}
              aria-label={t('aria.acknowledge_mandate')}
              title={!isOwner ? t('role_readonly_banner') : undefined}
              data-testid="detail-action-acknowledge"
              style={{ ...btnPrimary, opacity: !isOwner || busyAction ? 0.5 : 1 }}
            >
              <CheckCircle2 size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
              {t('actions.acknowledge')}
            </button>
          )}
          {isActive && (
            <>
              <button
                type="button"
                onClick={() => setAssignOpen(true)}
                disabled={!isOwner || !!busyAction}
                aria-label={t('aria.assign_signatory')}
                title={!isOwner ? t('role_readonly_banner') : undefined}
                data-testid="detail-action-assign"
                style={{ ...btnSecondary, opacity: !isOwner || busyAction ? 0.5 : 1 }}
              >
                <UserPlus size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
                {t('actions.assign_signatory')}
              </button>
              <button
                type="button"
                onClick={() =>
                  onOpenReplacementComposer({
                    bankName: mandate.bankName,
                    accountReference: mandate.accountReference,
                    rules: (mandate.mandateRules?.requires || []).map((r) => ({
                      signatoryClass: r.signatoryClass,
                      count: r.count,
                    })),
                    thresholds: (mandate.mandateRules?.amountThresholds || []).map((th) => ({
                      minAmountKwd: th.minAmountKwd,
                      extraRequires: (th.extraRequires || []).map((er) => ({
                        signatoryClass: er.signatoryClass,
                        count: er.count,
                      })),
                    })),
                  })
                }
                disabled={!isOwner || !!busyAction}
                aria-label={t('aria.create_replacement', {
                  bank: mandate.bankName,
                  account: mandate.accountReference,
                })}
                title={!isOwner ? t('role_readonly_banner') : undefined}
                data-testid="detail-action-create-replacement"
                style={{ ...btnSecondary, opacity: !isOwner || busyAction ? 0.5 : 1 }}
              >
                <Copy size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
                {t('actions.create_replacement')}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            disabled={!isOwner || !!busyAction}
            aria-label={t('aria.cancel_mandate')}
            title={!isOwner ? t('role_readonly_banner') : undefined}
            data-testid="detail-action-cancel"
            style={{
              ...btnSecondary,
              color: 'var(--semantic-danger)',
              borderColor: 'var(--semantic-danger)',
              opacity: !isOwner || busyAction ? 0.5 : 1,
            }}
          >
            <Ban size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
            {t('actions.cancel_mandate')}
          </button>
        </div>
      )}

      {/* Rule breakdown */}
      <section>
        <SectionHeading text={t('detail.heading_rule_breakdown')} />
        <div
          style={{
            padding: 14,
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            background: 'var(--bg-surface-sunken)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
              marginBottom: 6,
            }}
          >
            {t('detail.rule_base')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, marginInlineEnd: 6 }}>
              {t('detail.rule_any_voucher')}
            </span>
            {renderRequiresSummary(t, mandate.mandateRules?.requires)}
          </div>
          {Array.isArray(mandate.mandateRules?.amountThresholds) &&
            mandate.mandateRules.amountThresholds.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: 'var(--text-tertiary)',
                    marginBottom: 6,
                  }}
                >
                  {t('detail.rule_threshold_heading')}
                </div>
                <ul style={{ margin: 0, paddingInlineStart: 16, color: 'var(--text-secondary)', fontSize: 12 }}>
                  {mandate.mandateRules.amountThresholds.map((th, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>
                      {t('detail.rule_above_amount', {
                        amount: formatKwd(th.minAmountKwd),
                        extra: renderRequiresSummary(t, th.extraRequires),
                      })}
                    </li>
                  ))}
                </ul>
              </>
            )}
        </div>
      </section>

      {/* Signatory roster */}
      <section data-testid="detail-signatory-roster">
        <SectionHeading text={t('detail.heading_signatories')} />
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
              marginBottom: 6,
            }}
          >
            {t('detail.signatories_current')}
          </div>
          {currentSignatories.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('detail.signatories_none_current')}
            </div>
          ) : (
            <SignatoryTable
              t={t}
              rows={currentSignatories}
              isOwner={isOwner}
              canRevoke={isActive}
              onRevoke={(row) => setRevokeTarget(row)}
            />
          )}
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
              marginBottom: 6,
            }}
          >
            {t('detail.signatories_historical')}
          </div>
          {historicalSignatories.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('detail.signatories_none_historical')}
            </div>
          ) : (
            <SignatoryTable
              t={t}
              rows={historicalSignatories}
              isOwner={isOwner}
              canRevoke={false}
              showRevokedReason
            />
          )}
        </div>
      </section>

      {/* Linked vouchers */}
      <section data-testid="detail-linked-vouchers">
        <SectionHeading text={t('detail.heading_linked_vouchers')} />
        {linkedVouchers.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {t('detail.linked_vouchers_none')}
          </div>
        ) : (
          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.6fr 1fr 1fr',
                gap: 10,
                padding: '8px 12px',
                background: 'var(--bg-surface-sunken)',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: 'var(--text-tertiary)',
              }}
            >
              <div>{t('detail.linked_vouchers_column_number')}</div>
              <div>{t('detail.linked_vouchers_column_beneficiary')}</div>
              <div style={{ textAlign: 'end' }}>
                {t('detail.linked_vouchers_column_amount')}
              </div>
              <div>{t('detail.linked_vouchers_column_status')}</div>
            </div>
            {linkedVouchers.map((v) => (
              <div
                key={v.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.6fr 1fr 1fr',
                  gap: 10,
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: 12,
                }}
              >
                <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                  <LtrText>{v.voucherNumber}</LtrText>
                </div>
                <div>{v.beneficiaryNameSnapshot}</div>
                <div
                  style={{
                    textAlign: 'end',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  <LtrText>{formatKwd(v.amountKwd)}</LtrText>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>{v.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Audit trail */}
      <section>
        <SectionHeading text={t('detail.heading_audit_trail')} />
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <LifecycleRow
            label={t('detail.label_created_at')}
            actor={mandate.createdBy}
            at={mandate.createdAt}
            t={t}
          />
          {mandate.submittedToBankAt && (
            <LifecycleRow
              label={t('detail.label_submitted_at')}
              actor={mandate.createdBy}
              at={mandate.submittedToBankAt}
              t={t}
            />
          )}
          {mandate.acknowledgedAt && (
            <LifecycleRow
              label={t('detail.label_acknowledged_at')}
              actor={mandate.acknowledgedBy}
              at={mandate.acknowledgedAt}
              t={t}
            />
          )}
          {mandate.cancelledAt && (
            <LifecycleRow
              label={t('detail.label_cancelled_at')}
              actor={mandate.cancelledBy}
              at={mandate.cancelledAt}
              t={t}
              note={mandate.cancellationReason}
              noteLabel={t('detail.label_cancellation_reason')}
              tone="danger"
            />
          )}
        </ul>
      </section>

      {ackOpen && (
        <AcknowledgeModal
          t={t}
          busy={!!busyAction}
          onCancel={() => setAckOpen(false)}
          onConfirm={(body) =>
            runAction('ack', () => acknowledgeMandate(mandateId, body), 'acknowledged').then(
              () => setAckOpen(false),
            )
          }
        />
      )}
      {cancelOpen && (
        <CancelMandateModal
          t={t}
          busy={!!busyAction}
          linkedVoucherCount={activeLinkedVouchers.length}
          onCancel={() => setCancelOpen(false)}
          onConfirm={(reason) =>
            runAction('cancel', () => cancelMandate(mandateId, { reason }), 'cancelled').then(
              () => setCancelOpen(false),
            )
          }
        />
      )}
      {assignOpen && (
        <AssignSignatoryModal
          t={t}
          busy={!!busyAction}
          onCancel={() => setAssignOpen(false)}
          onConfirm={(body) =>
            runAction('assign', () => assignMandateSignatory(mandateId, body), 'assigned').then(
              () => setAssignOpen(false),
            )
          }
        />
      )}
      {revokeTarget && (
        <RevokeSignatoryModal
          t={t}
          target={revokeTarget}
          busy={!!busyAction}
          onCancel={() => setRevokeTarget(null)}
          onConfirm={(body) =>
            runAction(
              'revoke',
              () =>
                revokeMandateSignatory({
                  assignmentId: revokeTarget.id,
                  revokedReason: body.revokedReason,
                  effectiveUntil: body.effectiveUntil,
                }),
              'revoked',
            ).then(() => setRevokeTarget(null))
          }
        />
      )}
    </div>
  );
}

function SignatoryTable({ t, rows, isOwner, canRevoke, onRevoke, showRevokedReason }) {
  const cols = showRevokedReason
    ? '1.4fr 1fr 0.9fr 0.9fr 1.4fr'
    : '1.4fr 1fr 0.9fr 0.9fr 0.7fr';
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: cols,
          gap: 10,
          padding: '8px 12px',
          background: 'var(--bg-surface-sunken)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'var(--text-tertiary)',
        }}
      >
        <div>{t('detail.signatories_column_user')}</div>
        <div>{t('detail.signatories_column_class')}</div>
        <div>{t('detail.signatories_column_effective_from')}</div>
        <div>{t('detail.signatories_column_effective_until')}</div>
        <div>
          {showRevokedReason
            ? t('detail.signatories_column_revoked_reason')
            : t('detail.signatories_column_actions')}
        </div>
      </div>
      {rows.map((r) => (
        <div
          key={r.id}
          data-testid={`signatory-row-${r.id}`}
          style={{
            display: 'grid',
            gridTemplateColumns: cols,
            gap: 10,
            padding: '10px 12px',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: 12,
            color: 'var(--text-primary)',
          }}
        >
          <div style={{ fontFamily: "'DM Mono', monospace" }}>
            <LtrText>{r.userId}</LtrText>
          </div>
          <div>{classLabel(t, r.signatoryClass)}</div>
          <div style={{ fontFamily: "'DM Mono', monospace", color: 'var(--text-tertiary)' }}>
            <LtrText>{isoSlice(r.effectiveFrom)}</LtrText>
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", color: 'var(--text-tertiary)' }}>
            <LtrText>{isoSlice(r.effectiveUntil)}</LtrText>
          </div>
          <div>
            {showRevokedReason ? (
              <span style={{ color: 'var(--text-secondary)' }}>{r.revokedReason || '—'}</span>
            ) : (
              canRevoke && (
                <button
                  type="button"
                  onClick={() => onRevoke(r)}
                  disabled={!isOwner}
                  aria-label={t('aria.revoke_signatory', { user: r.userId })}
                  title={!isOwner ? t('role_readonly_banner') : undefined}
                  style={{ ...btnMini, opacity: !isOwner ? 0.5 : 1 }}
                >
                  <UserMinus size={12} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
                  {t('actions.revoke_signatory')}
                </button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────

function AcknowledgeModal({ t, busy, onCancel, onConfirm }) {
  const [ackAt, setAckAt] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);

  const submit = async () => {
    setErr(null);
    const body = {};
    if (ackAt) body.acknowledgedAt = new Date(ackAt).toISOString();
    if (note.trim()) body.note = note.trim();
    try {
      await onConfirm(body);
    } catch (e) {
      setErr(e?.message || t('acknowledge_modal.error_generic'));
    }
  };

  return (
    <ModalShell title={t('acknowledge_modal.title')} onCancel={onCancel}>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 10,
          lineHeight: 1.5,
        }}
      >
        {t('acknowledge_modal.description')}
      </div>
      {err && <ErrorBanner text={err} />}
      <LabeledField
        label={t('acknowledge_modal.field_acknowledged_at')}
        hint={t('acknowledge_modal.field_acknowledged_at_hint')}
      >
        <input
          type="datetime-local"
          value={ackAt}
          onChange={(e) => setAckAt(e.target.value)}
          style={inputText}
        />
      </LabeledField>
      <LabeledField label={t('acknowledge_modal.field_note')}>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('acknowledge_modal.field_note_placeholder')}
          rows={3}
          maxLength={500}
          style={{ ...inputText, resize: 'vertical' }}
        />
      </LabeledField>
      <ModalFooter>
        <button type="button" onClick={onCancel} style={btnSecondary}>
          {t('acknowledge_modal.cancel')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}
        >
          <CheckCircle2 size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
          {t('acknowledge_modal.confirm')}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

function CancelMandateModal({ t, busy, linkedVoucherCount, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState(null);

  const submit = async () => {
    if (!reason.trim()) {
      setErr(t('cancel_modal.error_required'));
      return;
    }
    setErr(null);
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setErr(e?.message || t('cancel_modal.error_generic'));
    }
  };

  return (
    <ModalShell title={t('cancel_modal.title')} onCancel={onCancel}>
      <div
        role="alert"
        style={{
          padding: '10px 12px',
          background: 'var(--semantic-warning-subtle)',
          border: '1px solid var(--semantic-warning)',
          borderRadius: 8,
          color: 'var(--semantic-warning)',
          fontSize: 12,
          marginBottom: 10,
          lineHeight: 1.5,
        }}
      >
        <AlertTriangle size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
        {t('cancel_modal.warning_terminal')}
      </div>
      {linkedVoucherCount > 0 && (
        <div
          data-testid="cancel-linked-voucher-warning"
          role="alert"
          style={{
            padding: '10px 12px',
            background: 'var(--semantic-danger-subtle)',
            border: '1px solid var(--semantic-danger)',
            borderRadius: 8,
            color: 'var(--semantic-danger)',
            fontSize: 12,
            marginBottom: 10,
            lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
          {linkedVoucherCount === 1
            ? t('cancel_modal.warning_linked_vouchers_one', { count: linkedVoucherCount })
            : t('cancel_modal.warning_linked_vouchers_other', { count: linkedVoucherCount })}
        </div>
      )}
      <LabeledField
        label={t('cancel_modal.field_reason')}
        invalid={!!err}
        errorText={err}
      >
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('cancel_modal.field_reason_placeholder')}
          rows={3}
          maxLength={500}
          style={{ ...inputText, resize: 'vertical' }}
        />
      </LabeledField>
      <ModalFooter>
        <button type="button" onClick={onCancel} style={btnSecondary}>
          {t('cancel_modal.cancel')}
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
          <Ban size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
          {t('cancel_modal.confirm')}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

function AssignSignatoryModal({ t, busy, onCancel, onConfirm }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [userId, setUserId] = useState('');
  const [signatoryClass, setSignatoryClass] = useState('OWNER');
  const [customClass, setCustomClass] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [err, setErr] = useState({});

  const isCustom = signatoryClass === 'custom';

  const submit = async () => {
    const errs = {};
    if (!userId.trim()) errs.userId = t('assign_modal.error_user_required');
    const cls = isCustom ? customClass.trim() : signatoryClass;
    if (!cls) errs.signatoryClass = t('assign_modal.error_class_required');
    if (!effectiveFrom) errs.effectiveFrom = t('assign_modal.error_effective_from_required');
    setErr(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      await onConfirm({
        userId: userId.trim(),
        signatoryClass: cls,
        effectiveFrom,
        effectiveUntil: effectiveUntil || undefined,
      });
    } catch (e) {
      setErr({ generic: e?.message || t('assign_modal.error_generic') });
    }
  };

  return (
    <ModalShell title={t('assign_modal.title')} onCancel={onCancel}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
        {t('assign_modal.description')}
      </div>
      {err.generic && <ErrorBanner text={err.generic} />}
      <LabeledField
        label={t('assign_modal.field_user_id')}
        hint={t('assign_modal.field_user_id_hint')}
        invalid={!!err.userId}
        errorText={err.userId}
      >
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder={t('assign_modal.field_user_id_placeholder')}
          style={{ ...inputText, fontFamily: "'DM Mono', monospace" }}
          aria-invalid={!!err.userId}
        />
      </LabeledField>
      <LabeledField
        label={t('signatory_class.label')}
        invalid={!!err.signatoryClass}
        errorText={err.signatoryClass}
      >
        <select
          value={signatoryClass}
          onChange={(e) => setSignatoryClass(e.target.value)}
          style={inputSelect}
        >
          {SIGNATORY_CLASS_KEYS.map((k) => (
            <option key={k} value={k}>
              {t(`signatory_class.${k.toLowerCase()}`)}
            </option>
          ))}
          <option value="custom">{t('signatory_class.custom')}</option>
        </select>
        {isCustom && (
          <input
            type="text"
            value={customClass}
            onChange={(e) => setCustomClass(e.target.value)}
            placeholder={t('signatory_class.custom_placeholder')}
            style={{ ...inputText, marginTop: 8 }}
          />
        )}
      </LabeledField>
      <div style={gridTwoCol}>
        <LabeledField
          label={t('assign_modal.field_effective_from')}
          invalid={!!err.effectiveFrom}
          errorText={err.effectiveFrom}
        >
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            style={inputText}
          />
        </LabeledField>
        <LabeledField label={t('assign_modal.field_effective_until')}>
          <input
            type="date"
            value={effectiveUntil}
            onChange={(e) => setEffectiveUntil(e.target.value)}
            style={inputText}
          />
        </LabeledField>
      </div>
      <ModalFooter>
        <button type="button" onClick={onCancel} style={btnSecondary}>
          {t('assign_modal.cancel')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}
        >
          <UserPlus size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
          {t('assign_modal.confirm')}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

function RevokeSignatoryModal({ t, target, busy, onCancel, onConfirm }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [reason, setReason] = useState('');
  const [effectiveUntil, setEffectiveUntil] = useState(today);
  const [err, setErr] = useState({});

  const submit = async () => {
    const errs = {};
    if (!reason.trim()) errs.reason = t('revoke_modal.error_reason_required');
    if (!effectiveUntil) errs.effectiveUntil = t('revoke_modal.error_effective_until_required');
    setErr(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      await onConfirm({ revokedReason: reason.trim(), effectiveUntil });
    } catch (e) {
      setErr({ generic: e?.message || t('revoke_modal.error_generic') });
    }
  };

  return (
    <ModalShell title={t('revoke_modal.title')} onCancel={onCancel}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
        {t('revoke_modal.description')}
      </div>
      {err.generic && <ErrorBanner text={err.generic} />}
      <div
        style={{
          display: 'flex',
          gap: 14,
          padding: 12,
          background: 'var(--bg-surface-sunken)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          marginBottom: 10,
          fontSize: 12,
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
            {t('revoke_modal.label_current_user')}
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", color: 'var(--text-primary)' }}>
            <LtrText>{target.userId}</LtrText>
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
            }}
          >
            {t('revoke_modal.label_current_class')}
          </div>
          <div style={{ color: 'var(--text-primary)' }}>
            {classLabel(t, target.signatoryClass)}
          </div>
        </div>
      </div>
      <LabeledField
        label={t('revoke_modal.field_revoked_reason')}
        invalid={!!err.reason}
        errorText={err.reason}
      >
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('revoke_modal.field_revoked_reason_placeholder')}
          rows={3}
          maxLength={500}
          style={{ ...inputText, resize: 'vertical' }}
        />
      </LabeledField>
      <LabeledField
        label={t('revoke_modal.field_effective_until')}
        hint={t('revoke_modal.field_effective_until_hint')}
        invalid={!!err.effectiveUntil}
        errorText={err.effectiveUntil}
      >
        <input
          type="date"
          value={effectiveUntil}
          onChange={(e) => setEffectiveUntil(e.target.value)}
          style={inputText}
        />
      </LabeledField>
      <ModalFooter>
        <button type="button" onClick={onCancel} style={btnSecondary}>
          {t('revoke_modal.cancel')}
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
          <UserMinus size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
          {t('revoke_modal.confirm')}
        </button>
      </ModalFooter>
    </ModalShell>
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

function KeyFact({ label, value }) {
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
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function LifecycleRow({ label, actor, at, note, noteLabel, tone, t }) {
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
          <LtrText>{actor || (t ? t('dash') : '—')}</LtrText>
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

function ModalShell({ title, children, onCancel }) {
  return (
    <div
      role="dialog"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        background: 'var(--overlay-scrim, rgba(0,0,0,0.55))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: '92vw',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: 22,
          boxShadow: '0 24px 60px var(--overlay-shadow, rgba(0,0,0,0.5))',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: '88vh',
          overflowY: 'auto',
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

