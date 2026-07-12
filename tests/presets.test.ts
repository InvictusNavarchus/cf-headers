import { describe, expect, it } from 'vitest';
import {
	cacheControl,
	immutableAssetCacheControl,
	noCacheControl,
	noStoreCacheControl,
} from '../src/helpers/cache-control.js';
import { csp, strictCsp } from '../src/helpers/csp.js';
import {
	lockedDownPermissionsPolicy,
	permissionsPolicy,
} from '../src/helpers/permissions-policy.js';
import {
	corsPreset,
	dynamicContentPreset,
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

	it('supports stale-while-revalidate and stale-if-error directives', () => {
		expect(
			cacheControl({
				public: true,
				maxAge: 3600,
				staleWhileRevalidate: 60,
				staleIfError: 300,
			}),
		).toBe(
			'public, max-age=3600, stale-while-revalidate=60, stale-if-error=300',
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

	it('builds a no-store preset', () => {
		expect(noStoreCacheControl()).toBe('no-cache, no-store, must-revalidate');
	});

	it('serializes public+private together', () => {
		expect(cacheControl({ public: true, private: true })).toBe(
			'public, private',
		);
	});

	it('serializes noStore combined with maxAge', () => {
		expect(cacheControl({ noStore: true, maxAge: 60 })).toBe(
			'no-store, max-age=60',
		);
	});

	it('serializes an empty options object as empty string', () => {
		expect(cacheControl({})).toBe('');
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

	it('supports reportUri and reportTo options', () => {
		expect(
			csp({
				defaultSrc: ["'self'"],
				reportUri: 'https://example.report-uri.com/r/d/csp/enforce',
				reportTo: 'default-endpoint',
			}),
		).toBe(
			"default-src 'self'; report-uri https://example.report-uri.com/r/d/csp/enforce; report-to default-endpoint",
		);
	});

	it('strictCsp() produces a locked-down baseline', () => {
		expect(strictCsp()).toBe(
			"default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
		);
	});

	it('serializes an empty options object as empty string', () => {
		expect(csp({})).toBe('');
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
		expect(p.headers['X-Frame-Options']).toBe('DENY');
		expect(typeof p.headers['Content-Security-Policy']).toBe('string');
		expect(p.headers['Strict-Transport-Security']).toBe('max-age=31536000');
		expect(p.headers['Permissions-Policy']).toBe(
			'camera=(), microphone=(), geolocation=()',
		);
		expect(p.headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
		expect(p.headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
		expect(p.headers['Cross-Origin-Embedder-Policy']).toBe('unsafe-none');
	});

	it('dynamicContentPreset sets no-store caching headers', () => {
		const p = dynamicContentPreset();
		expect(p.path).toBe('/*');
		expect(p.headers['Cache-Control']).toBe(
			'no-cache, no-store, must-revalidate',
		);
	});

	it('securityHeadersPreset supports custom HSTS config', () => {
		const p = securityHeadersPreset('/*', {
			hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
		});
		expect(p.headers['Strict-Transport-Security']).toBe(
			'max-age=31536000; includeSubDomains; preload',
		);
	});

	it('securityHeadersPreset auto-includes includeSubDomains when preload is true', () => {
		const p = securityHeadersPreset('/*', {
			hsts: { preload: true },
		});
		expect(p.headers['Strict-Transport-Security']).toBe(
			'max-age=31536000; includeSubDomains; preload',
		);
	});

	it('securityHeadersPreset throws if preload is true but includeSubDomains is false', () => {
		expect(() =>
			securityHeadersPreset('/*', {
				hsts: { preload: true, includeSubDomains: false },
			}),
		).toThrow('HSTS preload requires includeSubDomains to be enabled.');
	});

	it('securityHeadersPreset throws if preload is true but maxAge is less than 1 year', () => {
		expect(() =>
			securityHeadersPreset('/*', {
				hsts: { preload: true, maxAge: 600 },
			}),
		).toThrow(
			'HSTS preload requires a maxAge of at least 31536000 seconds (1 year).',
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

	it('securityHeadersPreset supports custom COOP, COEP, and CORP settings', () => {
		const p = securityHeadersPreset('/*', {
			coop: 'same-origin-allow-popups',
			coep: 'require-corp',
			corp: 'same-site',
		});
		expect(p.headers['Cross-Origin-Opener-Policy']).toBe(
			'same-origin-allow-popups',
		);
		expect(p.headers['Cross-Origin-Embedder-Policy']).toBe('require-corp');
		expect(p.headers['Cross-Origin-Resource-Policy']).toBe('same-site');
	});

	it('securityHeadersPreset supports disabling COOP, COEP, and CORP', () => {
		const p = securityHeadersPreset('/*', {
			coop: false,
			coep: false,
			corp: false,
		});
		expect(p.headers['Cross-Origin-Opener-Policy']).toBeUndefined();
		expect(p.headers['Cross-Origin-Embedder-Policy']).toBeUndefined();
		expect(p.headers['Cross-Origin-Resource-Policy']).toBeUndefined();
	});

	it('securityHeadersPreset supports custom X-Frame-Options settings', () => {
		const p1 = securityHeadersPreset('/*', { xFrameOptions: 'SAMEORIGIN' });
		expect(p1.headers['X-Frame-Options']).toBe('SAMEORIGIN');

		const p2 = securityHeadersPreset('/*', { xFrameOptions: false });
		expect(p2.headers['X-Frame-Options']).toBeUndefined();

		const p3 = securityHeadersPreset('/*', { xFrameOptions: true });
		expect(p3.headers['X-Frame-Options']).toBe('DENY');
	});

	it('securityHeadersPreset supports backward compatibility with raw CspOptions', () => {
		const p = securityHeadersPreset('/*', { scriptSrc: ["'self'"] });
		expect(p.headers['Content-Security-Policy']).toContain("script-src 'self'");
		expect(p.headers['Strict-Transport-Security']).toBe('max-age=31536000');
	});
});
