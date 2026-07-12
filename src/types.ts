import type { KnownHeaderName } from './registry.js';
import type { HeaderValueFor } from './header-values.js';

/**
 * Broad grouping used to organize the header catalog (mirrors how the
 * headers are commonly categorized in HTTP references).
 */
export type HeaderCategory =
	| 'authentication'
	| 'caching'
	| 'conditionals'
	| 'connection-management'
	| 'content-negotiation'
	| 'controls'
	| 'cookies'
	| 'cors'
	| 'downloads'
	| 'integrity'
	| 'message-body'
	| 'preferences'
	| 'proxies'
	| 'range-requests'
	| 'redirects'
	| 'request-context'
	| 'response-context'
	| 'security'
	| 'fetch-metadata'
	| 'storage-access'
	| 'client-hints'
	| 'compression-dictionary'
	| 'attribution-reporting'
	| 'privacy'
	| 'topics-api'
	| 'websocket'
	| 'reporting'
	| 'transfer-coding'
	| 'non-standard'
	| 'other';

/**
 * Standardization / support status for a header.
 *
 * - `standard`      Defined in a stable spec and broadly supported.
 * - `experimental`  Behind a spec draft, origin trial, or limited rollout.
 * - `deprecated`     Superseded or removed; kept for legacy interop only.
 * - `non-standard`  Proprietary/convention-based, not part of a formal spec.
 */
export type HeaderStatus =
	| 'standard'
	| 'experimental'
	| 'deprecated'
	| 'non-standard';

/** Which side of the exchange a header is normally sent on. */
export type HeaderContext = 'request' | 'response' | 'both';

/** Static metadata describing a single HTTP header. */
export interface HeaderInfo {
	/** Canonical, correctly-cased header name, e.g. "Content-Security-Policy". */
	readonly name: string;
	readonly category: HeaderCategory;
	readonly context: HeaderContext;
	readonly status: HeaderStatus;
	/** One-line, plain-English explanation of what the header does. */
	readonly description: string;
	/** Set when this header is realistically something you'd emit from a
	 * static-hosting `_headers` file (i.e. it is response-oriented and not
	 * purely informational/request-only). */
	readonly settableViaHeadersFile: boolean;
	/** Absolute URL to further reading. */
	readonly referenceUrl: string;
}

/** Rule for detaching (removing) a header that Cloudflare or an earlier,
 * less specific rule would otherwise apply. */
export interface DetachHeader {
	readonly detach: true;
}

/**
 * A single line of Cache-Control-like syntax where you may want either a
 * literal value or an explicit "remove this header" marker.
 */
export type HeaderDirective = string | number | DetachHeader;

/**
 * The rule's header block. Known header names get autocomplete + (for a
 * handful of headers) a narrowed value type; unknown/custom header names
 * (including `X-` prefixed ones) are still accepted as plain strings.
 *
 * `KnownHeaderName | (string & {})` is the standard TS trick for "suggest
 * these literals, but still accept any string" — using plain `string` here
 * instead would make editors drop the autocomplete list entirely.
 */
export type HeaderBlock = {
	[header: string]: HeaderDirective;
};

/**
 * The type-strong shape used by the public API: every known header name is
 * offered with its narrowed value type (falling back to `string`), and any
 * other string key is still accepted for custom/experimental headers.
 */
export type HeaderBlockInput = {
	[K in KnownHeaderName]?: HeaderValueFor<K> | DetachHeader;
} & {
	[header: string]: HeaderDirective;
};

/** A single `_headers` rule: a URL pattern plus the header lines under it. */
export interface HeaderRule {
	/**
	 * Path or absolute URL this rule applies to. Supports Cloudflare's
	 * `_redirects`-style matching: `*` splats and `:placeholder` segments.
	 */
	path: string;
	headers: HeaderBlockInput;
	/** Optional human-readable note, emitted as a `#` comment above the rule. */
	comment?: string;
}

/** Top-level generator configuration. */
export interface CfHeadersConfig {
	/**
	 * Directory the `_headers` file should be written into — typically your
	 * framework's build output directory (e.g. `dist`, `build`, `public`).
	 */
	outDir: string;
	rules: HeaderRule[];
	/**
	 * When true (default), rules that violate Cloudflare's documented limits
	 * (100 rules, 2000 chars/line) throw. When false, they only warn.
	 */
	strict?: boolean;
}

/** Result of validating a config before writing the file. */
export interface ValidationIssue {
	level: 'error' | 'warning';
	message: string;
	ruleIndex?: number;
}
