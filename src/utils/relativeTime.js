import i18n from "../i18n";

// Localized relative time ("just now", "3h ago", "yesterday", "Apr 8"). Reads
// the active language from i18next so it adapts without requiring callers to
// pass a locale.
export function formatRelativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso);
  if (isNaN(then.getTime())) return "";
  const now = new Date();
  const diffMs = now - then;
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);

  const tr = (key, values) => {
    try {
      return i18n.t(`time.${key}`, { ns: "common", ...values });
    } catch (e) {
      return key;
    }
  };

  if (sec < 60) return tr("just_now");
  if (min < 60) return tr("minutes_ago", { count: min });
  if (hr < 24) return tr("hours_ago", { count: hr });

  // Yesterday: same calendar day - 1
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfThen = new Date(then);
  startOfThen.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday - startOfThen) / (1000 * 60 * 60 * 24));

  if (dayDiff === 1) return tr("yesterday");
  if (dayDiff < 7) return tr("days_ago", { count: dayDiff });

  const lang = (typeof document !== "undefined" && document.documentElement.lang) || "en";
  const locale = lang === "ar" ? "ar" : "en-US";
  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
