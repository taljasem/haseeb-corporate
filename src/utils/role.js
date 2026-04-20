// src/utils/role.js
//
// HASEEB-155: shared role normalization + display helpers. Before this,
// SettingsScreen, AdministrationScreen, and MigrationWizardScreen each had
// their own inline normalizeRole() — Settings was missing the "sen" branch,
// which bucketed Senior into Junior on that surface only. The three now
// import from here so a Senior Accountant sees "Senior" consistently.

/** Canonical frontend role strings used across role-aware UI. */
export const ROLES = Object.freeze({
  OWNER: "Owner",
  CFO: "CFO",
  SENIOR: "Senior",
  JUNIOR: "Junior",
});

/**
 * Normalize an incoming role string (from backend ENUM like OWNER|ACCOUNTANT|VIEWER
 * or UI-level string like "CFO"|"cfo"|"Senior Accountant") to one of the canonical
 * frontend role strings. Default to "CFO" if unrecognized — the most common case
 * for the Haseeb CFO-driven workflows, and a safe default that doesn't grant
 * excess privilege (backend is authoritative on writes regardless).
 */
export function normalizeRole(raw) {
  if (!raw) return ROLES.CFO;
  const s = String(raw).toLowerCase().trim();
  if (s.startsWith("own")) return ROLES.OWNER;
  if (s.startsWith("cfo")) return ROLES.CFO;
  if (s.startsWith("sen")) return ROLES.SENIOR;
  if (s.startsWith("jun") || s === "viewer" || s === "auditor") return ROLES.JUNIOR;
  if (s.startsWith("acc")) return ROLES.CFO; // ACCOUNTANT → CFO (midsize role model)
  return ROLES.CFO;
}

/**
 * Return an i18n-aware role display label. Callers supply `t` from
 * useTranslation('common') (or whatever namespace holds role labels).
 * Falls back to the canonical English string if translation is missing.
 */
export function roleLabel(t, role) {
  const normalized = normalizeRole(role);
  return t(`roles.${normalized.toLowerCase()}`, { defaultValue: normalized });
}

/** Convenience predicates — midsize role model: Senior == CFO for admin write. */
export const canEditAdmin = (role) => {
  const r = normalizeRole(role);
  return r === ROLES.CFO || r === ROLES.SENIOR;
};
export const canAccessAdmin = (role) => {
  const r = normalizeRole(role);
  return r === ROLES.CFO || r === ROLES.SENIOR || r === ROLES.OWNER;
};
