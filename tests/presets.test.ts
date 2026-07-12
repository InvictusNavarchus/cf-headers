import { describe, expect, it } from 'vitest';
import {
	cacheControl,
	immutableAssetCacheControl,
	noCacheControl,
} from '../src/helpers/cache-control.js';
import { csp, strictCsp } from '../src/helpers/csp.js';
import {
	lockedDownPermissionsPolicy,
	permissionsPolicy,
} from '../src/helpers/permissions-policy.js';
import {
	corsPreset,
	immutableAssetsPreset,
	noIndexPreviewDomainPreset,
	securityHeadersPreset,
} from '../src/presets.js';

describe('cacheControl', () => {
	it('builds a directive list in a stable order', () => {
		expect(cacheControl({ public: true, maxAge: 3600, immutable: true })).toBe(
			'public, max-age=3600, immutable',
		);
	});

	it("matches Cloudflare's fingerprinted-asset example", () => {
		expect(immutableAssetCacheControl()).toBe(
			'public, max-age=31536000, immutable',
		);
	});

	it('builds a no-cache preset', () => {
		expect(noCacheControl()).toBe('public, max-age=0, must-revalidate');
	});

	it('rejects public+private together', () => {
		expect(() => cacheControl({ public: true, private: true })).toThrow(
			/mutually exclusive/,
		);
	});

	it('rejects noStore combined with maxAge', () => {
		expect(() => cacheControl({ noStore: true, maxAge: 60 })).toThrow(
			/noStore/,
		);
	});

	it('rejects an empty options object', () => {
		expect(() => cacheControl({})).toThrow(/at least one directive/);
	});
});

describe('csp', () => {
	it("joins directives with '; ' and sources with a space", () => {
		expect(
			csp({
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'", 'https://cdn.example.com'],
			}),
		).toBe("default-src 'self'; script-src 'self' https://cdn.example.com");
	});

	it('appends bare directives without a value', () => {
		expect(csp({ defaultSrc: ["'self'"], upgradeInsecureRequests: true })).toBe(
			"default-src 'self'; upgrade-insecure-requests",
		);
	});

	it('strictCsp() produces a locked-down baseline', () => {
		expect(strictCsp()).toBe(
			"default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
		);
	});

	it('rejects an empty options object', () => {
		expect(() => csp({})).toThrow(/at least one directive/);
	});
});

describe('permissionsPolicy', () => {
	it('renders an empty allowlist as ()', () => {
		expect(permissionsPolicy({ camera: [] })).toBe('camera=()');
	});

	it("renders 'self' unquoted and other origins quoted", () => {
		expect(
			permissionsPolicy({ geolocation: ['self', 'https://example.com'] }),
		).toBe('geolocation=(self "https://example.com")');
	});

	it('renders a wildcard allowlist as *', () => {
		expect(permissionsPolicy({ fullscreen: '*' })).toBe('fullscreen=*');
	});

	it('supports arbitrary feature names via `extra`', () => {
		expect(permissionsPolicy({ extra: { 'attribution-reporting': [] } })).toBe(
			'attribution-reporting=()',
		);
	});

	it('lockedDownPermissionsPolicy() blocks the common sensitive features', () => {
		expect(lockedDownPermissionsPolicy()).toContain('camera=()');
		expect(lockedDownPermissionsPolicy()).toContain('browsing-topics=()');
	});
});

describe('presets', () => {
	it('corsPreset sets Access-Control-Allow-Origin: * for the given path', () => {
		const p = corsPreset('/assets/*');
		expect(p.path).toBe('/assets/*');
		expect(p.headers['Access-Control-Allow-Origin']).toBe('*');
	});

	it('noIndexPreviewDomainPreset sets X-Robots-Tag: noindex', () => {
		const p = noIndexPreviewDomainPreset('https://:project.pages.dev/*');
		expect(p.headers['X-Robots-Tag']).toBe('noindex');
	});

	it('immutableAssetsPreset uses the immutable cache-control value', () => {
		const p = immutableAssetsPreset();
		expect(p.headers['Cache-Control']).toBe(
			'public, max-age=31536000, immutable',
		);
	});

	it('securityHeadersPreset sets the baseline hardening headers', () => {
		const p = securityHeadersPreset();
		expect(p.headers['X-Content-Type-Options']).toBe('nosniff');
		expect(typeof p.headers['Content-Security-Policy']).toBe('string');
		expect(p.headers['Strict-Transport-Security']).toBe('max-age=31536000');
		expect(p.headers['Permissions-Policy']).toBe(
			'camera=(), microphone=(), geolocation=()',
		);
	});

	it('securityHeadersPreset supports custom HSTS config', () => {
		const p = securityHeadersPreset('/*', {
			hsts: { maxAge: 600, includeSubDomains: true, preload: true },
		});
		expect(p.headers['Strict-Transport-Security']).toBe(
			'max-age=600; includeSubDomains; preload',
		);
	});

	it('securityHeadersPreset supports disabling HSTS', () => {
		const p = securityHeadersPreset('/*', { hsts: false });
		expect(p.headers['Strict-Transport-Security']).toBeUndefined();
	});

	it('securityHeadersPreset supports boolean true HSTS', () => {
		const p = securityHeadersPreset('/*', { hsts: true });
		expect(p.headers['Strict-Transport-Security']).toBe('max-age=31536000');
	});

	it('securityHeadersPreset supports custom permissions policy', () => {
		const p = securityHeadersPreset('/*', {
			permissions: { camera: ['self'] },
		});
		expect(p.headers['Permissions-Policy']).toContain('camera=(self)');
		expect(p.headers['Permissions-Policy']).toContain('microphone=()');
	});

	it('securityHeadersPreset supports backward compatibility with raw CspOptions', () => {
		const p = securityHeadersPreset('/*', { scriptSrc: ["'self'"] });
		expect(p.headers['Content-Security-Policy']).toContain("script-src 'self'");
		expect(p.headers['Strict-Transport-Security']).toBe('max-age=31536000');
	});
});
