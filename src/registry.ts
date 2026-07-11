import type { HeaderCategory, HeaderContext, HeaderInfo, HeaderStatus } from "./types.js";

const MDN_BASE = "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers";

/**
 * Compact tuple form used to author the catalog:
 * [name, category, context, status, settableViaHeadersFile, description]
 *
 * Descriptions are intentionally short, original one-liners (not copied
 * from any spec or reference site) — enough to get useful autocomplete
 * hints without needing to leave your editor.
 */
type RawEntry = readonly [string, HeaderCategory, HeaderContext, HeaderStatus, boolean, string];

const RAW_HEADERS = [
  // ---- Authentication ------------------------------------------------
  ["WWW-Authenticate", "authentication", "response", "standard", true, "Tells the client which auth scheme(s) to use to access a resource."],
  ["Authorization", "authentication", "request", "standard", false, "Carries the client's credentials for a protected resource."],
  ["Proxy-Authenticate", "authentication", "response", "standard", true, "Like WWW-Authenticate, but issued by a proxy in front of the origin."],
  ["Proxy-Authorization", "authentication", "request", "standard", false, "Carries credentials for authenticating with a proxy server."],

  // ---- Caching --------------------------------------------------------
  ["Age", "caching", "response", "standard", true, "Seconds since a cached response was generated at the origin."],
  ["Cache-Control", "caching", "both", "standard", true, "Directives controlling who may cache a response and for how long."],
  ["Clear-Site-Data", "caching", "response", "standard", true, "Instructs the browser to wipe cookies, storage, and/or cache for the origin."],
  ["Expires", "caching", "response", "standard", true, "Absolute date/time after which a response is considered stale."],
  ["No-Vary-Search", "caching", "response", "experimental", true, "Lets a response opt certain query-string params out of cache-key matching."],

  // ---- Conditionals -----------------------------------------------------
  ["Last-Modified", "conditionals", "response", "standard", true, "Timestamp of the resource's last modification, used for freshness checks."],
  ["ETag", "conditionals", "response", "standard", true, "Opaque fingerprint of a resource version, used for conditional requests."],
  ["If-Match", "conditionals", "request", "standard", false, "Only perform the request if the resource's ETag matches."],
  ["If-None-Match", "conditionals", "request", "standard", false, "Only perform the request if the resource's ETag does NOT match."],
  ["If-Modified-Since", "conditionals", "request", "standard", false, "Only return the resource if it changed after the given date."],
  ["If-Unmodified-Since", "conditionals", "request", "standard", false, "Only perform the request if the resource is unchanged since the given date."],
  ["Vary", "conditionals", "response", "standard", true, "Lists request headers that affect which cached variant is served."],

  // ---- Connection management --------------------------------------------
  ["Connection", "connection-management", "both", "standard", true, "Controls whether the underlying TCP connection stays open."],
  ["Keep-Alive", "connection-management", "both", "standard", true, "Tuning parameters for how long a persistent connection is kept open."],

  // ---- Content negotiation ------------------------------------------------
  ["Accept", "content-negotiation", "request", "standard", false, "Media types the client is willing to receive."],
  ["Accept-Encoding", "content-negotiation", "request", "standard", false, "Content codings (e.g. gzip, br) the client can decode."],
  ["Accept-Language", "content-negotiation", "request", "standard", false, "Preferred natural languages for the response."],
  ["Accept-Patch", "content-negotiation", "response", "standard", true, "Advertises which media types a PATCH endpoint understands."],
  ["Accept-Post", "content-negotiation", "response", "standard", true, "Advertises which media types a POST endpoint understands."],

  // ---- Controls -----------------------------------------------------------
  ["Expect", "controls", "request", "standard", false, "States an expectation the server must meet to proceed with the request."],
  ["Max-Forwards", "controls", "request", "standard", false, "Caps how many proxy hops a TRACE/OPTIONS request may traverse."],

  // ---- Cookies --------------------------------------------------------------
  ["Cookie", "cookies", "request", "standard", false, "Cookies previously set by the server, sent back on subsequent requests."],
  ["Set-Cookie", "cookies", "response", "standard", true, "Instructs the client to store a cookie."],

  // ---- CORS -------------------------------------------------------------------
  ["Access-Control-Allow-Credentials", "cors", "response", "standard", true, "Allows a cross-origin request to include credentials (cookies, auth)."],
  ["Access-Control-Allow-Headers", "cors", "response", "standard", true, "Lists request headers permitted in the actual cross-origin request."],
  ["Access-Control-Allow-Methods", "cors", "response", "standard", true, "Lists HTTP methods permitted for the cross-origin resource."],
  ["Access-Control-Allow-Origin", "cors", "response", "standard", true, "Declares which origin(s) may read the response."],
  ["Access-Control-Expose-Headers", "cors", "response", "standard", true, "Lists response headers a browser script is allowed to read."],
  ["Access-Control-Max-Age", "cors", "response", "standard", true, "How long, in seconds, a CORS preflight result may be cached."],
  ["Access-Control-Request-Headers", "cors", "request", "standard", false, "Sent in a preflight to list headers the real request will use."],
  ["Access-Control-Request-Method", "cors", "request", "standard", false, "Sent in a preflight to announce the real request's HTTP method."],
  ["Origin", "cors", "request", "standard", false, "The scheme+host+port a cross-origin request originated from."],
  ["Timing-Allow-Origin", "cors", "response", "standard", true, "Opts an origin in to reading detailed Resource Timing data cross-origin."],

  // ---- Downloads ---------------------------------------------------------------
  ["Content-Disposition", "downloads", "response", "standard", true, "Suggests the browser show the resource inline or download it as a file."],

  // ---- Integrity digests ---------------------------------------------------------
  ["Content-Digest", "integrity", "both", "experimental", true, "Cryptographic digest of the message content actually transferred."],
  ["Repr-Digest", "integrity", "both", "experimental", true, "Cryptographic digest of the resource's selected representation."],
  ["Want-Content-Digest", "integrity", "both", "experimental", false, "Requests that the peer include a Content-Digest header."],
  ["Want-Repr-Digest", "integrity", "both", "experimental", false, "Requests that the peer include a Repr-Digest header."],

  // ---- Integrity policy -------------------------------------------------------------
  ["Integrity-Policy", "integrity", "response", "experimental", true, "Requires Subresource Integrity for certain fetched resource types."],
  ["Integrity-Policy-Report-Only", "integrity", "response", "experimental", true, "Reports would-be SRI violations without enforcing the policy."],

  // ---- Message body info ---------------------------------------------------------------
  ["Content-Length", "message-body", "both", "standard", true, "Size of the message body in bytes."],
  ["Content-Type", "message-body", "both", "standard", true, "MIME type (and optional charset) of the resource."],
  ["Content-Encoding", "message-body", "both", "standard", true, "Compression coding applied to the body (e.g. gzip, br)."],
  ["Content-Language", "message-body", "both", "standard", true, "Human language(s) the content is intended for."],
  ["Content-Location", "message-body", "both", "standard", true, "An alternate location where the same data can be found."],

  // ---- Preferences -----------------------------------------------------------------------
  ["Prefer", "preferences", "request", "standard", false, "Requests optional server behaviors, e.g. minimal responses."],
  ["Preference-Applied", "preferences", "response", "standard", true, "States which requested Prefer options the server actually honored."],

  // ---- Proxies -----------------------------------------------------------------------------
  ["Forwarded", "proxies", "request", "standard", false, "Standardized record of client-facing proxy info (successor to X-Forwarded-*)."],
  ["Via", "proxies", "both", "standard", true, "Records the proxies/gateways a message passed through."],

  // ---- Range requests -----------------------------------------------------------------------
  ["Accept-Ranges", "range-requests", "response", "standard", true, "Advertises support for partial (byte-range) requests."],
  ["Range", "range-requests", "request", "standard", false, "Requests only a portion of a resource."],
  ["If-Range", "range-requests", "request", "standard", false, "Makes a range request conditional on the resource being unchanged."],
  ["Content-Range", "range-requests", "response", "standard", true, "Indicates which portion of the full resource a partial response covers."],

  // ---- Redirects -----------------------------------------------------------------------------
  ["Location", "redirects", "response", "standard", true, "Target URL for a redirect or the URL of a newly created resource."],
  ["Refresh", "redirects", "response", "standard", true, "Tells the browser to reload or navigate after a delay."],

  // ---- Request context -----------------------------------------------------------------------
  ["From", "request-context", "request", "standard", false, "Email address of the human operating the requesting user agent."],
  ["Host", "request-context", "request", "standard", false, "Target domain (and optional port) for the request."],
  ["Referer", "request-context", "request", "standard", false, "URL of the page that linked to the current request."],
  ["Referrer-Policy", "request-context", "response", "standard", true, "Controls how much referrer information is sent on outgoing navigations."],
  ["User-Agent", "request-context", "request", "standard", false, "Identifies the requesting application/OS/vendor."],

  // ---- Response context -----------------------------------------------------------------------
  ["Allow", "response-context", "response", "standard", true, "Lists the HTTP methods a resource supports."],
  ["Server", "response-context", "response", "standard", true, "Identifies the software handling the request at the origin."],

  // ---- Security ---------------------------------------------------------------------------------
  ["Cross-Origin-Embedder-Policy", "security", "response", "standard", true, "Controls whether cross-origin resources must opt in to being embedded."],
  ["Cross-Origin-Opener-Policy", "security", "response", "standard", true, "Isolates a top-level document's browsing context from other origins."],
  ["Cross-Origin-Resource-Policy", "security", "response", "standard", true, "Restricts which origins may load a resource (images, scripts, etc.)."],
  ["Content-Security-Policy", "security", "response", "standard", true, "Allow-lists the sources a page may load scripts, styles, media, etc. from."],
  ["Content-Security-Policy-Report-Only", "security", "response", "standard", true, "Reports CSP violations without actually blocking anything."],
  ["Expect-CT", "security", "response", "deprecated", true, "Formerly enforced Certificate Transparency; removed from modern browsers."],
  ["Permissions-Policy", "security", "response", "standard", true, "Enables or disables browser features/APIs for the page and its iframes."],
  ["Reporting-Endpoints", "reporting", "response", "experimental", true, "Registers named endpoints for CSP, COOP, and other browser reports."],
  ["Strict-Transport-Security", "security", "response", "standard", true, "Forces the browser to use HTTPS for this origin going forward (HSTS)."],
  ["Upgrade-Insecure-Requests", "security", "both", "standard", true, "Signals a preference for encrypted, authenticated responses."],
  ["X-Content-Type-Options", "security", "response", "standard", true, "Set to \"nosniff\" to stop the browser from MIME-sniffing the body."],
  ["X-Frame-Options", "security", "response", "deprecated", true, "Legacy clickjacking protection; superseded by CSP frame-ancestors."],
  ["X-Permitted-Cross-Domain-Policies", "security", "response", "non-standard", true, "Restricts Adobe Flash/Acrobat-style cross-domain policy files."],
  ["X-Powered-By", "security", "response", "non-standard", true, "Advertises the backend framework; usually stripped to reduce fingerprinting."],
  ["X-XSS-Protection", "security", "response", "deprecated", true, "Legacy browser XSS filter toggle; removed from modern engines, use CSP instead."],

  // ---- Fetch metadata request headers ------------------------------------------------------------
  ["Sec-Fetch-Site", "fetch-metadata", "request", "standard", false, "Relationship between the request's initiator origin and its target."],
  ["Sec-Fetch-Mode", "fetch-metadata", "request", "standard", false, "The fetch mode used for the request (cors, navigate, no-cors, ...)."],
  ["Sec-Fetch-User", "fetch-metadata", "request", "standard", false, "Whether the navigation was triggered by an actual user activation."],
  ["Sec-Fetch-Dest", "fetch-metadata", "request", "standard", false, "What the fetched resource will be used for (script, image, style, ...)."],
  ["Sec-Purpose", "fetch-metadata", "request", "standard", false, "Marks a request as a background/prefetch fetch rather than direct use."],
  ["Service-Worker-Navigation-Preload", "fetch-metadata", "request", "standard", false, "Value passed with a service worker's preloaded navigation fetch."],

  // ---- Storage access -----------------------------------------------------------------------------
  ["Sec-Fetch-Storage-Access", "storage-access", "request", "experimental", false, "Reports the current storage-access status for a fetch."],
  ["Activate-Storage-Access", "storage-access", "response", "experimental", true, "Asks the browser to activate storage access and retry the request."],

  // ---- Transfer coding -------------------------------------------------------------------------------
  ["Transfer-Encoding", "transfer-coding", "response", "standard", true, "Encoding used to safely transfer the body (e.g. chunked)."],
  ["TE", "transfer-coding", "request", "standard", false, "Transfer codings the client is willing to accept."],
  ["Trailer", "transfer-coding", "both", "standard", true, "Lists headers that will appear after a chunked message body."],

  // ---- WebSockets -----------------------------------------------------------------------------------
  ["Sec-WebSocket-Accept", "websocket", "response", "standard", true, "Server's confirmation that it accepts the WebSocket upgrade."],
  ["Sec-WebSocket-Extensions", "websocket", "both", "standard", true, "Negotiates WebSocket protocol extensions."],
  ["Sec-WebSocket-Key", "websocket", "request", "standard", false, "Client-generated key proving an explicit intent to open a WebSocket."],
  ["Sec-WebSocket-Protocol", "websocket", "both", "standard", true, "Negotiates an application sub-protocol for the WebSocket."],
  ["Sec-WebSocket-Version", "websocket", "both", "standard", true, "The WebSocket protocol version in use."],

  // ---- Other --------------------------------------------------------------------------------------------
  ["Alt-Svc", "other", "response", "standard", true, "Advertises alternative ways (host/protocol) to reach this service."],
  ["Alt-Used", "other", "request", "standard", false, "Identifies which alternative service is actually being used."],
  ["Date", "other", "both", "standard", true, "Date and time the message was generated."],
  ["Link", "other", "response", "standard", true, "Serializes one or more resource relationships, similar to <link>."],
  ["Retry-After", "other", "response", "standard", true, "How long the client should wait before retrying (used with 429/503)."],
  ["Server-Timing", "other", "response", "standard", true, "Surfaces backend performance metrics to the browser's dev tools."],
  ["Service-Worker", "other", "request", "standard", false, "Sent when fetching a service worker's own script resource."],
  ["Service-Worker-Allowed", "other", "response", "standard", true, "Widens the default path scope a service worker is allowed to control."],
  ["SourceMap", "other", "response", "standard", true, "Points debuggers to a source map for this resource."],
  ["Upgrade", "other", "both", "standard", true, "Requests/confirms switching the connection to a different protocol."],
  ["Priority", "other", "both", "standard", true, "Hints the relative fetch priority of a request or response."],

  // ---- Attribution Reporting (experimental) --------------------------------------------------------------
  ["Attribution-Reporting-Eligible", "attribution-reporting", "request", "experimental", false, "Marks a request as eligible to register an attribution source/trigger."],
  ["Attribution-Reporting-Register-Source", "attribution-reporting", "response", "experimental", true, "Registers this response as an attribution source."],
  ["Attribution-Reporting-Register-Trigger", "attribution-reporting", "response", "experimental", true, "Registers this response as an attribution trigger (conversion)."],

  // ---- Client hints (experimental) -------------------------------------------------------------------------
  ["Accept-CH", "client-hints", "response", "experimental", true, "Requests that the client resend future requests with specific Client Hints."],
  ["Critical-CH", "client-hints", "response", "experimental", true, "Marks certain Accept-CH hints as critical, forcing a retried request."],
  ["Sec-CH-UA", "client-hints", "request", "experimental", false, "Browser brand and significant version."],
  ["Sec-CH-UA-Arch", "client-hints", "request", "experimental", false, "Underlying platform CPU architecture."],
  ["Sec-CH-UA-Bitness", "client-hints", "request", "experimental", false, "Underlying CPU architecture bitness (e.g. 64)."],
  ["Sec-CH-UA-Form-Factors", "client-hints", "request", "experimental", false, "How the user interacts with the device (desktop, mobile, XR, ...)."],
  ["Sec-CH-UA-Full-Version", "client-hints", "request", "deprecated", false, "Full browser version string; superseded by Sec-CH-UA-Full-Version-List."],
  ["Sec-CH-UA-Full-Version-List", "client-hints", "request", "experimental", false, "Full version for every brand in the user agent's brand list."],
  ["Sec-CH-UA-Mobile", "client-hints", "request", "experimental", false, "Whether the browser is running on a mobile device."],
  ["Sec-CH-UA-Model", "client-hints", "request", "experimental", false, "The device model."],
  ["Sec-CH-UA-Platform", "client-hints", "request", "experimental", false, "The underlying operating system."],
  ["Sec-CH-UA-Platform-Version", "client-hints", "request", "experimental", false, "The underlying operating system's version."],
  ["Sec-CH-UA-WoW64", "client-hints", "request", "experimental", false, "Whether a 32-bit browser is running on 64-bit Windows."],
  ["Sec-CH-Prefers-Color-Scheme", "client-hints", "request", "experimental", false, "User's preference for a light or dark color scheme."],
  ["Sec-CH-Prefers-Reduced-Motion", "client-hints", "request", "experimental", false, "User's preference for fewer animations/layout shifts."],
  ["Sec-CH-Prefers-Reduced-Transparency", "client-hints", "request", "experimental", false, "User's preference for reduced transparency effects."],
  ["Sec-CH-Device-Memory", "client-hints", "request", "experimental", false, "Approximate device RAM available to the browser."],
  ["Sec-CH-DPR", "client-hints", "request", "experimental", false, "Client device pixel ratio."],
  ["Sec-CH-Viewport-Height", "client-hints", "request", "experimental", false, "Layout viewport height in CSS pixels."],
  ["Sec-CH-Viewport-Width", "client-hints", "request", "experimental", false, "Layout viewport width in CSS pixels."],
  ["Sec-CH-Width", "client-hints", "request", "experimental", false, "Intended display width of the requested image, in CSS pixels."],
  ["Device-Memory", "client-hints", "request", "deprecated", false, "Legacy, unprefixed predecessor of Sec-CH-Device-Memory."],
  ["DPR", "client-hints", "request", "deprecated", false, "Legacy, unprefixed predecessor of Sec-CH-DPR."],
  ["Viewport-Width", "client-hints", "request", "deprecated", false, "Legacy, unprefixed predecessor of Sec-CH-Viewport-Width."],
  ["Width", "client-hints", "request", "deprecated", false, "Legacy, unprefixed predecessor of Sec-CH-Width."],
  ["Downlink", "client-hints", "request", "experimental", false, "Approximate downstream bandwidth in Mbps."],
  ["ECT", "client-hints", "request", "experimental", false, "Effective connection type bucket (e.g. 4g, 3g, slow-2g)."],
  ["RTT", "client-hints", "request", "experimental", false, "Application-layer round-trip time in milliseconds."],
  ["Save-Data", "client-hints", "request", "experimental", false, "Signals the user has requested reduced data usage."],

  // ---- Compression Dictionary Transport (experimental) --------------------------------------------------------
  ["Available-Dictionary", "compression-dictionary", "request", "experimental", false, "Advertises the best shared compression dictionary the client already has."],
  ["Dictionary-ID", "compression-dictionary", "request", "experimental", false, "References a server-assigned id for an already-available dictionary."],
  ["Use-As-Dictionary", "compression-dictionary", "response", "experimental", true, "Declares match criteria for using this response as a future dictionary."],

  // ---- Privacy ---------------------------------------------------------------------------------------------------
  ["DNT", "privacy", "request", "deprecated", false, "Legacy \"Do Not Track\" signal; largely replaced by Sec-GPC."],
  ["Tk", "privacy", "response", "deprecated", true, "Legacy response counterpart to DNT, reporting tracking status."],
  ["Sec-GPC", "privacy", "request", "non-standard", false, "Global Privacy Control signal opting out of data sale/sharing."],

  // ---- Security (experimental) -----------------------------------------------------------------------------------
  ["Origin-Agent-Cluster", "security", "response", "experimental", true, "Requests that the document get its own origin-keyed agent cluster."],

  // ---- Reporting / server-sent events --------------------------------------------------------------------------------
  ["NEL", "reporting", "response", "experimental", true, "Configures the browser's Network Error Logging reporting policy."],
  ["Report-To", "reporting", "response", "deprecated", true, "Legacy Reporting API endpoint config; superseded by Reporting-Endpoints."],

  // ---- Topics API (experimental / non-standard) --------------------------------------------------------------------
  ["Observe-Browsing-Topics", "topics-api", "response", "experimental", true, "Marks inferred page topics as observed for the Topics API."],
  ["Sec-Browsing-Topics", "topics-api", "request", "experimental", false, "Carries the user's selected ad-topics for the current request."],

  // ---- Miscellaneous experimental -----------------------------------------------------------------------------------
  ["Accept-Signature", "other", "request", "experimental", false, "Signals willingness to receive signed HTTP exchanges."],
  ["Early-Data", "other", "request", "experimental", false, "Indicates the request arrived over TLS 1.3 early data (0-RTT)."],
  ["Idempotency-Key", "other", "request", "experimental", false, "Client-supplied key making POST/PATCH requests safely retryable."],
  ["Set-Login", "other", "response", "experimental", true, "Federated identity provider signals its login status (FedCM)."],
  ["Signature", "other", "response", "experimental", true, "Carries signature(s) for a signed HTTP exchange."],
  ["Signed-Headers", "other", "response", "experimental", true, "Lists which response headers are covered by a signed exchange."],
  ["Speculation-Rules", "other", "response", "experimental", true, "Points to JSON rules for prerendering/prefetching likely navigations."],
  ["Sec-Speculation-Tags", "other", "request", "experimental", false, "Tags identifying which speculation rule triggered a request."],
  ["Supports-Loading-Mode", "other", "response", "experimental", true, "Opts a navigation target in to higher-risk loading modes like prerendering."],

  // ---- Non-standard --------------------------------------------------------------------------------------------------
  ["X-Forwarded-For", "non-standard", "request", "non-standard", false, "Originating client IP address(es), added by proxies/load balancers."],
  ["X-Forwarded-Host", "non-standard", "request", "non-standard", false, "The original Host requested before hitting a proxy/load balancer."],
  ["X-Forwarded-Proto", "non-standard", "request", "non-standard", false, "The original protocol (http/https) used before a proxy/load balancer."],
  ["X-DNS-Prefetch-Control", "non-standard", "response", "non-standard", true, "Enables or disables the browser's speculative DNS prefetching."],
  ["X-Robots-Tag", "non-standard", "response", "non-standard", true, "Per-response equivalent of a <meta name=\"robots\"> indexing directive."],

  // ---- Deprecated -----------------------------------------------------------------------------------------------------
  ["Pragma", "other", "both", "deprecated", true, "HTTP/1.0-era caching header, kept only for backward compatibility."],
  ["Warning", "other", "response", "deprecated", true, "Legacy general-purpose warning about possible response problems."],
] as const satisfies readonly RawEntry[];

function toHeaderInfo([name, category, context, status, settableViaHeadersFile, description]: RawEntry): HeaderInfo {
  return {
    name,
    category,
    context,
    status,
    settableViaHeadersFile,
    description,
    referenceUrl: `${MDN_BASE}/${name}`,
  };
}

/** The full header catalog, in declaration order. */
export const HEADERS_REGISTRY: readonly HeaderInfo[] = RAW_HEADERS.map(toHeaderInfo);

/** Union of every known, correctly-cased header name in the catalog. */
export type KnownHeaderName = (typeof RAW_HEADERS)[number][0];

/** O(1) lookup from header name to its metadata. Keys are lower-cased. */
const REGISTRY_BY_LOWER_NAME: ReadonlyMap<string, HeaderInfo> = new Map(
  HEADERS_REGISTRY.map((info) => [info.name.toLowerCase(), info]),
);

/**
 * Look up metadata for a header name (case-insensitive). Returns `undefined`
 * for headers not in the catalog (e.g. your own custom `X-` headers).
 */
export function getHeaderInfo(name: string): HeaderInfo | undefined {
  return REGISTRY_BY_LOWER_NAME.get(name.toLowerCase());
}

/** Whether a header name is recognized by the catalog. */
export function isKnownHeader(name: string): name is KnownHeaderName {
  return REGISTRY_BY_LOWER_NAME.has(name.toLowerCase());
}

/** All headers in a given category. */
export function getHeadersByCategory(category: HeaderCategory): HeaderInfo[] {
  return HEADERS_REGISTRY.filter((h) => h.category === category);
}

/** All headers with a given status (e.g. every deprecated header). */
export function getHeadersByStatus(status: HeaderStatus): HeaderInfo[] {
  return HEADERS_REGISTRY.filter((h) => h.status === status);
}
