export interface CacheControlOptions {
  /** Response may be cached by any cache (browsers, CDNs, proxies). */
  public?: boolean;
  /** Response may only be cached by the end user's browser. */
  private?: boolean;
  /** Cache may store the response but must revalidate before each use. */
  noCache?: boolean;
  /** Response must not be stored in any cache at all. */
  noStore?: boolean;
  /** Seconds a cached response is considered fresh (`max-age`). */
  maxAge?: number;
  /** Like `maxAge`, but only applies to shared caches such as CDNs. */
  sMaxAge?: number;
  /** Cache must not serve stale content once `maxAge` has passed. */
  mustRevalidate?: boolean;
  /** Like `mustRevalidate`, but only applies to shared caches. */
  proxyRevalidate?: boolean;
  /** Response body will never change for the given URL — safe to cache
   * "forever" (Cloudflare's recommended flag for fingerprinted assets). */
  immutable?: boolean;
  /** Disables Cache-Control transformations (e.g. image recompression)
   * some intermediaries apply. */
  noTransform?: boolean;
  /** Seconds a stale response may still be served while revalidating in
   * the background (`stale-while-revalidate`). */
  staleWhileRevalidate?: number;
  /** Seconds a stale response may be served if the origin errors
   * (`stale-if-error`). */
  staleIfError?: number;
}

/**
 * Build a `Cache-Control` value from a typed options object instead of
 * hand-assembling a comma-separated string.
 *
 * @example
 * cacheControl({ public: true, maxAge: 31536000, immutable: true })
 * // "public, max-age=31536000, immutable"
 */
export function cacheControl(options: CacheControlOptions): string {
  const parts: string[] = [];

  if (options.public) parts.push("public");
  if (options.private) parts.push("private");
  if (options.noCache) parts.push("no-cache");
  if (options.noStore) parts.push("no-store");
  if (options.maxAge !== undefined) parts.push(`max-age=${options.maxAge}`);
  if (options.sMaxAge !== undefined) parts.push(`s-maxage=${options.sMaxAge}`);
  if (options.mustRevalidate) parts.push("must-revalidate");
  if (options.proxyRevalidate) parts.push("proxy-revalidate");
  if (options.immutable) parts.push("immutable");
  if (options.noTransform) parts.push("no-transform");
  if (options.staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  if (options.staleIfError !== undefined) {
    parts.push(`stale-if-error=${options.staleIfError}`);
  }

  if (parts.length === 0) {
    throw new Error("cacheControl(): at least one directive must be set.");
  }
  if (options.public && options.private) {
    throw new Error("cacheControl(): `public` and `private` are mutually exclusive.");
  }
  if (options.noStore && (options.maxAge !== undefined || options.immutable)) {
    throw new Error("cacheControl(): `noStore` makes `maxAge`/`immutable` meaningless — pick one.");
  }

  return parts.join(", ");
}

/** Preset for content-hashed/fingerprinted build assets: cache for a year,
 * never revalidate. Mirrors Cloudflare's own recommended pattern. */
export function immutableAssetCacheControl(): string {
  return cacheControl({ public: true, maxAge: 31536000, immutable: true });
}

/** Preset for HTML documents: always revalidate, never serve stale. */
export function noCacheControl(): string {
  return cacheControl({ public: true, maxAge: 0, mustRevalidate: true });
}
