import { useEffect, useState } from "react";
import FinancialHealth from "./screens/FinancialHealth";

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);
  return now;
}

function TopBar() {
  const now = useNow();
  const date = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <header className="border-b border-token bg-bg">
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="text-primary uppercase"
            style={{
              fontFamily: '"Bebas Neue", "DM Sans", sans-serif',
              letterSpacing: "0.18em",
              fontSize: "1.25rem",
              lineHeight: 1,
            }}
          >
            Al Manara Trading Co.
          </div>
          <span className="text-[9px] uppercase tracking-widest text-tertiary border border-token rounded px-2 py-0.5">
            Owner View
          </span>
        </div>
        <div className="text-xs text-secondary font-mono tabular-nums">
          {date} · {time}
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-bg">
      <TopBar />
      <main>
        <FinancialHealth />
      </main>
    </div>
  );
}
