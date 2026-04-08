import { useRef, useState, useCallback } from "react";
import AmbientBackground from "./components/AmbientBackground";
import Header from "./components/Header";
import OwnerView from "./screens/owner/OwnerView";
import CFOView from "./screens/cfo/CFOView";
import JuniorView from "./screens/junior/JuniorView";
import { NavContext } from "./components/shared/NavContext";
import { TenantProvider, useTenant } from "./components/shared/TenantContext";
import "./i18n";
import { LanguageProvider } from "./i18n/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import MobileDrawer from "./components/shared/MobileDrawer";
import OwnerSidebar from "./components/owner/OwnerSidebar";
import CFOSidebar from "./components/cfo/CFOSidebar";
import JuniorSidebar from "./components/junior/JuniorSidebar";
import { useTranslation } from "react-i18next";

const ROLES = ["Owner", "CFO", "Junior"];
const ROLE_COLOR = {
  Owner: "var(--role-owner)",
  CFO: "var(--accent-primary)",
  Junior: "var(--semantic-info)",
};

function DrawerRoleSwitcher({ role, setRole, onClose }) {
  const { t } = useTranslation("header");
  return (
    <div
      style={{
        borderTop: "1px solid var(--border-subtle)",
        padding: "14px 16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
        }}
      >
        ROLE
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {ROLES.map((r) => {
          const on = role === r;
          const color = ROLE_COLOR[r];
          return (
            <button
              key={r}
              onClick={() => {
                setRole(r);
                onClose && onClose();
              }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                padding: "8px 14px",
                borderRadius: 6,
                background: on ? `color-mix(in srgb, ${color} 10%, transparent)` : "var(--bg-surface-sunken)",
                border: on ? `1px solid ${color}` : "1px solid var(--border-default)",
                color: on ? color : "var(--text-secondary)",
                cursor: "pointer",
                fontFamily: "inherit",
                minHeight: 36,
              }}
            >
              {t(`role_${r.toLowerCase()}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AppInner() {
  const [role, setRoleState] = useState("Owner");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerActiveScreen, setDrawerActiveScreen] = useState("today");
  const setRole = useCallback((r) => {
    setRoleState(r);
    setDrawerActiveScreen("today");
  }, []);
  const { tenantId } = useTenant();

  // Active role view registers its handlers here on mount.
  const handlersRef = useRef({ setActiveScreen: () => {}, openTask: () => {} });
  const registerNav = useCallback((handlers) => {
    handlersRef.current = handlers;
  }, []);
  const setActiveScreen = useCallback((screen) => {
    handlersRef.current.setActiveScreen(screen);
    setDrawerActiveScreen(screen);
    setDrawerOpen(false);
  }, []);
  const openTask = useCallback((id) => handlersRef.current.openTask(id), []);

  // Remount the active role view when tenant changes so branded data refetches.
  const viewKey = `${role}-${tenantId}`;

  return (
    <NavContext.Provider value={{ setActiveScreen, openTask }}>
      <AmbientBackground />
      <Header role={role} setRole={setRole} onOpenDrawer={() => setDrawerOpen(true)} />
      {role === "Owner" && <OwnerView key={viewKey} registerNav={registerNav} />}
      {role === "CFO" && <CFOView key={viewKey} registerNav={registerNav} />}
      {role === "Junior" && <JuniorView key={viewKey} registerNav={registerNav} />}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {role === "Owner" && (
          <OwnerSidebar active={drawerActiveScreen} setActive={setActiveScreen} />
        )}
        {role === "CFO" && (
          <CFOSidebar active={drawerActiveScreen} setActive={setActiveScreen} />
        )}
        {role === "Junior" && (
          <JuniorSidebar active={drawerActiveScreen} setActive={setActiveScreen} />
        )}
        <DrawerRoleSwitcher role={role} setRole={setRole} onClose={() => setDrawerOpen(false)} />
      </MobileDrawer>
    </NavContext.Provider>
  );
}

export default function App() {
  return (
    <TenantProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AppInner />
        </ThemeProvider>
      </LanguageProvider>
    </TenantProvider>
  );
}
