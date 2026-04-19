import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import LtrText from "../shared/LtrText";
import { runThreeWayMatch } from "../../engine";

const inputStyle = {
  width: "100%",
  background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "var(--text-primary)",
  fontSize: 12,
  fontFamily: "inherit",
  outline: "none",
};

const STATUS_COLORS = {
  OK: { color: "var(--accent-primary)", bg: "var(--accent-primary-subtle)" },
  OVER_RECEIVED: { color: "var(--semantic-warning)", bg: "var(--semantic-warning-subtle)" },
  UNDER_RECEIVED: { color: "var(--semantic-warning)", bg: "var(--semantic-warning-subtle)" },
  OVER_BILLED: { color: "var(--semantic-danger)", bg: "var(--semantic-danger-subtle)" },
  UNDER_BILLED: { color: "var(--semantic-warning)", bg: "var(--semantic-warning-subtle)" },
  NOT_BILLED: { color: "var(--text-tertiary)", bg: "var(--bg-surface-sunken)" },
};

function isValidDecimalQty(v) {
  if (v === "" || v == null) return true; // empty is allowed
  return /^\d+(?:\.\d{1,2})?$/.test(String(v).trim());
}
function isValidDecimalKwd(v) {
  if (v === "" || v == null) return true;
  return /^\d+(?:\.\d{1,3})?$/.test(String(v).trim());
}

export default function ThreeWayMatchDrawer({ open, po, onClose }) {
  const { t } = useTranslation("purchase-orders");
  useEscapeKey(onClose, open);

  const [billedAmountKwd, setBilledAmountKwd] = useState("");
  const [billedByLine, setBilledByLine] = useState({});
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setBilledAmountKwd("");
    setBilledByLine({});
    setResult(null);
    setError(null);
  }, [open]);

  if (!open || !po) return null;

  const handleRun = async () => {
    setError(null);
    if (!isValidDecimalKwd(billedAmountKwd)) {
      setError(t("match_drawer.error_billed_amount"));
      return;
    }
    for (const l of po.lines || []) {
      const v = billedByLine[l.id];
      if (v && !isValidDecimalQty(v)) {
        setError(t("match_drawer.error_billed_qty"));
        return;
      }
    }

    const billedQtysPayload = {};
    let anyBilled = false;
    for (const l of po.lines || []) {
      const v = billedByLine[l.id];
      if (v !== undefined && v !== "") {
        billedQtysPayload[l.id] = String(v).trim();
        anyBilled = true;
      }
    }

    setRunning(true);
    try {
      const input = {
        purchaseOrderId: po.id,
        billId: anyBilled || billedAmountKwd ? po.id : null,
        billedQuantitiesByPoLine: anyBilled ? billedQtysPayload : undefined,
        billedAmountKwd: billedAmountKwd ? String(billedAmountKwd).trim() : null,
      };
      const r = await runThreeWayMatch(input);
      setResult(r);
    } catch (err) {
      setError(err?.message || t("match_drawer.error_generic"));
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          insetInlineEnd: 0,
          width: 560,
          maxWidth: "100vw",
          background: "var(--panel-bg)",
          borderInlineStart: "1px solid var(--border-default)",
          zIndex: 301,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t("match_drawer.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("match_drawer.title")}
            </div>
            <LtrText>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  fontFamily: "'DM Mono', monospace",
                  marginTop: 2,
                }}
              >
                {po.poNumber}
              </div>
            </LtrText>
          </div>
          <button
            onClick={onClose}
            aria-label={t("match_drawer.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div
          style={{
            padding: "18px 22px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {error && (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 12px",
                background: "var(--semantic-danger-subtle)",
                border: "1px solid var(--semantic-danger)",
                borderRadius: 8,
                color: "var(--semantic-danger)",
                fontSize: 12,
              }}
            >
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              padding: "10px 12px",
              background: "var(--bg-surface-sunken)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
            }}
          >
            {t("match_drawer.hint")}
          </div>

          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                marginBottom: 8,
              }}
            >
              {t("match_drawer.bill_section")}
            </div>
            <Field label={t("match_drawer.field_billed_amount")}>
              <input
                type="text"
                inputMode="decimal"
                value={billedAmountKwd}
                onChange={(e) => setBilledAmountKwd(e.target.value)}
                placeholder="0.000"
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
              />
            </Field>
          </div>

          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                marginBottom: 8,
              }}
            >
              {t("match_drawer.billed_qtys_section")}
            </div>
            <div
              style={{
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 80px 110px",
                  gap: 8,
                  padding: "8px 12px",
                  background: "var(--bg-surface-sunken)",
                  borderBottom: "1px solid var(--border-default)",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                }}
              >
                <div>{t("table.description")}</div>
                <div style={{ textAlign: "end" }}>{t("table.ordered")}</div>
                <div style={{ textAlign: "end" }}>{t("table.billed")}</div>
              </div>
              {(po.lines || []).map((l, idx) => (
                <div
                  key={l.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 80px 110px",
                    gap: 8,
                    padding: "8px 12px",
                    borderBottom:
                      idx === po.lines.length - 1 ? "none" : "1px solid var(--border-subtle)",
                    alignItems: "center",
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: "var(--text-primary)" }}>{l.description}</div>
                  <LtrText>
                    <div
                      style={{
                        textAlign: "end",
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {Number(l.quantity).toFixed(2)}
                    </div>
                  </LtrText>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={billedByLine[l.id] || ""}
                    onChange={(e) =>
                      setBilledByLine((p) => ({ ...p, [l.id]: e.target.value }))
                    }
                    placeholder="0.00"
                    style={{
                      ...inputStyle,
                      fontFamily: "'DM Mono', monospace",
                      textAlign: "end",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleRun}
            disabled={running}
            style={btnPrimary(running)}
          >
            {running ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("match_drawer.running")}
              </>
            ) : (
              <>
                <Scale
                  size={13}
                  style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
                />
                {t("match_drawer.run")}
              </>
            )}
          </button>

          {result && <ResultView result={result} />}
        </div>
      </div>
    </>
  );
}

function ResultView({ result }) {
  const { t } = useTranslation("purchase-orders");
  const matched = result.overallStatus === "MATCHED";
  const tone = matched ? "var(--accent-primary)" : "var(--semantic-danger)";
  const toneBg = matched ? "var(--accent-primary-subtle)" : "var(--semantic-danger-subtle)";
  const toneBorder = matched ? "var(--accent-primary-border)" : "var(--semantic-danger)";

  return (
    <div
      role="status"
      style={{
        padding: "14px 16px",
        borderRadius: 10,
        background: toneBg,
        border: `1px solid ${toneBorder}`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: tone,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.05em",
          }}
        >
          {matched ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {matched ? t("match_drawer.matched") : t("match_drawer.discrepancies")}
        </div>
        <LtrText>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "'DM Mono', monospace",
              color: tone,
            }}
          >
            {result.confidenceScore}%
          </div>
        </LtrText>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        <Cell label={t("match_drawer.po_total")} value={`${result.poTotalKwd} KWD`} />
        <Cell label={t("match_drawer.received_value")} value={`${result.receivedValueKwd} KWD`} />
        {result.billedAmountKwd != null && (
          <Cell label={t("match_drawer.billed_amount")} value={`${result.billedAmountKwd} KWD`} />
        )}
      </div>

      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {t("match_drawer.line_discrepancies")}
        </div>
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--panel-bg)",
          }}
        >
          {result.lineDiscrepancies.map((d, idx) => {
            const c = STATUS_COLORS[d.qtyMatchStatus] || STATUS_COLORS.OK;
            return (
              <div
                key={d.purchaseOrderLineId}
                style={{
                  padding: "10px 12px",
                  borderBottom:
                    idx === result.lineDiscrepancies.length - 1
                      ? "none"
                      : "1px solid var(--border-subtle)",
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 3,
                  }}
                >
                  <div style={{ color: "var(--text-primary)", flex: 1 }}>{d.description}</div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      padding: "2px 7px",
                      borderRadius: 10,
                      background: c.bg,
                      color: c.color,
                      border: "1px solid",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t(`match_drawer.status_${d.qtyMatchStatus}`)}
                  </span>
                </div>
                <LtrText>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {d.note}
                  </div>
                </LtrText>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontStyle: "italic" }}>
        {result.note}
      </div>
    </div>
  );
}

function Cell({ label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <LtrText>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          {value}
        </div>
      </LtrText>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

const btnPrimary = (l) => ({
  background: "var(--accent-primary)",
  color: "#fff",
  border: "none",
  padding: "9px 16px",
  borderRadius: 6,
  cursor: l ? "not-allowed" : "pointer",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "inherit",
});
