import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Boxes,
  Plus,
  AlertTriangle,
  Camera,
  CheckCircle2,
  XCircle,
  Scale,
  ArrowLeft,
  Save,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import Spinner from "../../components/shared/Spinner";
import useEscapeKey from "../../hooks/useEscapeKey";
import InventoryCountCreateModal from "../../components/inventory-count/InventoryCountCreateModal";
import {
  listInventoryCounts,
  getInventoryCount,
  snapshotInventoryCount,
  recordInventoryCountLine as _recordInventoryCountLine,
  reconcileInventoryCount,
  cancelInventoryCount,
  getInventoryCountVarianceJeShape,
} from "../../engine";

// Re-export so LineTable can import without duplicating the import list.
const recordInventoryCountLine = _recordInventoryCountLine;

const STATUS_COLORS = {
  DRAFT: {
    color: "var(--text-secondary)",
    bg: "var(--bg-surface)",
  },
  COUNTING: {
    color: "var(--semantic-warning)",
    bg: "var(--semantic-warning-subtle)",
  },
  RECONCILED: {
    color: "var(--accent-primary)",
    bg: "var(--accent-primary-subtle)",
  },
  POSTED: {
    color: "var(--accent-primary)",
    bg: "var(--accent-primary-subtle)",
  },
  CANCELLED: {
    color: "var(--text-tertiary)",
    bg: "var(--bg-surface-sunken)",
  },
};

const STATUS_FILTERS = [
  "ALL",
  "DRAFT",
  "COUNTING",
  "RECONCILED",
  "POSTED",
  "CANCELLED",
];

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

export default function InventoryCountScreen({ role = "CFO" }) {
  const { t } = useTranslation("inventory-count");
  const [rows, setRows] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [varianceDrawerOpen, setVarianceDrawerOpen] = useState(false);
  const [varianceData, setVarianceData] = useState(null);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [acting, setActing] = useState(null);

  const reloadList = async () => {
    setLoadError(null);
    try {
      const filters = statusFilter === "ALL" ? {} : { status: statusFilter };
      const list = await listInventoryCounts(filters);
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
      const detail = await getInventoryCount(id);
      setSelected(detail);
    } catch (err) {
      setToast(err?.message || t("error_load_detail"));
    }
  };

  useEffect(() => {
    reloadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    reloadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleSnapshot = async () => {
    if (!selected) return;
    setActing("snapshot");
    try {
      await snapshotInventoryCount(selected.id);
      setToast(t("toast.snapshot_done"));
      await reloadDetail(selected.id);
      reloadList();
    } catch (err) {
      setToast(err?.message || t("error_snapshot"));
    } finally {
      setActing(null);
    }
  };

  const handleReconcile = async () => {
    if (!selected) return;
    setActing("reconcile");
    try {
      await reconcileInventoryCount(selected.id);
      setToast(t("toast.reconciled"));
      await reloadDetail(selected.id);
      reloadList();
    } catch (err) {
      setToast(err?.message || t("error_reconcile"));
    } finally {
      setActing(null);
    }
  };

  const handleCancel = async () => {
    if (!selected) return;
    setActing("cancel");
    try {
      await cancelInventoryCount(selected.id);
      setToast(t("toast.cancelled"));
      await reloadDetail(selected.id);
      reloadList();
    } catch (err) {
      setToast(err?.message || t("error_cancel"));
    } finally {
      setActing(null);
    }
  };

  const openVarianceDrawer = async () => {
    if (!selected) return;
    setVarianceDrawerOpen(true);
    setVarianceData(null);
    try {
      const shape = await getInventoryCountVarianceJeShape(selected.id);
      setVarianceData(shape);
    } catch (err) {
      setVarianceData({ error: err?.message || t("error_variance_shape") });
    }
  };

  // Master-detail routing: when a selection is active, show detail;
  // otherwise show the list.
  if (selectedId && selected) {
    return (
      <CountDetailView
        count={selected}
        onBack={() => {
          setSelectedId(null);
          setSelected(null);
        }}
        onSnapshot={handleSnapshot}
        onReconcile={handleReconcile}
        onCancel={handleCancel}
        onOpenVariance={openVarianceDrawer}
        onLineRecorded={async () => {
          await reloadDetail(selected.id);
          setToast(t("toast.line_recorded"));
        }}
        acting={acting}
        toast={toast}
        setToast={setToast}
        varianceDrawerOpen={varianceDrawerOpen}
        varianceData={varianceData}
        closeVarianceDrawer={() => {
          setVarianceDrawerOpen(false);
          setVarianceData(null);
        }}
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
          <button
            onClick={() => setCreateOpen(true)}
            style={btnPrimary(false)}
          >
            <Plus
              size={13}
              style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
            />
            {t("new_count")}
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
                  background: on
                    ? "var(--accent-primary-subtle)"
                    : "transparent",
                  borderColor: on
                    ? "var(--accent-primary-border)"
                    : "var(--border-strong)",
                  color: on
                    ? "var(--accent-primary)"
                    : "var(--text-secondary)",
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
            icon={Boxes}
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
              const colors =
                STATUS_COLORS[row.status] || STATUS_COLORS.DRAFT;
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
                      idx === rows.length - 1
                        ? "none"
                        : "1px solid var(--border-subtle)",
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
                          {row.countDate}
                        </span>
                      </LtrText>
                      {row.locationLabel && (
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {row.locationLabel}
                        </span>
                      )}
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
                    {row.notes && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          marginTop: 4,
                          fontStyle: "italic",
                        }}
                      >
                        {row.notes}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t("row.open")} →
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <InventoryCountCreateModal
          open={createOpen}
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

function CountDetailView({
  count,
  onBack,
  onSnapshot,
  onReconcile,
  onCancel,
  onOpenVariance,
  onLineRecorded,
  acting,
  toast,
  setToast,
  varianceDrawerOpen,
  varianceData,
  closeVarianceDrawer,
}) {
  const { t } = useTranslation("inventory-count");
  const colors = STATUS_COLORS[count.status] || STATUS_COLORS.DRAFT;
  const lines = count.lines || [];

  const isDraft = count.status === "DRAFT";
  const isCounting = count.status === "COUNTING";
  const isReconciled = count.status === "RECONCILED";
  const isPosted = count.status === "POSTED";
  const isCancelled = count.status === "CANCELLED";
  const isTerminal = isReconciled || isPosted || isCancelled;

  const countedLines = lines.filter((l) => l.countedQuantity != null).length;

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

        {/* Header */}
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
          <div>
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
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 24,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              <LtrText>{count.countDate}</LtrText>
              {count.locationLabel && (
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--text-tertiary)",
                    marginInlineStart: 10,
                  }}
                >
                  · {count.locationLabel}
                </span>
              )}
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
                {t(`status_${count.status}`)}
              </span>
              {isCounting && (
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {t("detail.progress", {
                    counted: countedLines,
                    total: lines.length,
                  })}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isDraft && (
              <button
                onClick={onSnapshot}
                disabled={acting != null}
                style={btnPrimary(acting === "snapshot")}
              >
                {acting === "snapshot" ? (
                  <>
                    <Spinner size={13} />
                    &nbsp;{t("detail.snapshotting")}
                  </>
                ) : (
                  <>
                    <Camera
                      size={13}
                      style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
                    />
                    {t("detail.action_snapshot")}
                  </>
                )}
              </button>
            )}
            {isCounting && (
              <button
                onClick={onReconcile}
                disabled={acting != null}
                style={btnPrimary(acting === "reconcile")}
              >
                {acting === "reconcile" ? (
                  <>
                    <Spinner size={13} />
                    &nbsp;{t("detail.reconciling")}
                  </>
                ) : (
                  <>
                    <CheckCircle2
                      size={13}
                      style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
                    />
                    {t("detail.action_reconcile")}
                  </>
                )}
              </button>
            )}
            {(isReconciled || isPosted) && (
              <button onClick={onOpenVariance} style={btnMini}>
                <Scale
                  size={11}
                  style={{ verticalAlign: "middle", marginInlineEnd: 4 }}
                />
                {t("detail.action_variance_je")}
              </button>
            )}
            {(isDraft || isCounting) && (
              <button
                onClick={onCancel}
                disabled={acting != null}
                style={{
                  ...btnMini,
                  color: "var(--semantic-danger)",
                  borderColor: "var(--semantic-danger-border)",
                }}
              >
                {acting === "cancel" ? (
                  <Spinner size={11} />
                ) : (
                  <>
                    <XCircle
                      size={11}
                      style={{ verticalAlign: "middle", marginInlineEnd: 4 }}
                    />
                    {t("detail.action_cancel")}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {count.notes && (
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
            {count.notes}
          </div>
        )}

        {/* State-aware body */}
        {isDraft && (
          <EmptyState
            icon={Camera}
            title={t("detail.draft_empty_title")}
            description={t("detail.draft_empty_description")}
          />
        )}

        {(isCounting || isTerminal) && lines.length === 0 && (
          <EmptyState
            icon={Boxes}
            title={t("detail.no_items_title")}
            description={t("detail.no_items_description")}
          />
        )}

        {(isCounting || isTerminal) && lines.length > 0 && (
          <LineTable
            lines={lines}
            countingMode={isCounting}
            onLineRecorded={onLineRecorded}
            setToast={setToast}
          />
        )}

        {varianceDrawerOpen && (
          <VarianceDrawer
            data={varianceData}
            onClose={closeVarianceDrawer}
            isPosted={isPosted}
          />
        )}
      </div>
    </div>
  );
}

function LineTable({ lines, countingMode, onLineRecorded, setToast }) {
  const { t } = useTranslation("inventory-count");
  const [editingLineId, setEditingLineId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const totalVariance = lines.reduce(
    (a, l) => a + Number(l.varianceValueKwd || 0),
    0,
  );

  const startEdit = (line) => {
    setEditingLineId(line.id);
    setEditValue(line.countedQuantity || "");
  };

  const saveEdit = async (line) => {
    if (!/^\d+(?:\.\d{1,2})?$/.test(String(editValue).trim())) {
      setToast(t("table.error_qty_format"));
      return;
    }
    setSaving(true);
    try {
      await recordInventoryCountLine(line.id, {
        countedQuantity: String(editValue).trim(),
      });
      setEditingLineId(null);
      setEditValue("");
      if (onLineRecorded) await onLineRecorded();
    } catch (err) {
      setToast(err?.message || t("table.error_record"));
    } finally {
      setSaving(false);
    }
  };

  return (
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
          gridTemplateColumns: "1.5fr 90px 90px 90px 100px 100px 100px",
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
        <div>{t("table.item")}</div>
        <div style={{ textAlign: "end" }}>{t("table.system")}</div>
        <div style={{ textAlign: "end" }}>{t("table.counted")}</div>
        <div style={{ textAlign: "end" }}>{t("table.variance_qty")}</div>
        <div style={{ textAlign: "end" }}>{t("table.unit_cost")}</div>
        <div style={{ textAlign: "end" }}>{t("table.variance_kwd")}</div>
        <div style={{ textAlign: "end" }}>{t("table.actions")}</div>
      </div>
      {lines.map((line, idx) => {
        const isEditing = editingLineId === line.id;
        const varianceKwd = Number(line.varianceValueKwd || 0);
        const varianceColor =
          Math.abs(varianceKwd) < 0.001
            ? "var(--text-secondary)"
            : varianceKwd > 0
            ? "var(--accent-primary)"
            : "var(--semantic-danger)";
        return (
          <div
            key={line.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 90px 90px 90px 100px 100px 100px",
              gap: 8,
              padding: "10px 14px",
              borderBottom:
                idx === lines.length - 1
                  ? "none"
                  : "1px solid var(--border-subtle)",
              fontSize: 12,
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                {line.itemName || line.itemId}
              </div>
              {line.itemCode && (
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-tertiary)",
                    fontFamily: "'DM Mono', monospace",
                    marginTop: 2,
                  }}
                >
                  <LtrText>{line.itemCode}</LtrText>
                </div>
              )}
            </div>
            <div
              style={{
                textAlign: "end",
                fontFamily: "'DM Mono', monospace",
                color: "var(--text-secondary)",
              }}
            >
              <LtrText>{line.systemQuantity}</LtrText>
            </div>
            <div style={{ textAlign: "end" }}>
              {isEditing ? (
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%",
                    background: "var(--bg-surface-sunken)",
                    border: "1px solid var(--accent-primary)",
                    borderRadius: 4,
                    padding: "4px 6px",
                    color: "var(--text-primary)",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                    textAlign: "end",
                    outline: "none",
                  }}
                />
              ) : (
                <LtrText>
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color:
                        line.countedQuantity != null
                          ? "var(--text-primary)"
                          : "var(--text-tertiary)",
                      fontWeight:
                        line.countedQuantity != null ? 600 : 400,
                    }}
                  >
                    {line.countedQuantity != null
                      ? line.countedQuantity
                      : "—"}
                  </span>
                </LtrText>
              )}
            </div>
            <div
              style={{
                textAlign: "end",
                fontFamily: "'DM Mono', monospace",
                color:
                  line.varianceQuantity != null
                    ? varianceColor
                    : "var(--text-tertiary)",
              }}
            >
              <LtrText>
                {line.varianceQuantity != null ? line.varianceQuantity : "—"}
              </LtrText>
            </div>
            <div
              style={{
                textAlign: "end",
                fontFamily: "'DM Mono', monospace",
                color: "var(--text-tertiary)",
              }}
            >
              <LtrText>{line.snapshotUnitCost}</LtrText>
            </div>
            <div
              style={{
                textAlign: "end",
                fontFamily: "'DM Mono', monospace",
                color: varianceColor,
                fontWeight: 600,
              }}
            >
              <LtrText>
                {line.varianceValueKwd != null ? line.varianceValueKwd : "—"}
              </LtrText>
            </div>
            <div style={{ textAlign: "end" }}>
              {countingMode && !isEditing && (
                <button onClick={() => startEdit(line)} style={btnMini}>
                  {line.countedQuantity != null
                    ? t("table.edit")
                    : t("table.count")}
                </button>
              )}
              {countingMode && isEditing && (
                <div style={{ display: "inline-flex", gap: 4 }}>
                  <button
                    onClick={() => saveEdit(line)}
                    disabled={saving}
                    style={{
                      ...btnMini,
                      background: "var(--accent-primary)",
                      color: "#fff",
                      border: "none",
                    }}
                  >
                    {saving ? (
                      <Spinner size={11} />
                    ) : (
                      <Save size={11} />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditingLineId(null);
                      setEditValue("");
                    }}
                    style={btnMini}
                  >
                    <XCircle size={11} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {lines.length > 0 && (
        <div
          style={{
            padding: "10px 14px",
            background: "var(--bg-surface-sunken)",
            borderTop: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "flex-end",
            fontSize: 12,
            gap: 14,
            color: "var(--text-tertiary)",
          }}
        >
          <span>
            {t("table.total_variance")}:{" "}
            <LtrText>
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  color:
                    Math.abs(totalVariance) < 0.001
                      ? "var(--text-secondary)"
                      : totalVariance > 0
                      ? "var(--accent-primary)"
                      : "var(--semantic-danger)",
                  fontWeight: 700,
                }}
              >
                {totalVariance.toFixed(3)} KWD
              </span>
            </LtrText>
          </span>
        </div>
      )}
    </div>
  );
}

function VarianceDrawer({ data, onClose, isPosted }) {
  const { t } = useTranslation("inventory-count");
  useEscapeKey(onClose, true);

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
          insetInlineEnd: 0,
          height: "100vh",
          width: 520,
          background: "var(--panel-bg)",
          borderInlineStart: "1px solid var(--border-default)",
          zIndex: 301,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
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
              {t("variance_drawer.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("variance_drawer.title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("variance_drawer.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <XCircle size={18} />
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {!data && (
            <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
              {t("variance_drawer.loading")}
            </div>
          )}
          {data?.error && (
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
              <AlertTriangle size={14} /> {data.error}
            </div>
          )}
          {data && !data.error && (
            <>
              <div
                style={{
                  padding: "12px 14px",
                  background: "var(--bg-surface-sunken)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  fontSize: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>
                    {t("variance_drawer.total_abs")}:
                  </span>{" "}
                  <LtrText>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--text-primary)",
                        fontWeight: 600,
                      }}
                    >
                      {data.totalAbsoluteVarianceKwd} KWD
                    </span>
                  </LtrText>
                </div>
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>
                    {t("variance_drawer.net")}:
                  </span>{" "}
                  <LtrText>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color:
                          Math.abs(Number(data.netVarianceKwd)) < 0.001
                            ? "var(--text-secondary)"
                            : Number(data.netVarianceKwd) > 0
                            ? "var(--accent-primary)"
                            : "var(--semantic-danger)",
                        fontWeight: 600,
                      }}
                    >
                      {data.netVarianceKwd} KWD
                    </span>
                  </LtrText>
                </div>
                {data.note && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      fontStyle: "italic",
                      marginTop: 4,
                    }}
                  >
                    {data.note}
                  </div>
                )}
              </div>

              {(data.legs || []).length > 0 && (
                <div
                  style={{
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  {data.legs.map((leg, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 14px",
                        borderBottom:
                          i === data.legs.length - 1
                            ? "none"
                            : "1px solid var(--border-subtle)",
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "var(--text-primary)",
                            fontWeight: 600,
                          }}
                        >
                          {leg.description}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--text-tertiary)",
                            fontFamily: "'DM Mono', monospace",
                            marginTop: 2,
                          }}
                        >
                          <LtrText>{leg.accountRole}</LtrText>
                        </div>
                      </div>
                      <div
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        <LtrText>
                          {leg.side} {leg.amountKwd}
                        </LtrText>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isPosted && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    fontStyle: "italic",
                  }}
                >
                  {t("variance_drawer.posting_deferred_note")}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
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
