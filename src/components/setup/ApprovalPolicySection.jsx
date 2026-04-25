/**
 * @file ApprovalPolicySection.jsx
 *
 * HASEEB-482 (DECISION-026 Phase 2 frontend, 2026-04-24) — Setup-screen
 * panel that lets the Owner inspect and edit the four monetary tier
 * thresholds that drive the JE-approval engine. Mirrors the Tax / Engine
 * Rules section pattern in SetupScreen.jsx (Card + FormRow + button
 * styles passed in from the parent).
 *
 * Behaviour:
 *   - GET /api/settings/approval-policy on mount; populate the four
 *     KWD inputs from response.thresholds.* (decimal strings, KWD has
 *     3 dp precision on the wire).
 *   - Inputs editable ONLY when the active role is Owner. Non-Owner
 *     sees a banner and disabled inputs (defence in depth — the
 *     backend PATCH is also OWNER-only at the route layer).
 *   - Save calls PATCH with ONLY the changed fields (partial update).
 *     Client-side validation enforces auto < reviewer < cfo and
 *     cfo <= board BEFORE the network call so a degenerate ordering
 *     never reaches the engine. Backend re-checks via
 *     `policyAssertConsistent` and returns bilingual zod errors which
 *     we surface verbatim if local validation passes but the engine
 *     still rejects.
 *   - "Last updated" footer: parsed from response.lastUpdatedAt and
 *     response.lastUpdatedBy. When the row is the engine-default
 *     (createdBy null) we render "System default" / "افتراضي النظام".
 *
 * Design-system note: we use the same Card / FormRow / inputStyle /
 * btnPrimary helpers SetupScreen ships internally — they are not
 * exported, so the parent passes them in as props. This keeps
 * ApprovalPolicySection free of cross-file style imports while still
 * matching the rest of the Setup surface visually.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import LtrText from '../shared/LtrText';
import Spinner from '../shared/Spinner';
import { ROLES, normalizeRole } from '../../utils/role';
import {
  getApprovalPolicy,
  updateApprovalPolicy,
} from '../../api/approvalPolicy';

/**
 * Parse a KWD-decimal string like "1000.000" into a Number so we can
 * order-check client-side. Returns NaN for unparseable input — caller
 * treats NaN as a validation failure.
 */
function toNumber(s) {
  if (s == null || s === '') return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Format a Number back to a KWD wire string (3 dp). Strips trailing
 * zeros when the user enters an integer like "1000" so the placeholder
 * doesn't keep filling in ".000" mid-typing.
 */
function fmtForWire(n) {
  if (n == null || Number.isNaN(n)) return '';
  // The backend accepts up to 3 dp. Persist EXACTLY at 3 dp to avoid
  // floating-point representation drift across patches.
  return Number(n).toFixed(3);
}

/**
 * Formatter for the "Last updated" footer. Returns a short locale-aware
 * date string. Falls back to the raw ISO when locale parsing fails.
 */
function fmtIsoDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function ApprovalPolicySection({
  role,
  Card,
  Toast,
  FormRow,
  inputStyle,
  btnPrimary,
}) {
  const { t } = useTranslation('setup');
  const normalizedRole = normalizeRole(role);
  const isOwner = normalizedRole === ROLES.OWNER;

  const [policy, setPolicy] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // Local edit buffers for the four monetary fields. Held as strings
  // (not numbers) so the user can type "1000" mid-edit without a forced
  // `.000` repaint per keystroke. Coerced to fmtForWire() on PATCH.
  const [autoCeil, setAutoCeil] = useState('');
  const [reviewerCeil, setReviewerCeil] = useState('');
  const [cfoCeil, setCfoCeil] = useState('');
  const [boardThr, setBoardThr] = useState('');

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    getApprovalPolicy()
      .then((p) => {
        if (cancelled) return;
        setPolicy(p);
        setAutoCeil(p?.thresholds?.autoApproveCeilingKwd ?? '');
        setReviewerCeil(p?.thresholds?.reviewerApprovalCeilingKwd ?? '');
        setCfoCeil(p?.thresholds?.cfoApprovalCeilingKwd ?? '');
        setBoardThr(p?.thresholds?.boardAckThresholdKwd ?? '');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err?.message || t('approval_policy.error_load'));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  /** Compute changed-only patch + run client-side ordering check. */
  const validation = useMemo(() => {
    const errors = [];
    const a = toNumber(autoCeil);
    const r = toNumber(reviewerCeil);
    const c = toNumber(cfoCeil);
    const b = toNumber(boardThr);

    if (Number.isNaN(a) || a < 0) errors.push(t('approval_policy.validation_auto'));
    if (Number.isNaN(r) || r < 0) errors.push(t('approval_policy.validation_reviewer'));
    if (Number.isNaN(c) || c < 0) errors.push(t('approval_policy.validation_cfo'));
    if (Number.isNaN(b) || b < 0) errors.push(t('approval_policy.validation_board'));

    if (errors.length === 0) {
      if (!(a < r)) errors.push(t('approval_policy.validation_auto_lt_reviewer'));
      if (!(r < c)) errors.push(t('approval_policy.validation_reviewer_lt_cfo'));
      if (!(c <= b)) errors.push(t('approval_policy.validation_cfo_le_board'));
    }

    return { errors, isValid: errors.length === 0 };
  }, [autoCeil, reviewerCeil, cfoCeil, boardThr, t]);

  function buildPatch() {
    if (!policy) return {};
    const patch = {};
    const cur = policy.thresholds || {};
    const a = fmtForWire(toNumber(autoCeil));
    const r = fmtForWire(toNumber(reviewerCeil));
    const c = fmtForWire(toNumber(cfoCeil));
    const b = fmtForWire(toNumber(boardThr));
    if (a && a !== cur.autoApproveCeilingKwd) patch.autoApproveCeilingKwd = a;
    if (r && r !== cur.reviewerApprovalCeilingKwd) patch.reviewerApprovalCeilingKwd = r;
    if (c && c !== cur.cfoApprovalCeilingKwd) patch.cfoApprovalCeilingKwd = c;
    if (b && b !== cur.boardAckThresholdKwd) patch.boardAckThresholdKwd = b;
    return patch;
  }

  const handleSave = async () => {
    setError(null);
    if (!validation.isValid) {
      setError(validation.errors[0]);
      return;
    }
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      setToast(t('approval_policy.no_changes'));
      return;
    }
    setSaving(true);
    try {
      const updated = await updateApprovalPolicy(patch);
      setPolicy(updated);
      // Re-sync the inputs from the server echo so any 3-dp normalisation
      // shows in the UI immediately.
      if (updated?.thresholds) {
        setAutoCeil(updated.thresholds.autoApproveCeilingKwd ?? autoCeil);
        setReviewerCeil(updated.thresholds.reviewerApprovalCeilingKwd ?? reviewerCeil);
        setCfoCeil(updated.thresholds.cfoApprovalCeilingKwd ?? cfoCeil);
        setBoardThr(updated.thresholds.boardAckThresholdKwd ?? boardThr);
      }
      setToast(t('approval_policy.saved_toast'));
    } catch (err) {
      // Backend returns bilingual messages directly in `error.message`
      // for zod / consistency violations; for 403 we render the
      // Owner-only banner from translations.
      if (err?.status === 403) {
        setError(t('approval_policy.error_owner_only'));
      } else {
        setError(err?.message || t('approval_policy.error_save'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <Card title={t('approval_policy.title')} description={t('approval_policy.description')}>
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            background: 'var(--semantic-danger-subtle)',
            border: '1px solid var(--semantic-danger)',
            borderRadius: 8,
            color: 'var(--semantic-danger)',
            fontSize: 12,
          }}
        >
          {loadError}
        </div>
      </Card>
    );
  }

  if (!policy) {
    return (
      <Card title={t('approval_policy.title')} description={t('approval_policy.description')}>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{t('loading')}</div>
      </Card>
    );
  }

  const lastUpdated = policy.lastUpdatedAt;
  const lastUpdatedBy = policy.lastUpdatedBy;
  const updatedFooter = lastUpdatedBy
    ? t('approval_policy.last_updated', {
        date: fmtIsoDate(lastUpdated),
        actor: lastUpdatedBy,
      })
    : t('approval_policy.last_updated_default', {
        date: fmtIsoDate(lastUpdated),
      });

  const readOnly = !isOwner;

  return (
    <Card
      title={t('approval_policy.title')}
      description={t('approval_policy.description')}
    >
      <Toast text={toast} onClear={() => setToast(null)} />

      {readOnly && (
        <div
          role="status"
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            background: 'var(--semantic-warning-subtle)',
            border: '1px solid var(--semantic-warning)',
            borderRadius: 8,
            color: 'var(--semantic-warning)',
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertTriangle size={14} />
          <span>{t('approval_policy.owner_only_banner')}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            background: 'var(--semantic-danger-subtle)',
            border: '1px solid var(--semantic-danger)',
            borderRadius: 8,
            color: 'var(--semantic-danger)',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <div
        role="table"
        aria-label={t('approval_policy.title')}
        style={{ marginTop: 6 }}
      >
        {/* Header row */}
        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr 1fr 160px',
            gap: 12,
            padding: '10px 0',
            borderBottom: '1px solid var(--border-default)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
          }}
        >
          <span role="columnheader">{t('approval_policy.col_tier')}</span>
          <span role="columnheader">{t('approval_policy.col_range')}</span>
          <span role="columnheader">{t('approval_policy.col_approver')}</span>
          <span role="columnheader">{t('approval_policy.col_amount')}</span>
        </div>

        {/* Tier 1 — Auto-post */}
        <TierRow
          tierLabel={t('approval_policy.tier_auto')}
          rangeLabel={t('approval_policy.range_below', { value: fmtForWire(toNumber(autoCeil)) || '—' })}
          approverLabel={t('approval_policy.approver_engine')}
          value={autoCeil}
          onChange={setAutoCeil}
          readOnly={readOnly}
          inputStyle={inputStyle}
          ariaLabel={t('approval_policy.field_auto_aria')}
        />

        {/* Tier 2 — Senior accountant */}
        <TierRow
          tierLabel={t('approval_policy.tier_reviewer')}
          rangeLabel={t('approval_policy.range_between', {
            from: fmtForWire(toNumber(autoCeil)) || '—',
            to: fmtForWire(toNumber(reviewerCeil)) || '—',
          })}
          approverLabel={t('approval_policy.approver_reviewer')}
          value={reviewerCeil}
          onChange={setReviewerCeil}
          readOnly={readOnly}
          inputStyle={inputStyle}
          ariaLabel={t('approval_policy.field_reviewer_aria')}
        />

        {/* Tier 3 — CFO */}
        <TierRow
          tierLabel={t('approval_policy.tier_cfo')}
          rangeLabel={t('approval_policy.range_between', {
            from: fmtForWire(toNumber(reviewerCeil)) || '—',
            to: fmtForWire(toNumber(cfoCeil)) || '—',
          })}
          approverLabel={t('approval_policy.approver_cfo')}
          value={cfoCeil}
          onChange={setCfoCeil}
          readOnly={readOnly}
          inputStyle={inputStyle}
          ariaLabel={t('approval_policy.field_cfo_aria')}
        />

        {/* Tier 4 — Board */}
        <TierRow
          tierLabel={t('approval_policy.tier_board')}
          rangeLabel={t('approval_policy.range_at_or_above', {
            value: fmtForWire(toNumber(boardThr)) || '—',
          })}
          approverLabel={t('approval_policy.approver_board')}
          value={boardThr}
          onChange={setBoardThr}
          readOnly={readOnly}
          inputStyle={inputStyle}
          ariaLabel={t('approval_policy.field_board_aria')}
        />
      </div>

      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={handleSave}
          disabled={saving || readOnly}
          aria-disabled={saving || readOnly}
          style={{
            ...btnPrimary(saving),
            opacity: readOnly ? 0.5 : 1,
            cursor: readOnly ? 'not-allowed' : btnPrimary(saving).cursor,
          }}
        >
          {saving ? (
            <>
              <Spinner size={13} />
              &nbsp;{t('approval_policy.saving')}
            </>
          ) : (
            t('approval_policy.save')
          )}
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          <LtrText>{updatedFooter}</LtrText>
        </div>
      </div>
    </Card>
  );
}

/**
 * Single editable row inside the threshold table. Layout matches the
 * column-header grid above so the values line up under the headers.
 */
function TierRow({
  tierLabel,
  rangeLabel,
  approverLabel,
  value,
  onChange,
  readOnly,
  inputStyle,
  ariaLabel,
}) {
  return (
    <div
      role="row"
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr 1fr 160px',
        gap: 12,
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: 12,
      }}
    >
      <span role="cell" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
        {tierLabel}
      </span>
      <span role="cell" style={{ color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>
        <LtrText>{rangeLabel}</LtrText>
      </span>
      <span role="cell" style={{ color: 'var(--text-secondary)' }}>
        {approverLabel}
      </span>
      <span role="cell">
        <input
          type="number"
          inputMode="decimal"
          step="0.001"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          aria-label={ariaLabel}
          style={{
            ...inputStyle,
            opacity: readOnly ? 0.6 : 1,
            cursor: readOnly ? 'not-allowed' : 'text',
          }}
        />
      </span>
    </div>
  );
}
