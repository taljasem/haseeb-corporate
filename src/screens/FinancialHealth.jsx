import AminahChat from "../components/AminahChat";
import AminahStream from "../components/AminahStream";
import TransactionFeed from "../components/TransactionFeed";

export default function FinancialHealth() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        overflow: "hidden",
        alignItems: "stretch",
      }}
    >
      <AminahChat />
      <AminahStream />
      <TransactionFeed />
    </div>
  );
}
