import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runCli, runInspect } from '../src/cli.js';

describe('CLI Command Parsing and Routing', () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-headers-cli-'));
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	describe('list-headers command', () => {
		it('prints all headers', async () => {
			const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			await runCli(['node', 'bin.js', 'list-headers']);

			expect(logSpy).toHaveBeenCalled();
			const lastCall = logSpy.mock.calls[logSpy.mock.calls.length - 1]?.[0];
			expect(lastCall).toContain('header(s)');
		});

		it('filters headers by category', async () => {
			const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			await runCli([
				'node',
				'bin.js',
				'list-headers',
				'--category',
				'security',
			]);

			expect(logSpy).toHaveBeenCalled();
			for (const call of logSpy.mock.calls) {
				const line = call[0] as string;
				if (line.includes('header(s)') || line.trim() === '') continue;
				expect(line.toLowerCase()).toContain('security');
			}
		});

		it('filters headers by status', async () => {
			const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			await runCli([
				'node',
				'bin.js',
				'list-headers',
				'--status',
				'deprecated',
			]);

			expect(logSpy).toHaveBeenCalled();
			for (const call of logSpy.mock.calls) {
				const line = call[0] as string;
				if (line.includes('header(s)') || line.trim() === '') continue;
				expect(line.toLowerCase()).toContain('deprecated');
			}
		});
	});

	describe('inspect command', () => {
		it('prints details for a known header', async () => {
			const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			await runCli(['node', 'bin.js', 'inspect', 'Cache-Control']);

			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining('Cache-Control'),
			);
			expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('status:'));
			expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('category:'));
		});

		it('handles custom/unknown headers gracefully', async () => {
			const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			await runCli(['node', 'bin.js', 'inspect', 'X-My-Header']);

			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining('treated as a custom header'),
			);
		});

		it('fails and throws CACError if header name is missing from CLI command', async () => {
			await expect(runCli(['node', 'bin.js', 'inspect'])).rejects.toThrow(
				/missing required args/,
			);
		});

		it('runInspect fails and sets exitCode to 1 if name is undefined', () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const prevExitCode = process.exitCode;
			process.exitCode = undefined;

			runInspect(undefined);

			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Usage: cf-headers inspect'),
			);
			expect(process.exitCode).toBe(1);

			process.exitCode = prevExitCode;
		});
	});

	describe('build command / default', () => {
		it('runs build by default and command line options are forwarded', async () => {
			const outDir = path.join(tempDir, 'dist-cli-build');
			const configJsPath = path.join(tempDir, 'cf-headers.config.js');
			await fs.writeFile(
				configJsPath,
				`export default {
					outDir: 'invalid-out-dir',
					rules: [
						{ path: '/cli-test/*', headers: { 'X-CLI': 'ok' } }
					]
				};`,
				'utf-8',
			);

			vi.spyOn(console, 'log').mockImplementation(() => {});

			await runCli([
				'node',
				'bin.js',
				'build',
				'--config',
				configJsPath,
				'--out-dir',
				outDir,
			]);

			const filePath = path.join(outDir, '_headers');
			const content = await fs.readFile(filePath, 'utf-8');
			expect(content).toBe('/cli-test/*\n  X-CLI: ok\n');
		});

		it('fails on unknown commands and prints help', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const prevExitCode = process.exitCode;
			process.exitCode = undefined;

			await runCli(['node', 'bin.js', 'unknown-command']);

			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Unknown command'),
			);
			expect(process.exitCode).toBe(1);

			process.exitCode = prevExitCode;
		});
	});
});
