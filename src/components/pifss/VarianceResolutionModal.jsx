/**
 * VarianceResolutionModal — AUDIT-ACC-058 (2026-04-22).
 *
 * PIFSS annual reconciliation per-variance resolution surface. Wraps
 * PATCH /api/pifss-reconciliation/variances/:id.
 *
 * Status transitions (4 canonical values):
 *   UNRESOLVED | UNDER_INVESTIGATION | RESOLVED | IN_DISPUTE
 *
 * Reopen gate (defense-in-depth, backend enforces too):
 *   RESOLVED / IN_DISPUTE → UNRESOLVED requires the Owner role + a
 *   non-empty `reopenReason`. For non-Owner users we hide the reopen
 *   field entirely and surface a warning banner (service would return
 *   403 regardless).
 *
 * Monetary fields (Δ employer / Δ employee) are Decimal(18,3) strings
 * off the wire. We render them directly — no parseFloat.
 *
 * Bilingual: consumes pifssReconciliation namespace. RTL via logical
 * properties (marginInlineStart / marginInlineEnd) + borderInlineStart
 * / borderInlineEnd.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import LtrText from '../shared/LtrText';
import { normalizeRole, ROLES } from '../../utils/role';
import { resolveVariance } from '../../engine';

const VARIANCE_STATUSES = [
  { key: 'UNRESOLVED', labelKey: 'variance_status.unresolved' },
  { key: 'UNDER_INVESTIGATION', labelKey: 'variance_status.under_investigation' },
  { key: 'RESOLVED', labelKey: 'variance_status.resolved' },
  { key: 'IN_DISPUTE', labelKey: 'variance_status.in_dispute' },
];

const CLOSED_STATUSES = new Set(['RESOLVED', 'IN_DISPUTE']);

// canReopen predicate, inline per the dispatch spec.
function canReopen(currentStatus, role) {
  return (
    CLOSED_STATUSES.has(currentStatus) &&
    normalizeRole(role) === ROLES.OWNER
  );
}

function periodString(variance) {
  const y = variance?.periodYear;
  const m = variance?.periodMonth;
  if (y == null || m == null) return '—';
  return `${y}-${String(m).padStart(2, '0')}`;
}

function varianceTypeLabel(t, type) {
  if (!type) return '—';
  return t(`variance_type.${type.toLowerCase()}`);
}

export default function VarianceResolutionModal({
  open,
  onClose,
  variance,
  role = 'CFO',
  onResolved,
  onError,
}) {
  const { t } = useTranslation('pifssReconciliation');
  const normalizedRole = normalizeRole(role);
  const isOwner = normalizedRole === ROLES.OWNER;

  const currentStatus = variance?.status;
  const isClosed = CLOSED_STATUSES.has(currentStatus);
  const nonOwnerViewingClosed = isClosed && !isOwner;

  // Form state.
  const [status, setStatus] = useState(currentStatus || '');
  const [resolutionNote, setResolutionNote] = useState(
    variance?.resolutionNote || '',
  );
  const [reopenReason, setReopenReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // Reset form when variance changes or modal opens.
  useEffect(() => {
    if (open) {
      setStatus(variance?.status || '');
      setResolutionNote(variance?.resolutionNote || '');
      setReopenReason('');
      setValidationError(null);
      setSaving(false);
    }
  }, [open, variance?.id, variance?.status, variance?.resolutionNote]);

  // Derived: is the user attempting a reopen transition?
  const attemptingReopen = useMemo(() => {
    return isClosed && status === 'UNRESOLVED' && currentStatus !== 'UNRESOLVED';
  }, [isClosed, status, currentStatus]);

  const reopenFieldVisible = attemptingReopen && isOwner;

  if (!open || !variance) return null;

  const handleSave = async () => {
    setValidationError(null);

    // Status required.
    if (!status) {
      setValidationError(t('resolution_modal.error_status_required'));
      return;
    }

    // Resolution note length cap.
    if (resolutionNote && resolutionNote.length > 2000) {
      setValidationError(t('resolution_modal.error_resolution_note_too_long'));
      return;
    }

    // Reopen reason required if reopening, and only Owner may do so.
    if (attemptingReopen) {
      if (!isOwner) {
        // Non-owner attempting reopen — block client-side (backend would 403).
        setValidationError(t('resolution_modal.reopen_warning_non_owner'));
        return;
      }
      if (!reopenReason || !reopenReason.trim()) {
        setValidationError(
          t('resolution_modal.error_reopen_reason_required'),
        );
        return;
      }
      if (reopenReason.length > 2000) {
        setValidationError(t('resolution_modal.error_reopen_reason_too_long'));
        return;
      }
    }

    setSaving(true);
    try {
      const body = { status };
      if (resolutionNote && resolutionNote.trim()) {
        body.resolutionNote = resolutionNote.trim();
      }
      if (attemptingReopen && reopenReason && reopenReason.trim()) {
        body.reopenReason = reopenReason.trim();
      }
      const result = await resolveVariance(variance.id, body);
      setSaving(false);
      if (onResolved) onResolved(result?.variance || result);
      onClose();
    } catch (err) {
      setSaving(false);
      const msg = err?.message || t('toast.error_resolve');
      setValidationError(msg);
      if (onError) onError(msg);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="variance-resolution-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '18px 22px 14px',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <div>
            <div
              id="variance-resolution-modal-title"
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: 'var(--text-primary)',
                letterSpacing: '-0.3px',
                lineHeight: 1,
              }}
            >
              {t('resolution_modal.title')}
            </div>
            <div
              style={{
                marginTop: 8,
                display: 'grid',
                gridTemplateColumns: 'auto auto',
                columnGap: 18,
                rowGap: 4,
                fontSize: 11,
                color: 'var(--text-tertiary)',
              }}
            >
              <div>
                <span style={{ fontWeight: 700 }}>
                  {t('resolution_modal.summary_period')}:{' '}
                </span>
                <LtrText>{periodString(variance)}</LtrText>
              </div>
              <div>
                <span style={{ fontWeight: 700 }}>
                  {t('resolution_modal.summary_type')}:{' '}
                </span>
                {varianceTypeLabel(t, variance.varianceType)}
              </div>
              <div>
                <span style={{ fontWeight: 700 }}>
                  {t('resolution_modal.summary_delta_employer')}:{' '}
                </span>
                <LtrText>{variance.deltaEmployerKwd ?? '—'}</LtrText>
              </div>
              <div>
                <span style={{ fontWeight: 700 }}>
                  {t('resolution_modal.summary_delta_employee')}:{' '}
                </span>
                <LtrText>{variance.deltaEmployeeKwd ?? '—'}</LtrText>
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label={t('aria.close_modal')}
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px' }}>
          {/* Non-owner reopen warning banner */}
          {nonOwnerViewingClosed && (
            <div
              role="alert"
              style={{
                display: 'flex',
                gap: 8,
                padding: '10px 12px',
                marginBottom: 14,
                background: 'var(--semantic-warning-subtle)',
                border: '1px solid var(--semantic-warning)',
                borderRadius: 8,
                color: 'var(--semantic-warning)',
                fontSize: 12,
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t('resolution_modal.reopen_warning_non_owner')}</span>
            </div>
          )}

          {/* Owner reopen info banner */}
          {attemptingReopen && isOwner && (
            <div
              role="status"
              style={{
                display: 'flex',
                gap: 8,
                padding: '10px 12px',
                marginBottom: 14,
                background: 'var(--accent-primary-subtle)',
                border: '1px solid var(--accent-primary-border)',
                borderRadius: 8,
                color: 'var(--accent-primary)',
                fontSize: 12,
              }}
            >
              <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t('resolution_modal.reopen_warning_owner')}</span>
            </div>
          )}

          {/* Status select */}
          <label style={labelStyle} htmlFor="variance-status-select">
            {t('resolution_modal.field_status')}
          </label>
          <select
            id="variance-status-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={saving}
            style={inputStyle}
          >
            <option value="">
              {t('resolution_modal.field_status_placeholder')}
            </option>
            {VARIANCE_STATUSES.map((s) => {
              // For non-Owner viewing closed variance, disable the
              // UNRESOLVED (reopen) option.
              const disabled =
                s.key === 'UNRESOLVED' && nonOwnerViewingClosed;
              return (
                <option key={s.key} value={s.key} disabled={disabled}>
                  {t(s.labelKey)}
                </option>
              );
            })}
          </select>

          {/* Resolution note */}
          <label
            style={{ ...labelStyle, marginTop: 14 }}
            htmlFor="variance-resolution-note"
          >
            {t('resolution_modal.field_resolution_note')}
          </label>
          <textarea
            id="variance-resolution-note"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            disabled={saving}
            maxLength={2000}
            rows={3}
            placeholder={t('resolution_modal.field_resolution_note_hint')}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
          />
          <div style={hintStyle}>
            {t('resolution_modal.field_resolution_note_hint')}
          </div>

          {/* Reopen reason (only for Owner + attempting reopen) */}
          {reopenFieldVisible && (
            <>
              <label
                style={{ ...labelStyle, marginTop: 14 }}
                htmlFor="variance-reopen-reason"
              >
                {t('resolution_modal.field_reopen_reason')}
                <span style={{ color: 'var(--semantic-danger)', marginInlineStart: 4 }}>
                  *
                </span>
              </label>
              <textarea
                id="variance-reopen-reason"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                disabled={saving}
                maxLength={2000}
                rows={3}
                placeholder={t('resolution_modal.field_reopen_reason_hint')}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
              />
              <div style={hintStyle}>
                {t('resolution_modal.field_reopen_reason_hint')}
              </div>
            </>
          )}

          {/* Validation error */}
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
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '14px 22px 18px',
            borderTop: '1px solid var(--border-default)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={btnSecondary}
          >
            {t('resolution_modal.action_cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary}
          >
            {saving
              ? t('resolution_modal.saving')
              : t('resolution_modal.action_save')}
          </button>
        </div>
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
  padding: '8px 16px',
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 6,
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
