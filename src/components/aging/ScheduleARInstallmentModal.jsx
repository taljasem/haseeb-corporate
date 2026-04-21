import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle, CheckCircle2 } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
// AUDIT-ACC-005 (corporate-api 3fdb92c, 2026-04-22): AR installment-plan
// modal wired to the new /api/invoices/:id/schedule-payment endpoint.
// Body = { installments: [{dueDate: ISO-date, amount: KWD-string 3dp}] }
// Min 2 / max 12 installments; sum must equal invoice.outstanding within
// 0.001 KWD tolerance; backend returns 409 on existing active plan.
// Resolution 2.2(a) per Tarek 2026-04-22.
import { scheduleInvoicePaymentPlan } from "../../engine";

const inputStyle = {
  width: "100%", background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)", borderRadius: 8,
  padding: "10px 12px", color: "var(--text-primary)",
  fontSize: 13, fontFamily: "inherit", outline: "none",
};

const MIN_INSTALLMENTS = 2;
const MAX_INSTALLMENTS = 12;
const TOLERANCE_MILLI = 1; // 0.001 KWD == 1 millis

// Convert a 3dp KWD string to integer milliunits (avoids float drift when
// comparing installment sums against invoice.outstanding). Returns null
// if the input isn't parseable as a KWD-3dp number.
function kwdToMilli(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (!/^\d+(\.\d{0,3})?$/.test(s)) return null;
  const [ip, fp = ""] = s.split(".");
  const padded = (fp + "000").slice(0, 3);
  const n = Number(ip) * 1000 + Number(padded);
  return Number.isFinite(n) ? n : null;
}

function milliToKwdStr(m) {
  if (!Number.isFinite(m)) return "0.000";
  const sign = m < 0 ? "-" : "";
  const abs = Math.abs(m);
  const ip = Math.floor(abs / 1000);
  const fp = String(abs % 1000).padStart(3, "0");
  return `${sign}${ip}.${fp}`;
}

function addMonthsYMD(dateStr, months) {
  // Parse YYYY-MM-DD as a local date and add N months, clamping the day.
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  const base = new Date(y, m - 1, d);
  const target = new Date(base.getFullYear(), base.getMonth() + months, base.getDate());
  // Clamp to end-of-month if the day overflowed (e.g. Jan 31 + 1 month).
  if (target.getMonth() !== ((base.getMonth() + months) % 12 + 12) % 12) {
    target.setDate(0);
  }
  const yy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  const dd = String(target.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function isFutureOrTodayYMD(ymd) {
  if (!ymd) return false;
  return ymd >= todayYMD();
}

// Build default installments: N rows, amounts divide outstanding equally
// with rounding residual on the last row, dates monthly from the later
// of (invoice.dueDate, today) + 1 month.
function buildDefaultInstallments(n, outstandingMilli, seedDate) {
  if (!n || n < MIN_INSTALLMENTS) return [];
  const per = Math.floor(outstandingMilli / n);
  const residual = outstandingMilli - per * n;
  const rows = [];
  const base = seedDate || todayYMD();
  for (let i = 0; i < n; i++) {
    const amountMilli = i === n - 1 ? per + residual : per;
    rows.push({
      dueDate: addMonthsYMD(base, i + 1),
      amount: milliToKwdStr(amountMilli),
    });
  }
  return rows;
}

export default function ScheduleARInstallmentModal({ open, invoice, onClose, onScheduled }) {
  const { t } = useTranslation("aging");
  useEscapeKey(onClose, open);
  const [count, setCount] = useState(3);
  const [installments, setInstallments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const outstandingMilli = useMemo(() => {
    if (!invoice) return 0;
    // invoice.outstanding may be a number (mockEngine) or string (live adapter).
    const viaMilli = kwdToMilli(invoice.outstanding);
    if (viaMilli !== null) return viaMilli;
    const n = Number(invoice.outstanding || invoice.amount || 0);
    return Math.round(n * 1000);
  }, [invoice]);

  // Initialize + repopulate defaults whenever the modal opens, the invoice
  // changes, or the installment count changes.
  useEffect(() => {
    if (!open || !invoice) return;
    // Seed date: later of invoice.dueDate or today (so past-due invoices
    // schedule forward from today, not in the past).
    const dueYMD = invoice.dueDate ? String(invoice.dueDate).slice(0, 10) : todayYMD();
    const seed = dueYMD >= todayYMD() ? dueYMD : todayYMD();
    setInstallments(buildDefaultInstallments(count, outstandingMilli, seed));
    setSubmitError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id, count]);

  // Reset count on open.
  useEffect(() => {
    if (open) setCount(3);
  }, [open]);

  const updateRow = (idx, patch) => {
    setInstallments((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const sumMilli = useMemo(() => {
    return installments.reduce((acc, r) => {
      const m = kwdToMilli(r.amount);
      return acc + (m === null ? 0 : m);
    }, 0);
  }, [installments]);

  const deltaMilli = sumMilli - outstandingMilli;
  const sumMatches = Math.abs(deltaMilli) <= TOLERANCE_MILLI;

  const datesFilled = installments.every((r) => !!r.dueDate);
  const datesValid = installments.every((r) => isFutureOrTodayYMD(r.dueDate));
  const amountsParseable = installments.every((r) => kwdToMilli(r.amount) !== null);

  const canSubmit =
    !saving &&
    installments.length >= MIN_INSTALLMENTS &&
    installments.length <= MAX_INSTALLMENTS &&
    sumMatches &&
    datesFilled &&
    datesValid &&
    amountsParseable;

  if (!open || !invoice) return null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const payload = installments.map((r) => ({
        dueDate: r.dueDate,
        amount: milliToKwdStr(kwdToMilli(r.amount)),
      }));
      const result = await scheduleInvoicePaymentPlan(invoice.id, { installments: payload });
      if (onScheduled) onScheduled(result);
      if (onClose) onClose();
    } catch (err) {
      const msg = err?.message || err?.error?.message || String(err) || t("schedule_ar_modal.toast_error");
      setSubmitError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 640, maxHeight: "calc(100vh - 80px)", background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("schedule_ar_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>{t("schedule_ar_modal.title")}</div>
          </div>
          <button onClick={onClose} aria-label={t("schedule_ar_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {invoice.invoiceNumber} · {invoice.partyName} · <span style={{ fontFamily: "'DM Mono', monospace" }}>{milliToKwdStr(outstandingMilli)} KWD</span>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>
              {t("schedule_ar_modal.installment_count_label")}
            </div>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              style={{ ...inputStyle, appearance: "none", maxWidth: 160 }}
            >
              {Array.from({ length: MAX_INSTALLMENTS - MIN_INSTALLMENTS + 1 }, (_, i) => i + MIN_INSTALLMENTS).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: 8, alignItems: "center", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", padding: "6px 0" }}>
            <div>#</div>
            <div>{t("schedule_ar_modal.due_date_label")}</div>
            <div style={{ textAlign: "end" }}>{t("schedule_ar_modal.amount_label")}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {installments.map((row, idx) => {
              const dateOk = isFutureOrTodayYMD(row.dueDate);
              const amtOk = kwdToMilli(row.amount) !== null;
              return (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: 8, alignItems: "center" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text-tertiary)" }}>{idx + 1}</div>
                  <input
                    type="date"
                    value={row.dueDate}
                    onChange={(e) => updateRow(idx, { dueDate: e.target.value })}
                    style={{ ...inputStyle, colorScheme: "dark", ...(row.dueDate && !dateOk ? { borderColor: "var(--semantic-danger)" } : {}) }}
                    aria-label={t("schedule_ar_modal.due_date_label") + " " + (idx + 1)}
                  />
                  <input
                    value={row.amount}
                    onChange={(e) => updateRow(idx, { amount: e.target.value })}
                    inputMode="decimal"
                    style={{ ...inputStyle, fontFamily: "'DM Mono', monospace", textAlign: "end", ...(row.amount && !amtOk ? { borderColor: "var(--semantic-danger)" } : {}) }}
                    aria-label={t("schedule_ar_modal.amount_label") + " " + (idx + 1)}
                  />
                </div>
              );
            })}
          </div>

          {/* Live sum indicator */}
          <div
            role="status"
            aria-live="polite"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 8,
              background: sumMatches ? "var(--accent-primary-subtle)" : "var(--semantic-warning-subtle)",
              border: sumMatches ? "1px solid var(--accent-primary-border)" : "1px solid rgba(212,168,75,0.35)",
              color: sumMatches ? "var(--accent-primary)" : "var(--semantic-warning)",
              fontSize: 12,
            }}
          >
            {sumMatches ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            <div style={{ fontFamily: "inherit" }}>
              {sumMatches
                ? t("schedule_ar_modal.sum_matches", { sum: milliToKwdStr(sumMilli) })
                : t("schedule_ar_modal.sum_mismatch_warning", {
                    sum: milliToKwdStr(sumMilli),
                    outstanding: milliToKwdStr(outstandingMilli),
                    delta: milliToKwdStr(deltaMilli),
                  })}
            </div>
          </div>
        </div>

        {submitError && (
          <div
            role="alert"
            style={{
              margin: "0 22px 12px",
              padding: "10px 12px",
              background: "var(--semantic-danger-subtle)",
              border: "1px solid var(--semantic-danger)",
              borderRadius: 6,
              color: "var(--semantic-danger)",
              fontSize: 12,
              lineHeight: 1.4,
            }}
          >
            {submitError}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)", alignItems: "center" }}>
          {!canSubmit && !saving && (
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginInlineEnd: "auto" }}>
              {!sumMatches
                ? t("schedule_ar_modal.submit_disabled_sum_mismatch")
                : !datesFilled || !datesValid
                ? t("schedule_ar_modal.submit_disabled_date_missing")
                : t("schedule_ar_modal.submit_disabled_generic")}
            </div>
          )}
          <button onClick={onClose} style={btnSecondary}>{t("schedule_ar_modal.cancel")}</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              background: canSubmit ? "var(--accent-primary)" : "var(--bg-surface-sunken)",
              color: canSubmit ? "#fff" : "var(--text-tertiary)",
              border: "none",
              padding: "9px 18px",
              borderRadius: 6,
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {saving ? <><Spinner size={13} />&nbsp;{t("schedule_ar_modal.saving")}</> : t("schedule_ar_modal.save")}
          </button>
        </div>
      </div>
    </>
  );
}

const btnSecondary = { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" };
