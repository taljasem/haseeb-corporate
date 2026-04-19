import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardList,
  Plus,
  AlertTriangle,
  Package,
  Scale,
  ArrowLeft,
  XCircle,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import Spinner from "../../components/shared/Spinner";
import PurchaseOrderCreateModal from "../../components/purchase-orders/PurchaseOrderCreateModal";
import GoodsReceiptCreateModal from "../../components/purchase-orders/GoodsReceiptCreateModal";
import ThreeWayMatchDrawer from "../../components/purchase-orders/ThreeWayMatchDrawer";
import {
  listPurchaseOrders,
  getPurchaseOrder,
  transitionPurchaseOrderStatus,
  listVendorsForRelatedParty,
} from "../../engine";

const STATUS_FILTERS = ["ALL", "DRAFT", "OPEN", "PARTIALLY_RECEIVED", "CLOSED", "CANCELLED"];
const STATUS_TRANSITIONS = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["PARTIALLY_RECEIVED", "CLOSED", "CANCELLED"],
  PARTIALLY_RECEIVED: ["CLOSED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
};

const STATUS_COLORS = {
  DRAFT: { color: "var(--text-secondary)", bg: "var(--bg-surface)" },
  OPEN: { color: "var(--accent-primary)", bg: "var(--accent-primary-subtle)" },
  PARTIALLY_RECEIVED: { color: "var(--semantic-warning)", bg: "var(--semantic-warning-subtle)" },
  CLOSED: { color: "var(--text-secondary)", bg: "var(--bg-surface)" },
  CANCELLED: { color: "var(--text-tertiary)", bg: "var(--bg-surface-sunken)" },
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

export default function PurchaseOrdersScreen({ role = "CFO" }) {
  const { t } = useTranslation("purchase-orders");
  const [rows, setRows] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [grOpen, setGrOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [acting, setActing] = useState(null);

  const reloadList = async () => {
    setLoadError(null);
    try {
      const filters = statusFilter === "ALL" ? {} : { status: statusFilter };
      const list = await listPurchaseOrders(filters);
      setRows(list || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t("error_load"));
    }
  };

  const reloadDetail = async (id) => {
    if (!id) {
      setSelected(null);
      return;
    }
    try {
      const detail = await getPurchaseOrder(id);
      setSelected(detail);
    } catch (err) {
      setToast(err?.message || t("error_load_detail"));
    }
  };

  useEffect(() => {
    reloadList();
    listVendorsForRelatedParty()
      .then((arr) => setVendors(arr || []))
      .catch(() => setVendors([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    reloadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleTransition = async (newStatus) => {
    if (!selected) return;
    setActing(`transition-${newStatus}`);
    try {
      await transitionPurchaseOrderStatus(selected.id, newStatus);
      setToast(t("toast.transitioned", { status: t(`status_${newStatus}`) }));
      await reloadDetail(selected.id);
      reloadList();
    } catch (err) {
      setToast(err?.message || t("error_transition"));
    } finally {
      setActing(null);
    }
  };

  const vendorName = (id) => {
    const v = vendors.find((x) => x.id === id);
    return v ? v.name || v.nameEn || id : id;
  };

  if (selectedId && selected) {
    return (
      <PODetailView
        po={selected}
        vendorLabel={vendorName(selected.vendorId)}
        onBack={() => {
          setSelectedId(null);
          setSelected(null);
        }}
        onAddGR={() => setGrOpen(true)}
        onMatch={() => setMatchOpen(true)}
        onTransition={handleTransition}
        acting={acting}
        toast={toast}
        setToast={setToast}
        grOpen={grOpen}
        closeGR={() => setGrOpen(false)}
        onGRSaved={async () => {
          await reloadDetail(selected.id);
          reloadList();
          setToast(t("toast.gr_created"));
        }}
        matchOpen={matchOpen}
        closeMatch={() => setMatchOpen(false)}
      />
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
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
          <button onClick={() => setCreateOpen(true)} style={btnPrimary(false)}>
            <Plus size={13} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
            {t("new_po")}
          </button>
        </div>

        <Toast text={toast} onClear={() => setToast(null)} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          {STATUS_FILTERS.map((s) => {
            const on = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  ...btnMini,
                  background: on ? "var(--accent-primary-subtle)" : "transparent",
                  borderColor: on ? "var(--accent-primary-border)" : "var(--border-strong)",
                  color: on ? "var(--accent-primary)" : "var(--text-secondary)",
                }}
              >
                {t(`filter_${s}`)}
              </button>
            );
          })}
        </div>

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

        {rows === null && (
          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
        )}

        {rows && rows.length === 0 && !loadError && (
          <EmptyState
            icon={ClipboardList}
            title={t("empty_title")}
            description={t("empty_description")}
          />
        )}

        {rows && rows.length > 0 && (
          <div
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {rows.map((row, idx) => {
              const colors = STATUS_COLORS[row.status] || STATUS_COLORS.DRAFT;
              return (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 14,
                    padding: "14px 18px",
                    borderBottom:
                      idx === rows.length - 1 ? "none" : "1px solid var(--border-subtle)",
                    background: "transparent",
                    border: "none",
                    borderBottomStyle: "solid",
                    width: "100%",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "start",
                    color: "var(--text-primary)",
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
                      <LtrText>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: "'DM Mono', monospace",
                            color: "var(--text-primary)",
                          }}
                        >
                          {row.poNumber}
                        </span>
                      </LtrText>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: colors.bg,
                          color: colors.color,
                          border: "1px solid",
                        }}
                      >
                        {t(`status_${row.status}`)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginTop: 4,
                      }}
                    >
                      {vendorName(row.vendorId)}
                    </div>
                    <LtrText>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          marginTop: 2,
                          fontFamily: "'DM Mono', monospace",
                        }}
                      >
                        {String(row.orderDate).slice(0, 10)}
                      </div>
                    </LtrText>
                  </div>
                  <LtrText>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.totalAmountKwd} KWD
                    </div>
                  </LtrText>
                </button>
              );
            })}
          </div>
        )}

        <PurchaseOrderCreateModal
          open={createOpen}
          vendors={vendors}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            reloadList();
            setToast(t("toast.created"));
          }}
        />
      </div>
    </div>
  );
}

function PODetailView({
  po,
  vendorLabel,
  onBack,
  onAddGR,
  onMatch,
  onTransition,
  acting,
  toast,
  setToast,
  grOpen,
  closeGR,
  onGRSaved,
  matchOpen,
  closeMatch,
}) {
  const { t } = useTranslation("purchase-orders");
  const colors = STATUS_COLORS[po.status] || STATUS_COLORS.DRAFT;
  const transitions = STATUS_TRANSITIONS[po.status] || [];
  const isTerminal = po.status === "CLOSED" || po.status === "CANCELLED";
  const isDraft = po.status === "DRAFT";
  const canReceive = po.status === "OPEN" || po.status === "PARTIALLY_RECEIVED";
  const canMatch = !isDraft;

  const receivedByLine = new Map();
  for (const g of po.receipts || []) {
    for (const rl of g.lines || []) {
      receivedByLine.set(
        rl.purchaseOrderLineId,
        (receivedByLine.get(rl.purchaseOrderLineId) || 0) + Number(rl.quantityReceived),
      );
    }
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <Toast text={toast} onClear={() => setToast(null)} />

        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12,
            padding: "0 0 14px 0",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ArrowLeft size={12} /> {t("back_to_list")}
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t("detail.label")}
            </div>
            <LtrText>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 22,
                  color: "var(--text-primary)",
                  marginTop: 2,
                }}
              >
                {po.poNumber}
              </div>
            </LtrText>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-primary)",
                marginTop: 4,
                fontWeight: 600,
              }}
            >
              {vendorLabel}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 6,
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
                  border: "1px solid",
                }}
              >
                {t(`status_${po.status}`)}
              </span>
              <LtrText>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {t("detail.order_date")}: {String(po.orderDate).slice(0, 10)}
                </span>
              </LtrText>
              {po.expectedDeliveryDate && (
                <LtrText>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {t("detail.expected_delivery")}: {String(po.expectedDeliveryDate).slice(0, 10)}
                  </span>
                </LtrText>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canReceive && (
              <button onClick={onAddGR} disabled={acting != null} style={btnMini}>
                <Package size={11} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
                {t("detail.action_add_gr")}
              </button>
            )}
            {canMatch && (
              <button onClick={onMatch} disabled={acting != null} style={btnPrimary(false)}>
                <Scale size={13} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
                {t("detail.action_match")}
              </button>
            )}
            {transitions.map((s) => (
              <button
                key={s}
                onClick={() => onTransition(s)}
                disabled={acting != null}
                style={{
                  ...btnMini,
                  color:
                    s === "CANCELLED"
                      ? "var(--semantic-danger)"
                      : "var(--text-secondary)",
                  borderColor:
                    s === "CANCELLED"
                      ? "var(--semantic-danger-border)"
                      : "var(--border-strong)",
                }}
              >
                {acting === `transition-${s}` ? (
                  <Spinner size={11} />
                ) : s === "CANCELLED" ? (
                  <>
                    <XCircle size={11} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
                    {t(`detail.action_transition_${s}`)}
                  </>
                ) : (
                  t(`detail.action_transition_${s}`)
                )}
              </button>
            ))}
          </div>
        </div>

        {po.notes && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              marginBottom: 14,
              padding: "10px 12px",
              background: "var(--bg-surface-sunken)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              fontStyle: "italic",
            }}
          >
            {po.notes}
          </div>
        )}

        {/* Lines */}
        <div style={{ marginTop: 4 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: "var(--text-tertiary)",
              marginBottom: 8,
            }}
          >
            {t("detail.lines_heading", { count: (po.lines || []).length })}
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
                gridTemplateColumns: "1.8fr 80px 110px 100px 100px 100px",
                gap: 8,
                padding: "10px 14px",
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
              <div style={{ textAlign: "end" }}>{t("table.unit_price")}</div>
              <div style={{ textAlign: "end" }}>{t("table.line_total")}</div>
              <div style={{ textAlign: "end" }}>{t("table.received")}</div>
              <div style={{ textAlign: "end" }}>{t("table.remaining")}</div>
            </div>
            {(po.lines || []).map((l, idx) => {
              const rcv = receivedByLine.get(l.id) || 0;
              const remaining = Math.max(0, Number(l.quantity) - rcv);
              const tone =
                remaining === 0
                  ? "var(--accent-primary)"
                  : rcv > 0
                  ? "var(--semantic-warning)"
                  : "var(--text-tertiary)";
              return (
                <div
                  key={l.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.8fr 80px 110px 100px 100px 100px",
                    gap: 8,
                    padding: "10px 14px",
                    borderBottom:
                      idx === (po.lines || []).length - 1
                        ? "none"
                        : "1px solid var(--border-subtle)",
                    fontSize: 12,
                    alignItems: "center",
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
                  <LtrText>
                    <div
                      style={{
                        textAlign: "end",
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {l.unitPriceKwd}
                    </div>
                  </LtrText>
                  <LtrText>
                    <div
                      style={{
                        textAlign: "end",
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {l.lineTotalKwd}
                    </div>
                  </LtrText>
                  <LtrText>
                    <div
                      style={{
                        textAlign: "end",
                        fontFamily: "'DM Mono', monospace",
                        color: tone,
                      }}
                    >
                      {rcv.toFixed(2)}
                    </div>
                  </LtrText>
                  <LtrText>
                    <div
                      style={{
                        textAlign: "end",
                        fontFamily: "'DM Mono', monospace",
                        color: tone,
                      }}
                    >
                      {remaining.toFixed(2)}
                    </div>
                  </LtrText>
                </div>
              );
            })}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.8fr 80px 110px 100px 100px 100px",
                gap: 8,
                padding: "10px 14px",
                background: "var(--bg-surface-sunken)",
                borderTop: "1px solid var(--border-default)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "var(--text-primary)",
              }}
            >
              <div style={{ textTransform: "uppercase" }}>{t("detail.total")}</div>
              <div />
              <div />
              <LtrText>
                <div
                  style={{
                    textAlign: "end",
                    fontFamily: "'DM Mono', monospace",
                    color: "var(--accent-primary)",
                  }}
                >
                  {po.totalAmountKwd} KWD
                </div>
              </LtrText>
              <div />
              <div />
            </div>
          </div>
        </div>

        {/* GR History */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: "var(--text-tertiary)",
              marginBottom: 8,
            }}
          >
            {t("detail.gr_heading", { count: (po.receipts || []).length })}
          </div>
          {(po.receipts || []).length === 0 && (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: 12,
                border: "1px dashed var(--border-default)",
                borderRadius: 8,
              }}
            >
              {canReceive ? t("detail.gr_empty_active") : t("detail.gr_empty_inactive")}
            </div>
          )}
          {(po.receipts || []).length > 0 && (
            <div
              style={{
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {po.receipts.map((g, idx) => (
                <div
                  key={g.id}
                  style={{
                    padding: "12px 14px",
                    borderBottom:
                      idx === po.receipts.length - 1
                        ? "none"
                        : "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    fontSize: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <LtrText>
                      <span
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {g.receiptNumber}
                      </span>
                    </LtrText>
                    {g.notes && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          marginTop: 2,
                        }}
                      >
                        {g.notes}
                      </div>
                    )}
                  </div>
                  <LtrText>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {String(g.receivedDate).slice(0, 10)}
                    </span>
                  </LtrText>
                  <LtrText>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {t("detail.gr_lines_count", { count: (g.lines || []).length })}
                    </span>
                  </LtrText>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 14,
            fontSize: 11,
            color: "var(--text-tertiary)",
            fontStyle: "italic",
          }}
        >
          {t("detail.posting_deferred_note")}
        </div>

        <GoodsReceiptCreateModal
          open={grOpen}
          po={po}
          onClose={closeGR}
          onSaved={onGRSaved}
        />

        <ThreeWayMatchDrawer
          open={matchOpen}
          po={po}
          onClose={closeMatch}
        />
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
