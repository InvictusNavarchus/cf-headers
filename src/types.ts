export type {
	HeaderCategory,
	HeaderContext,
	HeaderInfo,
	HeaderStatus,
} from './registry.js';
import type { KnownHeaderName } from './registry.js';
import type { HeaderValueFor } from './header-values.js';

/** Rule for detaching (removing) a header that Cloudflare or an earlier,
 * less specific rule would otherwise apply. */
export interface DetachHeader {
	readonly detach: true;
}

/** Rule for overriding a header that Cloudflare or an earlier, less specific
 * rule would otherwise apply. Cloudflare does not use path specificity to resolve
 * conflicts; instead it comma-joins values. This directive renders a detach
 * line followed by a set line to ensure the new value wins. */
export interface OverrideHeader {
	readonly override: string | number;
}

/**
 * A single line of Cache-Control-like syntax where you may want either a
 * literal value, an explicit "remove this header" marker, or an override marker.
 */
export type HeaderDirective = string | number | DetachHeader | OverrideHeader;

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
	[K in KnownHeaderName]?: HeaderValueFor<K> | DetachHeader | OverrideHeader;
} & {
	[header: string]: HeaderDirective;
};

/** A single `_headers` rule: a URL pattern plus the header lines under it.
 *
 * ⚠️ Precedence note: Cloudflare does NOT use path specificity to resolve
 * conflicts. If multiple rules match the same request and set the same
 * header name, Cloudflare *comma-joins* the values rather than letting one
 * win. To make a narrower rule truly override a broader one, use
 * `override()` (or a manual `{ detach: true }` + separate rule) instead of
 * just setting the header again.
 */
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
	rules: (HeaderRule | HeaderRule[])[];
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
