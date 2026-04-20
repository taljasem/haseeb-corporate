/**
 * Migration Wizard Step 3 — Account mapping.
 *
 * Lists SourceAccountMap rows (all, then client-filtered to UNMAPPED/
 * AMBIGUOUS/REJECTED) and lets the user:
 *   - Accept the single best suggestion (→ PATCH status=MAPPED).
 *   - Dismiss the suggestion (→ PATCH status=REJECTED).
 *   - Manual-map to a role from a shortlist modal (→ PATCH status=MAPPED).
 *   - "Suggest all" to recompute suggestions for every UNMAPPED row.
 *
 * Cohort signal: when row.suggestionReason === 'cohort_match', render a
 * teal "Cross-tenant pattern" chip.
 *
 * UX decisions (Phase 4 autonomy):
 *   - Top-3 suggestions via decline-and-refetch is available as a future
 *     enhancement; for v1 we surface only the single current best
 *     suggestion with confidence + reason chip.
 *   - Manual-map picker uses a ~30-role shortlist baked into i18n
 *     "roles" namespace entries. Full role picker needs a backend
 *     accounts/roles endpoint (flagged in commit).
 *   - "Next" is always enabled; the screen shows a soft warning count
 *     of rows still unmapped.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import {
  Check,
  X,
  Edit3,
  Sparkles,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Users,
} from "lucide-react";
import LtrText from "../shared/LtrText";
import Spinner from "../shared/Spinner";
import EmptyState from "../shared/EmptyState";
import {
  listSourceAccountMap,
  suggestAllSourceMap,
  updateSourceMap,
} from "../../engine";

const ROLE_SHORTLIST = [
  "COGS_GOODS",
  "REVENUE_SALES",
  "REVENUE_SERVICES",
  "REVENUE_OTHER",
  "BANK_PRIMARY",
  "BANK_SECONDARY",
  "CASH_ON_HAND",
  "ACCOUNTS_RECEIVABLE",
  "ACCOUNTS_PAYABLE",
  "INVENTORY_ASSET",
  "FIXED_ASSETS",
  "ACCUMULATED_DEPRECIATION",
  "VAT_INPUT",
  "VAT_OUTPUT",
  "WHT_PAYABLE",
  "PAYROLL_EXPENSE",
  "RENT_EXPENSE",
  "UTILITIES_EXPENSE",
  "TELECOM_EXPENSE",
  "OFFICE_SUPPLIES",
  "MARKETING_EXPENSE",
  "PROFESSIONAL_FEES",
  "BANK_FEES",
  "INTEREST_EXPENSE",
  "DEPRECIATION_EXPENSE",
  "FX_GAIN_LOSS",
  "OTHER_EXPENSE",
  "RETAINED_EARNINGS",
  "SHARE_CAPITAL",
  "OWNER_DRAWINGS",
];

export default function MigrationStep3Mapping({
  role,
  readOnly,
  accent,
  sourceSystem,
  goNext,
  goBack,
  step3FilterCode,
  setStep3FilterCode,
}) {
  const { t } = useTranslation("migration");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestAllRunning, setSuggestAllRunning] = useState(false);
  const [toast, setToast] = useState(null);
  const [manualMap, setManualMap] = useState(null); // { row } or null

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listSourceAccountMap({
        sourceSystem,
        limit: 500,
      });
      setRows(Array.isArray(r) ? r : []);
    } catch (err) {
      setError(err?.message || t("step3.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [sourceSystem, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const total = rows.length;
  const mappedCount = useMemo(
    () => rows.filter((r) => r.status === "MAPPED").length,
    [rows],
  );

  const displayedRows = useMemo(() => {
    // Show everything that is not yet MAPPED; if a filter code is set
    // (from Step 4 "individual review"), narrow to just that code.
    let list = rows.filter((r) => r.status !== "MAPPED");
    if (step3FilterCode) {
      list = list.filter((r) => r.sourceCode === step3FilterCode);
    }
    return list;
  }, [rows, step3FilterCode]);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  };

  const accept = async (row) => {
    if (readOnly || !row.suggestedHaseebAccountRole) return;
    try {
      await updateSourceMap(row.id, {
        status: "MAPPED",
        haseebAccountRole: row.suggestedHaseebAccountRole,
        confidence: row.confidence ?? 100,
      });
      showToast(t("step3.accepted"));
      reload();
    } catch (err) {
      setError(err?.message || t("errors.generic"));
    }
  };

  const dismiss = async (row) => {
    if (readOnly) return;
    try {
      await updateSourceMap(row.id, {
        status: "REJECTED",
      });
      showToast(t("step3.dismissed"));
      reload();
    } catch (err) {
      setError(err?.message || t("errors.generic"));
    }
  };

  const onSuggestAll = async () => {
    if (readOnly) return;
    setSuggestAllRunning(true);
    try {
      await suggestAllSourceMap();
      reload();
    } catch (err) {
      setError(err?.message || t("errors.generic"));
    } finally {
      setSuggestAllRunning(false);
    }
  };

  const saveManualMap = async (row, role) => {
    if (readOnly || !role) return;
    try {
      await updateSourceMap(row.id, {
        status: "MAPPED",
        haseebAccountRole: role,
        confidence: 100,
      });
      setManualMap(null);
      showToast(t("step3.accepted"));
      reload();
    } catch (err) {
      setError(err?.message || t("errors.generic"));
    }
  };

  const clearFilter = () => setStep3FilterCode(null);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <Spinner size={24} color="var(--text-secondary)" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionHeader
        title={t("step3.title")}
        description={t("step3.description")}
      />

      {/* Controls row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.05em",
            color: "var(--text-tertiary)",
          }}
        >
          {/* HASEEB-161: previous approach called t() with empty interpolation
              values, then string-replaced the raw `{{mapped}}` / `{{total}}`
              placeholders out of the output to slot in LtrText spans
              separately. In Arabic that left the sentence fragments without
              their numbers (collapsed to "من أصل رموز مربوطة"). Switched to
              <Trans> with a `components` mapping so the LtrText wrappers are
              embedded directly into the localised template string
              (`<l>{{mapped}}</l>` in both EN/AR resources). */}
          <Trans
            i18nKey="step3.mapped_of_total"
            ns="migration"
            values={{ mapped: mappedCount, total }}
            components={{
              l: (
                <LtrText
                  style={{ fontFamily: "'DM Mono', monospace", color: "var(--text-primary)" }}
                />
              ),
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {step3FilterCode && (
            <button
              type="button"
              onClick={clearFilter}
              style={secondaryBtnStyle}
            >
              <X size={14} />
              <LtrText style={{ fontFamily: "'DM Mono', monospace" }}>
                {step3FilterCode}
              </LtrText>
            </button>
          )}
          <button
            type="button"
            onClick={onSuggestAll}
            disabled={readOnly || suggestAllRunning}
            style={{
              ...primaryBtnStyle(accent),
              opacity: readOnly || suggestAllRunning ? 0.55 : 1,
              cursor: readOnly || suggestAllRunning ? "not-allowed" : "pointer",
            }}
          >
            {suggestAllRunning ? (
              <>
                <Spinner size={14} color="#fff" />
                {t("step3.suggesting")}
              </>
            ) : (
              <>
                <Sparkles size={14} />
                {t("step3.suggest_all")}
              </>
            )}
          </button>
        </div>
      </div>

      {error && <ErrorBanner text={error} />}

      {displayedRows.length === 0 ? (
        <EmptyState icon={Check} title={t("step3.empty")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {displayedRows.map((row) => (
            <MappingRow
              key={row.id}
              row={row}
              readOnly={readOnly}
              accent={accent}
              onAccept={() => accept(row)}
              onDismiss={() => dismiss(row)}
              onManualMap={() => setManualMap({ row })}
            />
          ))}
        </div>
      )}

      {toast && <Toast text={toast} />}

      {manualMap && (
        <ManualMapModal
          row={manualMap.row}
          onClose={() => setManualMap(null)}
          onSave={saveManualMap}
          accent={accent}
        />
      )}

      <NavRow goBack={goBack} goNext={goNext} accent={accent} />
    </div>
  );
}

function MappingRow({ row, readOnly, accent, onAccept, onDismiss, onManualMap }) {
  const { t } = useTranslation("migration");
  const reason = row.suggestionReason;
  const reasonKey =
    reason === "name_match"
      ? "reason_name_match"
      : reason === "role_token_match"
      ? "reason_role_token_match"
      : reason === "cohort_match"
      ? "reason_cohort_match"
      : null;
  const isCohort = reason === "cohort_match";
  const suggestedRole = row.suggestedHaseebAccountRole;
  const confidence = row.confidence;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr) minmax(0, 2fr)",
        gap: 16,
        alignItems: "center",
        padding: "14px 16px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 8,
      }}
    >
      {/* Source code + name */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <LtrText
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.sourceCode}
        </LtrText>
        {row.sourceName && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.sourceName}
          </div>
        )}
      </div>

      {/* Suggestion + reason chip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        {suggestedRole ? (
          <>
            <span
              style={{
                padding: "4px 10px",
                background: "var(--accent-primary-subtle)",
                border: "1px solid var(--accent-primary-border)",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent-primary)",
              }}
            >
              {t(`roles.${suggestedRole}`, { defaultValue: suggestedRole })}
            </span>
            {confidence != null && (
              <LtrText
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                }}
              >
                {confidence}%
              </LtrText>
            )}
            {reasonKey && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  background: isCohort
                    ? "var(--accent-primary-subtle)"
                    : "var(--bg-surface-sunken)",
                  border: `1px solid ${
                    isCohort ? "var(--accent-primary-border)" : "var(--border-default)"
                  }`,
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: isCohort ? "var(--accent-primary)" : "var(--text-tertiary)",
                }}
              >
                {isCohort && <Users size={10} />}
                {t(`step3.${reasonKey}`)}
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {t("step3.no_suggestion")}
          </span>
        )}
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={onAccept}
          disabled={readOnly || !suggestedRole}
          aria-label={t("step3.accept")}
          style={{
            ...actionBtnStyle,
            color: "var(--accent-primary)",
            borderColor: "var(--accent-primary-border)",
            opacity: readOnly || !suggestedRole ? 0.4 : 1,
            cursor: readOnly || !suggestedRole ? "not-allowed" : "pointer",
          }}
        >
          <Check size={13} />
          {t("step3.accept")}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={readOnly}
          aria-label={t("step3.dismiss")}
          style={{
            ...actionBtnStyle,
            color: "var(--text-secondary)",
            borderColor: "var(--border-default)",
            opacity: readOnly ? 0.4 : 1,
            cursor: readOnly ? "not-allowed" : "pointer",
          }}
        >
          <X size={13} />
          {t("step3.dismiss")}
        </button>
        <button
          type="button"
          onClick={onManualMap}
          disabled={readOnly}
          aria-label={t("step3.manual_map")}
          style={{
            ...actionBtnStyle,
            color: "var(--text-secondary)",
            borderColor: "var(--border-default)",
            opacity: readOnly ? 0.4 : 1,
            cursor: readOnly ? "not-allowed" : "pointer",
          }}
        >
          <Edit3 size={13} />
          {t("step3.manual_map")}
        </button>
      </div>
    </div>
  );
}

function ManualMapModal({ row, onClose, onSave, accent }) {
  const { t } = useTranslation("migration");
  const [selectedRole, setSelectedRole] = useState(
    row.suggestedHaseebAccountRole || "",
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("step3.manual_map_title")}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520,
          width: "100%",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 10,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {t("step3.manual_map_title")}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              marginTop: 4,
              fontStyle: "italic",
            }}
          >
            {t("step3.manual_map_hint")}
          </div>
        </div>

        <div
          style={{
            padding: "8px 12px",
            background: "var(--bg-surface-sunken)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          <LtrText style={{ fontFamily: "'DM Mono', monospace", color: "var(--text-primary)" }}>
            {row.sourceCode}
          </LtrText>
          {row.sourceName && <> — {row.sourceName}</>}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 6,
          }}
        >
          {ROLE_SHORTLIST.map((role) => {
            const isSelected = selectedRole === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                aria-pressed={isSelected}
                style={{
                  padding: "8px 12px",
                  background: isSelected ? `${accent}1A` : "var(--bg-surface)",
                  border: `1px solid ${
                    isSelected ? accent : "var(--border-default)"
                  }`,
                  borderRadius: 4,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 500,
                  color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                  textAlign: "start",
                }}
              >
                {t(`roles.${role}`, { defaultValue: role })}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={secondaryBtnStyle}
          >
            {t("step3.manual_map_cancel")}
          </button>
          <button
            type="button"
            onClick={() => onSave(row, selectedRole)}
            disabled={!selectedRole}
            style={{
              ...primaryBtnStyle(accent),
              opacity: !selectedRole ? 0.55 : 1,
              cursor: !selectedRole ? "not-allowed" : "pointer",
            }}
          >
            {t("step3.manual_map_save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small shared subcomponents ────────────────────────────────────────

function SectionHeader({ title, description }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 18,
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          marginTop: 4,
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </div>
  );
}

function ErrorBanner({ text }) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        background: "var(--semantic-danger-subtle)",
        border: "1px solid var(--semantic-danger-border)",
        borderRadius: 6,
        fontSize: 13,
        color: "var(--semantic-danger)",
      }}
    >
      <AlertCircle size={14} />
      <span>{text}</span>
    </div>
  );
}

function Toast({ text }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 24,
        insetInlineEnd: 24,
        background: "var(--accent-primary)",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        zIndex: 90,
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      }}
    >
      {text}
    </div>
  );
}

function NavRow({ goBack, goNext, accent }) {
  const { t } = useTranslation("migration");
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 12,
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <button type="button" onClick={goBack} style={secondaryBtnStyle}>
        <ArrowLeft size={14} />
        {t("nav.back")}
      </button>
      <button type="button" onClick={goNext} style={primaryBtnStyle(accent)}>
        {t("nav.next")}
        <ArrowRight size={14} />
      </button>
    </div>
  );
}

const actionBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 10px",
  background: "transparent",
  border: "1px solid var(--border-default)",
  borderRadius: 4,
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 500,
};

const secondaryBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  background: "transparent",
  border: "1px solid var(--border-default)",
  borderRadius: 6,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-secondary)",
};

function primaryBtnStyle(accent) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    background: accent,
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
  };
}
