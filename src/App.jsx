import { useRef, useState, useCallback } from "react";
import AmbientBackground from "./components/AmbientBackground";
import Header from "./components/Header";
import OwnerView from "./screens/owner/OwnerView";
import CFOView from "./screens/cfo/CFOView";
import JuniorView from "./screens/junior/JuniorView";
import { NavContext } from "./components/shared/NavContext";
import { TenantProvider, useTenant } from "./components/shared/TenantContext";

function AppInner() {
  const [role, setRole] = useState("Owner");
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
      {role === "Owner" && <OwnerView key={viewKey} registerNav={registerNav} />}
      {role === "CFO" && <CFOView key={viewKey} registerNav={registerNav} />}
      {role === "Junior" && <JuniorView key={viewKey} registerNav={registerNav} />}
    </NavContext.Provider>
  );
}

export default function App() {
  return (
    <TenantProvider>
      <AppInner />
    </TenantProvider>
  );
}
