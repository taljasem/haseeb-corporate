import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Search } from "lucide-react";
import LtrText from "../shared/LtrText";
import { previewRule } from "../../engine/mockEngine";

function fmtKWD(n) {
  if (n == null) return "—";
  const abs = Math.abs(Number(n));
  return abs.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

/**
 * Live preview panel for rule modals. Debounces the rule config so typing
 * doesn't spam the engine, and shows up to 10 sample matches with the
 * before/after category for categorization rules or proposed recipient for
 * routing rules.
 *
 * Props:
 *   ruleType: "categorization" | "routing"
 *   ruleConfig: the current in-progress rule object from the modal form
 */
export default function RulePreviewPanel({ ruleType, ruleConfig }) {
  const { t } = useTranslation("rules");
  const [expanded, setExpanded] = useState(true);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [debounced, setDebounced] = useState(ruleConfig);

  // Debounce rule config updates
  useEffect(() => {
    const id = setTimeout(() => setDebounced(ruleConfig), 300);
    return () => clearTimeout(id);
  }, [ruleConfig]);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setLoading(true);
    previewRule(ruleType, debounced).then((r) => {
      if (!cancelled) {
        setData(r);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [debounced, ruleType, expanded]);

  const matches = data?.matches || [];
  const total = data?.matchCount || 0;
  const hasMatches = matches.length > 0;

  return (
    <div
      style={{
        border: "1px solid rgba(0,196,140,0.20)",
        background: "var(--bg-surface-sunken)",
        borderRadius: 8,
        padding: "12px 14px",
        marginTop: 10,
      }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          fontFamily: "inherit",
          textAlign: "start",
        }}
      >
        {expanded ? <EyeOff size={13} color="var(--accent-primary)" /> : <Eye size={13} color="var(--accent-primary)" />}
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--accent-primary)" }}>
          {t("preview.title")}
        </span>
        {data && (
          <span style={{ marginInlineStart: "auto", fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}>
            <LtrText>
              {total <= 1 ? t("preview.match_count", { count: total }) : t("preview.match_count_plural", { count: total })}
            </LtrText>
          </span>
        )}
      </button>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          {loading && !data && (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "12px 0" }}>…</div>
          )}
          {!loading && !hasMatches && (
            <div style={{ padding: "14px 0", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{t("preview.empty_title")}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{t("preview.empty_desc")}</div>
            </div>
          )}
          {hasMatches && (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: ruleType === "routing" ? "70px 1fr 90px 1fr" : "70px 1fr 90px 1fr 1fr",
                  gap: 8,
                  padding: "6px 0",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: "var(--text-tertiary)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div>{t("preview.col_date")}</div>
                <div>{t("preview.col_merchant")}</div>
                <div style={{ textAlign: "end" }}>{t("preview.col_amount")}</div>
                <div>{t("preview.col_current")}</div>
                {ruleType === "routing" ? (
                  <div>{t("preview.col_recipient")}</div>
                ) : (
                  <div>{t("preview.col_proposed")}</div>
                )}
              </div>
              {matches.map((m) => (
                <div
                  key={m.txId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: ruleType === "routing" ? "70px 1fr 90px 1fr" : "70px 1fr 90px 1fr 1fr",
                    gap: 8,
                    padding: "8px 0",
                    fontSize: 11,
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    alignItems: "center",
                  }}
                >
                  <div style={{ color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}>{m.date}</div>
                  <div style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.merchant}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", textAlign: "end", color: m.amount < 0 ? "var(--semantic-danger)" : "var(--accent-primary)" }}>
                    <LtrText>{fmtKWD(m.amount)}</LtrText>
                  </div>
                  <div style={{ color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.currentCategory || "—"}
                  </div>
                  {ruleType === "routing" ? (
                    <div style={{ color: "var(--accent-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.proposedRecipient || "—"}
                    </div>
                  ) : (
                    <div style={{ color: "var(--accent-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.proposedCategory || "—"}
                    </div>
                  )}
                </div>
              ))}
              {total > matches.length && (
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6, textAlign: "center" }}>
                  <LtrText>{t("preview.showing", { shown: matches.length, total })}</LtrText>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
