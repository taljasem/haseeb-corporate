import { useState } from "react";
import AmbientBackground from "./components/AmbientBackground";
import Header from "./components/Header";
import OwnerView from "./screens/owner/OwnerView";
import CFOView from "./screens/cfo/CFOView";
import JuniorView from "./screens/junior/JuniorView";

export default function App() {
  const [role, setRole] = useState("Owner");

  return (
    <>
      <AmbientBackground />
      <Header role={role} setRole={setRole} />
      {role === "Owner" && <OwnerView />}
      {role === "CFO" && <CFOView />}
      {role === "Junior" && <JuniorView />}
    </>
  );
}
