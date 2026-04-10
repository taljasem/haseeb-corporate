import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import LtrText from "../shared/LtrText";
import { getForecast, recalculateForecast, getSavedForecastScenarios } from "../../engine/mockEngine";

function fmtKWD(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function CompareScenariosSlideOver({ open, onClose }) {
  const { t } = useTranslation("forecast");
  useEscapeKey(onClose, open);
  const [saved, setSaved] = useState([]);
  const [picked, setPicked] = useState([]);
  const [projections, setProjections] = useState({});

  useEffect(() => {
    if (!open) return;
    getSavedForecastScenarios().then((list) => {
      setSaved(list);
      setPicked(list.slice(0, 3).map((s) => s.id));
    });
  }, [open]);

  useEffect(() => {
    if (!open || picked.length === 0) return;
    Promise.all(
      picked.map((id) => {
        const s = saved.find((x) => x.id === id);
        if (!s) return Promise.resolve(null);
        return recalculateForecast(s.scenario, s.assumptions).then((p) => ({ id, savedScenario: s, projection: p }));
      })
    ).then((results) => {
      const map = {};
      results.filter(Boolean).forEach((r) => { map[r.id] = r; });
      setProjections(map);
    });
  }, [picked, saved, open]);

  if (!open) return null;

  const toggle = (id) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id]));
  };

  const cols = [
    { key: "revenue",    label: t("compare_slideover.kpi_revenue") },
    { key: "expenses",   label: t("compare_slideover.kpi_expenses") },
    { key: "netIncome",  label: t("compare_slideover.kpi_net_income") },
    { key: "endingCash", label: t("compare_slideover.kpi_ending_cash") },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div
        data-panel="aminah-slideover"
        style={{
          position: "fixed", top: 0, insetInlineEnd: 0, bottom: 0,
          width: 560, maxWidth: "calc(100vw - 32px)",
          background: "var(--panel-bg)",
          borderInlineStart: "1px solid rgba(255,255,255,0.10)",
          zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)" }}>{t("compare_slideover.title")}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{t("compare_slideover.subtitle")}</div>
          </div>
          <button onClick={onClose} aria-label={t("compare_slideover.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 8 }}>{t("compare_slideover.pick")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {saved.map((s) => {
              const on = picked.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  style={{
                    padding: "6px 12px", borderRadius: 14,
                    background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)",
                    border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                    color: on ? "var(--accent-primary)" : "var(--text-secondary)",
                    fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
          <div style={{ display: "grid", gridTemplateColumns: `140px repeat(${picked.length || 1}, 1fr)`, gap: 12, fontSize: 11 }}>
            <div />
            {picked.map((id) => {
              const s = saved.find((x) => x.id === id);
              return (
                <div key={id} style={{ fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-primary)", fontSize: 11 }}>
                  {s?.name || ""}
                </div>
              );
            })}
            {cols.map((c) => (
              <Row key={c.key} label={c.label} picked={picked} projections={projections} k={c.key} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, picked, projections, k }) {
  return (
    <>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        {label}
      </div>
      {picked.map((id) => {
        const p = projections[id]?.projection;
        return (
          <div key={id} style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: "var(--text-primary)", padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <LtrText>{p ? fmtKWD(p.totals[k]) : "—"}</LtrText>
          </div>
        );
      })}
    </>
  );
}
