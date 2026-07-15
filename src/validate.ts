import { MAX_LINE_LENGTH, MAX_RULES, serializeHeaderLine } from './build.js';
import { getHeaderInfo } from './registry.js';
import type { HeaderDirective, HeaderRule, ValidationIssue } from './types.js';

const ABSOLUTE_URL_WITH_PORT = /^https?:\/\/[^/]+:\d+/;
const NON_HTTPS_ABSOLUTE_URL = /^http:\/\//;

function isDetach(value: unknown): value is { detach: true } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'detach' in value &&
		(value as { detach: unknown }).detach === true
	);
}

function isOverride(value: unknown): value is { override: string | number } {
	return typeof value === 'object' && value !== null && 'override' in value;
}

function validatePath(
	path: string | undefined,
	ruleIndex: number,
	issues: ValidationIssue[],
): void {
	if (!path || path.trim().length === 0) {
		issues.push({
			level: 'error',
			message: 'Rule is missing a path.',
			ruleIndex,
		});
		return;
	}

	if (NON_HTTPS_ABSOLUTE_URL.test(path)) {
		issues.push({
			level: 'error',
			message: `Absolute URLs must start with "https://": "${path}".`,
			ruleIndex,
		});
	}

	if (ABSOLUTE_URL_WITH_PORT.test(path)) {
		issues.push({
			level: 'error',
			message: `Absolute URLs may not specify a port: "${path}".`,
			ruleIndex,
		});
	}

	if (path.startsWith('https://')) {
		const hostAndPath = path.slice(8);
		if (!hostAndPath.includes('.') || !path.endsWith('/*')) {
			issues.push({
				level: 'error',
				message: `Absolute URL pattern must contain a dot and end with "/*" to be matched correctly by Cloudflare: "${path}".`,
				ruleIndex,
			});
		}
	}

	if (path.split('*').length - 1 > 1) {
		issues.push({
			level: 'error',
			message: `Only a single "*" splat is allowed per path: "${path}".`,
			ruleIndex,
		});
	}
}

function validateGenericHeader(
	name: string,
	value: unknown,
	path: string,
	ruleIndex: number,
	issues: ValidationIssue[],
): void {
	const checkValue = isOverride(value) ? value.override : value;
	if (typeof checkValue === 'number' && !Number.isFinite(checkValue)) {
		issues.push({
			level: 'error',
			message: `Header "${name}" has a non-finite number value: ${checkValue}.`,
			ruleIndex,
		});
	}

	const lines = serializeHeaderLine(name, value as HeaderDirective).split('\n');
	for (const line of lines) {
		if (line.length > MAX_LINE_LENGTH) {
			issues.push({
				level: 'error',
				message: `Line for "${name}" is ${line.length} characters, over the ${MAX_LINE_LENGTH}-character limit.`,
				ruleIndex,
			});
		}
	}

	const lowerName = name.toLowerCase();
	const stringValue = isOverride(value)
		? String(value.override)
		: String(value);

	if (
		lowerName === 'access-control-allow-origin' &&
		stringValue === '*' &&
		path === '/*'
	) {
		issues.push({
			level: 'warning',
			message:
				'Applying `Access-Control-Allow-Origin: *` to `/*` may expose sensitive routes. Consider scoping this to a specific path like `/assets/*` (or using `corsPreset("/assets/*")`).',
			ruleIndex,
		});
	}

	const info = getHeaderInfo(name);
	if (info) {
		if (info.status === 'deprecated') {
			issues.push({
				level: 'warning',
				message: `"${name}" is deprecated: ${info.description}`,
				ruleIndex,
			});
		} else if (info.status === 'non-standard') {
			issues.push({
				level: 'warning',
				message: `"${name}" is a non-standard/proprietary header: ${info.description}`,
				ruleIndex,
			});
		}
		if (!info.settableViaHeadersFile) {
			issues.push({
				level: 'warning',
				message: `"${name}" is normally a request-only header; setting it via _headers has no effect on browser behavior.`,
				ruleIndex,
			});
		}
	}
}

function validateEmptyHeader(
	name: string,
	value: string,
	ruleIndex: number,
	issues: ValidationIssue[],
): void {
	if (value.trim().length === 0) {
		issues.push({
			level: 'error',
			message: `Header "${name}" cannot be empty. At least one directive or option must be set.`,
			ruleIndex,
		});
	}
}

function validateCsp(
	value: string,
	ruleIndex: number,
	issues: ValidationIssue[],
): void {
	const hasUnsafeInline = value.includes("'unsafe-inline'");
	const hasNonceOrHash =
		value.includes("'nonce-") ||
		/'sha(256|384|512)-/.test(value) ||
		value.includes("'strict-dynamic'");

	if (hasUnsafeInline && !hasNonceOrHash) {
		issues.push({
			level: 'warning',
			message:
				"Content-Security-Policy contains `'unsafe-inline'` without a nonce, hash, or `'strict-dynamic'`. This disables modern XSS protections.",
			ruleIndex,
		});
	}
	if (value.includes("'unsafe-eval'")) {
		issues.push({
			level: 'warning',
			message:
				"Content-Security-Policy contains `'unsafe-eval'`, which allows execution of arbitrary strings as code and increases XSS risk.",
			ruleIndex,
		});
	}
}

function validateCacheControl(
	value: string,
	ruleIndex: number,
	issues: ValidationIssue[],
): void {
	const hasPublic = /\bpublic\b/.test(value);
	const hasPrivate = /\bprivate\b/.test(value);
	if (hasPublic && hasPrivate) {
		issues.push({
			level: 'error',
			message: `Cache-Control cannot contain both "public" and "private" directives: "${value}".`,
			ruleIndex,
		});
	}

	const hasNoStore = /\bno-store\b/.test(value);
	const hasMaxAge = /\bmax-age\b/.test(value);
	const hasImmutable = /\bimmutable\b/.test(value);
	if (hasNoStore && (hasMaxAge || hasImmutable)) {
		issues.push({
			level: 'error',
			message: `Cache-Control directive "no-store" makes "max-age" and "immutable" meaningless — choose either no-store or caching options: "${value}".`,
			ruleIndex,
		});
	}
}

function validatePermissionsPolicy(
	value: string,
	ruleIndex: number,
	issues: ValidationIssue[],
): void {
	if (value.includes("'")) {
		issues.push({
			level: 'error',
			message: `Permissions-Policy cannot contain single quotes. Use unquoted self or double-quoted origins: "${value}".`,
			ruleIndex,
		});
	}
	if (/\bnone\b/i.test(value)) {
		issues.push({
			level: 'error',
			message: `Permissions-Policy does not support the "none" keyword. To disable a feature, use an empty allowlist like "feature=()": "${value}".`,
			ruleIndex,
		});
	}
	if (/\bsrc\b/i.test(value)) {
		issues.push({
			level: 'error',
			message: `Permissions-Policy does not support the "src" keyword. Use "self" or explicit origins instead: "${value}".`,
			ruleIndex,
		});
	}
	if (/\([^)]*\*[^)]*\)/.test(value)) {
		issues.push({
			level: 'error',
			message: `Permissions-Policy does not support wildcard "*" inside a parenthesized list. Use the bare wildcard "feature=*" without parenthesis or quotes: "${value}".`,
			ruleIndex,
		});
	}
}

function pathPrefix(path: string): string {
	return path.split(/[*:]/)[0] ?? '';
}

/**
 * Heuristic to check if two Cloudflare path patterns can overlap.
 * This is deliberately conservative and may flag non-overlapping paths,
 * but prevents silent header collisions.
 */
function pathsCanOverlap(a: string, b: string): boolean {
	if (a === b) return true;
	const pa = pathPrefix(a),
		pb = pathPrefix(b);
	return pa.startsWith(pb) || pb.startsWith(pa);
}

function detectHeaderCollisions(
	rules: HeaderRule[],
	issues: ValidationIssue[],
): void {
	const setters = new Map<
		string,
		{ ruleIndex: number; path: string; name: string }[]
	>();

	rules.forEach((rule, ruleIndex) => {
		for (const [name, value] of Object.entries(rule.headers)) {
			if (value === undefined || isDetach(value) || isOverride(value)) {
				continue;
			}
			const key = name.toLowerCase();
			let list = setters.get(key);
			if (!list) {
				list = [];
				setters.set(key, list);
			}
			list.push({ ruleIndex, path: rule.path, name });
		}
	});

	for (const [_, entries] of setters) {
		for (let i = 0; i < entries.length; i++) {
			const entryI = entries[i];
			if (!entryI) continue;
			for (let j = i + 1; j < entries.length; j++) {
				const entryJ = entries[j];
				if (!entryJ) continue;
				if (pathsCanOverlap(entryI.path, entryJ.path)) {
					issues.push({
						level: 'warning',
						message: `"${entryJ.name}" is set as a plain value in rule ${entryI.ruleIndex} ("${entryI.path}") and rule ${entryJ.ruleIndex} ("${entryJ.path}"). Cloudflare has no path-specificity precedence — if both rules match the same request, the values will be comma-joined. If that's not intended, use override() in the more specific rule.`,
						ruleIndex: entryJ.ruleIndex,
					});
				}
			}
		}
	}
}

/**
 * Validate a rule set against Cloudflare's documented constraints:
 *  - at most 100 rule blocks
 *  - at most 2000 characters per rendered line
 *  - absolute URLs must use https and may not specify a port
 *  - a header can't be both set and detached in the same rule
 *
 * Also flags (as warnings) headers that are deprecated, non-standard, or
 * not realistically something you'd set from a `_headers` file, so you
 * catch typos and legacy headers before they ship.
 */
export function validateConfig(rules: HeaderRule[]): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	if (rules.length > MAX_RULES) {
		issues.push({
			level: 'error',
			message: `Cloudflare allows at most ${MAX_RULES} header rules; this config defines ${rules.length}.`,
		});
	}

	rules.forEach((rule, ruleIndex) => {
		validatePath(rule.path, ruleIndex, issues);

		for (const [name, value] of Object.entries(rule.headers)) {
			validateGenericHeader(name, value, rule.path, ruleIndex, issues);

			if (!isDetach(value)) {
				const lowerName = name.toLowerCase();
				const stringValue = isOverride(value)
					? String(value.override)
					: String(value);

				if (
					lowerName === 'cache-control' ||
					lowerName === 'content-security-policy' ||
					lowerName === 'permissions-policy'
				) {
					validateEmptyHeader(name, stringValue, ruleIndex, issues);
				}

				if (lowerName === 'content-security-policy') {
					validateCsp(stringValue, ruleIndex, issues);
				} else if (lowerName === 'cache-control') {
					validateCacheControl(stringValue, ruleIndex, issues);
				} else if (lowerName === 'permissions-policy') {
					validatePermissionsPolicy(stringValue, ruleIndex, issues);
				}
			}
		}
	});

	detectHeaderCollisions(rules, issues);

	return issues;
}

/** Throws if any `"error"`-level issues are present. Always safe to call on
 * a set of only-warning issues (no-op). */
export function assertNoErrors(issues: ValidationIssue[]): void {
	const errors = issues.filter((i) => i.level === 'error');
	if (errors.length > 0) {
		const details = errors
			.map((e) =>
				e.ruleIndex !== undefined
					? `  [rule ${e.ruleIndex}] ${e.message}`
					: `  ${e.message}`,
			)
			.join('\n');
		throw new Error(`cf-headers: invalid configuration:\n${details}`);
	}
}
