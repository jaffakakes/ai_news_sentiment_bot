import type { ExtractedNews, NewsProvider } from "./types";

export interface ManualNewsInput {
  headline: string;
  source?: string;
  url?: string;
  publishedAt: number;
}

/**
 * Wraps hand-entered event details in the NewsProvider shape. It is the
 * fallback used directly by the event form, not selected via URL dispatch,
 * so canHandle() always declines.
 */
export class ManualProvider implements NewsProvider {
  readonly id = "manual";

  canHandle(): boolean {
    return false;
  }

  async extract(): Promise<ExtractedNews> {
    throw new Error("ManualProvider.extract requires fromInput()");
  }

  fromInput(input: ManualNewsInput): ExtractedNews {
    return {
      headline: input.headline,
      source: input.source?.trim() || this.id,
      url: input.url,
      publishedAt: input.publishedAt,
    };
  }
}
