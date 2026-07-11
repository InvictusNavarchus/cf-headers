import { describe, expect, it } from "vitest";
import { getHeaderInfo, getHeadersByCategory, getHeadersByStatus, HEADERS_REGISTRY, isKnownHeader } from "../src/registry.js";

describe("HEADERS_REGISTRY", () => {
  it("has no duplicate header names (case-insensitive)", () => {
    const lower = HEADERS_REGISTRY.map((h) => h.name.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it("gives every header a non-empty description", () => {
    for (const h of HEADERS_REGISTRY) {
      expect(h.description.length).toBeGreaterThan(0);
    }
  });

  it("gives every header a working-looking reference URL", () => {
    for (const h of HEADERS_REGISTRY) {
      expect(h.referenceUrl).toMatch(/^https:\/\/developer\.mozilla\.org\/.+\/Headers\/.+/);
    }
  });

  it("contains well-known headers with the expected status", () => {
    expect(getHeaderInfo("Content-Security-Policy")?.status).toBe("standard");
    expect(getHeaderInfo("X-Frame-Options")?.status).toBe("deprecated");
    expect(getHeaderInfo("X-Forwarded-For")?.status).toBe("non-standard");
    expect(getHeaderInfo("Sec-CH-UA")?.status).toBe("experimental");
  });

  it("is case-insensitive for lookups", () => {
    expect(getHeaderInfo("cache-control")?.name).toBe("Cache-Control");
    expect(getHeaderInfo("CACHE-CONTROL")?.name).toBe("Cache-Control");
  });

  it("returns undefined for unknown/custom headers", () => {
    expect(getHeaderInfo("X-My-Custom-Header")).toBeUndefined();
    expect(isKnownHeader("X-My-Custom-Header")).toBe(false);
  });

  it("filters by category and status", () => {
    const corsHeaders = getHeadersByCategory("cors");
    expect(corsHeaders.length).toBeGreaterThan(0);
    expect(corsHeaders.every((h) => h.category === "cors")).toBe(true);

    const deprecated = getHeadersByStatus("deprecated");
    expect(deprecated.length).toBeGreaterThan(0);
    expect(deprecated.every((h) => h.status === "deprecated")).toBe(true);
  });

  it("marks request-only headers as not settable via a _headers file", () => {
    expect(getHeaderInfo("User-Agent")?.settableViaHeadersFile).toBe(false);
    expect(getHeaderInfo("Content-Security-Policy")?.settableViaHeadersFile).toBe(true);
  });
});
