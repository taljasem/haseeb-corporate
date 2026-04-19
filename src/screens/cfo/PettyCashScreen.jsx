import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Wallet,
  Plus,
  AlertTriangle,
  RefreshCw,
  Scale,
  ArrowDownCircle,
  ArrowUpCircle,
  Settings2,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import PettyCashBoxModal from "../../components/petty-cash/PettyCashBoxModal";
import PettyCashTxModal from "../../components/petty-cash/PettyCashTxModal";
import {
  listPettyCashBoxes,
  deactivatePettyCashBox,
  listPettyCashTransactions,
  reconcilePettyCashBox,
  getAccountsFlat,
} from "../../engine";

const TX_TYPE_COLORS = {
  EXPENSE: {
    color: "var(--semantic-danger)",
    bg: "var(--semantic-danger-subtle)",
  },
  REPLENISH: {
    color: "var(--accent-primary)",
    bg: "var(--accent-primary-subtle)",
  },
  ADJUSTMENT: {
    color: "var(--semantic-warning)",
    bg: "var(--semantic-warning-subtle)",
  },
};

function Toast({ text, onClear }) {
  useEffect(() => {
    if (!text) return;
    const id = setTimeout(onClear, 3000);
    return () => clearTimeout(id);
  }, [text, onClear]);
  if (!text) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        insetInlineEnd: 24,
        background: "var(--accent-primary)",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        zIndex: 200,
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      }}
    >
      {text}
    </div>
  );
}

export default function PettyCashScreen({ role = "CFO" }) {
  const { t } = useTranslation("petty-cash");
  const { t: tc } = useTranslation("common");
  const [boxes, setBoxes] = useState(null);
  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [reconData, setReconData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [showInactive, setShowInactive] = useState(false);
  const [boxModalOpen, setBoxModalOpen] = useState(false);
  const [txModalState, setTxModalState] = useState({
    open: false,
    defaultType: "EXPENSE",
  });
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reloadBoxes = async () => {
    setLoadError(null);
    try {
      const list = await listPettyCashBoxes();
      setBoxes(list || []);
      // Keep current selection if still present; otherwise first active.
      setSelectedBoxId((prev) => {
        if (prev && list.some((b) => b.id === prev)) return prev;
        const firstActive = (list || []).find((b) => b.isActive);
        return firstActive ? firstActive.id : list?.[0]?.id || null;
      });
    } catch (err) {
      setBoxes([]);
      setLoadError(err?.message || t("error_load_boxes"));
    }
  };

  const reloadBoxDetail = async (boxId) => {
    if (!boxId) {
      setTransactions([]);
      setReconData(null);
      return;
    }
    try {
      const [txs, recon] = await Promise.all([
        listPettyCashTransactions({ boxId }).catch(() => []),
        reconcilePettyCashBox(boxId).catch(() => null),
      ]);
      setTransactions(txs || []);
      setReconData(recon);
    } catch (err) {
      setTransactions([]);
      setReconData(null);
      setLoadError(err?.message || t("error_load_detail"));
    }
  };

  useEffect(() => {
    reloadBoxes();
    getAccountsFlat()
      .then((arr) =>
        setAccounts(
          (arr || []).map((a) => ({
            id: a.raw?.id || a.id || a.code,
            code: a.code,
            nameEn: a.name || a.nameEn,
          })),
        ),
      )
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    reloadBoxDetail(selectedBoxId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBoxId]);

  const handleDeactivate = async (box) => {
    try {
      await deactivatePettyCashBox(box.id);
      setToast(t("deactivated_toast"));
      reloadBoxes();
    } catch (err) {
      setToast(err?.message || t("error_deactivate"));
    }
  };

  const visibleBoxes = (boxes || []).filter(
    (b) => showInactive || b.isActive,
  );
  const selectedBox = boxes?.find((b) => b.id === selectedBoxId) || null;
  const reconBalanced =
    reconData && Math.abs(Number(reconData.countedVsImprestKwd)) < 0.001;
  const reconOverage =
    reconData && Number(reconData.countedVsImprestKwd) > 0.001;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 18,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--accent-primary)",
              }}
            >
              {t("view_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 28,
                color: "var(--text-primary)",
                letterSpacing: "-0.3px",
                marginTop: 2,
                lineHeight: 1,
              }}
            >
              {t("title")}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                marginTop: 6,
              }}
            >
              {t("subtitle")}
            </div>
          </div>
          <button
            onClick={() => setBoxModalOpen(true)}
            style={btnPrimary(false)}
          >
            <Plus
              size={13}
              style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
            />
            {t("add_box")}
          </button>
        </div>

        <Toast text={toast} onClear={() => setToast(null)} />

        {loadError && (
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
              marginBottom: 12,
            }}
          >
            <AlertTriangle size={14} /> {loadError}
          </div>
        )}

        {boxes === null && (
          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
        )}

        {boxes && boxes.length === 0 && !loadError && (
          <EmptyState
            icon={Wallet}
            title={t("empty_title")}
            description={t("empty_description")}
          />
        )}

        {boxes && boxes.length > 0 && (
          <>
            {/* Box selector row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              {visibleBoxes.map((b) => {
                const on = selectedBoxId === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBoxId(b.id)}
                    style={{
                      ...btnMini,
                      background: on
                        ? "var(--accent-primary-subtle)"
                        : b.isActive
                        ? "transparent"
                        : "var(--bg-surface-sunken)",
                      borderColor: on
                        ? "rgba(0,196,140,0.30)"
                        : "var(--border-strong)",
                      color: on
                        ? "var(--accent-primary)"
                        : b.isActive
                        ? "var(--text-secondary)"
                        : "var(--text-tertiary)",
                      opacity: b.isActive ? 1 : 0.7,
                    }}
                  >
                    {b.label}
                    {!b.isActive && (
                      <span
                        style={{
                          marginInlineStart: 8,
                          fontSize: 9,
                          color: "var(--text-tertiary)",
                        }}
                      >
                        ({t("inactive_marker")})
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={() => setShowInactive((v) => !v)}
                style={{
                  ...btnMini,
                  marginInlineStart: 8,
                  color: showInactive
                    ? "var(--accent-primary)"
                    : "var(--text-tertiary)",
                }}
              >
                {showInactive
                  ? t("hide_inactive")
                  : t("show_inactive")}
              </button>
            </div>

            {/* Selected box detail */}
            {selectedBox && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Reconciliation strip */}
                <div
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 10,
                    padding: "18px 20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "'Bebas Neue', sans-serif",
                          fontSize: 20,
                          color: "var(--text-primary)",
                          letterSpacing: "-0.2px",
                        }}
                      >
                        {selectedBox.label}
                      </div>
                      {selectedBox.notes && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-tertiary)",
                            marginTop: 4,
                            fontStyle: "italic",
                          }}
                        >
                          {selectedBox.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() =>
                          setTxModalState({ open: true, defaultType: "EXPENSE" })
                        }
                        style={btnMini}
                        disabled={!selectedBox.isActive}
                      >
                        <ArrowDownCircle
                          size={11}
                          style={{
                            verticalAlign: "middle",
                            marginInlineEnd: 4,
                          }}
                        />
                        {t("action_record_expense")}
                      </button>
                      <button
                        onClick={() =>
                          setTxModalState({
                            open: true,
                            defaultType: "REPLENISH",
                          })
                        }
                        style={btnMini}
                        disabled={!selectedBox.isActive}
                      >
                        <ArrowUpCircle
                          size={11}
                          style={{
                            verticalAlign: "middle",
                            marginInlineEnd: 4,
                          }}
                        />
                        {t("action_replenish")}
                      </button>
                      <button
                        onClick={() =>
                          setTxModalState({
                            open: true,
                            defaultType: "ADJUSTMENT",
                          })
                        }
                        style={btnMini}
                        disabled={!selectedBox.isActive}
                      >
                        <Settings2
                          size={11}
                          style={{
                            verticalAlign: "middle",
                            marginInlineEnd: 4,
                          }}
                        />
                        {t("action_adjustment")}
                      </button>
                      <button
                        onClick={() => reloadBoxDetail(selectedBoxId)}
                        style={btnMini}
                        aria-label={t("refresh")}
                      >
                        <RefreshCw size={11} />
                      </button>
                      {selectedBox.isActive && (
                        <button
                          onClick={() => handleDeactivate(selectedBox)}
                          style={{
                            ...btnMini,
                            color: "var(--semantic-danger)",
                            borderColor: "rgba(208,90,90,0.30)",
                          }}
                        >
                          {t("action_deactivate")}
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <SummaryCell
                      label={t("summary_imprest")}
                      value={`${selectedBox.imprestAmountKwd} KWD`}
                      tone="default"
                    />
                    <SummaryCell
                      label={t("summary_current")}
                      value={`${selectedBox.currentBalanceKwd} KWD`}
                      tone="default"
                    />
                    {reconData && (
                      <>
                        <SummaryCell
                          label={t("summary_receipts_held")}
                          value={`${reconData.receiptsHeldKwd} KWD`}
                          tone="default"
                        />
                        <SummaryCell
                          label={t("summary_shortfall")}
                          value={`${reconData.shortfallKwd} KWD`}
                          tone={
                            Number(reconData.shortfallKwd) > 0.001
                              ? "warning"
                              : "default"
                          }
                        />
                      </>
                    )}
                  </div>

                  {reconData && (
                    <div
                      role="status"
                      style={{
                        marginTop: 14,
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid",
                        borderColor: reconBalanced
                          ? "rgba(0,196,140,0.30)"
                          : reconOverage
                          ? "rgba(212,168,75,0.30)"
                          : "var(--semantic-danger)",
                        background: reconBalanced
                          ? "var(--accent-primary-subtle)"
                          : reconOverage
                          ? "var(--semantic-warning-subtle)"
                          : "var(--semantic-danger-subtle)",
                        color: reconBalanced
                          ? "var(--accent-primary)"
                          : reconOverage
                          ? "var(--semantic-warning)"
                          : "var(--semantic-danger)",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Scale size={14} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>
                          {reconBalanced
                            ? t("recon_in_balance")
                            : reconOverage
                            ? t("recon_overage")
                            : t("recon_shortage")}
                        </div>
                        <div style={{ marginTop: 3, color: "var(--text-secondary)" }}>
                          <LtrText>
                            <span style={{ fontFamily: "'DM Mono', monospace" }}>
                              {t("recon_detail", {
                                counted: reconData.countedVsImprestKwd,
                                recommended: reconData.replenishRecommendedKwd,
                              })}
                            </span>
                          </LtrText>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Transactions table */}
                <div
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "14px 20px",
                      borderBottom: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: 18,
                        color: "var(--text-primary)",
                      }}
                    >
                      {t("transactions_heading")}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "var(--text-tertiary)" }}
                    >
                      {transactions
                        ? t("tx_count", { count: transactions.length })
                        : "…"}
                    </div>
                  </div>

                  {transactions && transactions.length === 0 && (
                    <div
                      style={{
                        padding: "28px 20px",
                        textAlign: "center",
                        fontSize: 12,
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {t("no_transactions")}
                    </div>
                  )}

                  {transactions && transactions.length > 0 && (
                    <div>
                      {transactions.map((tx, idx) => {
                        const colors =
                          TX_TYPE_COLORS[tx.type] ||
                          TX_TYPE_COLORS.ADJUSTMENT;
                        return (
                          <div
                            key={tx.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              padding: "12px 20px",
                              borderBottom:
                                idx === transactions.length - 1
                                  ? "none"
                                  : "1px solid var(--border-subtle)",
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    letterSpacing: "0.1em",
                                    padding: "2px 8px",
                                    borderRadius: 10,
                                    background: colors.bg,
                                    color: colors.color,
                                  }}
                                >
                                  {t(`type_${tx.type}`)}
                                </span>
                                <span
                                  style={{
                                    fontSize: 13,
                                    color: "var(--text-primary)",
                                  }}
                                >
                                  {tx.description}
                                </span>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 14,
                                  marginTop: 4,
                                  fontSize: 11,
                                  color: "var(--text-tertiary)",
                                }}
                              >
                                <LtrText>
                                  <span
                                    style={{
                                      fontFamily: "'DM Mono', monospace",
                                    }}
                                  >
                                    {tx.txDate}
                                  </span>
                                </LtrText>
                                {tx.receiptRef && (
                                  <LtrText>
                                    <span
                                      style={{
                                        fontFamily: "'DM Mono', monospace",
                                      }}
                                    >
                                      {t("receipt_prefix")} {tx.receiptRef}
                                    </span>
                                  </LtrText>
                                )}
                              </div>
                            </div>
                            <div
                              style={{
                                fontFamily: "'DM Mono', monospace",
                                fontSize: 14,
                                fontWeight: 700,
                                color: colors.color,
                              }}
                            >
                              <LtrText>
                                {tx.type === "EXPENSE" ? "−" : "+"}
                                {tx.amountKwd} KWD
                              </LtrText>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <PettyCashBoxModal
          open={boxModalOpen}
          onClose={() => setBoxModalOpen(false)}
          onSaved={() => {
            reloadBoxes();
            setToast(t("box_created_toast"));
          }}
        />

        <PettyCashTxModal
          open={txModalState.open}
          box={selectedBox}
          defaultType={txModalState.defaultType}
          accounts={accounts}
          onClose={() =>
            setTxModalState({ open: false, defaultType: "EXPENSE" })
          }
          onSaved={() => {
            reloadBoxes();
            reloadBoxDetail(selectedBoxId);
            setToast(t("tx_recorded_toast"));
          }}
        />
      </div>
    </div>
  );
}

function SummaryCell({ label, value, tone }) {
  const color =
    tone === "warning"
      ? "var(--semantic-warning)"
      : "var(--text-primary)";
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 16,
          fontWeight: 700,
          color,
        }}
      >
        <LtrText>{value}</LtrText>
      </div>
    </div>
  );
}

const btnMini = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)",
  padding: "6px 12px",
  borderRadius: 5,
  cursor: "pointer",
  fontSize: 11,
  fontFamily: "inherit",
  fontWeight: 600,
};
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
