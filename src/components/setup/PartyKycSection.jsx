// PartyKycSection — extracted from SetupScreen during Phase 5 (Contacts
// extraction, 2026-04-21). This is the Vendors+Customers KYC admin surface
// (CR number / expiry / civil ID / KYC notes). Consumed by ContactsScreen.
//
// The i18n namespace stays "setup" because the translation keys
// (vendors.*, customers.*, kyc_chip.*, kyc_modal.*) have not moved —
// they're still the source of truth for this component's copy, and
// KYCEditModal also reads from "setup". Keeping the namespace avoids a
// copy-and-parity pass on ~50 keys for a pure file-structure refactor.

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, Search, Edit3, AlertTriangle, X as XIcon, Briefcase, Users2,
} from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import LtrText from "../shared/LtrText";
import EmptyState from "../shared/EmptyState";
import {
  listVendors,
  deactivateVendor,
  listCustomers,
  deactivateCustomer,
} from "../../engine";
import KYCEditModal from "./KYCEditModal";

// ── local helpers (also extracted from SetupScreen) ──────────────────

function Card({ title, description, extra, children }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "20px 22px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: description ? 4 : 14, gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", letterSpacing: "-0.2px", lineHeight: 1.1 }}>{title}</div>
          {description && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>{description}</div>}
        </div>
        {extra}
      </div>
      {description && <div style={{ height: 10 }} />}
      {children}
    </div>
  );
}

function Toast({ text, onClear }) {
  useEffect(() => { if (!text) return; const id = setTimeout(() => onClear && onClear(), 2500); return () => clearTimeout(id); }, [text, onClear]);
  if (!text) return null;
  return <div style={{ marginBottom: 14, background: "var(--accent-primary-subtle)", border: "1px solid var(--accent-primary-border)", color: "var(--accent-primary)", padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500 }}>{text}</div>;
}

const btnMini = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-default)",
  padding: "6px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
  fontFamily: "inherit",
};
const btnPrimary = (l) => ({ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 6, cursor: l ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" });

function _daysUntil(iso) {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function ExpiryChip({ row }) {
  const { t } = useTranslation("setup");
  const days = _daysUntil(row.crExpiryDate);
  if (row.crExpiryDate == null) {
    return (
      <span
        style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
          padding: "2px 8px", borderRadius: 10,
          background: "var(--bg-surface)",
          color: "var(--text-tertiary)",
          border: "1px solid var(--border-default)",
        }}
      >
        {t("kyc_chip.no_cr_tracked")}
      </span>
    );
  }
  if (days <= 0) {
    return (
      <span
        style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
          padding: "2px 8px", borderRadius: 10,
          background: "var(--semantic-danger-subtle)",
          color: "var(--semantic-danger)",
          border: "1px solid var(--semantic-danger)",
        }}
      >
        {t("kyc_chip.expired")}
      </span>
    );
  }
  if (days <= 30) {
    return (
      <span
        style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
          padding: "2px 8px", borderRadius: 10,
          background: "var(--semantic-warning-subtle)",
          color: "var(--semantic-warning)",
          border: "1px solid var(--semantic-warning)",
        }}
      >
        {t("kyc_chip.expiring_in_days", { count: days })}
      </span>
    );
  }
  return null;
}

function DetailField({ label, children }) {
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
      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
        {children}
      </div>
    </div>
  );
}

// ── main export ──────────────────────────────────────────────────────

export default function PartyKycSection({ kind = "vendor", readOnly = false }) {
  const { t } = useTranslation("setup");
  const isCustomer = kind === "customer";
  const ns = isCustomer ? "customers" : "vendors";

  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);
  const [modalState, setModalState] = useState({
    open: false,
    mode: "create",
    row: null,
  });
  const [drawerRow, setDrawerRow] = useState(null);

  const list = isCustomer ? listCustomers : listVendors;
  const deactivate = isCustomer ? deactivateCustomer : deactivateVendor;

  const reload = async () => {
    setLoadError(null);
    try {
      const filters = {};
      if (search.trim()) filters.search = search.trim();
      const result = await list(filters);
      setRows(Array.isArray(result) ? result : []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t(`${ns}.error_load`));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, kind]);

  const handleDeactivate = async (row) => {
    try {
      await deactivate(row.id);
      setToast(t(`${ns}.deactivated_toast`));
      reload();
      setDrawerRow(null);
    } catch (err) {
      setToast(err?.message || t(`${ns}.error_deactivate`));
    }
  };

  return (
    <Card
      title={t(`${ns}.title`)}
      description={t(`${ns}.description`)}
      extra={
        <button
          onClick={() =>
            setModalState({ open: true, mode: "create", row: null })
          }
          disabled={readOnly}
          style={{
            ...btnPrimary(false),
            opacity: readOnly ? 0.5 : 1,
            cursor: readOnly ? "not-allowed" : "pointer",
          }}
        >
          <Plus
            size={13}
            style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
          />
          {t(`${ns}.new`)}
        </button>
      }
    >
      <Toast text={toast} onClear={() => setToast(null)} />

      <div style={{ marginBottom: 12 }}>
        <div style={{ position: "relative" }}>
          <Search
            size={13}
            color="var(--text-tertiary)"
            style={{
              position: "absolute",
              insetInlineStart: 10,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(`${ns}.search_placeholder`)}
            style={{
              width: "100%",
              background: "var(--bg-surface-sunken)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              padding: "8px 12px 8px 30px",
              color: "var(--text-primary)",
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
        </div>
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
          icon={isCustomer ? Users2 : Briefcase}
          title={t(`${ns}.empty_title`)}
          description={t(`${ns}.empty_description`)}
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
          {/* Header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1.2fr 0.9fr 0.8fr 90px",
              gap: 10,
              padding: "10px 18px",
              background: "var(--bg-surface-sunken)",
              borderBottom: "1px solid var(--border-default)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: "var(--text-tertiary)",
            }}
          >
            <div>{t(`${ns}.col_name`)}</div>
            <div>{t(`${ns}.col_email`)}</div>
            <div>{t(`${ns}.col_cr`)}</div>
            <div>{t(`${ns}.col_expiry`)}</div>
            <div />
          </div>

          {rows.map((row, idx) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1.2fr 0.9fr 0.8fr 90px",
                gap: 10,
                padding: "12px 18px",
                borderBottom:
                  idx === rows.length - 1
                    ? "none"
                    : "1px solid var(--border-subtle)",
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.nameEn || row.id}
                </div>
                {row.nameAr && (
                  <div
                    dir="rtl"
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    {row.nameAr}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <LtrText>{row.email || "—"}</LtrText>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                <LtrText>{row.crNumber || "—"}</LtrText>
              </div>
              <div>
                <ExpiryChip row={row} />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setDrawerRow(row)}
                  style={{ ...btnMini, padding: "6px 10px" }}
                  aria-label={t(`${ns}.action_view`)}
                  title={t(`${ns}.action_view`)}
                >
                  {t(`${ns}.action_view`)}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {drawerRow && (
        <PartyKycDetailDrawer
          row={drawerRow}
          kind={kind}
          readOnly={readOnly}
          onClose={() => setDrawerRow(null)}
          onEdit={() => {
            setModalState({ open: true, mode: "edit", row: drawerRow });
            setDrawerRow(null);
          }}
          onDeactivate={() => handleDeactivate(drawerRow)}
        />
      )}

      <KYCEditModal
        open={modalState.open}
        mode={modalState.mode}
        kind={kind}
        row={modalState.row}
        onClose={() =>
          setModalState({ open: false, mode: "create", row: null })
        }
        onSaved={() => {
          reload();
          setToast(
            modalState.mode === "edit"
              ? t(`${ns}.saved_edit_toast`)
              : t(`${ns}.saved_create_toast`),
          );
        }}
      />
    </Card>
  );
}

function PartyKycDetailDrawer({
  row,
  kind,
  readOnly,
  onClose,
  onEdit,
  onDeactivate,
}) {
  const { t } = useTranslation("setup");
  const isCustomer = kind === "customer";
  const ns = isCustomer ? "customers" : "vendors";
  useEscapeKey(onClose, !!row);

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
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t(`${ns}.detail_label`)}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.nameEn || row.id}
            </div>
            {row.nameAr && (
              <div
                dir="rtl"
                style={{
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                  marginTop: 2,
                }}
              >
                {row.nameAr}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t("kyc_modal.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <XIcon size={18} />
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
          <DetailField label={t("kyc_modal.field_email")}>
            <LtrText>{row.email || "—"}</LtrText>
          </DetailField>
          <DetailField label={t("kyc_modal.field_phone")}>
            <LtrText>{row.phone || "—"}</LtrText>
          </DetailField>

          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "var(--accent-primary)",
              padding: "10px 0 4px",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            {t("kyc_modal.section_kyc")}
          </div>

          <DetailField label={t("kyc_modal.field_cr_number")}>
            <LtrText>
              <span style={{ fontFamily: "'DM Mono', monospace" }}>
                {row.crNumber || "—"}
              </span>
            </LtrText>
          </DetailField>
          <DetailField label={t("kyc_modal.field_cr_issued_at")}>
            <LtrText>
              <span style={{ fontFamily: "'DM Mono', monospace" }}>
                {row.crIssuedAt || "—"}
              </span>
            </LtrText>
          </DetailField>
          <DetailField label={t("kyc_modal.field_cr_expiry_date")}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <LtrText>
                <span style={{ fontFamily: "'DM Mono', monospace" }}>
                  {row.crExpiryDate || "—"}
                </span>
              </LtrText>
              <ExpiryChip row={row} />
            </div>
          </DetailField>
          <DetailField label={t("kyc_modal.field_civil_id_number")}>
            <LtrText>
              <span style={{ fontFamily: "'DM Mono', monospace" }}>
                {row.civilIdNumber || "—"}
              </span>
            </LtrText>
          </DetailField>
          <DetailField label={t("kyc_modal.field_kyc_notes")}>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {row.kycNotes || "—"}
            </div>
          </DetailField>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            padding: "14px 22px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <button
            onClick={onDeactivate}
            disabled={readOnly}
            style={{
              ...btnMini,
              color: "var(--semantic-danger)",
              borderColor: "var(--semantic-danger-border)",
              opacity: readOnly ? 0.5 : 1,
              cursor: readOnly ? "not-allowed" : "pointer",
            }}
          >
            {t(`${ns}.action_deactivate`)}
          </button>
          <button
            onClick={onEdit}
            disabled={readOnly}
            style={{
              ...btnPrimary(false),
              opacity: readOnly ? 0.5 : 1,
              cursor: readOnly ? "not-allowed" : "pointer",
            }}
          >
            <Edit3
              size={12}
              style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
            />
            {t(`${ns}.edit_kyc`)}
          </button>
        </div>
      </div>
    </>
  );
}
