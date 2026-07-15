import { describe, expect, it } from 'vitest';
import {
	generateHeadersFile,
	getRenderedLines,
	MAX_LINE_LENGTH,
	MAX_RULES,
} from '../src/build.js';
import { assertNoErrors, validateConfig } from '../src/validate.js';
import type { HeaderRule } from '../src/types.js';

describe('generateHeadersFile', () => {
	it('renders a single rule with a comment and one header', () => {
		const rules: HeaderRule[] = [
			{
				path: '/secure/page',
				comment: 'lock this down',
				headers: { 'X-Frame-Options': 'DENY' },
			},
		];
		expect(generateHeadersFile(rules)).toBe(
			'# lock this down\n/secure/page\n  X-Frame-Options: DENY\n',
		);
	});

	it('renders multiple header lines under one path, in insertion order', () => {
		const rules: HeaderRule[] = [
			{
				path: '/secure/page',
				headers: {
					'X-Frame-Options': 'DENY',
					'X-Content-Type-Options': 'nosniff',
					'Referrer-Policy': 'no-referrer',
				},
			},
		];
		expect(generateHeadersFile(rules)).toBe(
			'/secure/page\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n',
		);
	});

	it('separates multiple rule blocks with a blank line', () => {
		const rules: HeaderRule[] = [
			{ path: '/static/*', headers: { 'Access-Control-Allow-Origin': '*' } },
			{
				path: 'https://myworker.mysubdomain.workers.dev/*',
				headers: { 'X-Robots-Tag': 'noindex' },
			},
		];
		expect(generateHeadersFile(rules)).toBe(
			'/static/*\n  Access-Control-Allow-Origin: *\n\nhttps://myworker.mysubdomain.workers.dev/*\n  X-Robots-Tag: noindex\n',
		);
	});

	it("renders a detach directive with the '! ' marker", () => {
		const rules: HeaderRule[] = [
			{
				path: '/*.jpg',
				headers: { 'Content-Security-Policy': { detach: true } },
			},
		];
		expect(generateHeadersFile(rules)).toBe(
			'/*.jpg\n  ! Content-Security-Policy\n',
		);
	});

	it('renders an override directive with a detach followed by a set', () => {
		const rules: HeaderRule[] = [
			{
				path: '/assets/*',
				headers: {
					'Cache-Control': { override: 'public, max-age=31536000, immutable' },
				},
			},
		];
		expect(generateHeadersFile(rules)).toBe(
			'/assets/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n',
		);
	});

	it('supports placeholders in both the path and header value', () => {
		const rules: HeaderRule[] = [
			{
				path: '/movies/:title',
				headers: { 'x-movie-name': 'You are watching ":title"' },
			},
		];
		expect(generateHeadersFile(rules)).toBe(
			'/movies/:title\n  x-movie-name: You are watching ":title"\n',
		);
	});

	it('reproduces the CORS example from the Cloudflare docs', () => {
		const rules: HeaderRule[] = [
			{ path: '/*', headers: { 'Access-Control-Allow-Origin': '*' } },
		];
		expect(generateHeadersFile(rules)).toBe(
			'/*\n  Access-Control-Allow-Origin: *\n',
		);
	});

	it('reproduces the fingerprinted-assets caching example from the Cloudflare docs', () => {
		const rules: HeaderRule[] = [
			{
				path: '/static/*',
				headers: { 'Cache-Control': 'public, max-age=31556952, immutable' },
			},
		];
		expect(generateHeadersFile(rules)).toBe(
			'/static/*\n  Cache-Control: public, max-age=31556952, immutable\n',
		);
	});
});

describe('validateConfig', () => {
	it('flags more than the documented 100-rule maximum', () => {
		const rules: HeaderRule[] = Array.from(
			{ length: MAX_RULES + 1 },
			(_, i) => ({
				path: `/page-${i}`,
				headers: { 'X-Test': '1' },
			}),
		);
		const issues = validateConfig(rules);
		expect(
			issues.some((i) => i.level === 'error' && i.message.includes('100')),
		).toBe(true);
	});

	it('flags lines over the documented 2000-character limit', () => {
		const rules: HeaderRule[] = [
			{ path: '/*', headers: { 'X-Test': 'a'.repeat(MAX_LINE_LENGTH) } },
		];
		const issues = validateConfig(rules);
		expect(
			issues.some((i) => i.level === 'error' && i.message.includes('2000')),
		).toBe(true);
	});

	it("flags absolute URLs that aren't https", () => {
		const rules: HeaderRule[] = [
			{ path: 'http://example.com/*', headers: { 'X-Test': '1' } },
		];
		const issues = validateConfig(rules);
		expect(
			issues.some((i) => i.level === 'error' && i.message.includes('https')),
		).toBe(true);
	});

	it('flags absolute URLs with an explicit port', () => {
		const rules: HeaderRule[] = [
			{ path: 'https://example.com:8080/*', headers: { 'X-Test': '1' } },
		];
		const issues = validateConfig(rules);
		expect(
			issues.some((i) => i.level === 'error' && i.message.includes('port')),
		).toBe(true);
	});

	it('flags absolute URL patterns that do not contain a dot or end with /*', () => {
		const rules1: HeaderRule[] = [
			{ path: 'https://nodot/*', headers: { 'X-Test': '1' } },
		];
		const issues1 = validateConfig(rules1);
		expect(
			issues1.some(
				(i) => i.level === 'error' && i.message.includes('contain a dot'),
			),
		).toBe(true);

		const rules2: HeaderRule[] = [
			{ path: 'https://example.com/assets', headers: { 'X-Test': '1' } },
		];
		const issues2 = validateConfig(rules2);
		expect(
			issues2.some(
				(i) => i.level === 'error' && i.message.includes('end with "/*"'),
			),
		).toBe(true);
	});

	it('flags more than one splat in a path', () => {
		const rules: HeaderRule[] = [
			{ path: '/a/*/b/*', headers: { 'X-Test': '1' } },
		];
		const issues = validateConfig(rules);
		expect(
			issues.some((i) => i.level === 'error' && i.message.includes('splat')),
		).toBe(true);
	});

	it('warns (but does not error) on deprecated headers', () => {
		const rules: HeaderRule[] = [
			{ path: '/*', headers: { 'X-Frame-Options': 'DENY' } },
		];
		const issues = validateConfig(rules);
		expect(
			issues.some(
				(i) =>
					i.level === 'warning' &&
					i.message.startsWith('"X-Frame-Options" is deprecated'),
			),
		).toBe(true);
		expect(() => assertNoErrors(issues)).not.toThrow();
	});

	it('warns on wildcard Access-Control-Allow-Origin on path /*', () => {
		const rules: HeaderRule[] = [
			{ path: '/*', headers: { 'Access-Control-Allow-Origin': '*' } },
		];
		const issues = validateConfig(rules);
		expect(
			issues.some(
				(i) =>
					i.level === 'warning' &&
					i.message.includes('Access-Control-Allow-Origin: *'),
			),
		).toBe(true);
	});

	it('does not warn on wildcard Access-Control-Allow-Origin on narrower paths', () => {
		const rules: HeaderRule[] = [
			{ path: '/assets/*', headers: { 'Access-Control-Allow-Origin': '*' } },
		];
		const issues = validateConfig(rules);
		expect(
			issues.some((i) => i.message.includes('Access-Control-Allow-Origin')),
		).toBe(false);
	});

	it('warns on unsafe-inline in Content-Security-Policy without nonce or hash', () => {
		const rules: HeaderRule[] = [
			{
				path: '/*',
				headers: {
					'Content-Security-Policy': "default-src 'self' 'unsafe-inline'",
				},
			},
		];
		const issues = validateConfig(rules);
		expect(
			issues.some(
				(i) => i.level === 'warning' && i.message.includes('unsafe-inline'),
			),
		).toBe(true);
	});

	it('does not warn on unsafe-inline in Content-Security-Policy with nonce or hash', () => {
		const rules: HeaderRule[] = [
			{
				path: '/*',
				headers: {
					'Content-Security-Policy':
						"default-src 'self' 'unsafe-inline' 'nonce-123'",
				},
			},
			{
				path: '/2',
				headers: {
					'Content-Security-Policy':
						"default-src 'self' 'unsafe-inline' 'sha256-abc'",
				},
			},
			{
				path: '/3',
				headers: {
					'Content-Security-Policy':
						"default-src 'self' 'unsafe-inline' 'strict-dynamic'",
				},
			},
		];
		const issues = validateConfig(rules);
		expect(issues.some((i) => i.message.includes('unsafe-inline'))).toBe(false);
	});

	it('warns on unsafe-eval in Content-Security-Policy', () => {
		const rules: HeaderRule[] = [
			{
				path: '/*',
				headers: {
					'Content-Security-Policy': "default-src 'self' 'unsafe-eval'",
				},
			},
		];
		const issues = validateConfig(rules);
		expect(
			issues.some(
				(i) => i.level === 'warning' && i.message.includes('unsafe-eval'),
			),
		).toBe(true);
	});

	it('passes clean on a valid, non-deprecated rule set', () => {
		const rules: HeaderRule[] = [
			{
				path: '/assets/*',
				headers: { 'Cache-Control': 'public, max-age=3600' },
			},
		];
		const issues = validateConfig(rules);
		expect(issues).toHaveLength(0);
	});

	it('assertNoErrors throws with details when errors are present', () => {
		const rules: HeaderRule[] = [{ path: '', headers: {} }];
		const issues = validateConfig(rules);
		expect(() => assertNoErrors(issues)).toThrow(
			/invalid configuration:\n\s+\[rule 0\] Rule is missing a path/,
		);
	});

	it('flags a rule with an empty or whitespace path', () => {
		const rules: HeaderRule[] = [
			{ path: '', headers: { 'X-Test': '1' } },
			{ path: '   ', headers: { 'X-Test': '2' } },
		];
		const issues = validateConfig(rules);
		const errors = issues.filter((i) => i.level === 'error');
		expect(errors).toHaveLength(2);
		expect(errors[0]?.message).toBe('Rule is missing a path.');
		expect(errors[0]?.ruleIndex).toBe(0);
		expect(errors[1]?.message).toBe('Rule is missing a path.');
		expect(errors[1]?.ruleIndex).toBe(1);
	});

	it('flags non-finite numbers as errors', () => {
		const rules: HeaderRule[] = [
			{
				path: '/*',
				headers: {
					'X-Test-NaN': NaN,
					'X-Test-Inf': Infinity,
					'X-Test-NegInf': -Infinity,
				},
			},
		];
		const issues = validateConfig(rules);
		expect(issues).toHaveLength(3);
		expect(issues.every((i) => i.level === 'error')).toBe(true);
		expect(issues[0]?.message).toBe(
			'Header "X-Test-NaN" has a non-finite number value: NaN.',
		);
		expect(issues[1]?.message).toBe(
			'Header "X-Test-Inf" has a non-finite number value: Infinity.',
		);
		expect(issues[2]?.message).toBe(
			'Header "X-Test-NegInf" has a non-finite number value: -Infinity.',
		);
	});

	it('flags invalid Permissions-Policy headers as errors', () => {
		const rules: HeaderRule[] = [
			{
				path: '/*',
				headers: {
					'Permissions-Policy': "camera='self', geolocation='none'",
				},
			},
			{
				path: '/app',
				headers: {
					'Permissions-Policy': 'microphone=none, usb=src, fullscreen=(*)',
				},
			},
		];
		const issues = validateConfig(rules);
		const errors = issues.filter((i) => i.level === 'error');
		expect(errors).toHaveLength(5);
		expect(errors.every((i) => i.level === 'error')).toBe(true);
		expect(errors[0]?.message).toContain('cannot contain single quotes');
		expect(errors[1]?.message).toContain('does not support the "none" keyword');
		expect(errors[2]?.message).toContain('does not support the "none" keyword');
		expect(errors[3]?.message).toContain('does not support the "src" keyword');
		expect(errors[4]?.message).toContain(
			'does not support wildcard "*" inside a parenthesized list',
		);
	});

	it('flags empty generated headers as errors', () => {
		const rules: HeaderRule[] = [
			{
				path: '/*',
				headers: {
					'Cache-Control': '',
					'Content-Security-Policy': '   ',
					'Permissions-Policy': '',
				},
			},
		];
		const issues = validateConfig(rules);
		expect(issues).toHaveLength(3);
		expect(issues.every((i) => i.level === 'error')).toBe(true);
		expect(issues[0]?.message).toContain('cannot be empty');
		expect(issues[1]?.message).toContain('cannot be empty');
		expect(issues[2]?.message).toContain('cannot be empty');
	});

	it('flags invalid Cache-Control directives as errors', () => {
		const rules: HeaderRule[] = [
			{
				path: '/*',
				headers: {
					'Cache-Control': 'public, private, max-age=3600',
				},
			},
			{
				path: '/no-store',
				headers: {
					'Cache-Control': 'no-store, max-age=60, immutable',
				},
			},
		];
		const issues = validateConfig(rules);
		const errors = issues.filter((i) => i.level === 'error');
		expect(errors).toHaveLength(2);
		expect(errors.every((i) => i.level === 'error')).toBe(true);
		expect(errors[0]?.message).toContain(
			'cannot contain both "public" and "private"',
		);
		expect(errors[1]?.message).toContain(
			'makes "max-age" and "immutable" meaningless',
		);
	});

	it('warns when paths overlap and set the same plain header', () => {
		const rules: HeaderRule[] = [
			{ path: '/*', headers: { 'Cache-Control': 'no-store' } },
			{
				path: '/static/*',
				headers: { 'Cache-Control': 'public, max-age=3600' },
			},
		];
		const issues = validateConfig(rules);
		const warnings = issues.filter((i) => i.level === 'warning');
		expect(warnings).toHaveLength(1);
		expect(warnings[0]?.message).toContain('Cache-Control');
		expect(warnings[0]?.message).toContain('comma-joined');
		expect(warnings[0]?.ruleIndex).toBe(1);
	});

	it('does not warn when the overlapping path uses override', () => {
		const rules: HeaderRule[] = [
			{ path: '/*', headers: { 'Cache-Control': 'no-store' } },
			{
				path: '/static/*',
				headers: { 'Cache-Control': { override: 'public, max-age=3600' } },
			},
		];
		const issues = validateConfig(rules);
		const warnings = issues.filter((i) => i.level === 'warning');
		expect(warnings).toHaveLength(0);
	});

	it('validates overridden values for syntax errors', () => {
		const rules: HeaderRule[] = [
			{
				path: '/*',
				headers: {
					'Cache-Control': { override: 'public, private, max-age=3600' },
				},
			},
		];
		const issues = validateConfig(rules);
		const errors = issues.filter((i) => i.level === 'error');
		expect(errors).toHaveLength(1);
		expect(errors[0]?.message).toContain(
			'cannot contain both "public" and "private"',
		);
	});
});

describe('getRenderedLines', () => {
	it('returns only non-empty lines from the rendered file', () => {
		const rules: HeaderRule[] = [
			{
				path: '/page',
				comment: 'test comment',
				headers: { 'X-Header-1': 'val1', 'X-Header-2': 'val2' },
			},
			{
				path: '/other',
				headers: { 'X-Header-3': 'val3' },
			},
		];

		const lines = getRenderedLines(rules);
		expect(lines).toEqual([
			'# test comment',
			'/page',
			'  X-Header-1: val1',
			'  X-Header-2: val2',
			'/other',
			'  X-Header-3: val3',
		]);
	});
});
