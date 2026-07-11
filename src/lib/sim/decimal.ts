import { Decimal } from "decimal.js";

/**
 * Single configured Decimal export. Every financial calculation in the app
 * imports from here — never from "decimal.js" directly (enforced by ESLint
 * no-restricted-imports) — so precision and rounding are uniform.
 */
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

export { Decimal };

export const D = (value: string | number | Decimal): Decimal =>
  new Decimal(value);

export const HUNDRED = new Decimal(100);
export const ZERO = new Decimal(0);
