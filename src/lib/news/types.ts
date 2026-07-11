/**
 * News extraction seam (Phase 3). URL providers (Open Graph, JSON-LD, RSS,
 * official APIs) will implement this interface; the dispatcher will pick the
 * first provider whose canHandle() accepts the input.
 */
export interface ExtractedNews {
  headline: string;
  source: string; // provider id, e.g. "manual", later "coindesk"
  url?: string;
  publishedAt: number; // epoch ms UTC
  tickers?: string[]; // suggested symbols when extractable
  body?: string;
}

export interface NewsProvider {
  readonly id: string;
  canHandle(input: string): boolean;
  extract(input: string): Promise<ExtractedNews>;
}
