import { immutableAssetCacheControl } from "./helpers/cache-control.js";
import { strictCsp, type CspOptions } from "./helpers/csp.js";
import type { HeaderRule } from "./types.js";

/** Allow any origin to fetch matching assets (fonts, images, etc). Pass a
 * narrower `path` (default `/*`) to scope it, e.g. `/assets/*`. */
export function corsPreset(path = "/*"): HeaderRule {
  return {
    path,
    comment: "Allow cross-origin fetches of these assets.",
    headers: { "Access-Control-Allow-Origin": "*" },
  };
}

/** Keep a `*.pages.dev` / `*.workers.dev` preview subdomain out of search
 * results, so only your custom domain gets indexed. */
export function noIndexPreviewDomainPreset(
  domainPattern: `https://${string}` = "https://:project.pages.dev/*",
): HeaderRule {
  return {
    path: domainPattern,
    comment: "Prevent the preview subdomain from being indexed by search engines.",
    headers: { "X-Robots-Tag": "noindex" },
  };
}

/** Long-lived, immutable caching for content-hashed build output
 * (e.g. Vite/webpack's fingerprinted `/assets/*` files). */
export function immutableAssetsPreset(path = "/assets/*"): HeaderRule {
  return {
    path,
    comment: "Fingerprinted assets never change contents for a given URL — cache aggressively.",
    headers: { "Cache-Control": immutableAssetCacheControl() },
  };
}

/** A solid baseline of hardening headers for HTML/app routes. Pass
 * `cspOverrides` to adjust the Content-Security-Policy for your app. */
export function securityHeadersPreset(path = "/*", cspOverrides: CspOptions = {}): HeaderRule {
  return {
    path,
    comment: "Baseline security headers.",
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": strictCsp(cspOverrides),
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  };
}
