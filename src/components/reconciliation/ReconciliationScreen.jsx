import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, CheckCircle2, AlertCircle, Circle, Lock, FileWarning, Plus, X } from "lucide-react";
import LtrText from "../shared/LtrText";
import {
  getReconciliationDashboard,
  getReconciliationById,
  resolveException,
  createMissingJournalEntry,
  manualMatch,
  completeReconciliation,
} from "../../engine/mockEngine";

const STATUS_META = {
  "completed":    { key: "completed",   color: "#00C48C", icon: CheckCircle2 },
  "in-progress":  { key: "in_progress", color: "#F5A524", icon: Circle },
  "not-started":  { key: "not_started", color: "#5B6570", icon: Circle },
  "locked":       { key: "locked",      color: "#5B6570", icon: Lock },
};

const EXC_TYPE_KEY = {
  "unidentified": "type_unidentified",
  "amount-mismatch": "type_amount_mismatch",
  "missing-ledger-entry": "type_missing_ledger",
  "date-mismatch": "type_date_mismatch",
};

function fmtKWD(n) {
  if (n == null) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ReconciliationScreen({ role = "CFO" }) {
  const { t } = useTranslation("reconciliation");
  const [view, setView] = useState("dashboard"); // dashboard | detail
  const [dashboard, setDashboard] = useState(null);
  const [activeRecId, setActiveRecId] = useState(null);
  const [recDetail, setRecDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshDashboard = useCallback(() => {
    getReconciliationDashboard().then(setDashboard);
  }, []);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    if (view === "detail" && activeRecId) {
      setLoading(true);
      getReconciliationById(activeRecId).then((r) => {
        setRecDetail(r);
        setLoading(false);
      });
    }
  }, [view, activeRecId]);

  const openDetail = (recId) => {
    setActiveRecId(recId);
    setView("detail");
  };
  const backToDashboard = () => {
    setView("dashboard");
    setActiveRecId(null);
    setRecDetail(null);
    refreshDashboard();
  };

  const reloadRec = async () => {
    if (!activeRecId) return;
    const r = await getReconciliationById(activeRecId);
    setRecDetail(r);
  };

  if (view === "detail") {
    return (
      <ReconciliationDetail
        rec={recDetail}
        loading={loading}
        role={role}
        onBack={backToDashboard}
        onReload={reloadRec}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "#E6EDF3", letterSpacing: "-0.3px", lineHeight: 1 }}>
          {t("title")}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "#5B6570", marginTop: 6 }}>
          {t("period_label")}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
        {!dashboard ? (
          <div style={{ color: "#5B6570", fontSize: 13 }}>{t("loading")}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
            {dashboard.map((row) => (
              <ReconciliationAccountCard key={row.accountId} row={row} onOpen={openDetail} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReconciliationAccountCard({ row, onOpen }) {
  const { t } = useTranslation("reconciliation");
  const meta = STATUS_META[row.status] || STATUS_META["not-started"];
  const Icon = meta.icon;
  const pct = row.totalCount > 0 ? Math.round((row.matchedCount / row.totalCount) * 100) : 0;

  return (
    <button
      onClick={() => row.currentReconciliationId && onOpen(row.currentReconciliationId)}
      disabled={!row.currentReconciliationId}
      style={{
        textAlign: "start",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 10,
        padding: "16px 18px",
        cursor: row.currentReconciliationId ? "pointer" : "default",
        fontFamily: "inherit",
        color: "#E6EDF3",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        if (row.currentReconciliationId) {
          e.currentTarget.style.borderColor = "rgba(0,196,140,0.35)";
          e.currentTarget.style.background = "rgba(0,196,140,0.04)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "#5B6570" }}>
            <LtrText>{row.bankName} · {row.accountNumberMasked}</LtrText>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#E6EDF3", marginTop: 4 }}>
            {row.accountName}
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: meta.color,
            background: `${meta.color}1A`,
            border: `1px solid ${meta.color}40`,
            padding: "4px 8px",
            borderRadius: 4,
          }}
        >
          <Icon size={10} />
          {t(`status.${meta.key}`)}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            height: 6,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: meta.color,
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <div style={{ color: "#8B98A5" }}>
          <span style={{ color: "#E6EDF3", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>
            {row.matchedCount}/{row.totalCount}
          </span>{" "}
          {t("card.matched")}
        </div>
        {row.exceptionCount > 0 ? (
          <div style={{ color: "#F5A524", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <AlertCircle size={11} />
            {row.exceptionCount === 1 ? t("card.exception_one", { count: 1 }) : t("card.exception_other", { count: row.exceptionCount })}
          </div>
        ) : row.status === "completed" ? (
          <div style={{ color: "#00C48C", fontWeight: 600 }}>{t("card.clean")}</div>
        ) : row.status === "not-started" ? (
          <div style={{ color: "#5B6570" }}>{t("card.not_started")}</div>
        ) : null}
      </div>
    </button>
  );
}

function ReconciliationDetail({ rec, loading, role, onBack, onReload }) {
  const { t } = useTranslation("reconciliation");
  const [jeComposerFor, setJeComposerFor] = useState(null);

  if (loading || !rec) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#5B6570" }}>
        {t("loading_detail")}
      </div>
    );
  }

  const meta = STATUS_META[rec.status] || STATUS_META["in-progress"];
  const diff = rec.reconciliationDifference;
  const isClean = diff === 0 && rec.exceptions.every((e) => e.resolved);
  const author = role === "CFO" ? "cfo" : role === "Owner" ? "owner" : "sara";

  const handleResolve = async (excId, resolution) => {
    await resolveException(rec.id, excId, resolution, author);
    onReload();
  };

  const handleCreateJE = async (excBankItemId, debit, credit) => {
    const bi = rec.unmatchedBankItems.find((b) => b.id === excBankItemId);
    if (!bi) return;
    await createMissingJournalEntry(rec.id, excBankItemId, debit, credit, bi.amount, author);
    setJeComposerFor(null);
    onReload();
  };

  const handleComplete = async () => {
    await completeReconciliation(rec.id, author);
    onReload();
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 28px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: "none",
            color: "#8B98A5",
            fontSize: 12,
            cursor: "pointer",
            padding: "4px 0",
            fontFamily: "inherit",
            marginBottom: 8,
          }}
        >
          <span className="rtl-flip" style={{ display: "inline-flex" }}><ChevronLeft size={14} /></span> {t("detail.back")}
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "#E6EDF3", letterSpacing: "-0.3px", lineHeight: 1 }}>
              <LtrText>{rec.id}</LtrText> · {rec.period.label}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "#5B6570", marginTop: 6 }}>
              {t("detail.sub", { accountId: rec.accountId, matched: rec.matchedCount, total: rec.totalBankItems })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: meta.color,
                background: `${meta.color}1A`,
                border: `1px solid ${meta.color}40`,
                padding: "5px 10px",
                borderRadius: 4,
              }}
            >
              {t(`status.${meta.key}`)}
            </div>
            {rec.status === "in-progress" && (
              <button
                onClick={handleComplete}
                disabled={!isClean}
                style={{
                  background: isClean ? "#00C48C" : "rgba(255,255,255,0.05)",
                  color: isClean ? "#fff" : "#5B6570",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: isClean ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                }}
              >
                {t("detail.complete")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: "rgba(255,255,255,0.06)",
          margin: "14px 28px 0",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <SummaryCell label={t("summary.opening_balance")} value={fmtKWD(rec.openingBalance)} />
        <SummaryCell label={t("summary.closing_bank")} value={fmtKWD(rec.closingBalance)} />
        <SummaryCell label={t("summary.closing_ledger")} value={fmtKWD(rec.closingLedgerBalance)} />
        <SummaryCell
          label={t("summary.difference")}
          value={fmtKWD(diff)}
          highlight={diff === 0 ? "#00C48C" : "#F5A524"}
        />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 28px 24px" }}>
        {/* Side-by-side columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
          <StatementColumn
            title={t("columns.bank_statement")}
            sub={t("columns.bank_sub", { total: rec.totalBankItems, unmatched: rec.unmatchedBankItems.length })}
            matchedCount={rec.matchedCount}
            unmatched={rec.unmatchedBankItems}
            exceptions={rec.exceptions}
            isBank
          />
          <StatementColumn
            title={t("columns.general_ledger")}
            sub={t("columns.ledger_sub", { total: rec.totalLedgerItems, unmatched: rec.unmatchedLedgerItems.length })}
            matchedCount={rec.matchedCount}
            unmatched={rec.unmatchedLedgerItems}
            exceptions={rec.exceptions}
            isBank={false}
          />
        </div>

        {/* Exceptions */}
        {rec.exceptions.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "#F5A524",
                marginBottom: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FileWarning size={12} />
              {t("exceptions.header", { open: rec.exceptions.filter((e) => !e.resolved).length })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rec.exceptions.map((exc) => (
                <ExceptionRow
                  key={exc.id}
                  exc={exc}
                  onResolve={handleResolve}
                  onOpenJE={() => setJeComposerFor(exc)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {jeComposerFor && (
        <InlineJEComposer
          exception={jeComposerFor}
          bankItem={rec.unmatchedBankItems.find((b) => b.id === jeComposerFor.bankItemId)}
          onCancel={() => setJeComposerFor(null)}
          onConfirm={handleCreateJE}
        />
      )}
    </div>
  );
}

function SummaryCell({ label, value, highlight }) {
  return (
    <div style={{ background: "#0C0E12", padding: "12px 16px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "#5B6570", marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 16,
          color: highlight || "#E6EDF3",
          fontWeight: 600,
          letterSpacing: "-0.5px",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatementColumn({ title, sub, matchedCount, unmatched, exceptions, isBank }) {
  const { t } = useTranslation("reconciliation");
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "#8B98A5" }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: "#5B6570", marginTop: 3 }}>
          {sub}
        </div>
      </div>
      <div style={{ padding: "8px 0" }}>
        {/* Collapsed matched header */}
        <div
          style={{
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#5B6570",
            fontSize: 11,
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <CheckCircle2 size={12} color="#00C48C" />
          <span style={{ color: "#8B98A5" }}>
            {t("columns.matched_collapsed", { count: matchedCount })}
          </span>
          <span style={{ color: "#5B6570" }}>{t("columns.collapsed")}</span>
        </div>
        {unmatched.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", color: "#5B6570", fontSize: 12 }}>
            {t("columns.no_unmatched")}
          </div>
        ) : (
          unmatched.map((item) => {
            const exc = exceptions.find((e) => (isBank ? e.bankItemId : e.ledgerEntryId) === item.id);
            return <StatementRow key={item.id} item={item} exception={exc} isBank={isBank} />;
          })
        )}
      </div>
    </div>
  );
}

function StatementRow({ item, exception, isBank }) {
  const sev = exception
    ? exception.type === "amount-mismatch" || exception.type === "unidentified"
      ? "#F5A524"
      : exception.type === "missing-ledger-entry"
      ? "#FF5A5F"
      : "#3B82F6"
    : "#5B6570";

  return (
    <div
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: sev,
          marginTop: 7,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#E6EDF3", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.description}
          </div>
          <div
            style={{
              fontSize: 12,
              fontFamily: "'DM Mono', monospace",
              color: item.amount < 0 ? "#FF5A5F" : "#E6EDF3",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {fmtKWD(item.amount)}
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#5B6570", marginTop: 3, display: "flex", gap: 8 }}>
          <span>{fmtDate(item.date)}</span>
          <span>·</span>
          <span style={{ fontFamily: "'DM Mono', monospace" }}>
            <LtrText>{isBank ? item.reference : item.journalEntryId}</LtrText>
          </span>
        </div>
      </div>
    </div>
  );
}

function ExceptionRow({ exc, onResolve, onOpenJE }) {
  const { t } = useTranslation("reconciliation");
  const typeColors = {
    "unidentified":           "#F5A524",
    "amount-mismatch":        "#F5A524",
    "missing-ledger-entry":   "#FF5A5F",
    "date-mismatch":          "#3B82F6",
  };
  const color = typeColors[exc.type] || "#8B98A5";

  return (
    <div
      style={{
        padding: "12px 16px",
        background: exc.resolved ? "rgba(0,196,140,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${exc.resolved ? "rgba(0,196,140,0.2)" : "rgba(255,255,255,0.10)"}`,
        borderInlineStart: `3px solid ${exc.resolved ? "#00C48C" : color}`,
        borderRadius: 6,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color,
              background: `${color}1A`,
              padding: "2px 6px",
              borderRadius: 3,
            }}
          >
            {t(`exceptions.${EXC_TYPE_KEY[exc.type] || "type_unidentified"}`)}
          </span>
          <span style={{ fontSize: 10, color: "#5B6570", fontFamily: "'DM Mono', monospace" }}><LtrText>{exc.id}</LtrText></span>
          {exc.resolved && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "#00C48C" }}>
              {t("exceptions.resolved")}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#E6EDF3", lineHeight: 1.5 }}>
          {exc.description}
        </div>
      </div>
      {!exc.resolved && (
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {exc.suggestedAction === "create-je" && (
            <button
              onClick={onOpenJE}
              style={{
                background: "#00C48C",
                color: "#fff",
                border: "none",
                padding: "6px 12px",
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Plus size={11} /> {t("exceptions.create_je")}
            </button>
          )}
          {exc.suggestedAction === "accept" && (
            <button
              onClick={() => onResolve(exc.id, t("exceptions.resolution_accepted"))}
              style={{
                background: "#00C48C",
                color: "#fff",
                border: "none",
                padding: "6px 12px",
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t("exceptions.accept_match")}
            </button>
          )}
          {exc.suggestedAction === "investigate" && (
            <button
              onClick={() => onResolve(exc.id, t("exceptions.resolution_investigated"))}
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "#E6EDF3",
                border: "1px solid rgba(255,255,255,0.15)",
                padding: "6px 12px",
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t("exceptions.mark_resolved")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InlineJEComposer({ exception, bankItem, onCancel, onConfirm }) {
  const { t } = useTranslation("reconciliation");
  const [debit, setDebit] = useState("6800 — Bank Charges");
  const [credit, setCredit] = useState("1010 — KIB Operating");

  if (!bankItem) return null;

  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 480,
          background: "#0C0E12",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          zIndex: 301,
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "#5B6570" }}>
              {t("je_composer.label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "#E6EDF3", marginTop: 4 }}>
              {t("je_composer.title")}
            </div>
          </div>
          <button onClick={onCancel} style={{ background: "transparent", border: "none", color: "#5B6570", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 12, color: "#8B98A5", marginBottom: 14, lineHeight: 1.5 }}>
            {bankItem.description} · {fmtKWD(bankItem.amount)} · {fmtDate(bankItem.date)}
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "#5B6570", marginBottom: 5 }}>
              {t("je_composer.debit_account")}
            </div>
            <input
              value={debit}
              onChange={(e) => setDebit(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 6,
                padding: "9px 12px",
                color: "#E6EDF3",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "#5B6570", marginBottom: 5 }}>
              {t("je_composer.credit_account")}
            </div>
            <input
              value={credit}
              onChange={(e) => setCredit(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 6,
                padding: "9px 12px",
                color: "#E6EDF3",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            padding: "14px 22px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              background: "transparent",
              color: "#8B98A5",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "9px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            {t("je_composer.cancel")}
          </button>
          <button
            onClick={() => onConfirm(exception.bankItemId, debit, credit)}
            style={{
              background: "#00C48C",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {t("je_composer.confirm")}
          </button>
        </div>
      </div>
    </>
  );
}
