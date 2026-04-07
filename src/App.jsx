import { useRef, useState, useCallback } from "react";
import AmbientBackground from "./components/AmbientBackground";
import Header from "./components/Header";
import OwnerView from "./screens/owner/OwnerView";
import CFOView from "./screens/cfo/CFOView";
import JuniorView from "./screens/junior/JuniorView";
import { NavContext } from "./components/shared/NavContext";

export default function App() {
  const [role, setRole] = useState("Owner");

  // Active role view registers its handlers here on mount.
  const handlersRef = useRef({ setActiveScreen: () => {}, openTask: () => {} });

  const registerNav = useCallback((handlers) => {
    handlersRef.current = handlers;
  }, []);

  // Stable wrappers passed via context
  const setActiveScreen = useCallback((screen) => handlersRef.current.setActiveScreen(screen), []);
  const openTask = useCallback((id) => handlersRef.current.openTask(id), []);

  return (
    <NavContext.Provider value={{ setActiveScreen, openTask }}>
      <AmbientBackground />
      <Header role={role} setRole={setRole} />
      {role === "Owner" && <OwnerView registerNav={registerNav} />}
      {role === "CFO" && <CFOView registerNav={registerNav} />}
      {role === "Junior" && <JuniorView registerNav={registerNav} />}
    </NavContext.Provider>
  );
}
