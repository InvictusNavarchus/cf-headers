import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { writeHeadersFile } from '../src/index.js';
import { runBuild } from '../src/cli.js';

describe('Integration Tests', () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(
			path.join(os.tmpdir(), 'cf-headers-integration-'),
		);
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	describe('writeHeadersFile', () => {
		it('writes _headers to outDir with correct contents', async () => {
			const outDir = path.join(tempDir, 'dist');
			const config = {
				outDir,
				rules: [
					{
						path: '/static/*',
						headers: { 'Cache-Control': 'public, max-age=3600' },
					},
				],
			};

			const result = await writeHeadersFile(config);
			expect(result.filePath).toBe(path.join(outDir, '_headers'));
			expect(result.content).toBe(
				'/static/*\n  Cache-Control: public, max-age=3600\n',
			);

			const written = await fs.readFile(result.filePath, 'utf-8');
			expect(written).toBe(result.content);
		});

		it('throws when strict is true and validation fails', async () => {
			const outDir = path.join(tempDir, 'dist');
			const config = {
				outDir,
				strict: true,
				rules: [
					{
						path: '', // invalid path
						headers: { 'Cache-Control': 'public' },
					},
				],
			};

			await expect(writeHeadersFile(config)).rejects.toThrow(
				/invalid configuration/,
			);
		});

		it('does not throw and writes file when strict is false and validation fails', async () => {
			const outDir = path.join(tempDir, 'dist');
			const config = {
				outDir,
				strict: false,
				rules: [
					{
						path: '', // invalid path
						headers: { 'Cache-Control': 'public' },
					},
				],
			};

			const result = await writeHeadersFile(config);
			expect(result.issues.length).toBeGreaterThan(0);
			const written = await fs.readFile(result.filePath, 'utf-8');
			expect(written).toContain('Cache-Control: public');
		});
	});

	describe('CLI runBuild', () => {
		it('runs build and writes _headers file from a configuration', async () => {
			const outDir = path.join(tempDir, 'dist-cli');

			const configJsPath = path.join(tempDir, 'cf-headers.config.js');
			await fs.writeFile(
				configJsPath,
				`export default {
					outDir: '${outDir.replace(/\\/g, '\\\\')}',
					rules: [
						{ path: '/js/*', headers: { 'X-JS': 'yes' } }
					]
				};`,
				'utf-8',
			);

			const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			await runBuild({ config: configJsPath });

			const filePath = path.join(outDir, '_headers');
			const content = await fs.readFile(filePath, 'utf-8');
			expect(content).toBe('/js/*\n  X-JS: yes\n');
			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining('Wrote 1 rule(s)'),
			);
		});

		it('applies command line overrides for outDir and strict options', async () => {
			const configJsPath = path.join(tempDir, 'cf-headers.config.js');
			const outDir = path.join(tempDir, 'dist-cli');
			const overrideDir = path.join(tempDir, 'dist-override');

			await fs.writeFile(
				configJsPath,
				`export default {
					outDir: '${outDir.replace(/\\/g, '\\\\')}',
					rules: [
						{ path: '', headers: { 'X-JS': 'yes' } }
					]
				};`,
				'utf-8',
			);

			vi.spyOn(console, 'log').mockImplementation(() => {});
			vi.spyOn(console, 'error').mockImplementation(() => {});

			await runBuild({
				config: configJsPath,
				outDir: overrideDir,
				strict: false,
			});

			const filePath = path.join(overrideDir, '_headers');
			expect(await fs.readFile(filePath, 'utf-8')).toContain('X-JS: yes');
		});

		it('exits with code 1 and prints error when no config file is found', async () => {
			vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const prevExitCode = process.exitCode;
			process.exitCode = undefined;

			await runBuild({});

			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining('No config file found'),
			);
			expect(process.exitCode).toBe(1);

			process.exitCode = prevExitCode;
		});
	});
});
