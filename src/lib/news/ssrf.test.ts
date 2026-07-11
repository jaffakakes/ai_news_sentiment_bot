import { describe, expect, it } from "vitest";
import { isBlockedHostname, isPrivateAddress, validateUrlShape } from "./ssrf";

describe("isPrivateAddress", () => {
  const privateAddresses = [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1", // CGNAT
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1", // v4-mapped loopback
    "::ffff:10.0.0.1",
  ];
  it.each(privateAddresses)("blocks %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  const publicAddresses = ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8"];
  it.each(publicAddresses)("allows %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("isBlockedHostname", () => {
  it("blocks localhost and internal suffixes", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("LOCALHOST")).toBe(true);
    expect(isBlockedHostname("foo.localhost")).toBe(true);
    expect(isBlockedHostname("db.internal")).toBe(true);
    expect(isBlockedHostname("printer.local")).toBe(true);
    expect(isBlockedHostname("api.svc.cluster.local")).toBe(true);
  });
  it("allows public hostnames", () => {
    expect(isBlockedHostname("coindesk.com")).toBe(false);
    expect(isBlockedHostname("www.binance.com")).toBe(false);
    expect(isBlockedHostname("localhost.example.com")).toBe(false);
  });
});

describe("validateUrlShape", () => {
  it("rejects non-https, odd ports, credentials, private literals", () => {
    expect(validateUrlShape(new URL("ftp://example.com/x"))).toBeTruthy();
    expect(validateUrlShape(new URL("https://example.com:8443/x"))).toBeTruthy();
    expect(validateUrlShape(new URL("https://user:pw@example.com/x"))).toBeTruthy();
    expect(validateUrlShape(new URL("https://127.0.0.1/x"))).toBeTruthy();
    expect(validateUrlShape(new URL("https://[::1]/x"))).toBeTruthy();
    expect(validateUrlShape(new URL("https://localhost/x"))).toBeTruthy();
  });
  it("accepts a normal public https URL", () => {
    expect(validateUrlShape(new URL("https://www.coindesk.com/markets/x"))).toBeNull();
    expect(validateUrlShape(new URL("https://example.com:443/x"))).toBeNull();
  });
});
