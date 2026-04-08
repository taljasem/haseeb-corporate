import { useTranslation } from "react-i18next";

function fmtN(n) {
  if (n == null) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return n < 0 ? `(${abs})` : abs;
}
function fmtChange(n) {
  if (n == null) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  if (n === 0) return "0.000";
  return n > 0 ? `+${abs}` : `-${abs}`;
}
function fmtPct(p) {
  if (p == null) return "—";
  if (p === 0) return "0.0%";
  return (p > 0 ? "+" : "") + p.toFixed(1) + "%";
}
function changeColor(n) {
  if (!n) return "#8B98A5";
  return n > 0 ? "#00C48C" : "#FF5A5F";
}

const HL_BG = {
  teal:  "rgba(0,196,140,0.06)",
  amber: "rgba(212,168,75,0.06)",
  red:   "rgba(255,90,95,0.06)",
};
const HL_FG = {
  teal:  "#00C48C",
  amber: "#D4A84B",
  red:   "#FF5A5F",
};

function Cell({ children, align = "right", color = "#E6EDF3", size = 13, mono = true, weight = 400 }) {
  return (
    <div
      style={{
        fontFamily: mono ? "'DM Mono', monospace" : "inherit",
        fontSize: size,
        color,
        textAlign: align,
        fontVariantNumeric: "tabular-nums",
        fontWeight: weight,
      }}
    >
      {children}
    </div>
  );
}

function Row({ cols, label, current, prior, change, percent, indent = 0, bold = false, size = 13, hl = null, border = true, final = false }) {
  const bg = hl ? HL_BG[hl] : "transparent";
  const labelColor = hl ? HL_FG[hl] : bold ? "#E6EDF3" : "#8B98A5";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        gap: 12,
        padding: final ? "14px 18px" : "9px 18px",
        background: bg,
        borderBottom: border ? "1px solid rgba(255,255,255,0.04)" : "none",
        alignItems: "baseline",
      }}
    >
      <div
        style={{
          fontSize: final ? 14 : size,
          color: labelColor,
          fontWeight: bold || hl || final ? 600 : 400,
          paddingLeft: indent * 16,
          letterSpacing: final ? "0.03em" : "0",
          textTransform: final ? "uppercase" : "none",
        }}
      >
        {label}
      </div>
      <Cell
        color={hl ? HL_FG[hl] : "#E6EDF3"}
        weight={bold || hl || final ? 500 : 400}
        size={final ? 15 : 13}
      >
        {fmtN(current)}
      </Cell>
      <Cell color="#5B6570">{fmtN(prior)}</Cell>
      <Cell color={changeColor(change)}>{fmtChange(change)}</Cell>
      <Cell color={changeColor(change)} size={12}>{fmtPct(percent)}</Cell>
    </div>
  );
}

export default function StatementTable({ sections = [] }) {
  const { t } = useTranslation("financial");
  const cols = "1fr 150px 140px 140px 80px";
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          gap: 12,
          padding: "12px 18px",
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "#5B6570",
        }}
      >
        <div>{t("table.col_account")}</div>
        <div style={{ textAlign: "right" }}>{t("table.col_current")}</div>
        <div style={{ textAlign: "right" }}>{t("table.col_prior")}</div>
        <div style={{ textAlign: "right" }}>{t("table.col_change")}</div>
        <div style={{ textAlign: "right" }}>{t("table.col_pct")}</div>
      </div>

      {sections.map((s, si) => {
        // Highlighted summary row (no lines)
        if (s.highlight) {
          const change = (s.current || 0) - (s.prior || 0);
          const pct = s.prior ? (change / Math.abs(s.prior)) * 100 : null;
          return (
            <Row
              key={si}
              cols={cols}
              label={s.name}
              current={s.current}
              prior={s.prior}
              change={change}
              percent={pct}
              hl={s.highlight}
              final={s.final}
            />
          );
        }
        if (s.isParent) {
          return (
            <div
              key={si}
              style={{
                padding: "14px 18px 6px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: "#E6EDF3",
                background: "rgba(255,255,255,0.02)",
                borderTop: si > 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}
            >
              {s.name}
            </div>
          );
        }
        // Normal section with a header row + lines + subtotal
        const rows = [];
        rows.push(
          <div
            key={`h-${si}`}
            style={{
              padding: "12px 18px 6px",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
              borderTop: si > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
          >
            {s.name}
          </div>
        );
        (s.lines || []).forEach((l, li) =>
          rows.push(
            <Row
              key={`l-${si}-${li}`}
              cols={cols}
              label={l.account}
              current={s.subtotal?.negative ? -l.current : l.current}
              prior={s.subtotal?.negative ? -l.prior : l.prior}
              change={l.change}
              percent={l.percentChange}
              indent={1}
            />
          )
        );
        if (s.subtotal) {
          const change = (s.subtotal.current || 0) - (s.subtotal.prior || 0);
          const pct = s.subtotal.prior ? (change / Math.abs(s.subtotal.prior)) * 100 : null;
          rows.push(
            <Row
              key={`sub-${si}`}
              cols={cols}
              label={s.subtotal.label}
              current={s.subtotal.negative ? -s.subtotal.current : s.subtotal.current}
              prior={s.subtotal.negative ? -s.subtotal.prior : s.subtotal.prior}
              change={change}
              percent={pct}
              bold
            />
          );
        }
        return <div key={si}>{rows}</div>;
      })}
    </div>
  );
}
