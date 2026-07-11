import { z } from "zod";

export const extractNewsSchema = z.object({
  url: z
    .url({ protocol: /^https?$/ })
    .max(2000, "URL is too long"),
});

export type ExtractNewsInput = z.infer<typeof extractNewsSchema>;
