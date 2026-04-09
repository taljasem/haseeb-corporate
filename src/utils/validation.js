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
