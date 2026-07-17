import {
	immutableAssetCacheControl,
	noStoreCacheControl,
} from './helpers/cache-control.js';
import { strictCsp, compatibleCsp, type CspOptions } from './helpers/csp.js';
import {
	lockedDownPermissionsPolicy,
	type PermissionsPolicyOptions,
} from './helpers/permissions-policy.js';
import type {
	CrossOriginEmbedderPolicyValue,
	CrossOriginOpenerPolicyValue,
	CrossOriginResourcePolicyValue,
	XFrameOptionsValue,
} from './header-values.js';
import type { HeaderRule } from './types.js';

/** Configuration options for HTTP Strict Transport Security (HSTS). */
export interface HstsOptions {
	/** The time, in seconds, that the browser should remember that a site is only to be accessed using HTTPS. Defaults to 31536000 (1 year). */
	maxAge?: number;
	/** If true, this rule applies to all of the site's subdomains as well. */
	includeSubDomains?: boolean;
	/** If true, requests to preload the HSTS configuration for the domain will be submitted. */
	preload?: boolean;
}

export type CspPresetName = 'compatible' | 'strict';

/** Options to customize the default security headers preset. */
export interface SecurityHeadersPresetOptions {
	/**
	 * Configures Content-Security-Policy (CSP). Pass `false` to disable.
	 * Defaults to `'compatible'` (allows same-origin JS/assets and inline styles).
	 */
	csp?:
		| CspPresetName
		| CspOptions
		| { preset: CspPresetName; overrides?: CspOptions }
		| false;
	/** Configures HTTP Strict Transport Security (HSTS). Pass `false` to disable entirely. Defaults to `{ maxAge: 31536000 }` (without subdomains/preload). */
	hsts?: boolean | HstsOptions;
	/** Overrides for the Permissions-Policy. */
	permissions?: PermissionsPolicyOptions;
	/** Configures Cross-Origin-Opener-Policy (COOP). Pass `false` to disable. Defaults to `'same-origin'`. */
	coop?: boolean | 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';
	/** Configures Cross-Origin-Embedder-Policy (COEP). Pass `false` to disable. Defaults to `false` (disabled) to avoid breaking third-party assets. */
	coep?: boolean | 'require-corp' | 'credentialless' | 'unsafe-none';
	/** Configures Cross-Origin-Resource-Policy (CORP). Pass `false` to disable. Defaults to `'same-origin'`. */
	corp?: boolean | 'same-origin' | 'same-site' | 'cross-origin';
	/** Configures X-Frame-Options. Pass `false` to disable. Defaults to `'DENY'`. */
	xFrameOptions?: boolean | 'DENY' | 'SAMEORIGIN';
}

function formatHsts(options: boolean | HstsOptions): string | undefined {
	if (options === false) return undefined;
	if (options === true) {
		return 'max-age=31536000';
	}
	const maxAge = options.maxAge ?? 31536000;
	if (options.preload) {
		if (options.includeSubDomains === false) {
			throw new Error('HSTS preload requires includeSubDomains to be enabled.');
		}
		if (maxAge < 31536000) {
			throw new Error(
				`HSTS preload requires a maxAge of at least 31536000 seconds (1 year). Received: ${maxAge}`,
			);
		}
	}
	const parts = [`max-age=${maxAge}`];
	if (options.includeSubDomains || options.preload) {
		parts.push('includeSubDomains');
	}
	if (options.preload) {
		parts.push('preload');
	}
	return parts.join('; ');
}

/** Allow any origin to fetch matching assets (fonts, images, etc) under the specified `path`. */
export function corsPreset(path: string): HeaderRule {
	return {
		path,
		comment: 'Allow cross-origin fetches of these assets.',
		headers: { 'Access-Control-Allow-Origin': '*' },
	};
}

/** Options to customize the no-index preview domain preset. */
export interface NoIndexPresetOptions {
	/**
	 * The Cloudflare platform to target.
	 * - 'pages' (default): Blocks *.pages.dev and *.*.pages.dev
	 * - 'workers': Blocks *.*.workers.dev
	 */
	platform?: 'pages' | 'workers';
}

/**
 * Keep Cloudflare's default platform domains (*.pages.dev / *.workers.dev)
 * out of search results, so only your custom domain gets indexed.
 *
 * Note: If you need to noindex a custom domain (e.g., staging.mysite.com),
 * do not use this preset. Instead, define a raw HeaderRule with an absolute URL:
 * { path: 'https://staging.mysite.com/*', headers: { 'X-Robots-Tag': 'noindex' } }
 */
export function noIndexPreviewDomainPreset(
	options: NoIndexPresetOptions = {},
): HeaderRule[] {
	if (options.platform === 'workers') {
		return [
			{
				// Matches <worker-name>.<account-subdomain>.workers.dev
				path: 'https://:version.:subdomain.workers.dev/*',
				comment: 'Block indexing of workers.dev preview deployment subdomains.',
				headers: { 'X-Robots-Tag': 'noindex' },
			},
		];
	}

	// Default to 'pages'
	return [
		{
			// Matches <project>.pages.dev
			path: 'https://:project.pages.dev/*',
			comment:
				'Block indexing of the root fallback domain. (Preview deployments are auto-excluded by Cloudflare by default).',
			headers: { 'X-Robots-Tag': 'noindex' },
		},
		{
			// Matches <branch>.<project>.pages.dev
			path: 'https://:version.:project.pages.dev/*',
			comment: 'Block indexing of hash/branch preview deployment subdomains.',
			headers: { 'X-Robots-Tag': 'noindex' },
		},
	];
}

/** Long-lived, immutable caching for content-hashed build output
 * (e.g. Vite/webpack's fingerprinted `/assets/*` files). */
export function immutableAssetsPreset(path = '/assets/*'): HeaderRule {
	return {
		path,
		comment:
			'Fingerprinted assets never change contents for a given URL — cache aggressively.',
		headers: { 'Cache-Control': immutableAssetCacheControl() },
	};
}

/** Prevent caching for HTML entry points, API routes, or dynamic content
 * to ensure users always receive the latest version. */
export function dynamicContentPreset(path = '/*'): HeaderRule {
	return {
		path,
		comment: 'Do not cache HTML entry points or dynamic content.',
		headers: { 'Cache-Control': noStoreCacheControl() },
	};
}

// Helper: resolves boolean | T | undefined configuration options
function resolveSecurityOption<T extends string>(
	value: boolean | T | undefined,
	trueValue: T,
	...args: [undefinedValue?: T]
): T | undefined {
	if (value === false) return undefined;
	if (value === true) return trueValue;
	if (value === undefined) {
		return args.length > 0 ? args[0] : trueValue;
	}
	return value;
}

function resolveXFrameOptions(
	opt?: boolean | XFrameOptionsValue,
): XFrameOptionsValue | undefined {
	return resolveSecurityOption(opt, 'DENY');
}

function resolveHsts(opt?: boolean | HstsOptions): string | undefined {
	return formatHsts(opt ?? { maxAge: 31536000 });
}

function resolvePermissionsPolicy(opt?: PermissionsPolicyOptions): string {
	return lockedDownPermissionsPolicy(opt ?? {});
}

function resolveCsp(
	opt?:
		| CspPresetName
		| CspOptions
		| { preset: CspPresetName; overrides?: CspOptions }
		| false,
): string | undefined {
	if (opt === false) return undefined;
	if (opt === undefined || opt === 'compatible') {
		return compatibleCsp({});
	}
	if (opt === 'strict') {
		return strictCsp({});
	}
	if (typeof opt === 'object') {
		if ('preset' in opt) {
			const config = opt as { preset: CspPresetName; overrides?: CspOptions };
			return config.preset === 'strict'
				? strictCsp(config.overrides ?? {})
				: compatibleCsp(config.overrides ?? {});
		}
		return compatibleCsp(opt);
	}
	return undefined;
}

function resolveCoop(
	opt?: boolean | CrossOriginOpenerPolicyValue,
): CrossOriginOpenerPolicyValue | undefined {
	return resolveSecurityOption(opt, 'same-origin');
}

function resolveCoep(
	opt?: boolean | CrossOriginEmbedderPolicyValue,
): CrossOriginEmbedderPolicyValue | undefined {
	return resolveSecurityOption(opt, 'require-corp', undefined);
}

function resolveCorp(
	opt?: boolean | CrossOriginResourcePolicyValue,
): CrossOriginResourcePolicyValue | undefined {
	return resolveSecurityOption(opt, 'same-origin');
}

/**
 * A solid baseline of hardening headers for HTML/app routes. Pass
 * `options` to adjust CSP, HSTS, Permissions-Policy, COOP, COEP, or CORP.
 */
export function securityHeadersPreset(
	path = '/*',
	options: SecurityHeadersPresetOptions = {},
): HeaderRule {
	const headers: HeaderRule['headers'] = {
		'X-Content-Type-Options': 'nosniff',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
	};

	const cspVal = resolveCsp(options.csp);
	if (cspVal) {
		headers['Content-Security-Policy'] = cspVal;
	}

	const xfo = resolveXFrameOptions(options.xFrameOptions);
	if (xfo) headers['X-Frame-Options'] = xfo;

	const hsts = resolveHsts(options.hsts);
	if (hsts) headers['Strict-Transport-Security'] = hsts;

	headers['Permissions-Policy'] = resolvePermissionsPolicy(options.permissions);

	const coop = resolveCoop(options.coop);
	if (coop) headers['Cross-Origin-Opener-Policy'] = coop;

	const coep = resolveCoep(options.coep);
	if (coep) headers['Cross-Origin-Embedder-Policy'] = coep;

	const corp = resolveCorp(options.corp);
	if (corp) headers['Cross-Origin-Resource-Policy'] = corp;

	return {
		path,
		comment: 'Baseline security headers.',
		headers,
	};
}
