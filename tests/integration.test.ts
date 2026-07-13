import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { writeHeadersFile } from '../src/index.js';

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
});
