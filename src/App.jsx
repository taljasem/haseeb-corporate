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
