import HeroBand from "../../components/HeroBand";
import AminahChat from "../../components/AminahChat";
import IntelligenceStream from "../../components/IntelligenceStream";
import TransactionFeed from "../../components/TransactionFeed";

export default function OwnerView() {
  return (
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
  );
}
