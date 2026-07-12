import {
	immutableAssetCacheControl,
	noStoreCacheControl,
} from './helpers/cache-control.js';
import { strictCsp, type CspOptions } from './helpers/csp.js';
import {
	lockedDownPermissionsPolicy,
	type PermissionsPolicyOptions,
} from './helpers/permissions-policy.js';
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

/** Options to customize the default security headers preset. */
export interface SecurityHeadersPresetOptions {
	/** Overrides for the Content-Security-Policy directive. */
	csp?: CspOptions;
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

function isSecurityHeadersPresetOptions(
	options: CspOptions | SecurityHeadersPresetOptions,
): options is SecurityHeadersPresetOptions {
	const keys = Object.keys(options);
	if (keys.length === 0) return true;

	const presetKeys = new Set([
		'csp',
		'hsts',
		'permissions',
		'coop',
		'coep',
		'corp',
	]);
	return keys.some((key) => presetKeys.has(key));
}

/** Allow any origin to fetch matching assets (fonts, images, etc) under the specified `path`. */
export function corsPreset(path: string): HeaderRule {
	return {
		path,
		comment: 'Allow cross-origin fetches of these assets.',
		headers: { 'Access-Control-Allow-Origin': '*' },
	};
}

/** Keep a `*.pages.dev` / `*.workers.dev` preview subdomain out of search
 * results, so only your custom domain gets indexed. */
export function noIndexPreviewDomainPreset(
	domainPattern: `https://${string}` = 'https://:project.pages.dev/*',
): HeaderRule {
	return {
		path: domainPattern,
		comment:
			'Prevent the preview subdomain from being indexed by search engines.',
		headers: { 'X-Robots-Tag': 'noindex' },
	};
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

/** A solid baseline of hardening headers for HTML/app routes. Pass
 * `options` to adjust CSP, HSTS, Permissions-Policy, COOP, COEP, or CORP.
 * For backward compatibility, you can also pass raw `CspOptions` as the second argument. */
export function securityHeadersPreset(
	path = '/*',
	options: CspOptions | SecurityHeadersPresetOptions = {},
): HeaderRule {
	let cspOpts: CspOptions = {};
	let hstsOpt: boolean | HstsOptions = { maxAge: 31536000 };
	let permissionsOpt: PermissionsPolicyOptions | undefined;
	let coopOpt:
		| boolean
		| 'same-origin'
		| 'same-origin-allow-popups'
		| 'unsafe-none' = 'same-origin';
	let coepOpt: boolean | 'require-corp' | 'credentialless' | 'unsafe-none' =
		false;
	let corpOpt: boolean | 'same-origin' | 'same-site' | 'cross-origin' =
		'same-origin';

	if (options) {
		if (isSecurityHeadersPresetOptions(options)) {
			const typedOpts = options;
			cspOpts = typedOpts.csp ?? {};
			if (typedOpts.hsts !== undefined) {
				hstsOpt = typedOpts.hsts;
			}
			permissionsOpt = typedOpts.permissions;
			if (typedOpts.coop !== undefined) coopOpt = typedOpts.coop;
			if (typedOpts.coep !== undefined) coepOpt = typedOpts.coep;
			if (typedOpts.corp !== undefined) corpOpt = typedOpts.corp;
		} else {
			// Backward compatibility: the options object itself contains CSP overrides
			cspOpts = options;
			console.warn(
				'cf-headers: Passing raw CspOptions directly as the second argument to securityHeadersPreset is deprecated. ' +
					'Please wrap your CSP options in the `csp` property, e.g. securityHeadersPreset("/*", { csp: { ... } }).',
			);
		}
	}

	const headers: HeaderRule['headers'] = {
		'X-Content-Type-Options': 'nosniff',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Content-Security-Policy': strictCsp(cspOpts),
	};

	// Note: X-Frame-Options is intentionally omitted because the default CSP
	// includes 'frame-ancestors 'none'', which obsoletes it in modern browsers.
	// We omit it to keep headers lean, but some legacy scanners may still flag its absence.

	const hstsValue = formatHsts(hstsOpt);
	if (hstsValue) {
		headers['Strict-Transport-Security'] = hstsValue;
	}

	// Note: We use a minimal default for Permissions-Policy ('camera=(), microphone=(), geolocation=()')
	// to restrict the most commonly abused features without breaking standard features (like payment/usb)
	// by default. For a broader lockdown, pass explicit options to use lockedDownPermissionsPolicy.
	headers['Permissions-Policy'] = permissionsOpt
		? lockedDownPermissionsPolicy(permissionsOpt)
		: 'camera=(), microphone=(), geolocation=()';

	if (coopOpt !== false) {
		headers['Cross-Origin-Opener-Policy'] =
			coopOpt === true ? 'same-origin' : coopOpt;
	}
	if (coepOpt !== false) {
		headers['Cross-Origin-Embedder-Policy'] =
			coepOpt === true ? 'require-corp' : coepOpt;
	}
	if (corpOpt !== false) {
		headers['Cross-Origin-Resource-Policy'] =
			corpOpt === true ? 'same-origin' : corpOpt;
	}

	return {
		path,
		comment: 'Baseline security headers.',
		headers,
	};
}
