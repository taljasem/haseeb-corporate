import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import AminahNarrationCard from "../../components/financial/AminahNarrationCard";
import VarianceDetailSlideOver from "../../components/variance/VarianceDetailSlideOver";
import { useTenant } from "../../components/shared/TenantContext";
import { getVarianceAnalysis, getVarianceNarration, exportVarianceReport } from "../../engine/mockEngine";

const STATUS_COLOR = {
  on_track:    "var(--accent-primary)",
  watch:       "var(--semantic-info)",
  investigate: "var(--semantic-warning)",
  critical:    "var(--semantic-danger)",
};

const PERIODS = ["month", "quarter", "ytd", "custom"];
const COMPARISONS = ["budget", "prior_period", "prior_year"];

function fmtKWD(n) {
  if (n == null) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function cellColor(v, max) {
  if (v === 0 || max === 0) return "transparent";
  const ratio = Math.min(1, Math.abs(v) / max);
  const base = v >= 0 ? "0,196,140" : "255,90,95";
  return `rgba(${base}, ${ratio * 0.25 + 0.05})`;
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

export default function VarianceAnalysisScreen({ onOpenAminah }) {
  const { t } = useTranslation("variance");
  const { tenant } = useTenant();
  const [period, setPeriod] = useState("month");
  const [comparison, setComparison] = useState("budget");
  const [data, setData] = useState(null);
  const [narration, setNarration] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getVarianceAnalysis(period, comparison).then(setData);
    getVarianceNarration(period).then(setNarration);
  }, [period, comparison]);

  if (!data) return <div style={{ padding: 28, color: "var(--text-tertiary)" }}>{t("loading")}</div>;

  const maxVariance = Math.max(...data.matrix.cells.flat().map((v) => Math.abs(v)), 1);
  const maxTrend = Math.max(...data.trend.map((x) => Math.abs(x.totalVariance)), 1);

  const handleExport = async () => {
    const meta = await exportVarianceReport(period, "csv");
    const rows = [["Department", ...data.matrix.categories, "Total"]];
    data.matrix.cells.forEach((row, i) => {
      const total = row.reduce((a, b) => a + b, 0);
      rows.push([data.matrix.departments[i], ...row, total]);
    });
    csvExport(meta.filename, rows);
    setToast(t("export", { format: "CSV" }));
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Hero */}
      <div
        style={{
          padding: "22px 28px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
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
            {t("hero_subtitle", { period: "March 2026", tenant: tenant?.company?.shortName || "" })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={handleExport} style={exportBtn}>{t("export", { format: "CSV" })}</button>
          {onOpenAminah && (
            <button onClick={() => onOpenAminah("Variance Analysis — March 2026")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--accent-primary)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
              <Sparkles size={12} /> AMINAH
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 32px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          {toast && (
            <div style={{ marginBottom: 14, background: "var(--accent-primary-subtle)", border: "1px solid rgba(0,196,140,0.30)", color: "var(--accent-primary)", padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500 }}>
              {toast}
            </div>
          )}

          {/* Controls */}
          <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {PERIODS.map((p) => {
                const on = period === p;
                return (
                  <button key={p} onClick={() => setPeriod(p)} style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 14, background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface)", border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)", color: on ? "var(--accent-primary)" : "var(--text-tertiary)", cursor: "pointer", fontFamily: "inherit" }}>
                    {p.replace("_", " ")}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>{t("controls.comparison_label")}</div>
            <select
              value={comparison}
              onChange={(e) => setComparison(e.target.value)}
              style={{ background: "var(--bg-surface-sunken)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, padding: "6px 10px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }}
            >
              {COMPARISONS.map((c) => (
                <option key={c} value={c}>{t(`controls.compare_${c}`)}</option>
              ))}
            </select>
          </div>

          {/* Top variances */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", marginBottom: 4 }}>{t("top_variances.title")}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 12 }}>{t("top_variances.subtitle")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 120px 120px", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-tertiary)" }}>
              <div>{t("top_variances.col_category")}</div>
              <div style={{ textAlign: "end" }}>{t("top_variances.col_plan")}</div>
              <div style={{ textAlign: "end" }}>{t("top_variances.col_actual")}</div>
              <div style={{ textAlign: "end" }}>{t("top_variances.col_variance")}</div>
              <div style={{ textAlign: "end" }}>{t("top_variances.col_status")}</div>
            </div>
            {data.topVariances.map((v) => (
              <button
                key={v.id}
                onClick={() => setDetailId(v.id)}
                style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 120px 120px 120px 120px", gap: 8, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "transparent", border: "none", cursor: "pointer", alignItems: "center", textAlign: "start", fontFamily: "inherit", color: "var(--text-primary)" }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{v.category}</div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{v.department}</div>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, textAlign: "end", color: "var(--text-secondary)" }}><LtrText>{fmtKWD(v.plan)}</LtrText></div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, textAlign: "end", color: "var(--text-secondary)" }}><LtrText>{fmtKWD(v.actual)}</LtrText></div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, textAlign: "end", color: v.variance >= 0 ? "var(--accent-primary)" : "var(--semantic-danger)", fontWeight: 600 }}>
                  <LtrText>{fmtKWD(v.variance)}</LtrText>
                  <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 400 }}><LtrText>{v.variancePct}%</LtrText></div>
                </div>
                <div style={{ textAlign: "end" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", color: STATUS_COLOR[v.status], background: `${STATUS_COLOR[v.status]}14`, border: `1px solid ${STATUS_COLOR[v.status]}55`, padding: "3px 8px", borderRadius: 4 }}>
                    {t(`status.${v.status}`)}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {narration && (
            <AminahNarrationCard text={narration.narration} onAsk={() => onOpenAminah && onOpenAminah("Variance analysis")} />
          )}

          {/* Matrix */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "18px 20px", marginBottom: 14, overflowX: "auto" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", marginBottom: 4 }}>{t("matrix.title")}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 12 }}>{t("matrix.subtitle")}</div>
            <div style={{ minWidth: 800 }}>
              <div style={{ display: "grid", gridTemplateColumns: `120px repeat(${data.matrix.categories.length}, minmax(80px, 1fr)) 100px`, gap: 4, padding: "8px 0", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-tertiary)" }}>
                <div />
                {data.matrix.categories.map((c) => <div key={c} style={{ textAlign: "end" }}>{c}</div>)}
                <div style={{ textAlign: "end" }}>{t("matrix.col_total")}</div>
              </div>
              {data.matrix.departments.map((dept, r) => {
                const rowTotal = data.matrix.cells[r].reduce((a, b) => a + b, 0);
                return (
                  <div key={dept} style={{ display: "grid", gridTemplateColumns: `120px repeat(${data.matrix.categories.length}, minmax(80px, 1fr)) 100px`, gap: 4, padding: "4px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 500, display: "flex", alignItems: "center" }}>{dept}</div>
                    {data.matrix.cells[r].map((cell, c) => {
                      const id = `var-${r}-${c}`;
                      return (
                        <button
                          key={c}
                          onClick={() => setDetailId(id)}
                          style={{
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 11,
                            textAlign: "end",
                            padding: "8px 10px",
                            background: cellColor(cell, maxVariance),
                            border: "1px solid rgba(255,255,255,0.04)",
                            borderRadius: 4,
                            color: cell >= 0 ? "var(--accent-primary)" : "var(--semantic-danger)",
                            cursor: "pointer",
                            fontWeight: Math.abs(cell) > maxVariance * 0.5 ? 600 : 400,
                          }}
                        >
                          <LtrText>{fmtKWD(cell)}</LtrText>
                        </button>
                      );
                    })}
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: "end", padding: "8px 10px", color: rowTotal >= 0 ? "var(--accent-primary)" : "var(--semantic-danger)", fontWeight: 600 }}>
                      <LtrText>{fmtKWD(rowTotal)}</LtrText>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "grid", gridTemplateColumns: `120px repeat(${data.matrix.categories.length}, minmax(80px, 1fr)) 100px`, gap: 4, padding: "8px 0", borderTop: "2px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-tertiary)" }}>{t("matrix.row_total")}</div>
                {data.matrix.categories.map((_c, i) => {
                  const colTotal = data.matrix.cells.reduce((s, row) => s + row[i], 0);
                  return (
                    <div key={i} style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: "end", padding: "4px 10px", color: colTotal >= 0 ? "var(--accent-primary)" : "var(--semantic-danger)", fontWeight: 600 }}>
                      <LtrText>{fmtKWD(colTotal)}</LtrText>
                    </div>
                  );
                })}
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, textAlign: "end", padding: "4px 10px", color: data.totalVariance >= 0 ? "var(--accent-primary)" : "var(--semantic-danger)", fontWeight: 700 }}>
                  <LtrText>{fmtKWD(data.totalVariance)}</LtrText>
                </div>
              </div>
            </div>
          </div>

          {/* Trend chart */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "18px 20px" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", marginBottom: 4 }}>{t("trend.title")}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 12 }}>{t("trend.subtitle")}</div>
            <TrendChart trend={data.trend} maxTrend={maxTrend} />
          </div>

          {narration && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
              <NarrationList label={t("narration.insights_label")} items={narration.topInsights} color="var(--accent-primary)" Icon={TrendingUp} />
              <NarrationList label={t("narration.actions_label")} items={narration.recommendedActions} color="var(--semantic-warning)" Icon={AlertTriangle} />
            </div>
          )}
        </div>
      </div>

      <VarianceDetailSlideOver
        open={!!detailId}
        varianceId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

function TrendChart({ trend, maxTrend }) {
  const width = 800;
  const height = 160;
  const barWidth = width / trend.length;
  const centerY = height / 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 180 }}>
      <line x1={0} y1={centerY} x2={width} y2={centerY} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
      {trend.map((m, i) => {
        const h = maxTrend > 0 ? Math.abs(m.totalVariance) / maxTrend * (centerY - 12) : 0;
        const x = i * barWidth + barWidth * 0.15;
        const w = barWidth * 0.7;
        const y = m.totalVariance >= 0 ? centerY - h : centerY;
        const color = m.totalVariance >= 0 ? "#00C48C" : "#FF5A5F";
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill={color} rx={2} />
            <text x={x + w / 2} y={height - 4} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.55)" fontFamily="'DM Mono', monospace">
              {m.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function NarrationList({ label, items, color, Icon }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color, marginBottom: 8 }}>
        <Icon size={12} /> {label}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 12, color: "var(--text-secondary)", paddingInlineStart: 12, position: "relative", lineHeight: 1.5 }}>
            <span style={{ position: "absolute", left: 0, top: 8, width: 4, height: 4, borderRadius: "50%", background: color }} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

const exportBtn = {
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid rgba(255,255,255,0.12)", padding: "7px 14px",
  borderRadius: 6, cursor: "pointer",
  fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", fontFamily: "inherit",
};
