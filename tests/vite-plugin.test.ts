import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { cfHeaders } from '../src/plugins/vite.js';

describe('Vite Plugin', () => {
	let tempDir: string;

	function callConfigResolved(
		plugin: ReturnType<typeof cfHeaders>,
		config: { root: string; build?: { outDir?: string } },
	) {
		(
			plugin.configResolved as (config: {
				root: string;
				build?: { outDir?: string };
			}) => void
		)?.(config);
	}

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-headers-vite-'));
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it('has the correct plugin properties', () => {
		const plugin = cfHeaders({ rules: [] });
		expect(plugin.name).toBe('cf-headers');
		expect(plugin.apply).toBe('build');
		expect(typeof plugin.closeBundle).toBe('function');
		expect(typeof plugin.configResolved).toBe('function');
	});

	it('resolves the output directory correctly (relative path)', async () => {
		const plugin = cfHeaders({
			rules: [{ path: '/assets/*', headers: { 'X-Vite': 'yes' } }],
		});

		callConfigResolved(plugin, {
			root: tempDir,
			build: { outDir: 'custom-dist' },
		});

		await plugin.closeBundle();

		const filePath = path.join(tempDir, 'custom-dist', '_headers');
		const content = await fs.readFile(filePath, 'utf-8');
		expect(content).toBe('/assets/*\n  X-Vite: yes\n');
	});

	it('resolves the output directory correctly (absolute path)', async () => {
		const plugin = cfHeaders({
			rules: [{ path: '/assets/*', headers: { 'X-Vite': 'yes' } }],
		});
		const absoluteOutDir = path.join(tempDir, 'absolute-dist');

		callConfigResolved(plugin, {
			root: '/ignored',
			build: { outDir: absoluteOutDir },
		});

		await plugin.closeBundle();

		const filePath = path.join(absoluteOutDir, '_headers');
		const content = await fs.readFile(filePath, 'utf-8');
		expect(content).toBe('/assets/*\n  X-Vite: yes\n');
	});

	it('throws on validation errors in strict mode (default)', async () => {
		const plugin = cfHeaders({
			rules: [{ path: '', headers: { 'X-Vite': 'yes' } }],
		});

		callConfigResolved(plugin, {
			root: tempDir,
			build: { outDir: 'dist' },
		});

		await expect(plugin.closeBundle()).rejects.toThrow(/invalid configuration/);
	});

	it('only warns and writes file when strict: false', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const plugin = cfHeaders({
			strict: false,
			rules: [{ path: '', headers: { 'X-Vite': 'yes' } }],
		});

		callConfigResolved(plugin, {
			root: tempDir,
			build: { outDir: 'dist' },
		});

		await plugin.closeBundle();

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('[cf-headers] error:'),
		);

		const filePath = path.join(tempDir, 'dist', '_headers');
		const content = await fs.readFile(filePath, 'utf-8');
		expect(content).toContain('X-Vite: yes');
	});
});
