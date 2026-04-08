import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "./shared/NavContext";
import { useTenant } from "./shared/TenantContext";
import { useLanguage } from "../i18n/LanguageContext";
import LtrText from "./shared/LtrText";

// DEMO ONLY — production roles come from auth
const ROLES = ["Owner", "CFO", "Junior"];

const NOTIFICATION_IDS = {
  Owner: [
    { id: "owner_1", destination: { screen: "taskbox", taskId: "TSK-120" } },
    { id: "owner_2", destination: { screen: "month-end-close" } },
    { id: "owner_3", destination: { screen: "financial-statements" } },
  ],
  CFO: [
    { id: "cfo_1", destination: { screen: "taskbox", taskId: "TSK-113" } },
    { id: "cfo_2", destination: { screen: "audit-bridge" } },
    { id: "cfo_3", destination: { screen: "bank-accounts" } },
    { id: "cfo_4", destination: { screen: "month-end-close" } },
  ],
  Junior: [
    { id: "junior_1", destination: { screen: "bank-transactions" } },
    { id: "junior_2", destination: { screen: "taskbox", taskId: "TSK-113" } },
    { id: "junior_3", destination: { screen: "taskbox", taskId: "TSK-102" } },
  ],
};
// Canonical role accent colors (match team member avatar colors)
const ROLE_COLOR = {
  Owner:  "#8B5CF6", // Tarek purple
  CFO:    "#00C48C", // You teal
  Junior: "#3B82F6", // Sara blue
};

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function Tooltip({ title, sub }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        background: "#0C0E12",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
        minWidth: 220,
        zIndex: 200,
      }}
    >
      <div style={{ fontSize: 12, color: "#E6EDF3", fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 11, color: "#5B6570", marginTop: 3 }}>{sub}</div>
    </div>
  );
}

export default function Header({ role, setRole }) {
  const { t } = useTranslation("header");
  const { language, toggleLanguage } = useLanguage();
  const [bellOpen, setBellOpen] = useState(false);
  const [unread, setUnread] = useState(true);
  const [themeTip, setThemeTip] = useState(false);
  const bellRef = useRef(null);
  const nav = useNav();
  const { tenant, tenantId, setTenantId, allTenants } = useTenant();
  const [tenantOpen, setTenantOpen] = useState(false);
  const tenantRef = useRef(null);
  useEffect(() => {
    if (!tenantOpen) return;
    const onClick = (e) => {
      if (tenantRef.current && !tenantRef.current.contains(e.target)) setTenantOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [tenantOpen]);

  useEffect(() => {
    if (!bellOpen) return;
    const onClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [bellOpen]);

  const notificationIds = NOTIFICATION_IDS[role] || NOTIFICATION_IDS.CFO;
  const bankAbbr = tenant?.banks?.[0]?.abbreviation || "KIB";
  const notifications = notificationIds.map((n) => ({
    id: n.id,
    title: t(`notifications.items.${n.id}_title`),
    body: t(`notifications.items.${n.id}_body`, { bank: bankAbbr }),
    time: t(`notifications.items.${n.id}_time`),
    destination: n.destination,
  }));

  return (
    <header
      style={{
        position: "relative",
        zIndex: 10,
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        display: "flex",
        alignItems: "center",
        height: 52,
        padding: "0 24px",
        flexShrink: 0,
        background: "rgba(5,7,10,0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Logo block */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingRight: 20,
          borderRight: "1px solid rgba(255,255,255,0.10)",
          height: "100%",
        }}
      >
        <div
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: "#00C48C",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
          }}
        >
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 11, position: "relative", zIndex: 1 }}>
            H
          </span>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, rgba(255,255,255,0.2), transparent 50%)",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 19,
            color: "#E6EDF3",
            letterSpacing: "0.02em",
          }}
        >
          {t("logo")}
        </span>
      </div>

      {/* Tenant switcher (demo control) */}
      <div ref={tenantRef} style={{ position: "relative", marginLeft: 18 }}>
        <button
          onClick={() => setTenantOpen((o) => !o)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.12em",
            color: "#5B6570",
            background: "rgba(255,255,255,0.02)",
            border: "1px dashed rgba(255,255,255,0.12)",
            borderRadius: 4,
            padding: "4px 10px",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          title={t("tenant_dev_only")}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          {t("tenant_label")} · <LtrText>{tenant.company.shortName.toUpperCase()}</LtrText>
        </button>
        {tenantOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              width: 260,
              background: "#0C0E12",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10,
              boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
              zIndex: 200,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "#5B6570",
                padding: "10px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {t("tenant_dev_only")}
            </div>
            {allTenants.map((tn) => {
              const on = tn.id === tenantId;
              const bank = tn.banks[0] || {};
              return (
                <button
                  key={tn.id}
                  onClick={() => {
                    setTenantId(tn.id);
                    setTenantOpen(false);
                  }}
                  onMouseEnter={(e) => {
                    if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!on) e.currentTarget.style.background = "transparent";
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px 14px",
                    background: on ? "rgba(0,196,140,0.06)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: bank.brandColor || "rgba(255,255,255,0.20)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: on ? "#00C48C" : "#E6EDF3", fontWeight: 500 }}>
                      <LtrText>{tn.company.name}</LtrText>
                    </div>
                    <div style={{ fontSize: 10, color: "#5B6570", marginTop: 2 }}>
                      <LtrText>{bank.name || "Standalone"}</LtrText> · {t(`distribution_modes.${(tn.distributionMode || "").replace(/-/g, "_")}`, { defaultValue: tn.distributionMode })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right cluster */}
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Role switcher — DEMO ONLY */}
        <div style={{ display: "flex", gap: 4 }}>
          {ROLES.map((r) => {
            const on = role === r;
            const color = ROLE_COLOR[r];
            return (
              <button
                key={r}
                onClick={() => setRole(r)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  padding: "4px 10px",
                  borderRadius: 4,
                  background: on ? `${color}14` : "rgba(255,255,255,0.02)",
                  border: on ? `1px solid ${color}66` : "1px solid rgba(255,255,255,0.08)",
                  color: on ? color : "#5B6570",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s ease",
                }}
              >
                {t(`role_${r.toLowerCase()}`)}
              </button>
            );
          })}
        </div>

        {/* Bell with red dot + dropdown */}
        <div ref={bellRef} style={{ position: "relative" }}>
          <button
            aria-label={t("notifications.aria_bell")}
            onClick={() => setBellOpen((o) => !o)}
            style={{
              position: "relative",
              width: 28, height: 28,
              background: "transparent",
              border: "none",
              color: "#5B6570",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BellIcon />
            {unread && (
              <span
                style={{
                  position: "absolute",
                  top: 4, right: 4,
                  width: 6, height: 6,
                  borderRadius: "50%",
                  background: "#FF5A5F",
                }}
              />
            )}
          </button>
          {bellOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 320,
                maxHeight: 480,
                background: "#0C0E12",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 10,
                boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                zIndex: 200,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "#5B6570" }}>
                  {t("notifications.title")}
                </div>
                <a
                  onClick={() => setUnread(false)}
                  style={{ fontSize: 11, color: "#00C48C", cursor: "pointer" }}
                >
                  {t("notifications.mark_all_read")}
                </a>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      setBellOpen(false);
                      const dest = n.destination || {};
                      if (dest.taskId && nav.openTask) {
                        nav.openTask(dest.taskId);
                      } else if (dest.screen && nav.setActiveScreen) {
                        nav.setActiveScreen(dest.screen);
                      }
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      cursor: "pointer",
                      transition: "background 0.12s ease",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#E6EDF3", fontWeight: 500 }}>
                      {n.title}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#5B6570",
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {n.body}
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 9,
                        color: "#5B6570",
                        marginTop: 2,
                      }}
                    >
                      {n.time}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  textAlign: "center",
                }}
              >
                <a style={{ fontSize: 11, color: "#00C48C", cursor: "pointer" }}>
                  {t("notifications.view_all_in_taskbox")} →
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <div style={{ position: "relative" }}>
          <button
            aria-label={t("notifications.aria_theme")}
            onClick={() => {
              setThemeTip(true);
              setTimeout(() => setThemeTip(false), 3000);
            }}
            style={{
              width: 28, height: 28,
              background: "transparent",
              border: "none",
              color: "#5B6570",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MoonIcon />
          </button>
          {themeTip && <Tooltip title={t("tooltip_theme_coming")} sub={t("tooltip_theme_subtext")} />}
        </div>

        {/* Language toggle */}
        <div style={{ position: "relative" }}>
          <button
            onClick={toggleLanguage}
            aria-label={t("notifications.aria_language")}
            style={{
              fontFamily: "'Noto Sans Arabic', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: language === "ar" ? "#00C48C" : "#5B6570",
              background: language === "ar" ? "rgba(0,196,140,0.10)" : "rgba(255,255,255,0.03)",
              border: language === "ar" ? "1px solid rgba(0,196,140,0.40)" : "1px solid rgba(255,255,255,0.10)",
              borderRadius: 4,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            عربي
          </button>
        </div>

        {/* Avatar */}
        <div
          style={{
            width: 26, height: 26,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#5B6570",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          T
        </div>
      </div>
    </header>
  );
}
