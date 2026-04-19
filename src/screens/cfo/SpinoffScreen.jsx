import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  GitBranch,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Scale,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import Spinner from "../../components/shared/Spinner";
import SpinoffEventModal from "../../components/spinoff/SpinoffEventModal";
import SpinoffTransferModal from "../../components/spinoff/SpinoffTransferModal";
import {
  listSpinoffEvents,
  getSpinoffEvent,
  removeSpinoffTransfer,
  validateSpinoffEvent,
  approveSpinoffEvent,
  cancelSpinoffEvent,
  getSpinoffBalanceCheck,
  getAccountsFlat,
} from "../../engine";

const STATUS_COLORS = {
  DRAFT: { color: "var(--text-secondary)", bg: "var(--bg-surface)" },
  VALIDATED: {
    color: "var(--semantic-warning)",
    bg: "var(--semantic-warning-subtle)",
  },
  APPROVED: {
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
  "VALIDATED",
  "APPROVED",
  "POSTED",
  "CANCELLED",
];

const CLASS_COLORS = {
  ASSET: "var(--accent-primary)",
  LIABILITY: "var(--semantic-warning)",
  EQUITY: "var(--role-owner, #8B5CF6)",
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

export default function SpinoffScreen({ role = "CFO" }) {
  const { t } = useTranslation("spinoff");
  const [rows, setRows] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [balanceCheck, setBalanceCheck] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [acting, setActing] = useState(null);

  const reloadList = async () => {
    setLoadError(null);
    try {
      const filters = statusFilter === "ALL" ? {} : { status: statusFilter };
      const list = await listSpinoffEvents(filters);
      setRows(list || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t("error_load"));
    }
  };

  const reloadDetail = async (id) => {
    if (!id) {
      setSelected(null);
      setBalanceCheck(null);
      return;
    }
    try {
      const [detail, check] = await Promise.all([
        getSpinoffEvent(id),
        getSpinoffBalanceCheck(id).catch(() => null),
      ]);
      setSelected(detail);
      setBalanceCheck(check);
    } catch (err) {
      setToast(err?.message || t("error_load_detail"));
    }
  };

  useEffect(() => {
    reloadList();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    reloadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleValidate = async () => {
    if (!selected) return;
    setActing("validate");
    try {
      await validateSpinoffEvent(selected.id);
      setToast(t("toast.validated"));
      await reloadDetail(selected.id);
      reloadList();
    } catch (err) {
      setToast(err?.message || t("error_validate"));
    } finally {
      setActing(null);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    setActing("approve");
    try {
      await approveSpinoffEvent(selected.id);
      setToast(t("toast.approved"));
      await reloadDetail(selected.id);
      reloadList();
    } catch (err) {
      setToast(err?.message || t("error_approve"));
    } finally {
      setActing(null);
    }
  };

  const handleCancel = async () => {
    if (!selected) return;
    setActing("cancel");
    try {
      await cancelSpinoffEvent(selected.id);
      setToast(t("toast.cancelled"));
      await reloadDetail(selected.id);
      reloadList();
    } catch (err) {
      setToast(err?.message || t("error_cancel"));
    } finally {
      setActing(null);
    }
  };

  const handleRemoveTransfer = async (transferId) => {
    setActing(`remove-${transferId}`);
    try {
      await removeSpinoffTransfer(transferId);
      setToast(t("toast.transfer_removed"));
      await reloadDetail(selected.id);
    } catch (err) {
      setToast(err?.message || t("error_remove_transfer"));
    } finally {
      setActing(null);
    }
  };

  if (selectedId && selected) {
    return (
      <EventDetailView
        event={selected}
        balanceCheck={balanceCheck}
        accounts={accounts}
        onBack={() => {
          setSelectedId(null);
          setSelected(null);
          setBalanceCheck(null);
        }}
        onValidate={handleValidate}
        onApprove={handleApprove}
        onCancel={handleCancel}
        onAddTransfer={() => setTransferOpen(true)}
        onRemoveTransfer={handleRemoveTransfer}
        acting={acting}
        toast={toast}
        setToast={setToast}
        transferOpen={transferOpen}
        closeTransferModal={() => setTransferOpen(false)}
        onTransferAdded={async () => {
          await reloadDetail(selected.id);
          setToast(t("toast.transfer_added"));
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
            {t("new_event")}
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
            icon={GitBranch}
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
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {row.targetEntityLabel}
                      </div>
                      <LtrText>
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {row.effectiveDate}
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
                      {row.description}
                    </div>
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

        <SpinoffEventModal
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

function EventDetailView({
  event,
  balanceCheck,
  accounts,
  onBack,
  onValidate,
  onApprove,
  onCancel,
  onAddTransfer,
  onRemoveTransfer,
  acting,
  toast,
  setToast,
  transferOpen,
  closeTransferModal,
  onTransferAdded,
}) {
  const { t } = useTranslation("spinoff");
  const colors = STATUS_COLORS[event.status] || STATUS_COLORS.DRAFT;
  const transfers = event.transfers || [];

  const isDraft = event.status === "DRAFT";
  const isValidated = event.status === "VALIDATED";
  const isApproved = event.status === "APPROVED";
  const isPosted = event.status === "POSTED";
  const isCancelled = event.status === "CANCELLED";
  const isTerminal = isApproved || isPosted || isCancelled;

  const accountLabel = (id) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.code} — ${a.nameEn}` : id;
  };

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
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 24,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {event.targetEntityLabel}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                marginTop: 4,
              }}
            >
              {event.description}
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
                {t(`status_${event.status}`)}
              </span>
              <LtrText>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {t("detail.effective")}: {event.effectiveDate}
                </span>
              </LtrText>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(isDraft || isValidated) && (
              <button
                onClick={onAddTransfer}
                disabled={acting != null}
                style={btnMini}
              >
                <Plus
                  size={11}
                  style={{ verticalAlign: "middle", marginInlineEnd: 4 }}
                />
                {t("detail.action_add_transfer")}
              </button>
            )}
            {(isDraft || isValidated) && (
              <button
                onClick={onValidate}
                disabled={acting != null || transfers.length === 0}
                style={btnPrimary(acting === "validate")}
              >
                {acting === "validate" ? (
                  <>
                    <Spinner size={13} />
                    &nbsp;{t("detail.validating")}
                  </>
                ) : (
                  <>
                    <Scale
                      size={13}
                      style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
                    />
                    {t("detail.action_validate")}
                  </>
                )}
              </button>
            )}
            {isValidated && (
              <button
                onClick={onApprove}
                disabled={acting != null}
                style={btnPrimary(acting === "approve")}
              >
                {acting === "approve" ? (
                  <>
                    <Spinner size={13} />
                    &nbsp;{t("detail.approving")}
                  </>
                ) : (
                  <>
                    <CheckCircle2
                      size={13}
                      style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
                    />
                    {t("detail.action_approve")}
                  </>
                )}
              </button>
            )}
            {(isDraft || isValidated) && (
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

        {event.notes && (
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
            {event.notes}
          </div>
        )}

        {/* Balance-check card */}
        {balanceCheck && (
          <BalanceCheckCard
            check={balanceCheck}
            blocksApprove={isDraft || (isValidated && !balanceCheck.isBalanced)}
          />
        )}

        {/* Transfers table */}
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: "var(--text-tertiary)",
              marginBottom: 8,
            }}
          >
            {t("detail.transfers_heading", { count: transfers.length })}
          </div>

          {transfers.length === 0 && (
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
              {isDraft
                ? t("detail.transfers_empty_draft")
                : t("detail.transfers_empty_terminal")}
            </div>
          )}

          {transfers.length > 0 && (
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
                  gridTemplateColumns: "110px 1.5fr 120px 120px 60px",
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
                <div>{t("table.class")}</div>
                <div>{t("table.source_account")}</div>
                <div style={{ textAlign: "end" }}>{t("table.amount")}</div>
                <div>{t("table.notes")}</div>
                <div />
              </div>
              {transfers.map((tr, idx) => (
                <div
                  key={tr.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "110px 1.5fr 120px 120px 60px",
                    gap: 8,
                    padding: "10px 14px",
                    borderBottom:
                      idx === transfers.length - 1
                        ? "none"
                        : "1px solid var(--border-subtle)",
                    fontSize: 12,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--bg-surface)",
                        color: CLASS_COLORS[tr.classification],
                        border: `1px solid ${CLASS_COLORS[tr.classification]}`,
                      }}
                    >
                      {t(`class_${tr.classification}`)}
                    </span>
                  </div>
                  <div>
                    <LtrText>
                      <span
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          color: "var(--text-primary)",
                        }}
                      >
                        {accountLabel(tr.sourceAccountId)}
                      </span>
                    </LtrText>
                  </div>
                  <div
                    style={{
                      textAlign: "end",
                      fontFamily: "'DM Mono', monospace",
                      color: "var(--text-primary)",
                      fontWeight: 600,
                    }}
                  >
                    <LtrText>{tr.amountKwd} KWD</LtrText>
                  </div>
                  <div
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: 11,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tr.notes || ""}
                  </div>
                  <div style={{ textAlign: "end" }}>
                    {(isDraft || isValidated) && (
                      <button
                        onClick={() => onRemoveTransfer(tr.id)}
                        disabled={acting != null}
                        aria-label={t("table.remove")}
                        style={{
                          background: "transparent",
                          border: "1px solid var(--border-default)",
                          borderRadius: 4,
                          padding: 6,
                          cursor: acting != null ? "not-allowed" : "pointer",
                          color: "var(--semantic-danger)",
                        }}
                      >
                        {acting === `remove-${tr.id}` ? (
                          <Spinner size={11} />
                        ) : (
                          <Trash2 size={11} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {(isApproved || isPosted) && (
          <div
            style={{
              marginTop: 12,
              fontSize: 11,
              color: "var(--text-tertiary)",
              fontStyle: "italic",
            }}
          >
            {t("detail.posting_deferred_note")}
          </div>
        )}

        <SpinoffTransferModal
          open={transferOpen}
          eventId={event.id}
          accounts={accounts}
          onClose={closeTransferModal}
          onSaved={onTransferAdded}
        />
      </div>
    </div>
  );
}

function BalanceCheckCard({ check, blocksApprove }) {
  const { t } = useTranslation("spinoff");
  const balanced = check.isBalanced;
  const color = balanced
    ? "var(--accent-primary)"
    : "var(--semantic-danger)";
  const bg = balanced
    ? "var(--accent-primary-subtle)"
    : "var(--semantic-danger-subtle)";
  const border = balanced
    ? "var(--accent-primary-border)"
    : "var(--semantic-danger)";

  return (
    <div
      role="status"
      style={{
        padding: "14px 16px",
        borderRadius: 10,
        background: bg,
        border: `1px solid ${border}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
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
            color,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.05em",
          }}
        >
          <Scale size={14} />
          {balanced ? t("balance.balanced") : t("balance.unbalanced")}
        </div>
        {!balanced && blocksApprove && (
          <div
            style={{
              fontSize: 11,
              color: "var(--semantic-danger)",
              fontStyle: "italic",
            }}
          >
            {t("balance.blocks_validation")}
          </div>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 10,
        }}
      >
        <BalanceCell label={t("balance.assets")} value={`${check.assetsKwd} KWD`} />
        <BalanceCell
          label={t("balance.liabilities")}
          value={`${check.liabilitiesKwd} KWD`}
        />
        <BalanceCell label={t("balance.equity")} value={`${check.equityKwd} KWD`} />
        <BalanceCell
          label={t("balance.left")}
          value={`${check.leftSideKwd} KWD`}
        />
        <BalanceCell
          label={t("balance.right")}
          value={`${check.rightSideKwd} KWD`}
        />
        <BalanceCell
          label={t("balance.difference")}
          value={`${check.differenceKwd} KWD`}
          tone={balanced ? "ok" : "danger"}
        />
      </div>
      {check.note && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            fontStyle: "italic",
          }}
        >
          {check.note}
        </div>
      )}
    </div>
  );
}

function BalanceCell({ label, value, tone }) {
  const color =
    tone === "danger"
      ? "var(--semantic-danger)"
      : tone === "ok"
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
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 13,
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
