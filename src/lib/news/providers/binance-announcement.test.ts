import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BinanceAnnouncementProvider } from "./binance-announcement";

const cmsFixture = JSON.parse(
  readFileSync(
    join(__dirname, "../../../test/fixtures/news/binance-cms-detail.json"),
    "utf8",
  ),
) as unknown;

const FIXTURE_CODE = "6fe9f6dc91544df88dc24ad41211feff";

describe("BinanceAnnouncementProvider", () => {
  it("recognizes announcement URLs in both formats", () => {
    const p = new BinanceAnnouncementProvider();
    expect(
      p.canHandle(`https://www.binance.com/en/support/announcement/detail/${FIXTURE_CODE}`),
    ).toBe(true);
    expect(
      p.canHandle(
        `https://www.binance.com/en/support/announcement/binance-lists-foo-${FIXTURE_CODE}`,
      ),
    ).toBe(true);
    expect(p.canHandle("https://www.binance.com/en/support/faq/x")).toBe(false);
    expect(p.canHandle("https://example.com/support/announcement/detail/abc")).toBe(false);
  });

  it("extracts the captured CMS article exactly", async () => {
    let requestedUrl = "";
    const p = new BinanceAnnouncementProvider(async (url) => {
      requestedUrl = url;
      return { status: 200, json: cmsFixture };
    });
    const news = await p.extract(
      `https://www.binance.com/en/support/announcement/detail/${FIXTURE_CODE}`,
    );
    expect(requestedUrl).toContain(`articleCode=${FIXTURE_CODE}`);
    expect(news.headline).toBe(
      "Binance Futures Will Launch USDⓈ-Margined SKHYUSDT Perpetual Contract (2026-07-10)",
    );
    expect(news.publishedAt).toBe(1783697823303);
    expect(news.publishedAtPrecision).toBe("exact");
    expect(news.publisher).toBe("Binance");
  });

  it("maps a null-data response to NOT_FOUND", async () => {
    const p = new BinanceAnnouncementProvider(async () => ({
      status: 200,
      json: { data: null },
    }));
    await expect(
      p.extract(`https://www.binance.com/en/support/announcement/detail/${FIXTURE_CODE}`),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("maps a blocked response to ACCESS_DENIED with an honest message", async () => {
    const p = new BinanceAnnouncementProvider(async () => ({ status: 403, json: null }));
    await expect(
      p.extract(`https://www.binance.com/en/support/announcement/detail/${FIXTURE_CODE}`),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });
});
