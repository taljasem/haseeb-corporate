/**
 * BoardPackScreen — AUDIT-ACC-056 (2026-04-23).
 *
 * Annual board-pack composite aggregator (FN-258, TASK-WAVE6-BOARD-PACK
 * 2026-04-19). Consumes the single read-only endpoint
 *   GET /api/board-pack?fiscalYear=YYYY
 * and renders a snapshot view composed of four sections:
 *
 *   1. Warnings banner (if any)
 *   2. Current fiscal year — published ReportVersion rows
 *   3. Prior fiscal year — published ReportVersion rows
 *   4. Year-over-year metric comparisons (both years present in each row)
 *   5. Disclosure-note run summaries (current year only)
 *
 * Role gating (backend is OWNER + AUDITOR only — AUDITOR has no
 * frontend role; CFO/Senior/Junior see the role-gate panel and the
 * sidebar entry is intentionally Owner-only — it lives under
 * OwnerSidebar only, not CFOSidebar):
 *
 *   - Owner (OWNER)                    → full read access.
 *   - CFO / Senior (ACCOUNTANT)         → role-gate panel (screen not
 *     mounted from CFOSidebar; surfaces only if someone navigates by
 *     key).
 *   - Junior (VIEWER / AUDITOR)         → role-gate panel.
 *
 * Wall preservation: frontend never calls an LLM. The only endpoint
 * consumed is the read-only board-pack aggregator. No mutations, no
 * JE posting, no writes anywhere.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Briefcase,
  AlertTriangle,
  RefreshCw,
  FileText,
  BarChart3,
  ScrollText,
  Calendar,
} from 'lucide-react';
import Decimal from 'decimal.js';
import EmptyState from '../../components/shared/EmptyState';
import LtrText from '../../components/shared/LtrText';
import { normalizeRole, ROLES } from '../../utils/role';
import { getBoardPack } from '../../engine';

// ── Constants ─────────────────────────────────────────────────────

const CURRENT_CIVIL_YEAR = new Date().getUTCFullYear();

// Reasonable fiscal-year picker range. Backend validates 2000..2100;
// we narrow to the last 10 years so the dropdown stays usable.
const YEAR_RANGE = Array.from({ length: 10 }, (_, i) => CURRENT_CIVIL_YEAR - i);

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Decimal-safe numeric formatter. Backend emits Decimal-safe strings.
 * We NEVER parseFloat per the wall and HASEEB-140 Decimal-preservation
 * patterns; instead, use Decimal.js to format to 3dp with thousands
 * separators. Returns the em-dash for null / empty / non-numeric input.
 */
function formatDecimal(value, { showSign = false } = {}) {
  if (value == null || value === '') return '—';
  try {
    const d = new Decimal(String(value));
    const fixed = d.toFixed(3);
    const [intPart, frac] = fixed.split('.');
    const sign = d.isNegative() ? '-' : showSign && d.isPositive() && !d.isZero() ? '+' : '';
    const absInt = intPart.replace(/^-/, '');
    const grouped = absInt.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${sign}${grouped}.${frac}`;
  } catch {
    return '—';
  }
}

function formatPercent(value) {
  if (value == null || value === '') return '—';
  try {
    const d = new Decimal(String(value));
    return `${d.toFixed(2)}%`;
  } catch {
    return '—';
  }
}

function isoSlice(ts) {
  if (!ts) return '—';
  return String(ts).slice(0, 10);
}

function isoTimestamp(ts) {
  if (!ts) return '—';
  return String(ts).replace('T', ' ').slice(0, 19);
}

// ── Tiny shared primitives ────────────────────────────────────────

function SectionHeader({ icon: Icon, title, count }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      {Icon && (
        <Icon size={18} strokeWidth={1.8} color="var(--text-secondary)" />
      )}
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '0.01em',
        }}
      >
        {title}
      </div>
      {typeof count === 'number' && (
        <span
          style={{
            marginInlineStart: 'auto',
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            color: 'var(--text-tertiary)',
          }}
        >
          <LtrText>{count}</LtrText>
        </span>
      )}
    </div>
  );
}

function TableShell({ children }) {
  return (
    <div
      style={{
        overflowX: 'auto',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        background: 'var(--bg-surface)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
        }}
      >
        {children}
      </table>
    </div>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        textAlign: 'start',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-default)',
        background: 'var(--bg-surface-sunken)',
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, mono = false, align = 'start' }) {
  return (
    <td
      style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-subtle, var(--border-default))',
        color: 'var(--text-secondary)',
        fontFamily: mono ? "'DM Mono', monospace" : undefined,
        fontSize: mono ? 12 : 13,
        textAlign: align,
        verticalAlign: 'top',
      }}
    >
      {children}
    </td>
  );
}

// ── Section renderers ─────────────────────────────────────────────

function ReportVersionsTable({ rows, emptyLabel }) {
  const { t } = useTranslation('boardPack');
  if (!rows || rows.length === 0) {
    return (
      <div
        data-testid="boardpack-empty-reports"
        style={{
          padding: '18px 12px',
          fontSize: 13,
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          border: '1px dashed var(--border-default)',
          borderRadius: 8,
        }}
      >
        {emptyLabel}
      </div>
    );
  }
  return (
    <TableShell>
      <thead>
        <tr>
          <Th>{t('table.report_type')}</Th>
          <Th>{t('table.report_key')}</Th>
          <Th>{t('table.version')}</Th>
          <Th>{t('table.period')}</Th>
          <Th>{t('table.as_of')}</Th>
          <Th>{t('table.published_at')}</Th>
          <Th>{t('table.published_by')}</Th>
          <Th>{t('table.notes')}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={`${r.reportType}|${r.reportKey}|${r.version}`}
            data-testid={`boardpack-report-row-${r.reportType}-${r.reportKey}`}
          >
            <Td>{r.reportType}</Td>
            <Td mono>{r.reportKey}</Td>
            <Td mono align="end">
              <LtrText>v{r.version}</LtrText>
            </Td>
            <Td mono>
              <LtrText>
                {isoSlice(r.periodFrom)} → {isoSlice(r.periodTo)}
              </LtrText>
            </Td>
            <Td mono>
              <LtrText>{isoSlice(r.asOfDate)}</LtrText>
            </Td>
            <Td mono>
              <LtrText>{isoTimestamp(r.publishedAt)}</LtrText>
            </Td>
            <Td>{r.publishedBy}</Td>
            <Td>{r.notes || '—'}</Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function YoYComparisonTable({ comparisons }) {
  const { t } = useTranslation('boardPack');
  if (!comparisons || comparisons.length === 0) {
    return (
      <div
        data-testid="boardpack-empty-yoy"
        style={{
          padding: '18px 12px',
          fontSize: 13,
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          border: '1px dashed var(--border-default)',
          borderRadius: 8,
        }}
      >
        {t('empty_section.yoy')}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {comparisons.map((c) => (
        <div
          key={`${c.reportType}|${c.reportKey}`}
          data-testid={`boardpack-yoy-${c.reportType}-${c.reportKey}`}
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            padding: '14px 16px',
            background: 'var(--bg-surface)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {c.reportType}
            </div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                color: 'var(--text-tertiary)',
              }}
            >
              {c.reportKey}
            </div>
          </div>
          <TableShell>
            <thead>
              <tr>
                <Th>{t('table.metric')}</Th>
                <Th>{t('table.prior_value')}</Th>
                <Th>{t('table.current_value')}</Th>
                <Th>{t('table.delta')}</Th>
                <Th>{t('table.delta_pct')}</Th>
              </tr>
            </thead>
            <tbody>
              {c.metrics.map((m) => (
                <tr
                  key={m.metricName}
                  data-testid={`boardpack-yoy-metric-${c.reportType}-${c.reportKey}-${m.metricName}`}
                >
                  <Td>{m.metricName}</Td>
                  <Td mono align="end">
                    <LtrText>{formatDecimal(m.priorValue)}</LtrText>
                  </Td>
                  <Td mono align="end">
                    <LtrText>{formatDecimal(m.currentValue)}</LtrText>
                  </Td>
                  <Td mono align="end">
                    <LtrText>{formatDecimal(m.deltaAbsolute, { showSign: true })}</LtrText>
                  </Td>
                  <Td mono align="end">
                    <LtrText>{formatPercent(m.deltaPercent)}</LtrText>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </div>
      ))}
    </div>
  );
}

function DisclosureSummariesTable({ summaries }) {
  const { t } = useTranslation('boardPack');
  if (!summaries || summaries.length === 0) {
    return (
      <div
        data-testid="boardpack-empty-disclosures"
        style={{
          padding: '18px 12px',
          fontSize: 13,
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          border: '1px dashed var(--border-default)',
          borderRadius: 8,
        }}
      >
        {t('empty_section.disclosures')}
      </div>
    );
  }
  return (
    <TableShell>
      <thead>
        <tr>
          <Th>{t('table.run_id')}</Th>
          <Th>{t('table.language')}</Th>
          <Th>{t('table.approved_at')}</Th>
          <Th>{t('table.material_note_count')}</Th>
        </tr>
      </thead>
      <tbody>
        {summaries.map((s) => (
          <tr key={s.runId} data-testid={`boardpack-disclosure-${s.runId}`}>
            <Td mono>
              <LtrText>{s.runId}</LtrText>
            </Td>
            <Td mono>
              <LtrText>{s.language}</LtrText>
            </Td>
            <Td mono>
              <LtrText>{isoTimestamp(s.approvedAt)}</LtrText>
            </Td>
            <Td mono align="end">
              <LtrText>{s.materialNoteCount}</LtrText>
            </Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function WarningsPanel({ warnings }) {
  const { t } = useTranslation('boardPack');
  if (!warnings || warnings.length === 0) return null;
  return (
    <div
      data-testid="boardpack-warnings"
      style={{
        marginBottom: 16,
        padding: '12px 14px',
        border: '1px solid var(--semantic-warning)',
        background: 'var(--semantic-warning-subtle)',
        borderRadius: 8,
        color: 'var(--semantic-warning)',
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        <AlertTriangle size={16} strokeWidth={2} />
        {t('warnings.label')}
      </div>
      <ul
        style={{
          margin: 0,
          paddingInlineStart: 20,
          color: 'var(--text-primary)',
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

// ── Role gate panel ───────────────────────────────────────────────

function RoleGate() {
  const { t } = useTranslation('boardPack');
  return (
    <div
      data-testid="boardpack-role-gate"
      style={{
        padding: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
      }}
    >
      <EmptyState
        icon={Briefcase}
        title={t('role_gate.title')}
        description={t('role_gate.description')}
      />
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────

export default function BoardPackScreen({ role = 'Owner' }) {
  const { t } = useTranslation('boardPack');
  const normRole = normalizeRole(role);
  const isOwner = normRole === ROLES.OWNER;

  const [fiscalYear, setFiscalYear] = useState(CURRENT_CIVIL_YEAR - 1);
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (fy) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getBoardPack({ fiscalYear: fy });
      setPack(result || null);
    } catch (e) {
      setError(e?.message || 'unknown error');
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    load(fiscalYear);
  }, [isOwner, fiscalYear, load]);

  const headerMeta = useMemo(() => {
    if (!pack) return null;
    return {
      fiscalYear: pack.fiscalYear,
      priorFiscalYear: pack.priorFiscalYear,
      generatedAt: pack.generatedAt,
    };
  }, [pack]);

  if (!isOwner) return <RoleGate />;

  const hasAnyContent =
    pack &&
    ((pack.currentReportVersions || []).length > 0 ||
      (pack.priorReportVersions || []).length > 0 ||
      (pack.yoyComparisons || []).length > 0 ||
      (pack.disclosureSummaries || []).length > 0);

  return (
    <div
      data-testid="boardpack-screen"
      style={{
        flex: 1,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflowY: 'auto',
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
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 6,
            }}
          >
            <Briefcase size={20} strokeWidth={1.8} color="var(--text-primary)" />
            <h1
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              {t('title')}
            </h1>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              maxWidth: 720,
            }}
          >
            {t('description')}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <label
            htmlFor="boardpack-year-select"
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {t('fiscal_year_label')}
          </label>
          <select
            id="boardpack-year-select"
            data-testid="boardpack-year-select"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))}
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 13,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
            }}
          >
            {YEAR_RANGE.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            data-testid="boardpack-reload"
            onClick={() => load(fiscalYear)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: loading ? 'progress' : 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <RefreshCw size={14} strokeWidth={2} />
            {t('reload')}
          </button>
        </div>
      </div>

      {/* Meta strip */}
      {headerMeta && (
        <div
          data-testid="boardpack-meta"
          style={{
            display: 'flex',
            gap: 24,
            padding: '10px 14px',
            background: 'var(--bg-surface-sunken)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-tertiary)' }}>
              {t('fiscal_year_label')}:
            </span>{' '}
            <LtrText>
              <strong style={{ color: 'var(--text-primary)' }}>
                {headerMeta.fiscalYear}
              </strong>
            </LtrText>
          </div>
          <div>
            <span style={{ color: 'var(--text-tertiary)' }}>
              {t('prior_year_label')}:
            </span>{' '}
            <LtrText>
              <strong style={{ color: 'var(--text-primary)' }}>
                {headerMeta.priorFiscalYear}
              </strong>
            </LtrText>
          </div>
          <div>
            <span style={{ color: 'var(--text-tertiary)' }}>
              {t('generated_at_label')}:
            </span>{' '}
            <LtrText>{isoTimestamp(headerMeta.generatedAt)}</LtrText>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          data-testid="boardpack-error"
          style={{
            padding: '12px 14px',
            border: '1px solid var(--semantic-danger)',
            background: 'var(--semantic-danger-subtle)',
            borderRadius: 8,
            color: 'var(--semantic-danger)',
            fontSize: 13,
          }}
        >
          {t('errors.load_failed', { message: error })}
        </div>
      )}

      {/* Loading */}
      {loading && !pack && (
        <div
          data-testid="boardpack-loading"
          style={{
            padding: 32,
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 13,
          }}
        >
          {t('loading')}
        </div>
      )}

      {/* Warnings */}
      {pack && <WarningsPanel warnings={pack.warnings} />}

      {/* Content or empty */}
      {pack && !hasAnyContent && !loading && (
        <div
          data-testid="boardpack-empty"
          style={{
            padding: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <EmptyState
            icon={Briefcase}
            title={t('empty.title')}
            description={t('empty.description')}
          />
        </div>
      )}

      {pack && hasAnyContent && (
        <>
          {/* Current reports */}
          <section data-testid="boardpack-section-current">
            <SectionHeader
              icon={FileText}
              title={t('sections.current_reports')}
              count={(pack.currentReportVersions || []).length}
            />
            <ReportVersionsTable
              rows={pack.currentReportVersions}
              emptyLabel={t('empty_section.current_reports')}
            />
          </section>

          {/* Prior reports */}
          <section data-testid="boardpack-section-prior">
            <SectionHeader
              icon={Calendar}
              title={t('sections.prior_reports')}
              count={(pack.priorReportVersions || []).length}
            />
            <ReportVersionsTable
              rows={pack.priorReportVersions}
              emptyLabel={t('empty_section.prior_reports')}
            />
          </section>

          {/* YoY comparisons */}
          <section data-testid="boardpack-section-yoy">
            <SectionHeader
              icon={BarChart3}
              title={t('sections.yoy')}
              count={(pack.yoyComparisons || []).length}
            />
            <YoYComparisonTable comparisons={pack.yoyComparisons} />
          </section>

          {/* Disclosure summaries */}
          <section data-testid="boardpack-section-disclosures">
            <SectionHeader
              icon={ScrollText}
              title={t('sections.disclosures')}
              count={(pack.disclosureSummaries || []).length}
            />
            <DisclosureSummariesTable summaries={pack.disclosureSummaries} />
          </section>
        </>
      )}
    </div>
  );
}
