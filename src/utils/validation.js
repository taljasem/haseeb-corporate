/**
 * Validation utilities. Each validator returns either a translation key
 * (with optional interpolation values) or null if the value is valid.
 *
 * Usage:
 *   const errors = runValidators(state, {
 *     name: [required(), minLength(3), maxLength(80)],
 *     recipient: [required("validation.select_recipient")],
 *   });
 *   const isValid = Object.keys(errors).length === 0;
 */

export const required = (key = "validation.required") => (value) => {
  if (value == null) return { key };
  if (typeof value === "string" && value.trim() === "") return { key };
  if (Array.isArray(value) && value.length === 0) return { key };
  return null;
};

// Simple email format check (not RFC-5322 perfect, but sufficient for demo).
export const email = (key = "validation.invalid_email") => (value) => {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return { key };
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  return ok ? null : { key };
};

// Confirms that value matches another field's value (for password confirm).
export const matches = (otherValue, key = "validation.mismatch") => (value) => {
  if (value == null || value === "") return null;
  if (value !== otherValue) return { key };
  return null;
};

// Exact-length check, e.g. 6-digit 2FA code.
export const exactLength = (len, key = "validation.invalid_code") => (value) => {
  if (value == null) return { key };
  if (typeof value !== "string") return { key };
  if (value.trim().length !== len) return { key };
  return null;
};

export const minLength = (min, key = "validation.too_short") => (value) => {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  if (value.trim().length < min) return { key, values: { min } };
  return null;
};

export const maxLength = (max, key = "validation.too_long") => (value) => {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  if (value.length > max) return { key, values: { max } };
  return null;
};

export const minValue = (min, key = "validation.amount_required") => (value) => {
  const n = Number(value);
  if (isNaN(n) || n < min) return { key };
  return null;
};

/** Returns { key } if debits !== credits, null otherwise. Tolerates float drift. */
export const mustBalance = (debits, credits, key = "validation.must_balance") => {
  const d = Number(debits) || 0;
  const c = Number(credits) || 0;
  if (Math.abs(d - c) > 0.0001) return { key };
  return null;
};

/**
 * Run a map of field → validators[] against a state object.
 * Returns { fieldName: { key, values } } for failing fields.
 * Empty object means valid.
 */
export function runValidators(state, schema) {
  const errors = {};
  for (const field of Object.keys(schema)) {
    for (const v of schema[field]) {
      const result = v(state[field]);
      if (result) {
        errors[field] = result;
        break;
      }
    }
  }
  return errors;
}
