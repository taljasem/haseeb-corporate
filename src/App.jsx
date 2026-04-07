import { useState } from "react";
import AmbientBackground from "./components/AmbientBackground";
import Header from "./components/Header";
import HeroBand from "./components/HeroBand";
import AminahChat from "./components/AminahChat";
import IntelligenceStream from "./components/IntelligenceStream";
import TransactionFeed from "./components/TransactionFeed";

function ComingNextPlaceholder({ role, tab }) {
  const label = tab === "bookkeeping" ? "BOOKKEEPING" : `${role.toUpperCase()} VIEW`;
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
          {label}
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
        <div
          style={{
            fontSize: 14,
            color: "#8B98A5",
            lineHeight: 1.65,
          }}
        >
          The owner view is the foundation — once locked, the CFO and Junior
          views build on the same architecture.
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState("Owner");
  const [tab, setTab] = useState("owner");

  const isOwner = role === "Owner" && tab === "owner";

  return (
    <>
      <AmbientBackground />
      <Header role={role} setRole={setRole} tab={tab} setTab={setTab} />
      {isOwner ? (
        <div
          className="view-enter"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            zIndex: 1,
            overflow: "hidden",
          }}
        >
          <HeroBand />
          <div
            style={{
              flex: 1,
              display: "flex",
              overflow: "hidden",
              alignItems: "stretch",
            }}
          >
            <AminahChat />
            <IntelligenceStream />
            <TransactionFeed />
          </div>
        </div>
      ) : (
        <ComingNextPlaceholder role={role} tab={tab} />
      )}
    </>
  );
}
