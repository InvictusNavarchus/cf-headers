import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findConfigFile, loadConfig } from '../src/load-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('load-config', () => {
	const tempDir = path.join(__dirname, 'tmp-load-config');

	async function cleanTempDir() {
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch {}
	}

	it('findConfigFile priority and existence', async () => {
		await cleanTempDir();
		await fs.mkdir(tempDir, { recursive: true });

		// Initially, no config
		const none = await findConfigFile(tempDir);
		expect(none).toBeUndefined();

		// Create mjs
		const mjsPath = path.join(tempDir, 'cf-headers.config.mjs');
		await fs.writeFile(mjsPath, 'export default {}');
		expect(await findConfigFile(tempDir)).toBe(mjsPath);

		// Create js (should take priority over mjs)
		const jsPath = path.join(tempDir, 'cf-headers.config.js');
		await fs.writeFile(jsPath, 'export default {}');
		expect(await findConfigFile(tempDir)).toBe(jsPath);

		// Create mts (should take priority over js)
		const mtsPath = path.join(tempDir, 'cf-headers.config.mts');
		await fs.writeFile(mtsPath, 'export default {}');
		expect(await findConfigFile(tempDir)).toBe(mtsPath);

		// Create ts (should take priority over mts)
		const tsPath = path.join(tempDir, 'cf-headers.config.ts');
		await fs.writeFile(tsPath, 'export default {}');
		expect(await findConfigFile(tempDir)).toBe(tsPath);

		await cleanTempDir();
	});

	it('loads a ts config file, transpiles and cleans up', async () => {
		await cleanTempDir();
		await fs.mkdir(tempDir, { recursive: true });

		const tsPath = path.join(tempDir, 'cf-headers.config.ts');
		await fs.writeFile(
			tsPath,
			`
			import { defineConfig } from '../../src/index.js';
			export default defineConfig({
				outDir: 'dist-temp',
				rules: [
					{ path: '/page', headers: { 'X-Loaded': 'true' } }
				]
			});
			`,
		);

		const config = await loadConfig(tsPath);
		expect(config.outDir).toBe('dist-temp');
		expect(config.rules?.[0]?.headers?.['X-Loaded']).toBe('true');

		// Check that the temp file was cleaned up (no other files besides the .ts file in the directory)
		const files = await fs.readdir(tempDir);
		expect(files).toEqual(['cf-headers.config.ts']);

		await cleanTempDir();
	});

	it('loads a js config file directly', async () => {
		await cleanTempDir();
		await fs.mkdir(tempDir, { recursive: true });

		const jsPath = path.join(tempDir, 'cf-headers.config.js');
		await fs.writeFile(
			jsPath,
			`
			export default {
				outDir: 'dist-js',
				rules: []
			};
			`,
		);

		const config = await loadConfig(jsPath);
		expect(config.outDir).toBe('dist-js');

		await cleanTempDir();
	});

	it('throws an error if no default export', async () => {
		await cleanTempDir();
		await fs.mkdir(tempDir, { recursive: true });

		const tsPath = path.join(tempDir, 'cf-headers.config.ts');
		await fs.writeFile(
			tsPath,
			`
			export const config = { outDir: 'dist' };
			`,
		);

		await expect(loadConfig(tsPath)).rejects.toThrow(
			/must have a default export/,
		);

		await cleanTempDir();
	});
});
