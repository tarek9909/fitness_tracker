/**
 * Robust numeric parsing and bounded input validation utilities for the Admin Dashboard.
 * Prevents NaN, infinite, empty, partial, and out-of-range values from poisoning
 * React component state or reaching backend API payloads.
 */

export interface BoundedNumberOptions {
  min?: number;
  max?: number;
  fallback: number;
}

/** Standard regular expression for strict decimal floating-point representations */
const STRICT_FLOAT_REGEX = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Strict integer parser.
 * Returns null if the value is null, undefined, empty string, contains non-digits,
 * or is not a finite integer.
 */
export function parseStrictInteger(value: unknown, options?: { min?: number; max?: number }): number | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (!/^[+-]?\d+$/.test(str)) return null;
  const num = Number(str);
  if (!Number.isSafeInteger(num)) return null;
  if (options?.min !== undefined && num < options.min) return null;
  if (options?.max !== undefined && num > options.max) return null;
  return num;
}

/**
 * Strict positive integer parser (e.g. for database IDs or positive counts > 0).
 * Returns null if not an integer >= 1.
 */
export function parsePositiveInteger(value: unknown, options?: { max?: number }): number | null {
  return parseStrictInteger(value, { min: 1, max: options?.max });
}

/**
 * Strict floating-point parser.
 * Returns null if the value is null, undefined, empty string, contains non-numeric characters,
 * is not a finite number, or is partial/malformed input like '12abc'.
 * Accepts standard decimal formats (e.g. '12', '12.34', '.5', '-0.75', '1.5e2').
 */
export function parseStrictFloat(value: unknown, options?: { min?: number; max?: number }): number | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (!STRICT_FLOAT_REGEX.test(str)) return null;
  const num = Number(str);
  if (!Number.isFinite(num)) return null;
  if (options?.min !== undefined && num < options.min) return null;
  if (options?.max !== undefined && num > options.max) return null;
  return num;
}

/**
 * Controlled input helper for integer form fields.
 * Safely parses input value from <input type="number"> onChange events without producing NaN.
 * Rejects partial/malformed strings, returning options.fallback.
 * If user empties the input, returns options.fallback.
 * Clamps to min/max if provided and finite.
 */
export function parseBoundedInteger(value: unknown, options: BoundedNumberOptions): number {
  if (value === null || value === undefined) return options.fallback;
  const str = String(value).trim();
  if (!str) return options.fallback;
  if (!/^[+-]?\d+$/.test(str)) return options.fallback;
  const num = Number(str);
  if (!Number.isSafeInteger(num)) return options.fallback;
  if (options.min !== undefined && num < options.min) return options.min;
  if (options.max !== undefined && num > options.max) return options.max;
  return num;
}

/**
 * Controlled input helper for floating-point form fields.
 * Safely parses input value from <input type="number" step="0.1"> onChange events without producing NaN.
 * Rejects partial/malformed inputs like '12abc', 'NaN', 'Infinity', returning options.fallback.
 * If user empties the input, returns options.fallback.
 * Clamps to min/max if provided and finite.
 */
export function parseBoundedFloat(value: unknown, options: BoundedNumberOptions): number {
  if (value === null || value === undefined) return options.fallback;
  const str = String(value).trim();
  if (!str) return options.fallback;
  if (!STRICT_FLOAT_REGEX.test(str)) return options.fallback;
  const num = Number(str);
  if (!Number.isFinite(num)) return options.fallback;
  if (options.min !== undefined && num < options.min) return options.min;
  if (options.max !== undefined && num > options.max) return options.max;
  return num;
}
