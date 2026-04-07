import { useState } from "react";
import AmbientBackground from "./components/AmbientBackground";
import Header from "./components/Header";
import OwnerView from "./screens/owner/OwnerView";
import CFOView from "./screens/cfo/CFOView";
import JuniorView from "./screens/junior/JuniorView";

function ComingNextPlaceholder({ role }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        zIndex: 1,
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          padding: "32px 36px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 10,
          textAlign: "center",
        }}
      >
        <div className="section-label" style={{ marginBottom: 10 }}>
          {role.toUpperCase()} VIEW
        </div>
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 36,
            color: "#E6EDF3",
            letterSpacing: "-0.5px",
            marginBottom: 12,
          }}
        >
          COMING NEXT.
        </div>
        <div style={{ fontSize: 14, color: "#8B98A5", lineHeight: 1.65 }}>
          The owner and CFO views are the foundation — the junior view builds on
          the same architecture.
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState("Owner");
  const [tab, setTab] = useState("owner");

  return (
    <>
      <AmbientBackground />
      <Header role={role} setRole={setRole} tab={tab} setTab={setTab} />
      {role === "Owner" && <OwnerView />}
      {role === "CFO" && <CFOView />}
      {role === "Junior" && <JuniorView />}
    </>
  );
}
