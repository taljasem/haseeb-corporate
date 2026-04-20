/**
 * Migration Wizard Screen — Track 1 Phase 4 (2026-04-20).
 *
 * 5-step tenant onboarding migration flow:
 *   1. Source system + CSV upload                 → MigrationStep1Source
 *   2. Parse preview                              → MigrationStep2Preview
 *   3. Account mapping                            → MigrationStep3Mapping
 *   4. Batch categorization (source-code groups)  → MigrationStep4Batch
 *   5. Post from staging                          → MigrationStep5Execute
 *
 * Role model:
 *   - CFO + Senior: full edit.
 *   - Owner: read-only (write actions hidden via readOnly prop drilled to each step).
 *   - Junior: blocked at the screen level (EmptyState).
 *
 * All state the wizard needs across steps lives in this component:
 *   - sourceSystem, parserVersion, entityType (Step 1)
 *   - importJobId, lastIngestedEntity (Step 1 → 2/3)
 *
 * Navigation:
 *   - Back: always enabled except on Step 1.
 *   - Next: enabled per per-step gating (Step 1 needs upload, Steps 2/4 allow skip,
 *     Step 3 warns if unmapped codes remain, Step 5 is the terminal step).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Check } from "lucide-react";
import EmptyState from "../../components/shared/EmptyState";
import MigrationStep1Source from "../../components/migration/MigrationStep1Source";
import MigrationStep2Preview from "../../components/migration/MigrationStep2Preview";
import MigrationStep3Mapping from "../../components/migration/MigrationStep3Mapping";
import MigrationStep4Batch from "../../components/migration/MigrationStep4Batch";
import MigrationStep5Execute from "../../components/migration/MigrationStep5Execute";
import { normalizeRole, canEditAdmin, canAccessAdmin } from "../../utils/role";

// HASEEB-155: Senior shares the CFO accent (midsize role model).
const ROLE_ACCENT = {
  Owner: "var(--role-owner)",
  CFO: "var(--accent-primary)",
  Senior: "var(--accent-primary)",
  Junior: "var(--semantic-info)",
};

const STEP_IDS = ["step1", "step2", "step3", "step4", "step5"];

function StepRail({ current, completed, onJumpTo, accent }) {
  const { t } = useTranslation("migration");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "18px 28px",
        borderBottom: "1px solid var(--border-subtle)",
        overflowX: "auto",
      }}
      role="tablist"
      aria-label={t("title")}
    >
      {STEP_IDS.map((id, i) => {
        const isCurrent = current === i;
        const isDone = completed.has(i);
        const isClickable = isDone || i <= Math.max(...Array.from(completed), -1) + 1;
        const circleColor = isCurrent
          ? accent
          : isDone
          ? "var(--accent-primary)"
          : "var(--text-tertiary)";
        const circleBg = isCurrent
          ? `${accent}1A`
          : isDone
          ? "var(--accent-primary-subtle)"
          : "var(--bg-surface)";
        const circleBorder = isCurrent
          ? accent
          : isDone
          ? "var(--accent-primary-border)"
          : "var(--border-default)";
        return (
          <div
            key={id}
            style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={isCurrent}
              aria-label={t(`steps.${id}`)}
              disabled={!isClickable}
              onClick={() => isClickable && onJumpTo(i)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 14px 6px 6px",
                background: "transparent",
                border: "none",
                cursor: isClickable ? "pointer" : "default",
                fontFamily: "inherit",
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 12,
                  fontWeight: 700,
                  color: circleColor,
                  background: circleBg,
                  border: `1px solid ${circleBorder}`,
                  flexShrink: 0,
                }}
              >
                {isDone ? <Check size={14} strokeWidth={2.5} /> : i + 1}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  color: isCurrent
                    ? "var(--text-primary)"
                    : "var(--text-tertiary)",
                  whiteSpace: "nowrap",
                }}
              >
                {t(`steps.${id}`)}
              </span>
            </button>
            {i < STEP_IDS.length - 1 && (
              <span
                aria-hidden="true"
                style={{
                  width: 24,
                  height: 1,
                  background: "var(--border-default)",
                  margin: "0 4px",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReadOnlyBanner() {
  const { t } = useTranslation("migration");
  return (
    <div
      role="note"
      style={{
        margin: "16px 28px 0",
        padding: "10px 14px",
        background: "var(--semantic-info-subtle)",
        border: "1px solid var(--semantic-info-border)",
        borderRadius: 8,
        fontSize: 13,
        color: "var(--semantic-info)",
      }}
    >
      {t("readonly_banner")}
    </div>
  );
}

export default function MigrationWizardScreen({ role: roleRaw = "CFO" }) {
  const role = normalizeRole(roleRaw);
  const { t } = useTranslation("migration");
  const accent = ROLE_ACCENT[role] || "var(--accent-primary)";
  const readOnly = !canEditAdmin(role);

  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState(new Set());
  // Shared wizard state across steps.
  const [sourceSystem, setSourceSystem] = useState("zoho");
  const [parserVersion, setParserVersion] = useState("v1");
  const [entityType, setEntityType] = useState("invoices"); // 'invoices' | 'bills' | 'journal-entries'
  const [importJobId, setImportJobId] = useState(null);
  // Track which entity types have been ingested so Steps 2/5 know what to fetch.
  const [ingestedEntities, setIngestedEntities] = useState(new Set());
  // Optional: filter to jump to in Step 3 from Step 4 individual-review.
  const [step3FilterCode, setStep3FilterCode] = useState(null);

  const viewLabelKey = useMemo(() => {
    if (role === "Owner") return "view_label_owner";
    if (role === "Senior") return "view_label_senior";
    return "view_label_cfo";
  }, [role]);

  if (!canAccessAdmin(role)) {
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "36px 28px" }}>
        <div style={{ maxWidth: 560, margin: "60px auto 0" }}>
          <EmptyState
            icon={Lock}
            title={t("no_access_title")}
            description={t("no_access_description")}
          />
        </div>
      </div>
    );
  }

  const markCompleted = (idx) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  const goNext = () => {
    markCompleted(stepIndex);
    setStepIndex((i) => Math.min(i + 1, STEP_IDS.length - 1));
  };
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));
  const jumpTo = (i) => {
    if (i <= stepIndex || completed.has(i - 1) || i === 0) {
      setStepIndex(i);
    }
  };

  const onIngestComplete = ({ jobId, entity }) => {
    setImportJobId(jobId);
    setIngestedEntities((prev) => {
      const next = new Set(prev);
      next.add(entity);
      return next;
    });
    markCompleted(0);
    setStepIndex(1);
  };

  const onStep3JumpToCode = (code) => {
    setStep3FilterCode(code);
    setStepIndex(2);
  };

  const stepProps = {
    role,
    readOnly,
    accent,
    sourceSystem,
    setSourceSystem,
    parserVersion,
    setParserVersion,
    entityType,
    setEntityType,
    importJobId,
    ingestedEntities,
    onIngestComplete,
    onStep3JumpToCode,
    step3FilterCode,
    setStep3FilterCode,
    goNext,
    goBack,
    markCompleted,
    isFirst: stepIndex === 0,
    isLast: stepIndex === STEP_IDS.length - 1,
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Hero band */}
      <div
        style={{
          padding: "22px 28px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          background: `linear-gradient(180deg, ${accent}1A 0%, transparent 100%)`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.15em",
            color: accent,
          }}
        >
          {t(viewLabelKey)}
        </div>
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 30,
            color: "var(--text-primary)",
            letterSpacing: "-0.3px",
            lineHeight: 1,
            marginTop: 2,
          }}
        >
          {t("title")}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.15em",
            color: "var(--text-tertiary)",
            marginTop: 6,
          }}
        >
          {t("subtitle")}
        </div>
      </div>

      <StepRail
        current={stepIndex}
        completed={completed}
        onJumpTo={jumpTo}
        accent={accent}
      />

      {readOnly && <ReadOnlyBanner />}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "22px 28px 32px",
          minWidth: 0,
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          {stepIndex === 0 && <MigrationStep1Source {...stepProps} />}
          {stepIndex === 1 && <MigrationStep2Preview {...stepProps} />}
          {stepIndex === 2 && <MigrationStep3Mapping {...stepProps} />}
          {stepIndex === 3 && <MigrationStep4Batch {...stepProps} />}
          {stepIndex === 4 && <MigrationStep5Execute {...stepProps} />}
        </div>
      </div>
    </div>
  );
}
