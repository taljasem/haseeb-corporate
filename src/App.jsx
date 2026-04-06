import { useState } from "react";
import AmbientBackground from "./components/AmbientBackground";
import Header from "./components/Header";
import HeroBand from "./components/HeroBand";
import FinancialHealth from "./screens/FinancialHealth";

function ComingNext({ label }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          className="section-label"
          style={{ marginBottom: 8 }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 48,
            color: "#E6EDF3",
            letterSpacing: "-1px",
          }}
        >
          COMING NEXT.
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
          <FinancialHealth />
        </div>
      ) : (
        <ComingNext
          label={
            tab === "bookkeeping"
              ? "BOOKKEEPING"
              : `${role.toUpperCase()} VIEW`
          }
        />
      )}
    </>
  );
}
