import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Landmark,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Calculator,
  RefreshCw,
  Wallet,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import Spinner from "../../components/shared/Spinner";
import IslamicArrangementModal from "../../components/islamic-finance/IslamicArrangementModal";
import IslamicMarkPaidModal from "../../components/islamic-finance/IslamicMarkPaidModal";
import {
  listIslamicArrangements,
  getIslamicArrangement,
  transitionIslamicStatus,
  generateIslamicSchedule,
  getIslamicPosition,
} from "../../engine";

const STATUS_FILTERS = ["ALL", "ACTIVE", "MATURED", "DEFAULTED", "SETTLED", "CANCELLED"];
const STATUS_TRANSITIONS = {
  ACTIVE: ["MATURED", "DEFAULTED", "SETTLED", "CANCELLED"],
  MATURED: ["SETTLED", "DEFAULTED"],
  DEFAULTED: ["SETTLED", "CANCELLED"],
  SETTLED: [],
  CANCELLED: [],
};

const STATUS_COLORS = {
  ACTIVE: { color: "var(--accent-primary)", bg: "var(--accent-primary-subtle)" },
  MATURED: { color: "var(--semantic-warning)", bg: "var(--semantic-warning-subtle)" },
  DEFAULTED: { color: "var(--semantic-danger)", bg: "var(--semantic-danger-subtle)" },
  SETTLED: { color: "var(--text-secondary)", bg: "var(--bg-surface)" },
  CANCELLED: { color: "var(--text-tertiary)", bg: "var(--bg-surface-sunken)" },
};

const ROW_STATUS_COLORS = {
  SCHEDULED: { color: "var(--text-secondary)", bg: "var(--bg-surface)" },
  PAID: { color: "var(--accent-primary)", bg: "var(--accent-primary-subtle)" },
  OVERDUE: { color: "var(--semantic-danger)", bg: "var(--semantic-danger-subtle)" },
  RESCHEDULED: { color: "var(--semantic-warning)", bg: "var(--semantic-warning-subtle)" },
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

export default function IslamicFinanceScreen({ role = "CFO" }) {
  const { t } = useTranslation("islamic-finance");
  const [rows, setRows] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [position, setPosition] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [paidRow, setPaidRow] = useState(null);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [acting, setActing] = useState(null);

  const reloadList = async () => {
    setLoadError(null);
    try {
      const filters = statusFilter === "ALL" ? {} : { status: statusFilter };
      const list = await listIslamicArrangements(filters);
      setRows(list || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t("error_load"));
    }
  };

  const reloadDetail = async (id) => {
    if (!id) {
      setSelected(null);
      setPosition(null);
      return;
    }
    try {
      const [detail, pos] = await Promise.all([
        getIslamicArrangement(id),
        getIslamicPosition(id).catch(() => null),
      ]);
      setSelected(detail);
      setPosition(pos);
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

  const handleGenerateSchedule = async (regenerate) => {
    if (!selected) return;
    setActing(regenerate ? "regenerate" : "generate");
    try {
      await generateIslamicSchedule(selected.id, { regenerate });
      setToast(regenerate ? t("toast.regenerated") : t("toast.generated"));
      await reloadDetail(selected.id);
    } catch (err) {
      setToast(err?.message || t("error_generate"));
    } finally {
      setActing(null);
    }
  };

  const handleTransition = async (newStatus) => {
    if (!selected) return;
    setActing(`transition-${newStatus}`);
    try {
      await transitionIslamicStatus(selected.id, newStatus);
      setToast(t("toast.transitioned", { status: t(`status_${newStatus}`) }));
      await reloadDetail(selected.id);
      reloadList();
    } catch (err) {
      setToast(err?.message || t("error_transition"));
    } finally {
      setActing(null);
    }
  };

  if (selectedId && selected) {
    return (
      <ArrangementDetailView
        arrangement={selected}
        position={position}
        onBack={() => {
          setSelectedId(null);
          setSelected(null);
          setPosition(null);
        }}
        onGenerate={() => handleGenerateSchedule(false)}
        onRegenerate={() => handleGenerateSchedule(true)}
        onTransition={handleTransition}
        onMarkPaid={(row) => setPaidRow(row)}
        acting={acting}
        toast={toast}
        setToast={setToast}
        paidRow={paidRow}
        closePaid={() => setPaidRow(null)}
        onPaidSaved={async () => {
          await reloadDetail(selected.id);
          setToast(t("toast.paid"));
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
          <button onClick={() => setCreateOpen(true)} style={btnPrimary(false)}>
            <Plus size={13} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
            {t("new_arrangement")}
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
            icon={Landmark}
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
              const colors = STATUS_COLORS[row.status] || STATUS_COLORS.ACTIVE;
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
                          {row.arrangementNumber}
                        </span>
                      </LtrText>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: "var(--bg-surface)",
                          color: "var(--accent-primary)",
                          border: "1px solid var(--accent-primary-border)",
                        }}
                      >
                        {t(`type_${row.arrangementType}`)}
                      </span>
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
                      {row.sourceTermLabel}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        marginTop: 2,
                      }}
                    >
                      {row.counterpartyBank}
                      {" · "}
                      {t(`direction_${row.direction}`)}
                    </div>
                  </div>
                  <div style={{ textAlign: "end" }}>
                    <LtrText>
                      <div
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {row.originalFacilityAmountKwd} KWD
                      </div>
                    </LtrText>
                    <LtrText>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          marginTop: 2,
                          fontFamily: "'DM Mono', monospace",
                        }}
                      >
                        {(row.profitRatePercent / 100).toFixed(2)}%
                        {" · "}
                        {t(`method_${row.profitComputationMethod}`)}
                      </div>
                    </LtrText>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <IslamicArrangementModal
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

function ArrangementDetailView({
  arrangement,
  position,
  onBack,
  onGenerate,
  onRegenerate,
  onTransition,
  onMarkPaid,
  acting,
  toast,
  setToast,
  paidRow,
  closePaid,
  onPaidSaved,
}) {
  const { t } = useTranslation("islamic-finance");
  const colors = STATUS_COLORS[arrangement.status] || STATUS_COLORS.ACTIVE;
  const schedule = arrangement.schedule || [];
  const transitions = STATUS_TRANSITIONS[arrangement.status] || [];
  const hasSchedule = schedule.length > 0;
  const isTerminal = arrangement.status === "SETTLED" || arrangement.status === "CANCELLED";

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
                {arrangement.arrangementNumber}
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
              {arrangement.sourceTermLabel}
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
                  background: "var(--bg-surface)",
                  color: "var(--accent-primary)",
                  border: "1px solid var(--accent-primary-border)",
                }}
              >
                {t(`type_${arrangement.arrangementType}`)}
              </span>
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
                {t(`status_${arrangement.status}`)}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {t(`direction_${arrangement.direction}`)}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!hasSchedule && !isTerminal && (
              <button
                onClick={onGenerate}
                disabled={acting != null}
                style={btnPrimary(acting === "generate")}
              >
                {acting === "generate" ? (
                  <>
                    <Spinner size={13} />
                    &nbsp;{t("detail.generating")}
                  </>
                ) : (
                  <>
                    <Calculator size={13} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
                    {t("detail.action_generate")}
                  </>
                )}
              </button>
            )}
            {hasSchedule && !isTerminal && (
              <button
                onClick={onRegenerate}
                disabled={acting != null}
                style={btnMini}
              >
                {acting === "regenerate" ? (
                  <Spinner size={11} />
                ) : (
                  <>
                    <RefreshCw size={11} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
                    {t("detail.action_regenerate")}
                  </>
                )}
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
                    s === "CANCELLED" || s === "DEFAULTED"
                      ? "var(--semantic-danger)"
                      : "var(--text-secondary)",
                  borderColor:
                    s === "CANCELLED" || s === "DEFAULTED"
                      ? "var(--semantic-danger-border)"
                      : "var(--border-strong)",
                }}
              >
                {acting === `transition-${s}` ? (
                  <Spinner size={11} />
                ) : (
                  t(`detail.action_transition_${s}`)
                )}
              </button>
            ))}
          </div>
        </div>

        {/* AAOIFI / IFRS label pair */}
        {position?.labelPair && (
          <LabelPairCard pair={position.labelPair} />
        )}

        {/* Position card */}
        {position && <PositionCard position={position} arrangement={arrangement} />}

        {/* Schedule */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t("detail.schedule_heading", { count: schedule.length })}
            </div>
          </div>

          {schedule.length === 0 && (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: 12,
                border: "1px dashed var(--border-default)",
                borderRadius: 8,
              }}
            >
              {t("detail.schedule_empty")}
            </div>
          )}

          {schedule.length > 0 && (
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
                  gridTemplateColumns: "50px 110px 110px 110px 110px 120px 100px 90px",
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
                <div>#</div>
                <div>{t("table.due_date")}</div>
                <div style={{ textAlign: "end" }}>{t("table.principal")}</div>
                <div style={{ textAlign: "end" }}>{t("table.profit")}</div>
                <div style={{ textAlign: "end" }}>{t("table.total")}</div>
                <div style={{ textAlign: "end" }}>{t("table.outstanding")}</div>
                <div>{t("table.row_status")}</div>
                <div />
              </div>
              {schedule.map((row, idx) => {
                const rc = ROW_STATUS_COLORS[row.status] || ROW_STATUS_COLORS.SCHEDULED;
                const canPay = row.status !== "PAID" && !isTerminal;
                return (
                  <div
                    key={row.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "50px 110px 110px 110px 110px 120px 100px 90px",
                      gap: 8,
                      padding: "10px 14px",
                      borderBottom:
                        idx === schedule.length - 1
                          ? "none"
                          : "1px solid var(--border-subtle)",
                      fontSize: 12,
                      alignItems: "center",
                    }}
                  >
                    <LtrText>
                      <div
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {row.installmentNumber}
                      </div>
                    </LtrText>
                    <LtrText>
                      <div
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {String(row.dueDate).slice(0, 10)}
                      </div>
                    </LtrText>
                    <LtrText>
                      <div
                        style={{
                          textAlign: "end",
                          fontFamily: "'DM Mono', monospace",
                          color: "var(--text-primary)",
                        }}
                      >
                        {row.principalPortionKwd}
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
                        {row.profitPortionKwd}
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
                        {row.totalPortionKwd}
                      </div>
                    </LtrText>
                    <LtrText>
                      <div
                        style={{
                          textAlign: "end",
                          fontFamily: "'DM Mono', monospace",
                          color: "var(--text-tertiary)",
                          fontSize: 11,
                        }}
                      >
                        {row.outstandingAfterKwd}
                      </div>
                    </LtrText>
                    <div>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          padding: "2px 7px",
                          borderRadius: 10,
                          background: rc.bg,
                          color: rc.color,
                          border: "1px solid",
                        }}
                      >
                        {t(`row_status_${row.status}`)}
                      </span>
                    </div>
                    <div style={{ textAlign: "end" }}>
                      {canPay && (
                        <button
                          onClick={() => onMarkPaid(row)}
                          disabled={acting != null}
                          aria-label={t("table.mark_paid")}
                          style={{
                            background: "transparent",
                            border: "1px solid var(--accent-primary-border)",
                            borderRadius: 4,
                            padding: "4px 8px",
                            cursor: acting != null ? "not-allowed" : "pointer",
                            color: "var(--accent-primary)",
                            fontSize: 10,
                            fontWeight: 600,
                            fontFamily: "inherit",
                          }}
                        >
                          <Wallet size={10} style={{ verticalAlign: "middle", marginInlineEnd: 3 }} />
                          {t("table.mark_paid")}
                        </button>
                      )}
                      {row.status === "PAID" && (
                        <CheckCircle2 size={14} color="var(--accent-primary)" />
                      )}
                    </div>
                  </div>
                );
              })}
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

        <IslamicMarkPaidModal
          open={paidRow != null}
          scheduleRow={paidRow}
          onClose={closePaid}
          onSaved={onPaidSaved}
        />
      </div>
    </div>
  );
}

function LabelPairCard({ pair }) {
  const { t } = useTranslation("islamic-finance");
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: "var(--bg-surface-sunken)",
        border: "1px solid var(--border-default)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginBottom: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "var(--accent-primary)",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          {t("labels.aaoifi")}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
          {pair.aaoifiLabel}
        </div>
      </div>
      <div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          {t("labels.ifrs")}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
          {pair.ifrsLabel}
        </div>
      </div>
    </div>
  );
}

function PositionCard({ position, arrangement }) {
  const { t } = useTranslation("islamic-finance");
  return (
    <div
      role="status"
      style={{
        padding: "14px 16px",
        borderRadius: 10,
        background: "var(--accent-primary-subtle)",
        border: "1px solid var(--accent-primary-border)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
      }}
    >
      <PositionCell
        label={t("position.facility")}
        value={`${arrangement.originalFacilityAmountKwd} KWD`}
      />
      <PositionCell
        label={t("position.outstanding")}
        value={`${position.outstandingPrincipalKwd} KWD`}
        tone="primary"
      />
      <PositionCell
        label={t("position.profit_accrued")}
        value={`${position.profitAccruedToDateKwd} KWD`}
      />
      <PositionCell
        label={t("position.profit_paid")}
        value={`${position.profitPaidToDateKwd} KWD`}
      />
      <PositionCell
        label={t("position.profit_unearned")}
        value={`${position.profitUnearnedKwd} KWD`}
      />
      <PositionCell
        label={t("position.paid_count")}
        value={`${position.installmentsPaidCount} / ${arrangement.installmentCount}`}
      />
      <PositionCell
        label={t("position.overdue_count")}
        value={String(position.installmentsOverdueCount)}
        tone={position.installmentsOverdueCount > 0 ? "danger" : undefined}
      />
      <PositionCell
        label={t("position.rate")}
        value={`${(arrangement.profitRatePercent / 100).toFixed(2)}%`}
      />
    </div>
  );
}

function PositionCell({ label, value, tone }) {
  const color =
    tone === "danger"
      ? "var(--semantic-danger)"
      : tone === "primary"
      ? "var(--accent-primary)"
      : "var(--text-primary)";
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
            color,
          }}
        >
          {value}
        </div>
      </LtrText>
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
