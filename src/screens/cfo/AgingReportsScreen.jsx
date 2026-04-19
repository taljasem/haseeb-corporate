import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search, MoreVertical, TrendingUp, TrendingDown, Sparkles, Inbox,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import AminahNarrationCard from "../../components/financial/AminahNarrationCard";
import { useTenant } from "../../components/shared/TenantContext";
import { formatDate } from "../../utils/format";
import { getAgingReport } from "../../engine";
import SendReminderModal from "../../components/aging/SendReminderModal";
import LogPaymentModal from "../../components/aging/LogPaymentModal";
import DisputeInvoiceModal from "../../components/aging/DisputeInvoiceModal";
import WriteOffModal from "../../components/aging/WriteOffModal";
import SchedulePaymentModal from "../../components/aging/SchedulePaymentModal";
import InvoiceDetailSlideOver from "../../components/aging/InvoiceDetailSlideOver";

const BUCKETS = ["current", "b1_30", "b31_60", "b61_90", "b90_plus"];
const BUCKET_COLOR = {
  current:  "var(--accent-primary)",
  b1_30:    "var(--semantic-warning)",
  b31_60:   "#F59E0B",
  b61_90:   "#F97316",
  b90_plus: "var(--semantic-danger)",
};
const STATUS_COLOR = {
  outstanding:  "var(--semantic-warning)",
  partial:      "var(--semantic-info)",
  disputed:     "var(--semantic-danger)",
  paid:         "var(--accent-primary)",
  written_off:  "var(--text-tertiary)",
};

function fmtKWD(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function csvExport(filename, rows) {
  const csv = rows.map((r) => r.map((c) => {
    const v = String(c == null ? "" : c);
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AgingReportsScreen({ onOpenAminah }) {
  const { t } = useTranslation("aging");
  const { tenant } = useTenant();
  const [type, setType] = useState("AR");
  const [data, setData] = useState(null);
  const [bucketFilter, setBucketFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("daysOverdue");
  const [sortDir, setSortDir] = useState("desc");
  const [selected, setSelected] = useState(new Set());
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [modal, setModal] = useState(null); // reminder | payment | dispute | writeoff | schedule | detail

  const reload = () => getAgingReport(type).then(setData);
  useEffect(() => { reload(); setSelected(new Set()); setBucketFilter(null); setMenuOpenId(null); }, [type]);

  const rows = useMemo(() => {
    if (!data) return [];
    let list = data.invoices.slice();
    if (bucketFilter) list = list.filter((i) => i.bucket === bucketFilter);
    if (statusFilter !== "all") list = list.filter((i) => i.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.partyName.toLowerCase().includes(q) || i.invoiceNumber.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const av = a[sortBy]; const bv = b[sortBy];
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [data, bucketFilter, statusFilter, search, sortBy, sortDir]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const openAction = (action, inv) => {
    setActiveInvoice(inv);
    setMenuOpenId(null);
    setModal(action);
  };

  const closeModal = () => { setModal(null); setActiveInvoice(null); };

  const handleExport = () => {
    if (!data) return;
    const tn = (tenant?.company?.shortName || "tenant").toLowerCase().replace(/\s+/g, "-");
    const header = ["Party", "Invoice", "Invoice Date", "Due Date", "Days Overdue", "Amount", "Outstanding", "Status", "Bucket"];
    const rowsOut = [header];
    rows.forEach((i) => rowsOut.push([i.partyName, i.invoiceNumber, formatDate(i.invoiceDate), formatDate(i.dueDate), i.daysOverdue, i.amount, i.outstanding, i.status, i.bucket]));
    csvExport(`${tn}_aging_${type.toLowerCase()}.csv`, rowsOut);
  };

  if (!data) return <div style={{ padding: 28, color: "var(--text-tertiary)" }}>{t("loading")}</div>;

  const totalOutstanding = data.totals.total;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Hero */}
      <div
        style={{
          padding: "22px 28px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "linear-gradient(180deg, rgba(0,196,140,0.10) 0%, transparent 100%)",
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
            {t("view_label")}
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "var(--text-primary)", letterSpacing: "-0.3px", marginTop: 2, lineHeight: 1 }}>
            {t("title")}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 6 }}>
            {t("hero_subtitle", { tenant: tenant?.company?.shortName || "", date: formatDate(data.asOfDate, { withYear: true }) })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={handleExport} style={exportBtn}>{t("export", { format: "CSV" })}</button>
          {onOpenAminah && (
            <button onClick={() => onOpenAminah(`Aging ${type}`)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--accent-primary)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
              <Sparkles size={12} /> AMINAH
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 32px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          {/* AR/AP tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border-subtle)" }}>
            {["AR", "AP"].map((tp) => {
              const on = type === tp;
              return (
                <button key={tp} onClick={() => setType(tp)} style={{ background: "transparent", border: "none", color: on ? "var(--accent-primary)" : "var(--text-tertiary)", fontSize: 13, fontWeight: 600, letterSpacing: "0.05em", padding: "12px 18px", cursor: "pointer", fontFamily: "inherit", boxShadow: on ? "inset 0 -2px 0 #00C48C" : "none" }}>
                  {t(`tabs.${tp.toLowerCase()}`)}
                </button>
              );
            })}
          </div>

          {/* Bucket summary strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 14 }}>
            {BUCKETS.map((b) => {
              const amount = data.totals[b] || 0;
              const count = data.counts[b] || 0;
              const pct = totalOutstanding > 0 ? Math.round((amount / totalOutstanding) * 100) : 0;
              const color = BUCKET_COLOR[b];
              const on = bucketFilter === b;
              return (
                <button
                  key={b}
                  onClick={() => setBucketFilter(on ? null : b)}
                  style={{
                    background: "var(--bg-surface)",
                    border: on ? `2px solid ${color}` : "1px solid var(--border-default)",
                    borderRadius: 10, padding: "14px 16px",
                    textAlign: "start", cursor: "pointer", fontFamily: "inherit",
                    borderInlineStart: `3px solid ${color}`,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color, marginBottom: 6 }}>
                    {t(`buckets.${b}`)}
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 500, color: "var(--text-primary)" }}>
                    <LtrText>{fmtKWD(amount)}</LtrText>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
                    {t("bucket_count", { count })} · <LtrText>{t("bucket_pct", { pct })}</LtrText>
                  </div>
                </button>
              );
            })}
            <div style={{ background: "var(--bg-surface-sunken)", border: "1px solid rgba(0,196,140,0.25)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--accent-primary)", marginBottom: 6 }}>
                {t("buckets.total")}
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 600, color: "var(--accent-primary)" }}>
                <LtrText>{fmtKWD(totalOutstanding)}</LtrText>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
                {t("total_count", { count: data.counts.total })}
              </div>
            </div>
          </div>

          {/* DSO/DPO */}
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "10px 16px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-tertiary)" }}>
                {type === "AR" ? t("dso") : t("dpo")}
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, color: "var(--text-primary)", marginTop: 2 }}>
                <LtrText>{type === "AR" ? data.dso : data.dpo}</LtrText>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginInlineStart: 6 }}>days</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                {type === "AR" ? t("dso_sub") : t("dpo_sub")}
              </div>
            </div>
          </div>

          {/* Aminah narration */}
          <AminahNarrationCard text={data.narration} onAsk={() => onOpenAminah && onOpenAminah(`Aging ${type}`)} />

          {/* Filters / search */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <Search size={13} color="var(--text-tertiary)" style={{ position: "absolute", insetInlineStart: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("table.search_placeholder")}
                style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 12px 8px 30px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }}
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }}>
              <option value="all">{t("table.filter_all")}</option>
              {["outstanding", "partial", "disputed", "paid", "written_off"].map((s) => (
                <option key={s} value={s}>{t(`status.${s}`)}</option>
              ))}
            </select>
            {bucketFilter && (
              <button onClick={() => setBucketFilter(null)} style={{ background: "var(--accent-primary-subtle)", color: "var(--accent-primary)", border: "1px solid var(--accent-primary-border)", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                × {t(`buckets.${bucketFilter}`)}
              </button>
            )}
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 10, background: "var(--accent-primary-subtle)", border: "1px solid var(--accent-primary-border)", borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "var(--accent-primary)", fontWeight: 600 }}>{t("table.selected", { count: selected.size })}</div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setSelected(new Set())} style={{ background: "transparent", color: "var(--text-secondary)", border: "none", padding: "6px 10px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>{t("table.bulk_clear")}</button>
            </div>
          )}

          {/* Table */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "30px 1.5fr 1fr 100px 100px 70px 110px 100px 110px 40px", gap: 8, padding: "10px 16px", background: "var(--bg-surface-sunken)", borderBottom: "1px solid var(--border-default)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-tertiary)" }}>
              <div />
              <HeaderCell label={type === "AR" ? t("table.col_party_ar") : t("table.col_party_ap")} col="partyName" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <HeaderCell label={t("table.col_invoice")} col="invoiceNumber" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <HeaderCell label={t("table.col_date")} col="invoiceDate" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <HeaderCell label={t("table.col_due")} col="dueDate" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <HeaderCell label={t("table.col_days")} col="daysOverdue" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="end" />
              <HeaderCell label={t("table.col_amount")} col="amount" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="end" />
              <HeaderCell label={t("table.col_outstanding")} col="outstanding" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="end" />
              <HeaderCell label={t("table.col_status")} col="status" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <div />
            </div>
            {rows.length === 0 ? (
              <EmptyState icon={Inbox} title={t("table.empty_title")} description={t("table.empty_desc")} />
            ) : (
              rows.slice(0, 80).map((inv) => (
                <Row
                  key={inv.id}
                  inv={inv}
                  type={type}
                  t={t}
                  selected={selected.has(inv.id)}
                  onToggleSelect={() => {
                    const n = new Set(selected);
                    if (n.has(inv.id)) n.delete(inv.id); else n.add(inv.id);
                    setSelected(n);
                  }}
                  menuOpen={menuOpenId === inv.id}
                  setMenuOpen={(v) => setMenuOpenId(v ? inv.id : null)}
                  onOpenAction={openAction}
                />
              ))
            )}
          </div>

          {/* Trend chart */}
          <div style={{ marginTop: 14, background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "18px 20px" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)" }}>{t("trend.title")}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 12 }}>{t("trend.subtitle")}</div>
            <TrendChart trend={data.trend} />
          </div>
        </div>
      </div>

      {/* Modals + slide-over */}
      <SendReminderModal open={modal === "reminder"} invoice={activeInvoice} onClose={closeModal} onSent={reload} />
      <LogPaymentModal open={modal === "payment"} invoice={activeInvoice} onClose={closeModal} onSaved={reload} />
      <DisputeInvoiceModal open={modal === "dispute"} invoice={activeInvoice} onClose={closeModal} onSaved={reload} />
      <WriteOffModal open={modal === "writeoff"} invoice={activeInvoice} onClose={closeModal} onSubmitted={reload} />
      <SchedulePaymentModal open={modal === "schedule"} invoice={activeInvoice} onClose={closeModal} onScheduled={reload} />
      <InvoiceDetailSlideOver open={modal === "detail"} invoiceId={activeInvoice?.id} onClose={closeModal} />
    </div>
  );
}

function HeaderCell({ label, col, sortBy, sortDir, onSort, align }) {
  return (
    <button
      onClick={() => onSort(col)}
      style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: sortBy === col ? "var(--accent-primary)" : "var(--text-tertiary)", textAlign: align || "start", fontFamily: "inherit" }}
    >
      {label} {sortBy === col && (sortDir === "asc" ? "↑" : "↓")}
    </button>
  );
}

function Row({ inv, type, t, selected, onToggleSelect, menuOpen, setMenuOpen, onOpenAction }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "30px 1.5fr 1fr 100px 100px 70px 110px 100px 110px 40px", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", alignItems: "center", position: "relative" }}>
      <input type="checkbox" checked={selected} onChange={onToggleSelect} />
      <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.partyName}</div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "'DM Mono', monospace" }}><LtrText>{inv.invoiceNumber}</LtrText></div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{formatDate(inv.invoiceDate)}</div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{formatDate(inv.dueDate)}</div>
      <div style={{ fontSize: 11, textAlign: "end", fontFamily: "'DM Mono', monospace", color: inv.daysOverdue > 0 ? "var(--semantic-danger)" : "var(--text-tertiary)", fontWeight: inv.daysOverdue > 0 ? 600 : 400 }}>
        <LtrText>{inv.daysOverdue || "—"}</LtrText>
      </div>
      <div style={{ fontSize: 11, textAlign: "end", fontFamily: "'DM Mono', monospace", color: "var(--text-primary)" }}><LtrText>{fmtKWD(inv.amount)}</LtrText></div>
      <div style={{ fontSize: 11, textAlign: "end", fontFamily: "'DM Mono', monospace", color: inv.outstanding > 0 ? "var(--semantic-warning)" : "var(--accent-primary)", fontWeight: 600 }}><LtrText>{fmtKWD(inv.outstanding)}</LtrText></div>
      <div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", color: STATUS_COLOR[inv.status], background: `${STATUS_COLOR[inv.status]}14`, border: `1px solid ${STATUS_COLOR[inv.status]}55`, padding: "3px 8px", borderRadius: 4 }}>
          {t(`status.${inv.status}`)}
        </span>
      </div>
      <div style={{ position: "relative" }}>
        <button onClick={() => setMenuOpen(!menuOpen)} aria-label={t("kebab.open")} style={{ width: 28, height: 28, borderRadius: 4, background: menuOpen ? "var(--bg-surface-sunken)" : "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <MoreVertical size={14} />
        </button>
        {menuOpen && (
          <div
            data-popover-anchor="end"
            style={{ position: "absolute", top: "calc(100% + 4px)", insetInlineEnd: 0, width: 220, background: "var(--bg-surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, boxShadow: "var(--panel-shadow)", zIndex: 150, padding: "6px 0" }}
          >
            {type === "AR" ? (
              <>
                <MenuItem label={t("kebab.send_reminder")} onClick={() => onOpenAction("reminder", inv)} />
                <MenuItem label={t("kebab.log_payment")} onClick={() => onOpenAction("payment", inv)} />
                <MenuItem label={t("kebab.mark_disputed")} onClick={() => onOpenAction("dispute", inv)} />
                <MenuItem label={t("kebab.write_off")} onClick={() => onOpenAction("writeoff", inv)} />
                <MenuItem label={t("kebab.view_invoice")} onClick={() => onOpenAction("detail", inv)} />
              </>
            ) : (
              <>
                <MenuItem label={t("kebab.schedule_payment")} onClick={() => onOpenAction("schedule", inv)} />
                <MenuItem label={t("kebab.log_payment")} onClick={() => onOpenAction("payment", inv)} />
                <MenuItem label={t("kebab.mark_disputed")} onClick={() => onOpenAction("dispute", inv)} />
                <MenuItem label={t("kebab.view_invoice")} onClick={() => onOpenAction("detail", inv)} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ width: "100%", background: "transparent", border: "none", textAlign: "start", padding: "9px 14px", fontSize: 12, fontFamily: "inherit", color: "var(--text-primary)", cursor: "pointer" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface-sunken)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {label}
    </button>
  );
}

function TrendChart({ trend }) {
  const width = 800; const height = 160;
  const barWidth = width / trend.length;
  const max = Math.max(...trend.map((m) => m.total), 1);
  const colors = [BUCKET_COLOR.current, BUCKET_COLOR.b1_30, BUCKET_COLOR.b31_60, BUCKET_COLOR.b61_90, BUCKET_COLOR.b90_plus];
  return (
    <svg viewBox={`0 0 ${width} ${height + 20}`} style={{ width: "100%", height: 200 }}>
      {trend.map((m, i) => {
        const x = i * barWidth + barWidth * 0.15;
        const w = barWidth * 0.7;
        let y = height - 4;
        const segments = BUCKETS.map((b, si) => {
          const v = m[b];
          const h = v / max * (height - 20);
          y -= h;
          return { y, h, color: colors[si] };
        });
        return (
          <g key={i}>
            {segments.map((s, si) => (
              <rect key={si} x={x} y={s.y} width={w} height={s.h} fill={s.color} />
            ))}
            <text x={x + w / 2} y={height + 14} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.55)" fontFamily="'DM Mono', monospace">
              {m.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const exportBtn = {
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid var(--border-default)", padding: "7px 14px",
  borderRadius: 6, cursor: "pointer",
  fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", fontFamily: "inherit",
};
