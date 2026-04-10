import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import LtrText from "../shared/LtrText";
import { getInvoiceDetail } from "../../engine/mockEngine";
import { formatRelativeTime } from "../../utils/relativeTime";
import { formatDate } from "../../utils/format";

function fmtKWD(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export default function InvoiceDetailSlideOver({ open, invoiceId, onClose }) {
  const { t } = useTranslation("aging");
  useEscapeKey(onClose, open);
  const [inv, setInv] = useState(null);

  useEffect(() => {
    if (!open || !invoiceId) { setInv(null); return; }
    getInvoiceDetail(invoiceId).then(setInv);
  }, [open, invoiceId]);

  if (!open) return null;
  const isAR = inv?.type === "AR";

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
          {!inv ? (
            <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
          ) : (
            <>
              <Section label={t("detail.invoice_info")}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: "var(--accent-primary)", marginBottom: 4 }}><LtrText>{inv.invoiceNumber}</LtrText></div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{inv.partyName}</div>
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                  <span>{formatDate(inv.invoiceDate)} → {formatDate(inv.dueDate)}</span>
                  {inv.daysOverdue > 0 && <span style={{ color: "var(--semantic-danger)", fontWeight: 600 }}>{inv.daysOverdue}d overdue</span>}
                </div>
              </Section>

              <Section label={t("detail.line_items")}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 90px 100px", gap: 8, padding: "6px 0", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-tertiary)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div>{t("detail.col_desc")}</div>
                  <div style={{ textAlign: "end" }}>{t("detail.col_qty")}</div>
                  <div style={{ textAlign: "end" }}>{t("detail.col_unit")}</div>
                  <div style={{ textAlign: "end" }}>{t("detail.col_total")}</div>
                </div>
                {inv.lineItems.map((l, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 90px 100px", gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12, color: "var(--text-secondary)" }}>
                    <div>{l.description}</div>
                    <div style={{ textAlign: "end", fontFamily: "'DM Mono', monospace" }}>{l.qty}</div>
                    <div style={{ textAlign: "end", fontFamily: "'DM Mono', monospace" }}><LtrText>{fmtKWD(l.unitPrice)}</LtrText></div>
                    <div style={{ textAlign: "end", fontFamily: "'DM Mono', monospace", color: "var(--text-primary)", fontWeight: 600 }}><LtrText>{fmtKWD(l.total)}</LtrText></div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t("detail.total_due")}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "var(--text-primary)" }}><LtrText>{fmtKWD(inv.amount)}</LtrText></div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                  <div style={{ color: "var(--text-secondary)" }}>{t("detail.outstanding")}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", color: inv.outstanding > 0 ? "var(--semantic-warning)" : "var(--accent-primary)" }}><LtrText>{fmtKWD(inv.outstanding)}</LtrText></div>
                </div>
              </Section>

              <Section label={t("detail.payment_history")}>
                {inv.partialPayments.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>{t("detail.no_payments")}</div>
                ) : (
                  inv.partialPayments.map((p, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
                      <div>
                        <div style={{ color: "var(--text-primary)" }}>{formatDate(p.date)} · {p.method}</div>
                        {p.reference && <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}><LtrText>{p.reference}</LtrText></div>}
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent-primary)", fontWeight: 600 }}><LtrText>{fmtKWD(p.amount)}</LtrText></div>
                    </div>
                  ))
                )}
              </Section>

              <Section label={t("detail.comm_history")}>
                {inv.communicationHistory.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>{t("detail.no_comms")}</div>
                ) : (
                  inv.communicationHistory.map((c, i) => (
                    <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
                      <div style={{ color: "var(--text-primary)" }}>{c.type.replace("_", " ")}{c.template ? ` (${c.template})` : ""}</div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                        {c.by || c.sentBy || "—"} · {formatRelativeTime(c.at || c.sentAt)}
                      </div>
                      {c.notes && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{c.notes}</div>}
                    </div>
                  ))
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}
