import { z } from "zod";

/** Positive decimal string, e.g. "0.05", "100", "46127.5". */
const decimalString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Must be a positive decimal number");

/** Decimal string that may be zero (fees, slippage). */
const nonNegativeDecimalString = decimalString;

export const simulationInputSchema = z
  .object({
    direction: z.enum(["long", "short"]),
    accountSize: decimalString,
    margin: decimalString,
    leverage: decimalString,
    entryPrice: decimalString,
    entryTime: z.number().int().positive(),
    exitPrice: decimalString.optional(),
    stopLoss: decimalString.optional(),
    takeProfit: decimalString.optional(),
    takerFeePct: nonNegativeDecimalString.default("0.05"),
    makerFeePct: nonNegativeDecimalString.default("0.02"),
    slippagePct: nonNegativeDecimalString.default("0"),
    maintenanceMarginRatePct: nonNegativeDecimalString.default("0.5"),
  })
  .check((ctx) => {
    const v = ctx.value;
    const num = (s: string) => Number(s); // validation-only comparisons
    if (num(v.leverage) < 1 || num(v.leverage) > 125) {
      ctx.issues.push({
        code: "custom",
        message: "Leverage must be between 1 and 125",
        path: ["leverage"],
        input: v.leverage,
      });
    }
    if (num(v.margin) > num(v.accountSize)) {
      ctx.issues.push({
        code: "custom",
        message: "Margin cannot exceed account size",
        path: ["margin"],
        input: v.margin,
      });
    }
    const entry = num(v.entryPrice);
    if (v.direction === "long") {
      if (v.stopLoss !== undefined && num(v.stopLoss) >= entry) {
        ctx.issues.push({
          code: "custom",
          message: "Long stop loss must be below entry",
          path: ["stopLoss"],
          input: v.stopLoss,
        });
      }
      if (v.takeProfit !== undefined && num(v.takeProfit) <= entry) {
        ctx.issues.push({
          code: "custom",
          message: "Long take profit must be above entry",
          path: ["takeProfit"],
          input: v.takeProfit,
        });
      }
    } else {
      if (v.stopLoss !== undefined && num(v.stopLoss) <= entry) {
        ctx.issues.push({
          code: "custom",
          message: "Short stop loss must be above entry",
          path: ["stopLoss"],
          input: v.stopLoss,
        });
      }
      if (v.takeProfit !== undefined && num(v.takeProfit) >= entry) {
        ctx.issues.push({
          code: "custom",
          message: "Short take profit must be below entry",
          path: ["takeProfit"],
          input: v.takeProfit,
        });
      }
    }
  });

export type SimulationInputDTO = z.infer<typeof simulationInputSchema>;
