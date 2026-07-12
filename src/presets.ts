import { immutableAssetCacheControl } from './helpers/cache-control.js';
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
}

function formatHsts(options: boolean | HstsOptions): string | undefined {
	if (options === false) return undefined;
	if (options === true) {
		return 'max-age=31536000';
	}
	const maxAge = options.maxAge ?? 31536000;
	const parts = [`max-age=${maxAge}`];
	if (options.includeSubDomains) {
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

/** A solid baseline of hardening headers for HTML/app routes. Pass
 * `options` to adjust CSP, HSTS, or Permissions-Policy. For backward compatibility,
 * you can also pass raw `CspOptions` as the second argument. */
export function securityHeadersPreset(
	path = '/*',
	options: CspOptions | SecurityHeadersPresetOptions = {},
): HeaderRule {
	let cspOpts: CspOptions = {};
	let hstsOpt: boolean | HstsOptions = { maxAge: 31536000 };
	let permissionsOpt: PermissionsPolicyOptions | undefined = undefined;

	if (options) {
		if ('csp' in options || 'hsts' in options || 'permissions' in options) {
			const typedOpts = options as SecurityHeadersPresetOptions;
			cspOpts = typedOpts.csp ?? {};
			if (typedOpts.hsts !== undefined) {
				hstsOpt = typedOpts.hsts;
			}
			permissionsOpt = typedOpts.permissions;
		} else {
			// Backward compatibility: the options object itself contains CSP overrides
			cspOpts = options as CspOptions;
		}
	}

	const headers: Record<string, any> = {
		'X-Content-Type-Options': 'nosniff',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Content-Security-Policy': strictCsp(cspOpts),
	};

	const hstsValue = formatHsts(hstsOpt);
	if (hstsValue) {
		headers['Strict-Transport-Security'] = hstsValue;
	}

	headers['Permissions-Policy'] = permissionsOpt
		? lockedDownPermissionsPolicy(permissionsOpt)
		: 'camera=(), microphone=(), geolocation=()';

	return {
		path,
		comment: 'Baseline security headers.',
		headers,
	};
}
