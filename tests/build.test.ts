import { describe, expect, it } from "vitest";
import { generateHeadersFile, MAX_LINE_LENGTH, MAX_RULES } from "../src/build.js";
import { assertNoErrors, validateConfig } from "../src/validate.js";
import type { HeaderRule } from "../src/types.js";

describe("generateHeadersFile", () => {
  it("renders a single rule with a comment and one header", () => {
    const rules: HeaderRule[] = [
      { path: "/secure/page", comment: "lock this down", headers: { "X-Frame-Options": "DENY" } },
    ];
    expect(generateHeadersFile(rules)).toBe("# lock this down\n/secure/page\n  X-Frame-Options: DENY\n");
  });

  it("renders multiple header lines under one path, in insertion order", () => {
    const rules: HeaderRule[] = [
      {
        path: "/secure/page",
        headers: {
          "X-Frame-Options": "DENY",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        },
      },
    ];
    expect(generateHeadersFile(rules)).toBe(
      "/secure/page\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n",
    );
  });

  it("separates multiple rule blocks with a blank line", () => {
    const rules: HeaderRule[] = [
      { path: "/static/*", headers: { "Access-Control-Allow-Origin": "*" } },
      { path: "https://myworker.mysubdomain.workers.dev/*", headers: { "X-Robots-Tag": "noindex" } },
    ];
    expect(generateHeadersFile(rules)).toBe(
      "/static/*\n  Access-Control-Allow-Origin: *\n\nhttps://myworker.mysubdomain.workers.dev/*\n  X-Robots-Tag: noindex\n",
    );
  });

  it("renders a detach directive with the '! ' marker", () => {
    const rules: HeaderRule[] = [
      { path: "/*.jpg", headers: { "Content-Security-Policy": { detach: true } } },
    ];
    expect(generateHeadersFile(rules)).toBe("/*.jpg\n  ! Content-Security-Policy\n");
  });

  it("supports placeholders in both the path and header value", () => {
    const rules: HeaderRule[] = [
      { path: "/movies/:title", headers: { "x-movie-name": 'You are watching ":title"' } },
    ];
    expect(generateHeadersFile(rules)).toBe('/movies/:title\n  x-movie-name: You are watching ":title"\n');
  });

  it("reproduces the CORS example from the Cloudflare docs", () => {
    const rules: HeaderRule[] = [{ path: "/*", headers: { "Access-Control-Allow-Origin": "*" } }];
    expect(generateHeadersFile(rules)).toBe("/*\n  Access-Control-Allow-Origin: *\n");
  });

  it("reproduces the fingerprinted-assets caching example from the Cloudflare docs", () => {
    const rules: HeaderRule[] = [
      { path: "/static/*", headers: { "Cache-Control": "public, max-age=31556952, immutable" } },
    ];
    expect(generateHeadersFile(rules)).toBe("/static/*\n  Cache-Control: public, max-age=31556952, immutable\n");
  });
});

describe("validateConfig", () => {
  it("flags more than the documented 100-rule maximum", () => {
    const rules: HeaderRule[] = Array.from({ length: MAX_RULES + 1 }, (_, i) => ({
      path: `/page-${i}`,
      headers: { "X-Test": "1" },
    }));
    const issues = validateConfig(rules);
    expect(issues.some((i) => i.level === "error" && i.message.includes("100"))).toBe(true);
  });

  it("flags lines over the documented 2000-character limit", () => {
    const rules: HeaderRule[] = [{ path: "/*", headers: { "X-Test": "a".repeat(MAX_LINE_LENGTH) } }];
    const issues = validateConfig(rules);
    expect(issues.some((i) => i.level === "error" && i.message.includes("2000"))).toBe(true);
  });

  it("flags absolute URLs that aren't https", () => {
    const rules: HeaderRule[] = [{ path: "http://example.com/*", headers: { "X-Test": "1" } }];
    const issues = validateConfig(rules);
    expect(issues.some((i) => i.level === "error" && i.message.includes("https"))).toBe(true);
  });

  it("flags absolute URLs with an explicit port", () => {
    const rules: HeaderRule[] = [{ path: "https://example.com:8080/*", headers: { "X-Test": "1" } }];
    const issues = validateConfig(rules);
    expect(issues.some((i) => i.level === "error" && i.message.includes("port"))).toBe(true);
  });

  it("flags more than one splat in a path", () => {
    const rules: HeaderRule[] = [{ path: "/a/*/b/*", headers: { "X-Test": "1" } }];
    const issues = validateConfig(rules);
    expect(issues.some((i) => i.level === "error" && i.message.includes("splat"))).toBe(true);
  });

  it("warns (but does not error) on deprecated headers", () => {
    const rules: HeaderRule[] = [{ path: "/*", headers: { "X-Frame-Options": "DENY" } }];
    const issues = validateConfig(rules);
    expect(issues.some((i) => i.level === "warning" && i.message.startsWith('"X-Frame-Options" is deprecated'))).toBe(
      true,
    );
    expect(() => assertNoErrors(issues)).not.toThrow();
  });

  it("warns on wildcard Access-Control-Allow-Origin on path /*", () => {
    const rules: HeaderRule[] = [{ path: "/*", headers: { "Access-Control-Allow-Origin": "*" } }];
    const issues = validateConfig(rules);
    expect(issues.some((i) => i.level === "warning" && i.message.includes("Access-Control-Allow-Origin: *"))).toBe(true);
  });

  it("does not warn on wildcard Access-Control-Allow-Origin on narrower paths", () => {
    const rules: HeaderRule[] = [{ path: "/assets/*", headers: { "Access-Control-Allow-Origin": "*" } }];
    const issues = validateConfig(rules);
    expect(issues.some((i) => i.message.includes("Access-Control-Allow-Origin"))).toBe(false);
  });

  it("warns on unsafe-inline in Content-Security-Policy without nonce or hash", () => {
    const rules: HeaderRule[] = [{ path: "/*", headers: { "Content-Security-Policy": "default-src 'self' 'unsafe-inline'" } }];
    const issues = validateConfig(rules);
    expect(issues.some((i) => i.level === "warning" && i.message.includes("unsafe-inline"))).toBe(true);
  });

  it("does not warn on unsafe-inline in Content-Security-Policy with nonce or hash", () => {
    const rules: HeaderRule[] = [
      { path: "/*", headers: { "Content-Security-Policy": "default-src 'self' 'unsafe-inline' 'nonce-123'" } },
      { path: "/2", headers: { "Content-Security-Policy": "default-src 'self' 'unsafe-inline' 'sha256-abc'" } },
      { path: "/3", headers: { "Content-Security-Policy": "default-src 'self' 'unsafe-inline' 'strict-dynamic'" } },
    ];
    const issues = validateConfig(rules);
    expect(issues.some((i) => i.message.includes("unsafe-inline"))).toBe(false);
  });

  it("warns on unsafe-eval in Content-Security-Policy", () => {
    const rules: HeaderRule[] = [{ path: "/*", headers: { "Content-Security-Policy": "default-src 'self' 'unsafe-eval'" } }];
    const issues = validateConfig(rules);
    expect(issues.some((i) => i.level === "warning" && i.message.includes("unsafe-eval"))).toBe(true);
  });

  it("passes clean on a valid, non-deprecated rule set", () => {
    const rules: HeaderRule[] = [{ path: "/assets/*", headers: { "Cache-Control": "public, max-age=3600" } }];
    const issues = validateConfig(rules);
    expect(issues).toHaveLength(0);
  });

  it("assertNoErrors throws with details when errors are present", () => {
    const rules: HeaderRule[] = [{ path: "", headers: {} }];
    const issues = validateConfig(rules);
    expect(() => assertNoErrors(issues)).toThrow(/invalid configuration/);
  });
});
