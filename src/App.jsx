import { useRef, useState, useCallback, useEffect, lazy, Suspense } from "react";
import AmbientBackground from "./components/AmbientBackground";
import Header from "./components/Header";
import { setCurrentRole } from "./engine/mockEngine";
const OwnerView = lazy(() => import("./screens/owner/OwnerView"));
const CFOView = lazy(() => import("./screens/cfo/CFOView"));
const JuniorView = lazy(() => import("./screens/junior/JuniorView"));
import { NavContext } from "./components/shared/NavContext";
import { TenantProvider, useTenant } from "./components/shared/TenantContext";
import "./i18n";
import { LanguageProvider } from "./i18n/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import DesktopOnlyGate from "./components/shared/DesktopOnlyGate";

function ViewFallback() {
  return <div style={{ flex: 1 }} />;
}

function AppInner() {
  const [role, setRole] = useState("Owner");
  useEffect(() => { setCurrentRole(role); }, [role]);
  const { tenantId } = useTenant();

  // Active role view registers its handlers here on mount.
  const handlersRef = useRef({ setActiveScreen: () => {}, openTask: () => {} });
  const registerNav = useCallback((handlers) => {
    handlersRef.current = handlers;
  }, []);
  const setActiveScreen = useCallback((screen) => handlersRef.current.setActiveScreen(screen), []);
  const openTask = useCallback((id) => handlersRef.current.openTask(id), []);

  // Remount the active role view when tenant changes so branded data refetches.
  const viewKey = `${role}-${tenantId}`;

  return (
    <NavContext.Provider value={{ setActiveScreen, openTask }}>
      <AmbientBackground />
      <Header role={role} setRole={setRole} />
      <Suspense fallback={<ViewFallback />}>
        {role === "Owner" && <OwnerView key={viewKey} registerNav={registerNav} />}
        {role === "CFO" && <CFOView key={viewKey} registerNav={registerNav} />}
        {role === "Junior" && <JuniorView key={viewKey} registerNav={registerNav} />}
      </Suspense>
    </NavContext.Provider>
  );
}

export default function App() {
  return (
    <TenantProvider>
      <LanguageProvider>
        <ThemeProvider>
          <DesktopOnlyGate />
          <AppInner />
        </ThemeProvider>
      </LanguageProvider>
    </TenantProvider>
  );
}
