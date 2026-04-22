/**
 * CitAssessmentSummaryWidget — AUDIT-ACC-057 (2026-04-22).
 *
 * Replaces the full `CitAssessmentSection` inside SetupScreen. The full
 * case management moved to the standalone CITAssessmentScreen under a
 * dedicated sidebar entry. Setup preserves a visible CIT status
 * footprint via this compact widget so operators landing in Setup can
 * see:
 *   - Most-recent case (fiscal year + status + statute countdown when
 *     approaching).
 *   - Approaching-statute warning count.
 *   - Link to open the full CIT case management screen.
 *
 * Setup's "cit_assessment" settings category (foreignOnly-gated with
 * the Gavel icon) is preserved — only the section content changes.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Clock, AlertTriangle, Gavel } from 'lucide-react';
import LtrText from '../shared/LtrText';
import {
  listCitAssessments,
  listApproachingStatute,
} from '../../engine';

const APPROACHING_WARN_DAYS = 180;

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

export default function CitAssessmentSummaryWidget({ onOpenScreen }) {
  const { t } = useTranslation('citAssessment');
  const [cases, setCases] = useState(null);
  const [approaching, setApproaching] = useState([]);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [list, sweep] = await Promise.all([
          listCitAssessments({}),
          listApproachingStatute({ withinDays: APPROACHING_WARN_DAYS }).catch(
            () => [],
          ),
        ]);
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        arr.sort((a, b) => (b.fiscalYear || 0) - (a.fiscalYear || 0));
        setCases(arr);
        const approachingRows = (sweep || []).map((row) =>
          row.assessment ? row.assessment : row,
        );
        setApproaching(approachingRows);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err?.message || t('summary.error_load'));
        setCases([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const mostRecent = cases && cases.length > 0 ? cases[0] : null;
  const openCount = cases
    ? cases.filter(
        (c) => c.status !== 'CLOSED' && c.status !== 'STATUTE_EXPIRED',
      ).length
    : 0;
  const statuteDays = mostRecent ? daysUntil(mostRecent.statuteExpiresOn) : null;
  const approachingCount = approaching.length;

  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 14,
          lineHeight: 1.5,
        }}
      >
        {t('summary.widget_description')}
      </div>

      {loadError && (
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
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 14,
        }}
      >
        {/* Most-recent card */}
        <div
          data-testid="cit-summary-most-recent"
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '14px 16px',
            background: 'var(--bg-surface-sunken)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.15em',
              color: 'var(--text-tertiary)',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Gavel size={12} /> {t('summary.most_recent_label')}
          </div>
          {mostRecent ? (
            <>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                <LtrText>FY{mostRecent.fiscalYear}</LtrText>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  marginTop: 6,
                }}
              >
                {t(`status.${mostRecent.status}`)}
              </div>
              {statuteDays != null &&
                statuteDays <= APPROACHING_WARN_DAYS &&
                mostRecent.status !== 'CLOSED' &&
                mostRecent.status !== 'STATUTE_EXPIRED' && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--semantic-warning)',
                      marginTop: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Clock size={11} />
                    {statuteDays < 0
                      ? t('year_list.statute_overdue', {
                          count: Math.abs(statuteDays),
                        })
                      : t('year_list.days_remaining', { count: statuteDays })}
                  </div>
                )}
            </>
          ) : (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-tertiary)',
                fontStyle: 'italic',
              }}
            >
              {t('summary.most_recent_none')}
            </div>
          )}
        </div>

        {/* Open-count card */}
        <div
          data-testid="cit-summary-open-count"
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '14px 16px',
            background: 'var(--bg-surface-sunken)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.15em',
              color: 'var(--text-tertiary)',
              marginBottom: 6,
            }}
          >
            {t('summary.widget_title')}
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 26,
              fontWeight: 700,
              color:
                openCount > 0
                  ? 'var(--accent-primary)'
                  : 'var(--text-tertiary)',
            }}
          >
            <LtrText>{openCount}</LtrText>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginTop: 4,
            }}
          >
            {openCount > 0
              ? t('summary.open_count', { count: openCount })
              : t('summary.open_count_zero')}
          </div>
        </div>

        {/* Approaching-statute card */}
        <div
          data-testid="cit-summary-approaching"
          style={{
            border:
              approachingCount > 0
                ? '1px solid var(--semantic-warning)'
                : '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '14px 16px',
            background:
              approachingCount > 0
                ? 'var(--semantic-warning-subtle)'
                : 'var(--bg-surface-sunken)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.15em',
              color:
                approachingCount > 0
                  ? 'var(--semantic-warning)'
                  : 'var(--text-tertiary)',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Clock size={12} />
            {approachingCount > 0
              ? t('summary.approaching_label', { count: approachingCount })
              : t('summary.approaching_label_zero')}
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 26,
              fontWeight: 700,
              color:
                approachingCount > 0
                  ? 'var(--semantic-warning)'
                  : 'var(--text-tertiary)',
            }}
          >
            <LtrText>{approachingCount}</LtrText>
          </div>
        </div>
      </div>

      {onOpenScreen && (
        <button
          type="button"
          onClick={onOpenScreen}
          data-testid="cit-summary-open-screen-link"
          style={{
            background: 'transparent',
            border: '1px solid var(--border-strong)',
            color: 'var(--accent-primary)',
            padding: '10px 16px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {t('summary.view_full_link')}
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
