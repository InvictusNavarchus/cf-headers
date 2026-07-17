/**
 * The CSP directives supported by this builder. Keys are camelCase for
 * ergonomics; values are the source expressions for that directive
 * (e.g. `["'self'", "https://cdn.example.com"]`).
 */
export interface CspOptions {
	defaultSrc?: string[];
	scriptSrc?: string[];
	scriptSrcElem?: string[];
	styleSrc?: string[];
	styleSrcElem?: string[];
	imgSrc?: string[];
	fontSrc?: string[];
	connectSrc?: string[];
	mediaSrc?: string[];
	objectSrc?: string[];
	workerSrc?: string[];
	manifestSrc?: string[];
	frameSrc?: string[];
	frameAncestors?: string[];
	formAction?: string[];
	baseUri?: string[];
	reportTo?: string;
	reportUri?: string;
	/** Adds `upgrade-insecure-requests` (a bare, valueless directive). */
	upgradeInsecureRequests?: boolean;
	/** Adds `block-all-mixed-content` (a bare, valueless directive). */
	blockAllMixedContent?: boolean;
}

const DIRECTIVE_NAMES: Record<
	keyof Omit<
		CspOptions,
		| 'reportTo'
		| 'reportUri'
		| 'upgradeInsecureRequests'
		| 'blockAllMixedContent'
	>,
	string
> = {
	defaultSrc: 'default-src',
	scriptSrc: 'script-src',
	scriptSrcElem: 'script-src-elem',
	styleSrc: 'style-src',
	styleSrcElem: 'style-src-elem',
	imgSrc: 'img-src',
	fontSrc: 'font-src',
	connectSrc: 'connect-src',
	mediaSrc: 'media-src',
	objectSrc: 'object-src',
	workerSrc: 'worker-src',
	manifestSrc: 'manifest-src',
	frameSrc: 'frame-src',
	frameAncestors: 'frame-ancestors',
	formAction: 'form-action',
	baseUri: 'base-uri',
};

/**
 * Build a `Content-Security-Policy` value from typed, per-directive source
 * lists instead of hand-assembling a `;`-separated string.
 *
 * @example
 * csp({ defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"] })
 * // "default-src 'self'; script-src 'self' 'unsafe-inline'"
 */
export function csp(options: CspOptions): string {
	const parts: string[] = [];

	for (const [key, directive] of Object.entries(DIRECTIVE_NAMES) as [
		keyof typeof DIRECTIVE_NAMES,
		string,
	][]) {
		const sources = options[key];
		if (sources && sources.length > 0) {
			parts.push(`${directive} ${sources.join(' ')}`);
		}
	}

	if (options.upgradeInsecureRequests) parts.push('upgrade-insecure-requests');
	if (options.blockAllMixedContent) parts.push('block-all-mixed-content');
	if (options.reportUri) parts.push(`report-uri ${options.reportUri}`);
	if (options.reportTo) parts.push(`report-to ${options.reportTo}`);

	return parts.join('; ');
}

/** A reasonable, compatible starting point for modern SPAs: same-origin assets,
 * inline styles allowed, data: and blob: URLs for images/fonts/workers. */
export function compatibleCsp(overrides: CspOptions = {}): string {
	return csp({
		defaultSrc: ["'self'"],
		scriptSrc: ["'self'"],
		styleSrc: ["'self'", "'unsafe-inline'"],
		imgSrc: ["'self'", 'data:', 'blob:'],
		fontSrc: ["'self'", 'data:'],
		connectSrc: ["'self'"],
		workerSrc: ["'self'", 'blob:'],
		objectSrc: ["'none'"],
		frameAncestors: ["'none'"],
		formAction: ["'self'"],
		baseUri: ["'self'"],
		upgradeInsecureRequests: true,
		...overrides,
	});
}

/** A locked-down starting point for fully self-contained static sites:
 * same-origin only, no inline styles or external resources. */
export function strictCsp(overrides: CspOptions = {}): string {
	return csp({
		defaultSrc: ["'self'"],
		scriptSrc: ["'self'"],
		styleSrc: ["'self'"],
		imgSrc: ["'self'"],
		fontSrc: ["'self'"],
		connectSrc: ["'self'"],
		workerSrc: ["'self'"],
		objectSrc: ["'none'"],
		frameSrc: ["'none'"],
		frameAncestors: ["'none'"],
		formAction: ["'self'"],
		baseUri: ["'self'"],
		upgradeInsecureRequests: true,
		...overrides,
	});
}
