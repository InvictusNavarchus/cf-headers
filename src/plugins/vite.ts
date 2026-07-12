import { buildHeadersFile, assertNoErrors } from '../index.js';
import type { HeaderRule } from '../types.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { Plugin } from 'vite';

export interface CfHeadersVitePluginOptions {
	rules: HeaderRule[];
	/** Only warn (instead of failing the build) on validation issues. */
	strict?: boolean;
}

/**
 * Vite plugin: writes `_headers` into `outDir` right after the production
 * bundle is finalized, so it ships alongside your build output.
 *
 * @example
 * // vite.config.ts
 * import { defineConfig } from "vite";
 * import { cfHeaders } from "cf-headers/vite";
 * import { securityHeadersPreset, immutableAssetsPreset } from "cf-headers";
 *
 * export default defineConfig({
 *   plugins: [
 *     cfHeaders({ rules: [securityHeadersPreset(), immutableAssetsPreset()] }),
 *   ],
 * });
 */
export function cfHeaders(options: CfHeadersVitePluginOptions): Plugin {
	let resolvedOutDir = 'dist';

	return {
		name: 'cf-headers',
		apply: 'build',
		// Vite calls configResolved/closeBundle with `this` bound to the
		// plugin context; we only need outDir, read via a loose `configResolved`
		// hook added dynamically below to avoid importing Vite's types.
		async closeBundle() {
			const { content, issues } = buildHeadersFile(options.rules);
			if (options.strict !== false) {
				assertNoErrors(issues);
			} else {
				for (const issue of issues) {
					// eslint-disable-next-line no-console
					console.warn(`[cf-headers] ${issue.level}: ${issue.message}`);
				}
			}
			await fs.mkdir(resolvedOutDir, { recursive: true });
			await fs.writeFile(
				path.join(resolvedOutDir, '_headers'),
				content,
				'utf-8',
			);
		},
		configResolved(config) {
			if (config.build?.outDir) {
				resolvedOutDir = path.isAbsolute(config.build.outDir)
					? config.build.outDir
					: path.join(config.root, config.build.outDir);
			}
		},
	};
}
