import { formatKWD } from "./format";

export function formatUSD(amount) {
  const n = Number(amount || 0);
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `USD ${formatted}`;
}

/** Render a money value using the correct formatter for the currency code. */
export function formatMoney(amount, currency = "KWD") {
  if (currency === "USD") return formatUSD(amount);
  return formatKWD(amount);
}
