import type { HeaderDirective, HeaderRule, OverrideHeader } from './types.js';

/** Cloudflare's documented per-line character limit for `_headers`. */
export const MAX_LINE_LENGTH = 2000;
/** Cloudflare's documented maximum number of rule blocks per `_headers` file. */
export const MAX_RULES = 100;

function isDetach(value: HeaderDirective): value is { detach: true } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'detach' in value &&
		value.detach === true
	);
}

export function isOverride(value: HeaderDirective): value is OverrideHeader {
	return typeof value === 'object' && value !== null && 'override' in value;
}

export function serializeHeaderLine(
	name: string,
	value: HeaderDirective,
): string {
	if (isDetach(value)) {
		return `  ! ${name}`;
	}
	if (isOverride(value)) {
		return `  ! ${name}\n  ${name}: ${value.override}`;
	}
	return `  ${name}: ${value}`;
}

/**
 * Render a single rule block ("path" line + indented header lines).
 * Multiple values for the same header (passed as an array by the caller
 * via `joinDuplicateHeaders`) are pre-joined before reaching this function.
 */
function serializeRule(rule: HeaderRule): string {
	const lines: string[] = [];
	if (rule.comment) {
		for (const commentLine of rule.comment.split('\n')) {
			lines.push(`# ${commentLine}`);
		}
	}
	lines.push(rule.path);
	for (const [name, value] of Object.entries(rule.headers)) {
		if (value === undefined) continue;
		lines.push(serializeHeaderLine(name, value));
	}
	return lines.join('\n');
}

/**
 * Convert a list of typed rules into the exact text that should be written
 * to a Cloudflare Pages/Workers `_headers` file. Pure function — no I/O.
 */
export function generateHeadersFile(rules: HeaderRule[]): string {
	const blocks = rules.map(serializeRule);
	return `${blocks.join('\n\n')}\n`;
}

/** Every physical line of the rendered file, useful for line-length checks. */
export function getRenderedLines(rules: HeaderRule[]): string[] {
	return generateHeadersFile(rules)
		.split('\n')
		.filter((l) => l.length > 0);
}
