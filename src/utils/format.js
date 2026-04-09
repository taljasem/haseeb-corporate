export function formatKWD(amount) {
  const n = Number(amount || 0);
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return `KWD ${formatted}`;
}

// Additive: plain KWD number with no currency prefix, signed — used in split
// panes / tight columns where the currency label lives in a header.
export function formatKWDAmount(amount) {
  if (amount == null) return "—";
  const n = Number(amount);
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

// Additive: localized short date (e.g. "Apr 8" / "٨ أبريل"). Pass withYear to
// append the year. Respects the active i18n language.
export function formatDate(iso, opts = {}) {
  if (!iso) return "—";
  const d = new Date(iso);
  // Seed data sometimes carries already-formatted display strings like
  // "Apr 7"; fall back to the original string so the display never breaks.
  if (isNaN(d.getTime())) return String(iso);
  // Lazy import to avoid a circular dep between format.js and i18n/index.js.
  let lang = "en";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lang = (typeof document !== "undefined" && document.documentElement.lang) || "en";
  } catch (e) { /* ignore */ }
  const locale = lang === "ar" ? "ar" : "en-US";
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(opts.withYear ? { year: "numeric" } : {}),
  });
}
