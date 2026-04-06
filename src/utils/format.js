export function formatKWD(amount) {
  const n = Number(amount || 0);
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return `KWD ${formatted}`;
}
