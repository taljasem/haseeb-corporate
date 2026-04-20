/**
 * Migration Wizard Step 2 — Parse preview.
 *
 * Fetches staged rows for the importJobId across all entity types that
 * have been ingested (screen tracks ingestedEntities in a Set) and
 * computes a summary locally: counts by status + aggregate unmapped-code
 * list. Top-3 sample rows per status are surfaced as expandable items.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import LtrText from "../shared/LtrText";
import Spinner from "../shared/Spinner";
import EmptyState from "../shared/EmptyState";
import {
  listStagedInvoices,
  listStagedBills,
  listStagedJournalEntries,
} from "../../engine";

const STATUS_KEYS = [
  { id: "AWAITING_MAPPING", labelKey: "summary_awaiting" },
  { id: "READY_TO_POST", labelKey: "summary_ready" },
  { id: "POSTED", labelKey: "summary_posted" },
  { id: "REJECTED", labelKey: "summary_rejected" },
  { id: "FAILED_POST", labelKey: "summary_failed" },
];

const STATUS_ACCENT = {
  AWAITING_MAPPING: "var(--semantic-warning)",
  READY_TO_POST: "var(--accent-primary)",
  POSTED: "var(--accent-primary)",
  REJECTED: "var(--text-tertiary)",
  FAILED_POST: "var(--semantic-danger)",
};

export default function MigrationStep2Preview({
  accent,
  importJobId,
  ingestedEntities,
  goNext,
  goBack,
}) {
  const { t } = useTranslation("migration");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState({ invoices: [], bills: [], journalEntries: [] });

  useEffect(() => {
    let alive = true;
    if (!importJobId) return undefined;
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const tasks = [];
        if (ingestedEntities.has("invoices")) {
          tasks.push(
            listStagedInvoices({ importJobId, limit: 500 }).then((r) => ["invoices", r]),
          );
        }
        if (ingestedEntities.has("bills")) {
          tasks.push(
            listStagedBills({ importJobId, limit: 500 }).then((r) => ["bills", r]),
          );
        }
        if (ingestedEntities.has("journal-entries")) {
          tasks.push(
            listStagedJournalEntries({ importJobId, limit: 500 }).then((r) => [
              "journalEntries",
              r,
            ]),
          );
        }
        const results = await Promise.all(tasks);
        if (!alive) return;
        const next = { invoices: [], bills: [], journalEntries: [] };
        for (const [key, r] of results) next[key] = r || [];
        setRows(next);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || t("step2.load_failed"));
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchAll();
    return () => {
      alive = false;
    };
  }, [importJobId, ingestedEntities, t]);

  const allRows = useMemo(
    () => [...rows.invoices, ...rows.bills, ...rows.journalEntries],
    [rows],
  );

  const counts = useMemo(() => {
    const c = { total: allRows.length };
    for (const status of STATUS_KEYS) {
      c[status.id] = allRows.filter((r) => r.status === status.id).length;
    }
    return c;
  }, [allRows]);

  const unmappedCodes = useMemo(() => {
    const s = new Set();
    for (const r of allRows) {
      for (const code of r.unmappedCodes || []) s.add(code);
    }
    return Array.from(s).sort();
  }, [allRows]);

  if (!importJobId) {
    return (
      <div>
        <EmptyState
          icon={AlertCircle}
          title={t("step2.no_import_job")}
        />
        <NavRow goBack={goBack} goNext={goNext} nextDisabled accent={accent} />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <Spinner size={24} color="var(--text-secondary)" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader
        title={t("step2.title")}
        description={t("step2.description")}
      />

      {error && <ErrorBanner text={error} />}

      {/* Summary grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        <SummaryCard
          label={t("step2.summary_total")}
          value={counts.total}
          accent={accent}
        />
        {STATUS_KEYS.map((s) => (
          <SummaryCard
            key={s.id}
            label={t(`step2.${s.labelKey}`)}
            value={counts[s.id]}
            accent={STATUS_ACCENT[s.id]}
          />
        ))}
      </div>

      {/* Unmapped codes */}
      <div>
        <SubHeader text={t("step2.unmapped_codes_title")} />
        {unmappedCodes.length === 0 ? (
          <div
            style={{
              fontSize: 13,
              color: "var(--text-tertiary)",
              padding: "8px 0",
            }}
          >
            {t("step2.unmapped_codes_empty")}
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {unmappedCodes.map((code) => (
              <span
                key={code}
                style={{
                  padding: "4px 10px",
                  background: "var(--semantic-warning-subtle)",
                  border: "1px solid var(--semantic-warning-border)",
                  borderRadius: 4,
                  color: "var(--semantic-warning)",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 12,
                }}
              >
                <LtrText>{code}</LtrText>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Sample rows per status */}
      <div>
        <SubHeader text={t("step2.samples_title")} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {STATUS_KEYS.map((s) => {
            const matching = allRows.filter((r) => r.status === s.id);
            const samples = matching.slice(0, 3);
            return (
              <SampleSection
                key={s.id}
                label={t(`step2.${s.labelKey}`)}
                count={counts[s.id]}
                samples={samples}
                moreCount={Math.max(0, matching.length - samples.length)}
                accent={STATUS_ACCENT[s.id]}
              />
            );
          })}
        </div>
      </div>

      <NavRow goBack={goBack} goNext={goNext} accent={accent} />
    </div>
  );
}

function SampleSection({ label, count, samples, moreCount, accent }) {
  const { t } = useTranslation("migration");
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.05em",
            color: accent,
          }}
        >
          {label}
        </span>
        <LtrText
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            color: "var(--text-tertiary)",
          }}
        >
          {count}
        </LtrText>
      </div>
      {samples.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          {t("step2.no_samples")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {samples.map((s) => (
            <SampleRow key={s.id} row={s} />
          ))}
          {moreCount > 0 && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                fontStyle: "italic",
                paddingTop: 4,
              }}
            >
              {t("step2.more_rows", { count: moreCount })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SampleRow({ row }) {
  // Guard for various staged-row shapes: invoices have invoiceNumber/customerRef,
  // bills have billNumber/vendorRef, journal-entries have reference.
  const title =
    row.invoiceNumber ||
    row.billNumber ||
    row.reference ||
    row.description ||
    `#${row.rowNumber ?? row.id}`;
  const subtitle = row.customerRef || row.vendorRef || row.date || "";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        fontSize: 12,
      }}
    >
      <span
        style={{
          color: "var(--text-secondary)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <LtrText style={{ fontFamily: "'DM Mono', monospace" }}>
          {String(title)}
        </LtrText>
      </span>
      {subtitle && (
        <span
          style={{
            color: "var(--text-tertiary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "50%",
          }}
        >
          <LtrText>{String(subtitle)}</LtrText>
        </span>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 22,
          fontWeight: 700,
          color: accent,
          lineHeight: 1,
        }}
      >
        <LtrText>{value}</LtrText>
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

function SubHeader({ text }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: "var(--text-tertiary)",
        textTransform: "uppercase",
        marginBottom: 10,
      }}
    >
      {text}
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

function NavRow({ goBack, goNext, nextDisabled, accent }) {
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
      <button
        type="button"
        onClick={goBack}
        style={{
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
        }}
      >
        <ArrowLeft size={14} />
        {t("nav.back")}
      </button>
      <button
        type="button"
        onClick={goNext}
        disabled={nextDisabled}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          background: accent,
          border: "none",
          borderRadius: 6,
          cursor: nextDisabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 600,
          color: "#fff",
          opacity: nextDisabled ? 0.55 : 1,
        }}
      >
        {t("nav.next")}
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
