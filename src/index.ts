import { generateHeadersFile } from './build.js';
import { assertNoErrors, validateConfig } from './validate.js';
import type { CfHeadersConfig, HeaderRule, ValidationIssue } from './types.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

// ---- Types --------------------------------------------------------------
export type {
	CfHeadersConfig,
	DetachHeader,
	HeaderBlock,
	HeaderBlockInput,
	HeaderDirective,
	HeaderRule,
	ValidationIssue,
} from './types.js';
export type {
	HeaderCategory,
	HeaderContext,
	HeaderInfo,
	HeaderStatus,
} from './types.js';
export type {
	CrossOriginEmbedderPolicyValue,
	CrossOriginOpenerPolicyValue,
	CrossOriginResourcePolicyValue,
	HeaderValueFor,
	ReferrerPolicyValue,
	TypedHeaderValues,
	XContentTypeOptionsValue,
	XDnsPrefetchControlValue,
	XFrameOptionsValue,
	XPermittedCrossDomainPoliciesValue,
} from './header-values.js';

// ---- Header catalog -------------------------------------------------------
export {
	HEADERS_REGISTRY,
	getHeaderInfo,
	getHeadersByCategory,
	getHeadersByStatus,
	isKnownHeader,
} from './registry.js';
export type { KnownHeaderName } from './registry.js';

// ---- Build / validate -------------------------------------------------------
export {
	generateHeadersFile,
	getRenderedLines,
	MAX_LINE_LENGTH,
	MAX_RULES,
} from './build.js';
export { assertNoErrors, validateConfig } from './validate.js';

// ---- Value builders -------------------------------------------------------
export {
	cacheControl,
	immutableAssetCacheControl,
	noCacheControl,
	noStoreCacheControl,
} from './helpers/cache-control.js';
export type { CacheControlOptions } from './helpers/cache-control.js';
export { csp, strictCsp } from './helpers/csp.js';
export type { CspOptions } from './helpers/csp.js';
export {
	lockedDownPermissionsPolicy,
	permissionsPolicy,
} from './helpers/permissions-policy.js';
export type {
	PermissionsPolicyAllowlist,
	PermissionsPolicyOptions,
} from './helpers/permissions-policy.js';

// ---- Presets -------------------------------------------------------------
export {
	corsPreset,
	dynamicContentPreset,
	immutableAssetsPreset,
	noIndexPreviewDomainPreset,
	securityHeadersPreset,
} from './presets.js';
export type {
	HstsOptions,
	SecurityHeadersPresetOptions,
} from './presets.js';

/**
 * Identity helper that gives you autocomplete + type-checking on a single
 * rule without needing to annotate it manually.
 *
 * @example
 * rule("/assets/*", { "Cache-Control": immutableAssetCacheControl() })
 */
export function rule(
	path: string,
	headers: HeaderRule['headers'],
	comment?: string,
): HeaderRule {
	return comment !== undefined ? { path, headers, comment } : { path, headers };
}

/**
 * Identity helper for the top-level config, primarily useful for config
 * files consumed by the CLI (gives you autocomplete without manual typing).
 */
export function defineConfig(config: CfHeadersConfig): CfHeadersConfig {
	return config;
}

/** Remove Cloudflare's detach marker (`! Header`) and empty-header edge
 * cases before validating; also used internally by `writeHeadersFile`. */
export function buildHeadersFile(rules: HeaderRule[]): {
	content: string;
	issues: ValidationIssue[];
} {
	const issues = validateConfig(rules);
	const content = generateHeadersFile(rules);
	return { content, issues };
}

export interface WriteHeadersFileResult {
	filePath: string;
	content: string;
	issues: ValidationIssue[];
}

/**
 * Validate and write a `_headers` file into `config.outDir`. Throws if
 * validation produces any `"error"`-level issues (set `strict: false` to
 * only log warnings and always write the file).
 */
export async function writeHeadersFile(
	config: CfHeadersConfig,
): Promise<WriteHeadersFileResult> {
	const issues = validateConfig(config.rules);
	if (config.strict !== false) {
		assertNoErrors(issues);
	}

	const content = generateHeadersFile(config.rules);
	await fs.mkdir(config.outDir, { recursive: true });
	const filePath = path.join(config.outDir, '_headers');
	await fs.writeFile(filePath, content, 'utf-8');

	return { filePath, content, issues };
}
