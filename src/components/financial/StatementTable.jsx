import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoreVertical, StickyNote } from "lucide-react";
import LtrText from "../shared/LtrText";

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
  if (!n) return "var(--text-secondary)";
  return n > 0 ? "var(--accent-primary)" : "var(--semantic-danger)";
}

const HL_BG = {
  teal:  "var(--bg-selected)",
  amber: "rgba(212,168,75,0.06)",
  red:   "rgba(255,90,95,0.06)",
};
const HL_FG = {
  teal:  "var(--accent-primary)",
  amber: "var(--semantic-warning)",
  red:   "var(--semantic-danger)",
};

// Extract a GL code from an account label like "6300 Marketing & Advertising".
// Lines ship with the name embedded (same shape _brandObj produces).
function extractCode(label) {
  if (!label) return null;
  const m = String(label).match(/^\s*(\d{3,5})\b/);
  return m ? m[1] : null;
}

function Cell({ children, align = "right", color = "var(--text-primary)", size = 13, mono = true, weight = 400 }) {
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

function LineMenu({ line, code, hasNote, onAction, anchorRef, onClose }) {
  const { t } = useTranslation("financial");
  const menuRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && anchorRef.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", onClick);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, anchorRef]);

  const items = [
    { id: "reclassify",    label: t("line_menu.reclassify") },
    { id: "note",          label: t(hasNote ? "line_menu.edit_note" : "line_menu.add_note") },
    { id: "view_entries",  label: t("line_menu.view_entries") },
    { id: "divider" },
    { id: "copy_code",     label: t("line_menu.copy_code"), disabled: !code },
  ];

  return (
    <div
      ref={menuRef}
      data-popover-anchor="end"
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        insetInlineEnd: 0,
        width: 220,
        background: "var(--bg-surface-raised)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 8,
        boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
        zIndex: 150,
        padding: "6px 0",
      }}
    >
      {items.map((it, i) => {
        if (it.id === "divider") {
          return <div key={`d-${i}`} style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "6px 0" }} />;
        }
        return (
          <button
            key={it.id}
            disabled={it.disabled}
            onClick={() => { onAction(it.id, line, code); onClose(); }}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              textAlign: "start",
              padding: "9px 14px",
              fontSize: 12,
              fontFamily: "inherit",
              color: it.disabled ? "var(--text-tertiary)" : "var(--text-primary)",
              cursor: it.disabled ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!it.disabled) e.currentTarget.style.background = "var(--bg-surface-sunken)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function Row({
  cols, label, current, prior, change, percent,
  indent = 0, bold = false, size = 13, hl = null, border = true, final = false,
  line = null, mode = "readonly", onLineAction, note = null, onOpenNote,
}) {
  const bg = hl ? HL_BG[hl] : "transparent";
  const labelColor = hl ? HL_FG[hl] : bold ? "var(--text-primary)" : "var(--text-secondary)";
  const [menuOpen, setMenuOpen] = useState(false);
  const kebabRef = useRef(null);
  const isCfo = mode === "cfo" && !!line; // Only line rows get actions, not highlights/subtotals
  const code = extractCode(label);
  const { t } = useTranslation("financial");

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
          paddingInlineStart: indent * 16,
          letterSpacing: final ? "0.03em" : "0",
          textTransform: final ? "uppercase" : "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
        }}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {isCfo && note && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenNote && onOpenNote(note, line, code); }}
            title={note.note}
            aria-label={t("line_menu.note_icon_tooltip")}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--accent-primary)",
              display: "inline-flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <StickyNote size={13} />
          </button>
        )}
      </div>
      <Cell
        color={hl ? HL_FG[hl] : "var(--text-primary)"}
        weight={bold || hl || final ? 500 : 400}
        size={final ? 15 : 13}
      >
        <LtrText>{fmtN(current)}</LtrText>
      </Cell>
      <Cell color="var(--text-tertiary)"><LtrText>{fmtN(prior)}</LtrText></Cell>
      <Cell color={changeColor(change)}><LtrText>{fmtChange(change)}</LtrText></Cell>
      <Cell color={changeColor(change)} size={12}><LtrText>{fmtPct(percent)}</LtrText></Cell>
      {mode === "cfo" && (
        <div style={{ position: "relative", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          {isCfo ? (
            <>
              <button
                ref={kebabRef}
                onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                aria-label={t("line_menu.open")}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  background: menuOpen ? "var(--bg-surface-sunken)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <LineMenu
                  line={line}
                  code={code}
                  hasNote={!!note}
                  onAction={onLineAction}
                  anchorRef={kebabRef}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function StatementTable({
  sections = [],
  mode = "readonly",
  onLineAction,
  notesByCode,
  onOpenNote,
}) {
  const { t } = useTranslation("financial");
  const cols = mode === "cfo" ? "1fr 150px 140px 140px 80px 40px" : "1fr 150px 140px 140px 80px";
  const getNoteFor = (label) => {
    if (!notesByCode) return null;
    const c = extractCode(label);
    return c ? notesByCode[c] || null : null;
  };

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        overflow: "visible",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          gap: 12,
          padding: "12px 18px",
          background: "var(--bg-surface-sunken)",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
        }}
      >
        <div>{t("table.col_account")}</div>
        <div style={{ textAlign: "end" }}>{t("table.col_current")}</div>
        <div style={{ textAlign: "end" }}>{t("table.col_prior")}</div>
        <div style={{ textAlign: "end" }}>{t("table.col_change")}</div>
        <div style={{ textAlign: "end" }}>{t("table.col_pct")}</div>
        {mode === "cfo" && <div />}
      </div>

      {sections.map((s, si) => {
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
              mode={mode}
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
                color: "var(--text-primary)",
                background: "var(--bg-surface)",
                borderTop: si > 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}
            >
              {s.name}
            </div>
          );
        }
        const rows = [];
        rows.push(
          <div
            key={`h-${si}`}
            style={{
              padding: "12px 18px 6px",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "var(--text-tertiary)",
              borderTop: si > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
          >
            {s.name}
          </div>
        );
        (s.lines || []).forEach((l, li) => {
          const note = getNoteFor(l.account);
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
              line={l}
              mode={mode}
              onLineAction={onLineAction}
              note={note}
              onOpenNote={onOpenNote}
            />
          );
        });
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
              mode={mode}
            />
          );
        }
        return <div key={si}>{rows}</div>;
      })}
    </div>
  );
}
