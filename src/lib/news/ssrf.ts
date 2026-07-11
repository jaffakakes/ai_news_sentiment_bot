import { isIP } from "node:net";

/**
 * SSRF guards for the news fetcher. Pure functions — DNS resolution happens
 * in fetch-page.ts, which re-runs these checks on every redirect hop.
 *
 * Depth: hostname denylist + private-range checks on IP literals and on
 * every resolved address. DNS-rebinding TOCTOU (record changing between our
 * lookup and undici's) remains theoretically possible; the upgrade path is
 * an undici Agent with a custom lookup that pins the validated address.
 * Acceptable residual risk for a single-user research tool.
 */

const BLOCKED_HOSTNAMES = new Set(["localhost"]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".svc.cluster.local"];

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  return BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return (
    ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>>
    0
  );
}

const inRange = (ip: number, base: string, maskBits: number): boolean => {
  const baseInt = ipv4ToInt(base);
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ip & mask) === (baseInt & mask);
};

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return (
    inRange(n, "0.0.0.0", 8) || // "this network"
    inRange(n, "10.0.0.0", 8) ||
    inRange(n, "100.64.0.0", 10) || // CGNAT
    inRange(n, "127.0.0.0", 8) ||
    inRange(n, "169.254.0.0", 16) || // link-local / cloud metadata
    inRange(n, "172.16.0.0", 12) ||
    inRange(n, "192.168.0.0", 16) ||
    inRange(n, "224.0.0.0", 4) || // multicast
    inRange(n, "240.0.0.0", 4) // reserved
  );
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  // IPv4-mapped (::ffff:a.b.c.d) — check the embedded v4.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]!);
  return (
    lower.startsWith("fc") || // fc00::/7 unique local
    lower.startsWith("fd") ||
    lower.startsWith("fe8") || // fe80::/10 link-local
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  );
}

/** True when `address` (v4 or v6 literal) points at private/reserved space. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true; // not an IP literal — caller should not have gotten here
}

/**
 * Validate URL shape before any network activity: https only, default port,
 * no embedded credentials, hostname not obviously internal, and IP-literal
 * hosts must be public.
 */
export function validateUrlShape(url: URL): string | null {
  if (url.protocol !== "https:") return "Only https URLs are fetched";
  if (url.port !== "" && url.port !== "443") {
    return "Non-default ports are not fetched";
  }
  if (url.username || url.password) {
    return "URLs with embedded credentials are not fetched";
  }
  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip v6 brackets
  if (isBlockedHostname(host)) return "Internal hostnames are not fetched";
  if (isIP(host) && isPrivateAddress(host)) {
    return "Private/reserved IP addresses are not fetched";
  }
  return null;
}
