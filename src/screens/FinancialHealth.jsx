import { useEffect, useState } from "react";
import { formatKWD } from "../utils/format";
import {
  getCashPosition,
  getRevenueSummary,
  getProfitability,
  getARTotal,
  getAPTotal,
  getCategorizationCoverage,
  getEngineAlerts,
} from "../engine/mockEngine";

const Label = ({ children }) => (
  <div className="text-[10px] uppercase tracking-widest text-tertiary mb-3">
    {children}
  </div>
);

const BigNumber = ({ children }) => (
  <div className="font-mono text-4xl font-medium tracking-tight tabular-nums text-primary">
    {children}
  </div>
);

const Card = ({ children }) => (
  <div className="bg-surface border border-token border-token-hover transition-colors rounded-lg p-6 min-h-[170px]">
    {children}
  </div>
);

const Skeleton = ({ w = "60%", h = "2.25rem" }) => (
  <div className="skeleton" style={{ width: w, height: h }} />
);

const severityDot = (sev) => {
  const map = {
    critical: "#FD361C",
    warning: "#D4A84B",
    info: "#6aa3ff",
  };
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ background: map[sev] || "#888" }}
    />
  );
};

export default function FinancialHealth() {
  const [data, setData] = useState({
    cash: null,
    rev: null,
    prof: null,
    ar: null,
    ap: null,
    cov: null,
    alerts: null,
  });

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getCashPosition(),
      getRevenueSummary(),
      getProfitability(),
      getARTotal(),
      getAPTotal(),
      getCategorizationCoverage(),
      getEngineAlerts(),
    ]).then(([cash, rev, prof, ar, ap, cov, alerts]) => {
      if (!mounted) return;
      setData({ cash, rev, prof, ar, ap, cov, alerts });
    });
    return () => {
      mounted = false;
    };
  }, []);

  const revDelta =
    data.rev && data.rev.lastMonth
      ? ((data.rev.thisMonth - data.rev.lastMonth) / data.rev.lastMonth) * 100
      : null;
  const revUp = revDelta != null && revDelta >= 0;

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto w-full">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-widest text-tertiary">
          Financial Health
        </div>
        <h1 className="text-2xl font-medium text-primary mt-1">
          Snapshot
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Cash Position */}
        <Card>
          <Label>Cash Position</Label>
          {data.cash ? (
            <>
              <BigNumber>{formatKWD(data.cash.total)}</BigNumber>
              <div className="mt-4 space-y-1.5">
                {data.cash.accounts.map((a) => (
                  <div
                    key={a.name}
                    className="flex justify-between text-xs text-secondary"
                  >
                    <span>{a.name}</span>
                    <span className="font-mono tabular-nums">
                      {formatKWD(a.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Skeleton w="70%" />
          )}
        </Card>

        {/* Revenue */}
        <Card>
          <Label>Revenue This Month</Label>
          {data.rev ? (
            <>
              <BigNumber>{formatKWD(data.rev.thisMonth)}</BigNumber>
              <div className="mt-4 text-xs text-secondary flex items-center gap-2">
                <span
                  className="font-mono tabular-nums"
                  style={{ color: revUp ? "#00A684" : "#FD361C" }}
                >
                  {revUp ? "▲" : "▼"} {Math.abs(revDelta).toFixed(1)}%
                </span>
                <span className="text-tertiary">vs last month</span>
              </div>
              <div className="text-[11px] text-tertiary mt-1 font-mono tabular-nums">
                Last month: {formatKWD(data.rev.lastMonth)}
              </div>
            </>
          ) : (
            <Skeleton w="70%" />
          )}
        </Card>

        {/* Net Income */}
        <Card>
          <Label>Net Income This Month</Label>
          {data.prof ? (
            <>
              <BigNumber>{formatKWD(data.prof.netIncome)}</BigNumber>
              <div className="mt-4 text-xs text-secondary space-y-1">
                <div className="flex justify-between">
                  <span className="text-tertiary">Gross margin</span>
                  <span className="font-mono tabular-nums">
                    {(data.prof.grossMargin * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tertiary">Operating margin</span>
                  <span className="font-mono tabular-nums">
                    {(data.prof.operatingMargin * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </>
          ) : (
            <Skeleton w="70%" />
          )}
        </Card>

        {/* AR */}
        <Card>
          <Label>Accounts Receivable</Label>
          {data.ar ? (
            <>
              <BigNumber>{formatKWD(data.ar.total)}</BigNumber>
              <div
                className="mt-4 text-xs font-mono tabular-nums"
                style={{ color: "#FD361C" }}
              >
                {formatKWD(data.ar.overdue)} overdue
              </div>
            </>
          ) : (
            <Skeleton w="70%" />
          )}
        </Card>

        {/* AP */}
        <Card>
          <Label>Accounts Payable</Label>
          {data.ap ? (
            <>
              <BigNumber>{formatKWD(data.ap.total)}</BigNumber>
              <div
                className="mt-4 text-xs font-mono tabular-nums"
                style={{ color: "#D4A84B" }}
              >
                {formatKWD(data.ap.dueSoon)} due soon
              </div>
            </>
          ) : (
            <Skeleton w="70%" />
          )}
        </Card>
      </div>

      {/* Coverage strip */}
      <div className="mt-6 bg-surface border border-token rounded-lg p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Label>Snapshot Completeness</Label>
            {data.cov ? (
              <div className="text-sm text-secondary">
                <span className="font-mono tabular-nums text-primary text-base">
                  {data.cov.percentage}%
                </span>
                <span className="mx-2 text-tertiary">—</span>
                <span className="font-mono tabular-nums">
                  {data.cov.categorized} of {data.cov.total}
                </span>{" "}
                transactions categorized,{" "}
                <span className="font-mono tabular-nums">
                  {data.cov.pending}
                </span>{" "}
                pending
              </div>
            ) : (
              <Skeleton w="320px" h="1rem" />
            )}
          </div>
          {data.cov && (
            <div className="w-full sm:w-64 h-1.5 bg-white/5 rounded overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${data.cov.percentage}%`,
                  background: "#00A684",
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Engine alerts */}
      <div className="mt-6">
        <Label>Engine Alerts</Label>
        <div className="bg-surface border border-token rounded-lg divide-y divide-white/5">
          {data.alerts
            ? data.alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  {severityDot(a.severity)}
                  <div className="flex-1 text-sm text-secondary">
                    {a.message}
                  </div>
                  <div className="text-[9px] uppercase tracking-widest text-tertiary border border-token rounded px-2 py-0.5">
                    Engine
                  </div>
                </div>
              ))
            : Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5">
                  <Skeleton w="60%" h="1rem" />
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
