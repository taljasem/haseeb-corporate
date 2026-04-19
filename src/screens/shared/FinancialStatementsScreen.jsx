import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText, MessageSquare, X, Sparkles, Edit3, Plus, StickyNote, GitBranch, History,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import AminahNarrationCard from "../../components/financial/AminahNarrationCard";
import StatementTable from "../../components/financial/StatementTable";
import ReclassifyLineModal from "../../components/financial/ReclassifyLineModal";
import LineNoteModal from "../../components/financial/LineNoteModal";
import PublishVersionModal from "../../components/financial/PublishVersionModal";
import VersionHistoryDrawer from "../../components/financial/VersionHistoryDrawer";
import { useTenant } from "../../components/shared/TenantContext";
import { formatRelativeTime } from "../../utils/relativeTime";
// Wave 2: IS/BS/CF come from the engine router (real API in LIVE mode,
// mock in MOCK mode, with shape adapters in src/api/reports.js).
// Adjusting entries, line notes, and export helpers have no backend yet
// and stay on mockEngine (mock_fallback in LIVE mode, with a one-shot warn).
// Phase 4 Wave 1: report versions are LIVE in both modes (mock stubs in
// engine/index.js for MOCK).
import {
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowStatement,
  listReportVersions,
} from "../../engine";
import {
  getAdjustingEntries,
  getLineNotes,
  exportStatement,
} from "../../engine/mockEngine";

const TAB_IDS = ["income", "balance", "cash-flow"];
const PERIOD_IDS = ["month", "quarter", "ytd", "custom"];

// FN-244: map UI tab ids to server-side ReportType enum values.
const TAB_TO_REPORT_TYPE = {
  income: "PROFIT_AND_LOSS",
  balance: "BALANCE_SHEET",
  "cash-flow": "CASH_FLOW_STATEMENT",
};

// FN-244: stable, opaque scope string the server partitions versions by.
// Scope is (tab, period). Including the tab here is belt-and-suspenders —
// the server also partitions by reportType — but it makes the key
// self-describing in logs and in the drawer subtitle.
function buildReportKey(tab, period) {
  return `${tab}:${period}`;
}
const MATERIALITY_OPTIONS = [
  { id: "all",  value: 0 },
  { id: "t_1k",  value: 1000 },
  { id: "t_5k",  value: 5000 },
  { id: "t_10k", value: 10000 },
  { id: "t_50k", value: 50000 },
  { id: "t_100k", value: 100000 },
];

function normalizeRole(r) {
  if (!r) return "Owner";
  const s = String(r).toLowerCase();
  if (s.startsWith("cfo")) return "CFO";
  return "Owner";
}

// ── Materiality filter ────────────────────────────────────────────
function filterByMateriality(sections, threshold) {
  if (!threshold || !sections) return sections;
  return sections.map((s) => {
    if (s.lines) {
      const filteredLines = s.lines.filter(
        (l) => Math.abs(Number(l.current) || 0) >= threshold || Math.abs(Number(l.prior) || 0) >= threshold
      );
      return { ...s, lines: filteredLines };
    }
    return s;
  });
}
function countLines(sections) {
  if (!sections) return { total: 0, shown: 0 };
  let total = 0;
  sections.forEach((s) => { if (s.lines) total += s.lines.length; });
  return { total };
}

// ── Client-side CSV export ────────────────────────────────────────
function exportCSV(sections, filename) {
  const rows = [["Account", "Current", "Prior", "Change", "% Change"]];
  (sections || []).forEach((s) => {
    if (s.highlight || s.isParent) {
      rows.push([s.name, s.current ?? "", s.prior ?? "", "", ""]);
      return;
    }
    rows.push([s.name, "", "", "", ""]);
    (s.lines || []).forEach((l) => {
      rows.push([
        `  ${l.account}`,
        l.current ?? "",
        l.prior ?? "",
        l.change ?? "",
        l.percentChange != null ? `${l.percentChange}%` : "",
      ]);
    });
    if (s.subtotal) {
      rows.push([s.subtotal.label, s.subtotal.current ?? "", s.subtotal.prior ?? "", "", ""]);
    }
  });
  const csv = rows
    .map((r) => r.map((c) => {
      const v = String(c == null ? "" : c);
      if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    }).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Print-friendly PDF flow ──────────────────────────────────────
function exportPrint(sections, title) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const rows = [];
  (sections || []).forEach((s) => {
    if (s.highlight || s.isParent) {
      rows.push(`<tr class="highlight"><td>${escapeHTML(s.name)}</td><td>${s.current ?? ""}</td><td>${s.prior ?? ""}</td><td></td></tr>`);
      return;
    }
    rows.push(`<tr class="section"><td colspan="4">${escapeHTML(s.name)}</td></tr>`);
    (s.lines || []).forEach((l) => {
      rows.push(`<tr><td style="padding-inline-start:24px">${escapeHTML(l.account)}</td><td>${l.current ?? ""}</td><td>${l.prior ?? ""}</td><td>${l.change ?? ""}</td></tr>`);
    });
    if (s.subtotal) {
      rows.push(`<tr class="subtotal"><td>${escapeHTML(s.subtotal.label)}</td><td>${s.subtotal.current ?? ""}</td><td>${s.subtotal.prior ?? ""}</td><td></td></tr>`);
    }
  });
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111; margin: 32px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { text-align: end; padding: 6px 10px; border-bottom: 1px solid #eee; }
    th:first-child, td:first-child { text-align: start; }
    tr.highlight td { font-weight: 700; background: #f4f4f5; }
    tr.section td { font-weight: 600; color: #555; padding-top: 14px; }
    tr.subtotal td { font-weight: 600; border-bottom: 2px solid #333; }
  </style></head><body>
  <h1>${escapeHTML(title)}</h1>
  <table><thead><tr><th>Account</th><th>Current</th><th>Prior</th><th>Change</th></tr></thead>
  <tbody>${rows.join("")}</tbody></table>
  <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
  </body></html>`);
  w.document.close();
}
function escapeHTML(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ─────────────────────────────────────────────────────────────────
export default function FinancialStatementsScreen({ role: roleRaw = "Owner", onOpenAminah }) {
  const role = normalizeRole(roleRaw);
  const { t } = useTranslation("financial");
  const { tenant } = useTenant();
  const [tab, setTab] = useState("income");
  const [period, setPeriod] = useState("month");
  const [income, setIncome] = useState(null);
  const [balance, setBalance] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [materialityId, setMaterialityId] = useState("all");
  const [adjustingOpen, setAdjustingOpen] = useState(false);
  const [adjusting, setAdjusting] = useState([]);
  const [adjustingFilter, setAdjustingFilter] = useState("all");
  const [notes, setNotes] = useState([]);
  const [reclassifySource, setReclassifySource] = useState(null);
  const [noteTarget, setNoteTarget] = useState(null);
  const [toast, setToast] = useState(null);
  // Wave 2: loading + error state for the three reports. Null-safe so the
  // existing render path keeps working.
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // FN-244 (Phase 4 Wave 1): report versioning state.
  //   • `publishOpen` — the Publish-as-version modal.
  //   • `historyOpen` — the Version History drawer.
  //   • `currentVersion` — the non-superseded version for the current
  //     (tab, period), if any. Drives the "supersedesId" picker default.
  //   • `viewingVersion` — the ReportVersion we're viewing in historical
  //     read-only mode. When set, the statement render path uses
  //     `viewingVersion.snapshotData` instead of the live fetch.
  //   • `versionsRefreshToken` — bumps on publish so the drawer re-fetches.
  const [publishOpen, setPublishOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [viewingVersion, setViewingVersion] = useState(null);
  const [versionsRefreshToken, setVersionsRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      getIncomeStatement(period),
      getBalanceSheet(period),
      getCashFlowStatement(period),
    ])
      .then(([is, bs, cf]) => {
        if (cancelled) return;
        setIncome(is);
        setBalance(bs);
        setCashFlow(cf);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        setLoadError({
          code: err?.code || "UNKNOWN",
          message:
            err?.code === "NETWORK_ERROR"
              ? "Can't reach the server. Check your connection and try again."
              : err?.message || "Something went wrong loading financial statements.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  // FN-244: reset historical-view mode when the user changes tab or
  // period. If they were viewing v3 of "income:month" and switch to
  // "balance", showing the old snapshot on the balance sheet would be
  // wrong and confusing.
  useEffect(() => {
    setViewingVersion(null);
  }, [tab, period]);

  // FN-244: fetch the current (non-superseded) version for this
  // (reportType, reportKey) so the Publish modal's supersedes picker
  // can default to it. Refreshes on publish via `versionsRefreshToken`.
  useEffect(() => {
    let cancelled = false;
    const reportType = TAB_TO_REPORT_TYPE[tab];
    const reportKey = buildReportKey(tab, period);
    if (!reportType) return;
    listReportVersions({ reportType, reportKey, currentOnly: true, limit: 1 })
      .then((list) => {
        if (cancelled) return;
        setCurrentVersion(Array.isArray(list) && list[0] ? list[0] : null);
      })
      .catch(() => {
        if (cancelled) return;
        setCurrentVersion(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, period, versionsRefreshToken]);

  // Detect empty-ledger state: every section line is zero.
  const isEmptyLedger = useMemo(() => {
    if (loading || loadError) return false;
    const any = income || balance || cashFlow;
    if (!any) return false;
    const total = [income, balance, cashFlow].reduce((sum, r) => {
      if (!r?.sections) return sum;
      let s = 0;
      for (const sec of r.sections) {
        if (sec.lines) for (const l of sec.lines) s += Math.abs(Number(l.current || 0));
        if (sec.current != null) s += Math.abs(Number(sec.current || 0));
      }
      return sum + s;
    }, 0);
    return total === 0;
  }, [income, balance, cashFlow, loading, loadError]);

  useEffect(() => {
    if (role !== "CFO") return;
    getAdjustingEntries(adjustingFilter === "all" ? "month" : adjustingFilter, tab).then(setAdjusting);
    getLineNotes("march-2026").then(setNotes);
  }, [role, tab, adjustingFilter]);

  // FN-244: when viewing a historical version, swap the live statement
  // data for the snapshot. The snapshotData POSTed at publish time is
  // the same shape the screen reads from IS/BS/CF, so this is a direct
  // substitution without any adapter.
  const liveCurrent = tab === "income" ? income : tab === "balance" ? balance : cashFlow;
  const current = viewingVersion ? viewingVersion.snapshotData : liveCurrent;
  const isHistoricalView = !!viewingVersion;
  const materialityValue = MATERIALITY_OPTIONS.find((m) => m.id === materialityId)?.value || 0;
  const filteredSections = useMemo(
    () => filterByMateriality(current?.sections, materialityValue),
    [current, materialityValue]
  );
  const lineCounts = useMemo(() => {
    const total = countLines(current?.sections).total;
    const shown = countLines(filteredSections).total;
    return { total, shown };
  }, [current, filteredSections]);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  };

  const handleExport = async (fmt) => {
    const meta = await exportStatement(tab, period, fmt);
    const title = `${t(`tabs.${tab}`)} — ${current?.period || ""}`;
    if (fmt === "csv") {
      exportCSV(current?.sections, meta.filename);
      showToast(t("export_modal.downloaded_toast", { filename: meta.filename }));
    } else {
      exportPrint(current?.sections, title);
    }
  };

  const noteForAccountCode = (code) => notes.find((n) => n.accountCode === code);
  const notesByCode = useMemo(() => {
    const map = {};
    for (const n of notes) map[n.accountCode] = n;
    return map;
  }, [notes]);

  const heroAccent = role === "CFO" ? "var(--accent-primary)" : "var(--role-owner)";

  // FN-244: only OWNER and ACCOUNTANT (which the UI surfaces as "CFO")
  // can publish versions. VIEWER + AUDITOR can open the drawer but not
  // the modal. Because this screen's normalizeRole collapses everything
  // down to Owner or CFO, gating on those two values is correct for the
  // current role surface. The backend is the real enforcement layer —
  // a 403 comes back if a non-OWNER/ACCOUNTANT token somehow reaches
  // publishReportVersion, and the modal surfaces the error.
  const canPublishVersion = role === "Owner" || role === "CFO";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Hero band (CFO only — Owner keeps its existing compact header) */}
      {role === "CFO" && (
        <div
          style={{
            padding: "22px 28px 18px",
            borderBottom: "1px solid var(--border-subtle)",
            background: `linear-gradient(180deg, ${heroAccent}1A 0%, transparent 100%)`,
            flexShrink: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--accent-primary)" }}>
              {t("cfo.view_label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "var(--text-primary)", letterSpacing: "-0.3px", marginTop: 2, lineHeight: 1 }}>
              {t("title")}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 6 }}>
              {t("cfo.hero_subtitle", { period: current?.period || "", tenant: tenant?.company?.shortName || "" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => setAdjustingOpen((o) => !o)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px",
                background: adjustingOpen ? "var(--accent-primary-subtle)" : "var(--bg-surface)",
                border: adjustingOpen ? "1px solid var(--accent-primary-border)" : "1px solid var(--border-default)",
                color: adjustingOpen ? "var(--accent-primary)" : "var(--text-secondary)",
                borderRadius: 6, cursor: "pointer",
                fontSize: 11, fontWeight: 600, fontFamily: "inherit",
              }}
            >
              <Edit3 size={12} />
              {t("cfo.adjusting_count", { count: adjusting.length })}
            </button>
            {/* FN-244: Publish-as-version (OWNER + ACCOUNTANT/CFO only) */}
            {canPublishVersion && !isHistoricalView && (
              <button
                onClick={() => setPublishOpen(true)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-secondary)",
                  borderRadius: 6, cursor: "pointer",
                  fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                }}
                title={t("versions.publish_button")}
              >
                <GitBranch size={12} />
                {t("versions.publish_button")}
              </button>
            )}
            {/* FN-244: Version history drawer toggle — all roles */}
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              aria-label={t("versions.history_aria")}
              title={t("versions.history_button")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px",
                background: historyOpen ? "var(--accent-primary-subtle)" : "var(--bg-surface)",
                border: historyOpen ? "1px solid var(--accent-primary-border)" : "1px solid var(--border-default)",
                color: historyOpen ? "var(--accent-primary)" : "var(--text-secondary)",
                borderRadius: 6, cursor: "pointer",
                fontSize: 11, fontWeight: 600, fontFamily: "inherit",
              }}
            >
              <History size={12} />
              {t("versions.history_button")}
            </button>
            {onOpenAminah && (
              <button
                onClick={() => onOpenAminah(`${t(`tabs.${tab}`)} — ${current?.period || ""}`)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px",
                  background: "var(--accent-primary)",
                  color: "#fff", border: "none",
                  borderRadius: 6, cursor: "pointer",
                  fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                }}
              >
                <Sparkles size={12} />
                AMINAH
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px", minWidth: 0 }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            {/* Period + title row (Owner view keeps legacy header; CFO moves title to hero) */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: 18,
                flexWrap: "wrap",
              }}
            >
              {role === "Owner" && (
                <div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--text-primary)", letterSpacing: "-0.3px", lineHeight: 1 }}>
                    {t("title")}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 6 }}>
                    {current?.period || t("period_default")}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {PERIOD_IDS.map((pid) => {
                    const on = period === pid;
                    return (
                      <button
                        key={pid}
                        onClick={() => setPeriod(pid)}
                        style={{
                          fontSize: 11, fontWeight: 600,
                          padding: "6px 12px", borderRadius: 14,
                          background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface)",
                          border: on ? "1px solid var(--accent-primary-border)" : "1px solid var(--border-default)",
                          color: on ? "var(--accent-primary)" : "var(--text-tertiary)",
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        {t(`periods.${pid}`)}
                      </button>
                    );
                  })}
                </div>
                {role === "Owner" && (
                  <>
                    {/* FN-244: Owner-view Publish (OWNER can always publish) */}
                    {canPublishVersion && !isHistoricalView && (
                      <button
                        onClick={() => setPublishOpen(true)}
                        title={t("versions.publish_button")}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "6px 12px",
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border-default)",
                          color: "var(--text-secondary)",
                          borderRadius: 14,
                          cursor: "pointer",
                          fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                        }}
                      >
                        <GitBranch size={12} />
                        {t("versions.publish_button")}
                      </button>
                    )}
                    {/* FN-244: Owner-view History (all roles) */}
                    <button
                      onClick={() => setHistoryOpen((o) => !o)}
                      aria-label={t("versions.history_aria")}
                      title={t("versions.history_button")}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "6px 12px",
                        background: historyOpen ? "var(--accent-primary-subtle)" : "var(--bg-surface)",
                        border: historyOpen ? "1px solid var(--accent-primary-border)" : "1px solid var(--border-default)",
                        color: historyOpen ? "var(--accent-primary)" : "var(--text-secondary)",
                        borderRadius: 14,
                        cursor: "pointer",
                        fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                      }}
                    >
                      <History size={12} />
                      {t("versions.history_button")}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Tab bar */}
            <div
              style={{
                display: "flex",
                gap: 4,
                marginBottom: 16,
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              {TAB_IDS.map((tid) => {
                const on = tab === tid;
                return (
                  <button
                    key={tid}
                    onClick={() => setTab(tid)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: on ? "var(--accent-primary)" : "var(--text-tertiary)",
                      fontSize: 12, fontWeight: 600,
                      letterSpacing: "0.08em",
                      padding: "12px 16px", cursor: "pointer",
                      fontFamily: "inherit",
                      boxShadow: on ? "inset 0 -2px 0 #00C48C" : "none",
                    }}
                  >
                    {t(`tabs.${tid}`)}
                  </button>
                );
              })}
            </div>

            {/* CFO tool bar: materiality only (per-line kebabs handle reclassify + notes now) */}
            {role === "CFO" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 14,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
                  {t("materiality.label")}
                </div>
                <select
                  value={materialityId}
                  onChange={(e) => setMaterialityId(e.target.value)}
                  style={{
                    background: "var(--bg-surface-sunken)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "var(--text-primary)",
                    fontSize: 12, fontFamily: "inherit", outline: "none",
                  }}
                >
                  {MATERIALITY_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id === "all" ? t("materiality.all") : `${t("materiality.prefix")}${t(`materiality.${m.id}`)}${t("materiality.suffix")}`}
                    </option>
                  ))}
                </select>
                {materialityId !== "all" && (
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}>
                    <LtrText>{t("materiality.filtered_count", { shown: lineCounts.shown, total: lineCounts.total })}</LtrText>
                  </span>
                )}
              </div>
            )}

            {toast && (
              <div
                style={{
                  marginBottom: 12,
                  background: "var(--accent-primary-subtle)",
                  border: "1px solid var(--accent-primary-border)",
                  color: "var(--accent-primary)",
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: 12, fontWeight: 500,
                }}
              >
                {toast}
              </div>
            )}

            {/* Wave 2: loading / error / empty states */}
            {loading && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  marginBottom: 12,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  padding: "28px 20px",
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: 12,
                  letterSpacing: "0.04em",
                }}
              >
                Loading financial statements…
              </div>
            )}
            {loadError && (
              <div
                role="alert"
                aria-live="polite"
                style={{
                  marginBottom: 12,
                  background: "rgba(253,54,28,0.08)",
                  border: "1px solid rgba(253,54,28,0.3)",
                  color: "var(--semantic-danger)",
                  padding: "14px 18px",
                  borderRadius: 10,
                  fontSize: 12,
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >
                <div>{loadError.message}</div>
                <button
                  onClick={() => setPeriod((p) => p)}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(253,54,28,0.35)",
                    color: "var(--semantic-danger)",
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            {!loading && !loadError && isEmptyLedger && (
              <div
                role="status"
                style={{
                  marginBottom: 12,
                  background: "var(--accent-primary-subtle)",
                  border: "1px solid var(--accent-primary-border)",
                  color: "var(--text-secondary)",
                  padding: "14px 18px",
                  borderRadius: 10,
                  fontSize: 12,
                }}
              >
                Not enough activity to generate this report. Record some transactions first, then come back.
              </div>
            )}

            {/* FN-244: historical view banner. Shown above the statement
                render path whenever the user is viewing a published
                snapshot instead of the live data. */}
            {isHistoricalView && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  marginBottom: 14,
                  background: "rgba(87,135,255,0.08)",
                  border: "1px solid rgba(87,135,255,0.25)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--semantic-info)" }}>
                    {t("versions.historical_banner.title_prefix")}
                    <LtrText>{viewingVersion.version}</LtrText>
                    {t("versions.historical_banner.title_middle")}
                    <LtrText>
                      {new Date(viewingVersion.publishedAt).toLocaleDateString(undefined, {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </LtrText>
                    {t("versions.historical_banner.title_suffix")}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {t("versions.historical_banner.body")}
                  </div>
                </div>
                <button
                  onClick={() => setViewingVersion(null)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-default)",
                    color: "var(--semantic-info)",
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  {t("versions.historical_banner.return")}
                </button>
              </div>
            )}

            {(isHistoricalView || (!loading && !loadError)) && current && (
              <>
                <AminahNarrationCard
                  text={current.aminahNarration}
                  onAsk={() =>
                    onOpenAminah && onOpenAminah(`${t(`tabs.${tab}`)} — ${current.period}`)
                  }
                />
                <StatementTable
                  sections={filteredSections}
                  mode={(role === "CFO" && !isHistoricalView) ? "cfo" : "readonly"}
                  notesByCode={notesByCode}
                  onOpenNote={(note, line) =>
                    setNoteTarget({ accountCode: note.accountCode, accountLabel: line?.account || note.accountCode, existing: note })
                  }
                  onLineAction={(actionId, line, code) => {
                    // FN-244: historical view is readonly — suppress
                    // all line actions that would mutate state.
                    if (isHistoricalView) return;
                    if (actionId === "reclassify") {
                      setReclassifySource({ account: line.account, current: line.current });
                    } else if (actionId === "note") {
                      const existing = code && notesByCode ? notesByCode[code] : null;
                      setNoteTarget({ accountCode: code || "", accountLabel: line.account, existing });
                    } else if (actionId === "view_entries") {
                      setAdjustingOpen(true);
                    } else if (actionId === "copy_code" && code) {
                      if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
                      showToast(t("line_menu.copied_toast"));
                    }
                  }}
                />

                {/* CFO notes panel — shows notes attached to this statement's lines */}
                {role === "CFO" && (
                  <div
                    style={{
                      marginTop: 14,
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 10,
                      padding: "16px 18px",
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 10 }}>
                      {t("cfo.notes_and_adjustments")}
                    </div>
                    {notes.length === 0 ? (
                      <EmptyState icon={StickyNote} title={t("notes.empty_title")} description={t("notes.empty_desc")} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {notes.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => setNoteTarget({ accountCode: n.accountCode, accountLabel: n.accountCode, existing: n })}
                            style={{
                              textAlign: "start",
                              background: "var(--bg-surface-sunken)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: 8,
                              padding: "10px 12px",
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-primary)", fontFamily: "'DM Mono', monospace" }}>
                              <LtrText>{n.accountCode}</LtrText>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-primary)", marginTop: 4, lineHeight: 1.5 }}>
                              {n.note}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                              {t("notes.by")} {n.author} · {formatRelativeTime(n.timestamp)} · {t(`notes.visibility_${n.visibility}`)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Export buttons */}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    onClick={() => handleExport("pdf")}
                    style={exportBtn}
                  >
                    {t("export", { format: "PDF" })}
                  </button>
                  <button
                    onClick={() => handleExport("csv")}
                    style={exportBtn}
                  >
                    {t("export", { format: "CSV" })}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Adjusting Entries side panel (CFO only) */}
        {role === "CFO" && adjustingOpen && (
          <aside
            style={{
              width: 380, flexShrink: 0,
              borderInlineStart: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", letterSpacing: "-0.2px", lineHeight: 1 }}>
                  {t("adjusting.title")}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                  {t("adjusting.subtitle", { period: current?.period || "" })}
                </div>
              </div>
              <button onClick={() => setAdjustingOpen(false)} aria-label={t("adjusting.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 4 }}>
              {["all", "week", "month"].map((f) => {
                const on = adjustingFilter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setAdjustingFilter(f)}
                    style={{
                      fontSize: 10, fontWeight: 600,
                      padding: "4px 10px", borderRadius: 12,
                      background: on ? "var(--accent-primary-subtle)" : "transparent",
                      border: on ? "1px solid var(--accent-primary-border)" : "1px solid var(--border-default)",
                      color: on ? "var(--accent-primary)" : "var(--text-tertiary)",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {t(`adjusting.filter_${f}`)}
                  </button>
                );
              })}
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {adjusting.length === 0 ? (
                <EmptyState icon={FileText} title={t("adjusting.empty_title")} description={t("adjusting.empty_desc")} />
              ) : (
                adjusting.map((j) => <AdjustingRow key={j.id} je={j} />)
              )}
            </div>
          </aside>
        )}

        {/* FN-244: Version History drawer (all roles) */}
        <VersionHistoryDrawer
          open={historyOpen}
          reportType={TAB_TO_REPORT_TYPE[tab]}
          reportKey={buildReportKey(tab, period)}
          reportLabel={t(`tabs.${tab}`)}
          viewingVersionId={viewingVersion?.id}
          refreshToken={versionsRefreshToken}
          onClose={() => setHistoryOpen(false)}
          onView={(v) => {
            setViewingVersion(v);
          }}
        />
      </div>

      {/* FN-244: Publish-as-version modal. */}
      <PublishVersionModal
        open={publishOpen}
        reportType={TAB_TO_REPORT_TYPE[tab]}
        reportKey={buildReportKey(tab, period)}
        snapshotData={liveCurrent}
        currentVersion={currentVersion}
        onClose={() => setPublishOpen(false)}
        onPublished={(row) => {
          setVersionsRefreshToken((n) => n + 1);
          showToast(
            <>
              {t("versions.publish_modal.published_toast_prefix")}
              <LtrText>{row?.version ?? ""}</LtrText>
              {t("versions.publish_modal.published_toast_suffix")}
            </>
          );
        }}
      />

      <ReclassifyLineModal
        open={!!reclassifySource}
        sourceLine={reclassifySource}
        onClose={() => setReclassifySource(null)}
        onPosted={() => {
          getAdjustingEntries(adjustingFilter === "all" ? "month" : adjustingFilter, tab).then(setAdjusting);
          showToast(t("reclassify.posted_toast"));
        }}
      />
      <LineNoteModal
        open={!!noteTarget}
        accountCode={noteTarget?.accountCode}
        accountLabel={noteTarget?.accountLabel}
        period="march-2026"
        existing={noteTarget?.existing}
        onClose={() => setNoteTarget(null)}
        onSaved={() => {
          getLineNotes("march-2026").then(setNotes);
          showToast(t("notes.saved_toast"));
        }}
        onDeleted={() => getLineNotes("march-2026").then(setNotes)}
      />
    </div>
  );
}

function AdjustingRow({ je }) {
  const { t } = useTranslation("financial");
  return (
    <div
      style={{
        padding: "12px 18px",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-primary)", fontFamily: "'DM Mono', monospace" }}>
          <LtrText>{je.id}</LtrText>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}>
          <LtrText>{je.amount.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</LtrText>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-primary)", marginTop: 4, lineHeight: 1.5 }}>
        {je.description}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
        {t("adjusting.posted_by")} {je.postedBy} · {formatRelativeTime(je.postedAt)}
      </div>
    </div>
  );
}

const exportBtn = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-default)",
  padding: "7px 14px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  fontFamily: "inherit",
};
