import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Shuffle, Plus, AlertTriangle } from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import BulkReclassProposalModal from "../../components/bulk-reclass/BulkReclassProposalModal";
import BulkReclassPreviewDrawer from "../../components/bulk-reclass/BulkReclassPreviewDrawer";
import {
  listBulkReclassifications,
  getBulkReclassification,
  getAccountsFlat,
} from "../../engine";

// Status → color mapping. Conservative pattern: APPROVED rendered in
// accent-primary (locked, ready to post); PREVIEWED in semantic-warning
// (high-stakes next step); CANCELLED in text-tertiary.
const STATUS_COLORS = {
  DRAFT: { color: "var(--text-secondary)", bg: "var(--bg-surface)" },
  PREVIEWED: {
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
  CANCELLED: { color: "var(--text-tertiary)", bg: "var(--bg-surface-sunken)" },
};

const STATUS_FILTERS = [
  "ALL",
  "DRAFT",
  "PREVIEWED",
  "APPROVED",
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

export default function BulkReclassScreen({ role = "CFO" }) {
  const { t } = useTranslation("bulk-reclass");
  const [rows, setRows] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reloadList = async () => {
    setLoadError(null);
    try {
      const filters = statusFilter === "ALL" ? {} : { status: statusFilter };
      const list = await listBulkReclassifications(filters);
      setRows(list || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t("error_load"));
    }
  };

  const refreshSelected = async () => {
    if (!selectedProposal) return;
    try {
      const fresh = await getBulkReclassification(selectedProposal.id);
      setSelectedProposal(fresh);
    } catch {
      // Refresh failure non-blocking — keep the stale selection.
    }
    reloadList();
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

  const openProposal = async (proposal) => {
    // Fetch fresh detail so we get .lines populated if already PREVIEWED.
    try {
      const fresh = await getBulkReclassification(proposal.id);
      setSelectedProposal(fresh || proposal);
    } catch {
      setSelectedProposal(proposal);
    }
  };

  const accountLabel = (id) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.code} — ${a.nameEn}` : id;
  };

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
            onClick={() => setProposalModalOpen(true)}
            style={btnPrimary(false)}
          >
            <Plus
              size={13}
              style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
            />
            {t("new_proposal")}
          </button>
        </div>

        <Toast text={toast} onClear={() => setToast(null)} />

        {/* Status filter pills */}
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
                    ? "rgba(0,196,140,0.30)"
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
            icon={Shuffle}
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
                <div
                  key={row.id}
                  onClick={() => openProposal(row)}
                  style={{
                    padding: "14px 18px",
                    borderBottom:
                      idx === rows.length - 1
                        ? "none"
                        : "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 14,
                    background:
                      selectedProposal?.id === row.id
                        ? "var(--bg-surface-sunken)"
                        : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedProposal?.id !== row.id) {
                      e.currentTarget.style.background =
                        "var(--bg-surface-sunken)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedProposal?.id !== row.id) {
                      e.currentTarget.style.background = "transparent";
                    }
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
                        {row.description}
                      </div>
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
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 14,
                        marginTop: 6,
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                      }}
                    >
                      <div>
                        {t("row.from_label")}:{" "}
                        <LtrText>
                          <span
                            style={{
                              color: "var(--text-secondary)",
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {accountLabel(row.fromAccountId)}
                          </span>
                        </LtrText>
                      </div>
                      <div>
                        {t("row.to_label")}:{" "}
                        <LtrText>
                          <span
                            style={{
                              color: "var(--text-secondary)",
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {accountLabel(row.toAccountId)}
                          </span>
                        </LtrText>
                      </div>
                      {(row.dateFrom || row.dateTo) && (
                        <div>
                          {t("row.dates_label")}:{" "}
                          <LtrText>
                            <span
                              style={{
                                color: "var(--text-secondary)",
                                fontFamily: "'DM Mono', monospace",
                              }}
                            >
                              {row.dateFrom || "—"} → {row.dateTo || "—"}
                            </span>
                          </LtrText>
                        </div>
                      )}
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
                </div>
              );
            })}
          </div>
        )}

        <BulkReclassProposalModal
          open={proposalModalOpen}
          accounts={accounts}
          onClose={() => setProposalModalOpen(false)}
          onSaved={() => {
            reloadList();
            setToast(t("proposal_created_toast"));
          }}
        />

        <BulkReclassPreviewDrawer
          open={!!selectedProposal}
          proposal={selectedProposal}
          accounts={accounts}
          onClose={() => setSelectedProposal(null)}
          onUpdated={refreshSelected}
          setToast={setToast}
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
