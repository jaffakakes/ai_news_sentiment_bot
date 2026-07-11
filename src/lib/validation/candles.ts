import { z } from "zod";

export const intervalSchema = z.enum(["1s", "1m", "5m", "15m", "1h"]);
export const marketSchema = z.enum(["spot", "perp"]);

export const eventWindowSchema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,20}$/, "Ticker must be 1-20 letters/digits, e.g. BTCUSDT"),
  exchange: z.literal("binance").default("binance"),
  market: marketSchema,
  eventTime: z.coerce.number().int().positive(),
  lookbackMinutes: z.coerce.number().int().min(1).max(1440).default(60),
  lookforwardMinutes: z.coerce.number().int().min(1).max(1440).default(120),
});

export const candlesQuerySchema = eventWindowSchema.extend({
  interval: intervalSchema,
});

export type CandlesQuery = z.infer<typeof candlesQuerySchema>;
export type EventWindowQuery = z.infer<typeof eventWindowSchema>;
