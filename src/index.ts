import { generateHeadersFile } from './build.js';
import { assertNoErrors, validateConfig } from './validate.js';
import type {
	CfHeadersConfig,
	HeaderRule,
	OverrideHeader,
	ValidationIssue,
} from './types.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

// ---- Types --------------------------------------------------------------
export type {
	CfHeadersConfig,
	DetachHeader,
	OverrideHeader,
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
} from './registry.js';
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
export { csp, strictCsp, compatibleCsp } from './helpers/csp.js';
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
	NoIndexPresetOptions,
	SecurityHeadersPresetOptions,
	ImmutableAssetsPresetOptions,
	CspPresetName,
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
 * Helper to override a header that Cloudflare or an earlier, less specific rule
 * would otherwise apply. Cloudflare does not use path specificity to resolve conflicts;
 * instead it comma-joins values. This helper outputs a detach line followed by a set line
 * to ensure the new value wins.
 *
 * @example
 * rule("/assets/*", { "Cache-Control": override(immutableAssetCacheControl()) })
 */
export function override(value: string | number): OverrideHeader {
	return { override: value };
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
export function buildHeadersFile(rules: (HeaderRule | HeaderRule[])[]): {
	content: string;
	issues: ValidationIssue[];
} {
	const flatRules = rules.flat();
	const issues = validateConfig(flatRules);
	const content = generateHeadersFile(flatRules);
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
	const { content, issues } = buildHeadersFile(config.rules);
	if (config.strict !== false) {
		assertNoErrors(issues);
	}

	await fs.mkdir(config.outDir, { recursive: true });
	const filePath = path.join(config.outDir, '_headers');
	await fs.writeFile(filePath, content, 'utf-8');

	return { filePath, content, issues };
}
