import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Flag, Plus } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import LtrText from "../shared/LtrText";
import { getVarianceDetail, unflagVariance } from "../../engine/mockEngine";
import { formatRelativeTime } from "../../utils/relativeTime";
import AddVarianceNoteModal from "./AddVarianceNoteModal";
import FlagVarianceModal from "./FlagVarianceModal";

function fmtKWD(n) {
  if (n == null) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function VarianceDetailSlideOver({ open, varianceId, onClose }) {
  const { t } = useTranslation("variance");
  useEscapeKey(onClose, open);
  const [detail, setDetail] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);

  const reload = () => {
    if (!varianceId) return;
    getVarianceDetail(varianceId).then(setDetail);
  };
  useEffect(() => {
    if (!open || !varianceId) { setDetail(null); return; }
    reload();
  }, [open, varianceId]);

  if (!open) return null;

  const handleUnflag = async () => {
    await unflagVariance(varianceId);
    reload();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div
        data-panel="aminah-slideover"
        style={{
          position: "fixed", top: 0, insetInlineEnd: 0, bottom: 0,
          width: 520, maxWidth: "calc(100vw - 32px)",
          background: "var(--panel-bg)",
          borderInlineStart: "1px solid rgba(255,255,255,0.10)",
          zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)" }}>
            {t("detail.title")}
          </div>
          <button onClick={onClose} aria-label={t("detail.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          {!detail ? (
            <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
          ) : (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
                {detail.category} · {detail.department}
              </div>
              {detail.flagged && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--semantic-warning)", background: "var(--semantic-warning-subtle)", padding: "3px 8px", borderRadius: 4, marginTop: 6, marginInlineEnd: 6 }}>
                  <Flag size={10} /> {t("detail.flagged")}
                </span>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14, marginBottom: 18 }}>
                <Stat label={t("detail.plan")} value={fmtKWD(detail.plan)} />
                <Stat label={t("detail.actual")} value={fmtKWD(detail.actual)} />
                <Stat label={t("detail.variance")} value={fmtKWD(detail.variance)} color={detail.variance >= 0 ? "var(--accent-primary)" : "var(--semantic-danger)"} />
              </div>

              <div style={{ background: "rgba(0,196,140,0.06)", border: "1px solid rgba(0,196,140,0.25)", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--accent-primary)", marginBottom: 6 }}>
                  {t("detail.commentary_label")}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {detail.aminahCommentary}
                </div>
              </div>

              <SectionHead label={t("detail.trend_title")} />
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${detail.monthlyTrend.length}, 1fr)`, gap: 6, marginBottom: 18 }}>
                {detail.monthlyTrend.map((m, i) => {
                  const max = Math.max(...detail.monthlyTrend.map((x) => Math.abs(x.variance)));
                  const h = max > 0 ? Math.max(6, Math.round((Math.abs(m.variance) / max) * 60)) : 6;
                  const color = m.variance >= 0 ? "var(--accent-primary)" : "var(--semantic-danger)";
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: "100%", height: h, background: color, borderRadius: 2 }} />
                      <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}><LtrText>{m.month}</LtrText></div>
                    </div>
                  );
                })}
              </div>

              <SectionHead label={t("detail.contributors_title")} />
              <div style={{ marginBottom: 18 }}>
                {detail.contributors.map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
                    <div style={{ color: "var(--text-primary)" }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent-primary)", marginInlineEnd: 8 }}><LtrText>{c.ref}</LtrText></span>
                      {c.desc}
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", color: "var(--semantic-danger)" }}>
                      <LtrText>{fmtKWD(c.amount)}</LtrText>
                    </div>
                  </div>
                ))}
              </div>

              <SectionHead label={t("detail.notes_title")} />
              <div style={{ marginBottom: 18 }}>
                {detail.notes.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>—</div>
                ) : (
                  detail.notes.map((n) => (
                    <div key={n.id} style={{ padding: "10px 12px", background: "var(--bg-surface-sunken)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>{n.note}</div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>{n.author} · {formatRelativeTime(n.timestamp)}</div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setNoteOpen(true)} style={btnSecondary}>
                  <Plus size={12} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} /> {t("detail.add_note")}
                </button>
                {detail.flagged ? (
                  <button onClick={handleUnflag} style={btnSecondary}>
                    {t("detail.unflag")}
                  </button>
                ) : (
                  <button onClick={() => setFlagOpen(true)} style={{ background: "var(--semantic-warning)", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                    <Flag size={12} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} /> {t("detail.flag")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <AddVarianceNoteModal
        open={noteOpen}
        varianceId={varianceId}
        onClose={() => setNoteOpen(false)}
        onSaved={reload}
      />
      <FlagVarianceModal
        open={flagOpen}
        varianceId={varianceId}
        onClose={() => setFlagOpen(false)}
        onFlagged={reload}
      />
    </>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-tertiary)" }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: color || "var(--text-primary)", fontWeight: 600, marginTop: 4 }}>
        <LtrText>{value}</LtrText>
      </div>
    </div>
  );
}

function SectionHead({ label }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 8, marginTop: 4 }}>
      {label}
    </div>
  );
}

const btnSecondary = {
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px",
  borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit",
};
