export type ReferrerPolicyValue =
	| 'no-referrer'
	| 'no-referrer-when-downgrade'
	| 'origin'
	| 'origin-when-cross-origin'
	| 'same-origin'
	| 'strict-origin'
	| 'strict-origin-when-cross-origin'
	| 'unsafe-url';

export type XFrameOptionsValue = 'DENY' | 'SAMEORIGIN';

export type CrossOriginOpenerPolicyValue =
	| 'unsafe-none'
	| 'same-origin-allow-popups'
	| 'same-origin';

export type CrossOriginEmbedderPolicyValue =
	| 'unsafe-none'
	| 'require-corp'
	| 'credentialless';

export type CrossOriginResourcePolicyValue =
	| 'same-site'
	| 'same-origin'
	| 'cross-origin';

export type XPermittedCrossDomainPoliciesValue =
	| 'none'
	| 'master-only'
	| 'by-content-type'
	| 'all';

export type XDnsPrefetchControlValue = 'on' | 'off';

export type XContentTypeOptionsValue = 'nosniff';

/**
 * Explicit value types for headers with a fixed, well-known vocabulary.
 * Anything not listed here falls back to plain `string` — most headers
 * (Cache-Control, CSP, Permissions-Policy, ...) are better served by the
 * dedicated builder helpers in `src/helpers/*` than by a giant literal union.
 */
export interface TypedHeaderValues {
	'Referrer-Policy': ReferrerPolicyValue;
	'X-Frame-Options': XFrameOptionsValue;
	'Cross-Origin-Opener-Policy': CrossOriginOpenerPolicyValue;
	'Cross-Origin-Embedder-Policy': CrossOriginEmbedderPolicyValue;
	'Cross-Origin-Resource-Policy': CrossOriginResourcePolicyValue;
	'X-Permitted-Cross-Domain-Policies': XPermittedCrossDomainPoliciesValue;
	'X-DNS-Prefetch-Control': XDnsPrefetchControlValue;
	'X-Content-Type-Options': XContentTypeOptionsValue;
}

export type HeaderValueFor<K extends string> = K extends keyof TypedHeaderValues
	? TypedHeaderValues[K]
	: string;
