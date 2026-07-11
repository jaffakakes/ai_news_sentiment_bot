import { beforeEach, describe, expect, it } from "vitest";
import { safeFetchPage } from "./fetch-page";
import { NewsProviderError } from "./errors";

beforeEach(() => {
  // The per-host courtesy limiter lives on globalThis; isolate tests.
  (globalThis as { __newsHostRate?: Map<string, unknown> }).__newsHostRate?.clear();
});

/**
 * The fetcher takes fetch via parameter injection; these tests never touch
 * the network. Hostnames use real public domains so the DNS check resolves
 * (the stub intercepts before any socket opens).
 */

function htmlResponse(
  body: string,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "content-type": "text/html; charset=utf-8", ...init.headers },
  });
}

const expectCode = async (promise: Promise<unknown>, code: string) => {
  try {
    await promise;
    expect.fail("expected NewsProviderError");
  } catch (err) {
    expect(err).toBeInstanceOf(NewsProviderError);
    expect((err as NewsProviderError).code).toBe(code);
  }
};

describe("safeFetchPage", () => {
  it("fetches and decodes a normal page, upgrading http to https", async () => {
    let requested = "";
    const page = await safeFetchPage("http://example.com/article", async (url) => {
      requested = String(url);
      return htmlResponse("<html><title>Hi</title></html>");
    });
    expect(requested).toBe("https://example.com/article");
    expect(page.text).toContain("<title>Hi</title>");
    expect(page.truncated).toBe(false);
  });

  it("follows redirects up to the limit, then fails", async () => {
    const hop = (n: number) =>
      new Response(null, {
        status: 301,
        headers: { location: `https://example.com/${n}` },
      });
    let count = 0;
    await expectCode(
      safeFetchPage("https://example.com/0", async () => hop(++count)),
      "FETCH_FAILED",
    );
    expect(count).toBe(4); // initial + 3 redirect hops
  });

  it("rejects a redirect to a private address", async () => {
    await expectCode(
      safeFetchPage("https://example.com/x", async (url) =>
        String(url).includes("example.com")
          ? new Response(null, {
              status: 302,
              headers: { location: "https://127.0.0.1/steal" },
            })
          : htmlResponse("nope"),
      ),
      "BLOCKED_URL",
    );
  });

  it("rejects a redirect to a login/consent wall", async () => {
    await expectCode(
      safeFetchPage("https://example.com/x", async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://accounts.example.com/signin" },
        }),
      ),
      "ACCESS_DENIED",
    );
  });

  it("maps 403 to ACCESS_DENIED and 404 to NOT_FOUND", async () => {
    await expectCode(
      safeFetchPage("https://example.com/x", async () => htmlResponse("", { status: 403 })),
      "ACCESS_DENIED",
    );
    await expectCode(
      safeFetchPage("https://example.com/x", async () => htmlResponse("", { status: 404 })),
      "NOT_FOUND",
    );
  });

  it("treats an empty-body 2xx as a bot wall (Binance WAF pattern)", async () => {
    await expectCode(
      safeFetchPage("https://example.com/x", async () => htmlResponse("")),
      "ACCESS_DENIED",
    );
  });

  it("truncates bodies over the cap and reports it", async () => {
    const big = "x".repeat(3 * 1024 * 1024);
    const page = await safeFetchPage("https://example.com/big", async () =>
      htmlResponse(big),
    );
    expect(page.truncated).toBe(true);
    expect(page.text.length).toBe(2 * 1024 * 1024);
  });

  it("decodes non-UTF8 charsets from the content-type header", async () => {
    // "Привет" in windows-1251
    const bytes = new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
    const page = await safeFetchPage("https://example.com/ru", async () =>
      new Response(bytes, {
        status: 200,
        headers: { "content-type": "text/html; charset=windows-1251" },
      }),
    );
    expect(page.text).toBe("Привет");
  });

  it("rejects invalid and non-https-able URLs outright", async () => {
    await expectCode(safeFetchPage("not a url", async () => htmlResponse("x")), "BLOCKED_URL");
    await expectCode(
      safeFetchPage("https://localhost/x", async () => htmlResponse("x")),
      "BLOCKED_URL",
    );
    await expectCode(
      safeFetchPage("https://10.0.0.1/x", async () => htmlResponse("x")),
      "BLOCKED_URL",
    );
  });
});
