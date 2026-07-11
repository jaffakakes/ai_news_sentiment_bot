import { z } from "zod";
import { marketSchema } from "./candles";

export const eventCategorySchema = z.enum([
  "TOKEN_BURN",
  "LISTING",
  "HACK",
  "PARTNERSHIP",
  "WHALE",
  "ETF",
  "MACRO",
  "UPGRADE",
  "OTHER",
]);

export const createEventSchema = z.object({
  ticker: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,20}$/, "Ticker must be 1-20 letters/digits"),
  eventTime: z.number().int().positive(), // epoch ms UTC
  timezone: z.string().min(1), // IANA; validated in the handler
  exchange: z.literal("binance").default("binance"),
  market: marketSchema,
  category: eventCategorySchema.default("OTHER"),
  headline: z.string().trim().max(500).optional(),
  url: z.url().max(2000).optional(),
  source: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(5000).optional(),
  lookbackMinutes: z.number().int().min(1).max(1440).default(60),
  lookforwardMinutes: z.number().int().min(1).max(1440).default(120),
});

export const eventFilterSchema = z.object({
  ticker: z.string().trim().toUpperCase().optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  source: z.string().trim().optional(),
  exchange: z.string().trim().optional(),
  category: eventCategorySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type EventFilter = z.infer<typeof eventFilterSchema>;
