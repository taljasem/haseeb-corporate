// ContactsScreen — Phase 5 (2026-04-21): top-level "Contacts" surface
// extracted from SetupScreen. Hosts the Vendors + Customers KYC admin
// tabs that used to live inside SetupScreen (sections "vendors" and
// "customers"). KYC is the capability within each tab — CR number,
// expiry, civil ID, KYC notes — not a separate section.
//
// Role model (midsize):
//   Owner  — read-only access
//   CFO    — edit
//   Senior — edit (shares CFO view)
//   Junior — no access (defense-in-depth empty state; routing in
//            OwnerView/CFOView is the primary gate)

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Briefcase, Users2, Lock, AlertTriangle } from "lucide-react";
import EmptyState from "../../components/shared/EmptyState";
import { useTenant } from "../../components/shared/TenantContext";
import { normalizeRole, canEditAdmin, canAccessAdmin } from "../../utils/role";
import PartyKycSection from "../../components/setup/PartyKycSection";

const TABS = [
  { id: "vendors",   icon: Briefcase, kind: "vendor"   },
  { id: "customers", icon: Users2,    kind: "customer" },
];

export default function ContactsScreen({ role: roleRaw = "CFO" }) {
  const { t } = useTranslation("contacts");
  const { tenant } = useTenant();
  const [active, setActive] = useState("vendors");

  const role = normalizeRole(roleRaw);
  const readOnly = !canEditAdmin(role);

  // Junior does NOT see Contacts. Primary gate is routing (JuniorView
  // has no Contacts case), this is defense-in-depth.
  if (!canAccessAdmin(role)) {
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "36px 28px" }}>
        <div style={{ maxWidth: 560, margin: "60px auto 0" }}>
          <EmptyState
            icon={Lock}
            title={t("no_access_title")}
            description={t("no_access_description")}
          />
        </div>
      </div>
    );
  }

  const activeTab = TABS.find((x) => x.id === active) || TABS[0];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        style={{
          padding: "22px 28px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "linear-gradient(180deg, rgba(0,196,140,0.10) 0%, transparent 100%)",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--accent-primary)" }}>
          {t("view_label")}
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "var(--text-primary)", letterSpacing: "-0.3px", marginTop: 2, lineHeight: 1 }}>
          {t("title")}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 6 }}>
          {t("subtitle", { tenant: tenant?.company?.shortName || "" })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 32px", minWidth: 0 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {readOnly && (
            <div
              role="status"
              style={{
                marginBottom: 14,
                padding: "10px 14px",
                background: "var(--semantic-warning-subtle)",
                border: "1px solid var(--semantic-warning)",
                borderRadius: 8,
                color: "var(--semantic-warning)",
                fontSize: 12,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertTriangle size={14} />
              <span>{t("readonly_banner")}</span>
            </div>
          )}

          {/* Tab pills — matches the sub-section tab idiom used elsewhere
              (transparent idle + accent-primary-subtle active). */}
          <div
            role="tablist"
            aria-label={t("tabs_aria_label")}
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            {TABS.map((tab) => {
              const on = tab.id === active;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(tab.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: on
                      ? "1px solid var(--accent-primary-border)"
                      : "1px solid var(--border-default)",
                    background: on
                      ? "var(--accent-primary-subtle)"
                      : "transparent",
                    color: on
                      ? "var(--accent-primary)"
                      : "var(--text-secondary)",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    transition: "all 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!on) e.currentTarget.style.background = "var(--bg-surface-sunken)";
                  }}
                  onMouseLeave={(e) => {
                    if (!on) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Icon size={13} strokeWidth={2} />
                  <span>{t(`tabs.${tab.id}`)}</span>
                </button>
              );
            })}
          </div>

          <PartyKycSection kind={activeTab.kind} readOnly={readOnly} />
        </div>
      </div>
    </div>
  );
}
