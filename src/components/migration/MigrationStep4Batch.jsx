/**
 * Migration Wizard Step 4 — Batch categorization.
 *
 * Groups staged-row line items by sourceAccountCode and presents bulk
 * apply prompts for groups with >= 3 lines. Applies mappings via
 * per-SourceAccountMap-row PATCH (no batch endpoint yet — flagged).
 *
 * UX decisions (Phase 4 autonomy):
 *   - Source-code grouping has a direct backend path (update source-map
 *     rows). Vendor-based grouping does NOT — deferred with an inline
 *     banner.
 *   - Groups with size < 3 are hidden (not worth a bulk prompt).
 *   - "Individual review" jumps to Step 3 filtered by the code via
 *     onStep3JumpToCode callback.
 *   - The step is skippable; "Next" is always enabled.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Layers,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
} from "lucide-react";
import LtrText from "../shared/LtrText";
import Spinner from "../shared/Spinner";
import EmptyState from "../shared/EmptyState";
import {
  listStagedInvoices,
  listStagedBills,
  listStagedJournalEntries,
  listSourceAccountMap,
  updateSourceMap,
} from "../../engine";

const MIN_GROUP_SIZE = 3;

export default function MigrationStep4Batch({
  readOnly,
  accent,
  sourceSystem,
  importJobId,
  ingestedEntities,
  goNext,
  goBack,
  onStep3JumpToCode,
}) {
  const { t } = useTranslation("migration");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stagedRows, setStagedRows] = useState([]);
  const [mapRows, setMapRows] = useState([]);
  const [applying, setApplying] = useState(null); // code currently applying
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let alive = true;
    const fetchAll = async () => {
      if (!importJobId) return;
      setLoading(true);
      setError(null);
      try {
        const tasks = [listSourceAccountMap({ sourceSystem, limit: 500 })];
        if (ingestedEntities.has("invoices")) {
          tasks.push(listStagedInvoices({ importJobId, limit: 500 }));
        }
        if (ingestedEntities.has("bills")) {
          tasks.push(listStagedBills({ importJobId, limit: 500 }));
        }
        if (ingestedEntities.has("journal-entries")) {
          tasks.push(listStagedJournalEntries({ importJobId, limit: 500 }));
        }
        const results = await Promise.all(tasks);
        if (!alive) return;
        const [mapr, ...stagedLists] = results;
        setMapRows(mapr || []);
        setStagedRows(stagedLists.flat());
      } catch (err) {
        if (!alive) return;
        setError(err?.message || t("errors.generic"));
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchAll();
    return () => {
      alive = false;
    };
  }, [importJobId, ingestedEntities, sourceSystem, t]);

  // Build the groups: { sourceCode -> { count: N, mapRow: SourceAccountMapRow | null } }
  const groups = useMemo(() => {
    const byCode = new Map();
    for (const row of stagedRows) {
      for (const line of row.lines || []) {
        const code = line.sourceAccountCode;
        if (!code) continue;
        byCode.set(code, (byCode.get(code) || 0) + 1);
      }
    }
    const mapByCode = new Map(mapRows.map((r) => [r.sourceCode, r]));
    return Array.from(byCode.entries())
      .filter(([, count]) => count >= MIN_GROUP_SIZE)
      .map(([code, count]) => ({
        code,
        count,
        mapRow: mapByCode.get(code) || null,
      }))
      .sort((a, b) => b.count - a.count);
  }, [stagedRows, mapRows]);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  };

  const applyGroup = async (group) => {
    if (readOnly || !group.mapRow || !group.mapRow.suggestedHaseebAccountRole)
      return;
    setApplying(group.code);
    setError(null);
    try {
      await updateSourceMap(group.mapRow.id, {
        status: "MAPPED",
        haseebAccountRole: group.mapRow.suggestedHaseebAccountRole,
        confidence: group.mapRow.confidence ?? 100,
      });
      // Reflect optimistically by reloading just the map.
      const fresh = await listSourceAccountMap({ sourceSystem, limit: 500 });
      setMapRows(fresh || []);
      showToast(t("step4.applied", { count: group.count }));
    } catch (err) {
      setError(err?.message || t("step4.apply_failed"));
    } finally {
      setApplying(null);
    }
  };

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
        title={t("step4.title")}
        description={t("step4.description")}
      />

      {error && <ErrorBanner text={error} />}

      {/* Vendor-deferred note */}
      <div
        role="note"
        style={{
          padding: "10px 12px",
          background: "var(--semantic-info-subtle)",
          border: "1px solid var(--semantic-info-border)",
          borderRadius: 6,
          fontSize: 12,
          color: "var(--semantic-info)",
        }}
      >
        {t("step4.vendor_group_deferred")}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={t("step4.no_groups")}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {groups.map((g) => (
            <GroupCard
              key={g.code}
              group={g}
              readOnly={readOnly}
              accent={accent}
              applying={applying === g.code}
              onApply={() => applyGroup(g)}
              onIndividualReview={() => onStep3JumpToCode(g.code)}
            />
          ))}
        </div>
      )}

      {toast && <Toast text={toast} />}

      <NavRow goBack={goBack} goNext={goNext} accent={accent} />
    </div>
  );
}

function GroupCard({ group, readOnly, accent, applying, onApply, onIndividualReview }) {
  const { t } = useTranslation("migration");
  const suggestedRole = group.mapRow?.suggestedHaseebAccountRole;
  const isMapped = group.mapRow?.status === "MAPPED";
  const mappedRole = group.mapRow?.haseebAccountRole;

  const prompt = suggestedRole
    ? t("step4.group_prompt", {
        count: group.count,
        code: group.code,
        role: t(`roles.${suggestedRole}`, { defaultValue: suggestedRole }),
      })
    : t("step4.group_prompt_unmapped", {
        count: group.count,
        code: group.code,
      });

  return (
    <div
      style={{
        padding: "14px 16px",
        background: "var(--bg-surface)",
        border: `1px solid ${
          isMapped ? "var(--accent-primary-border)" : "var(--border-default)"
        }`,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <LtrText
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-primary)",
            padding: "3px 8px",
            background: "var(--bg-surface-sunken)",
            borderRadius: 4,
          }}
        >
          {group.code}
        </LtrText>
        {isMapped && mappedRole && (
          <span
            style={{
              padding: "3px 8px",
              background: "var(--accent-primary-subtle)",
              border: "1px solid var(--accent-primary-border)",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              color: "var(--accent-primary)",
            }}
          >
            <Check size={11} style={{ marginInlineEnd: 4, verticalAlign: "text-bottom" }} />
            {t(`roles.${mappedRole}`, { defaultValue: mappedRole })}
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        {prompt}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={onApply}
          disabled={readOnly || !suggestedRole || isMapped || applying}
          style={{
            ...primaryBtnStyle(accent),
            opacity:
              readOnly || !suggestedRole || isMapped || applying ? 0.55 : 1,
            cursor:
              readOnly || !suggestedRole || isMapped || applying
                ? "not-allowed"
                : "pointer",
          }}
        >
          {applying ? (
            <>
              <Spinner size={13} color="#fff" />
              {t("step4.applying")}
            </>
          ) : (
            <>
              <Check size={13} />
              {t("step4.apply")}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onIndividualReview}
          style={secondaryBtnStyle}
        >
          {t("step4.individual_review")}
        </button>
      </div>
    </div>
  );
}

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
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={goNext} style={secondaryBtnStyle}>
          {t("step4.skip")}
        </button>
        <button type="button" onClick={goNext} style={primaryBtnStyle(accent)}>
          {t("nav.next")}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

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
