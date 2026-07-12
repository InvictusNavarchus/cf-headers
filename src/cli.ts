#!/usr/bin/env node
import { generateHeadersFile } from './build.js';
import { findConfigFile, loadConfig } from './load-config.js';
import { getHeaderInfo, HEADERS_REGISTRY } from './registry.js';
import { assertNoErrors, validateConfig } from './validate.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import type { ValidationIssue } from './types.js';

const HELP = `cf-headers — type-safe _headers generator for Cloudflare Pages & Workers

Usage:
  cf-headers [build]                Generate _headers from your config file
  cf-headers list-headers           Print the full header catalog
  cf-headers inspect <name>         Show metadata for a single header
  cf-headers --help                 Show this message

Options for "build" (the default command):
  -c, --config <path>   Path to a cf-headers.config.{ts,js,mjs} file
                         (default: search the current directory)
  -o, --out-dir <dir>   Override the config's outDir
  --no-strict           Only warn on validation issues instead of failing
`;

function printIssues(issues: ValidationIssue[]): void {
	for (const issue of issues) {
		const prefix = issue.level === 'error' ? 'error' : 'warn';
		const location =
			issue.ruleIndex !== undefined ? ` (rule ${issue.ruleIndex})` : '';
		console[issue.level === 'error' ? 'error' : 'warn'](
			`[cf-headers] ${prefix}${location}: ${issue.message}`,
		);
	}
}

async function runBuild(options: {
	config?: string;
	'out-dir'?: string;
	strict?: boolean;
}): Promise<void> {
	const configPath = options.config;
	const outDirOverride = options['out-dir'];
	const strictOverride = options.strict;

	const cwd = process.cwd();
	const resolvedConfigPath = configPath
		? path.resolve(cwd, configPath)
		: await findConfigFile(cwd);

	if (!resolvedConfigPath) {
		console.error(
			'[cf-headers] No config file found. Create a cf-headers.config.ts ' +
				'(e.g. `export default defineConfig({ outDir: "dist", rules: [...] })`) ' +
				'or pass --config <path>.',
		);
		process.exitCode = 1;
		return;
	}

	const config = await loadConfig(resolvedConfigPath);
	const outDir = outDirOverride ?? config.outDir;
	const strict = strictOverride ?? config.strict ?? true;

	const issues = validateConfig(config.rules);
	printIssues(issues);
	if (strict) {
		assertNoErrors(issues);
	}

	const content = generateHeadersFile(config.rules);
	await fs.mkdir(outDir, { recursive: true });
	const filePath = path.join(outDir, '_headers');
	await fs.writeFile(filePath, content, 'utf-8');

	console.log(
		`[cf-headers] Wrote ${config.rules.length} rule(s) to ${filePath}`,
	);
}

function runListHeaders(options: { category?: string; status?: string }): void {
	const categoryFilter = options.category;
	const statusFilter = options.status;

	const rows = HEADERS_REGISTRY.filter(
		(h) => !categoryFilter || h.category === categoryFilter,
	).filter((h) => !statusFilter || h.status === statusFilter);

	for (const h of rows) {
		console.log(
			`${h.name.padEnd(38)} ${h.status.padEnd(12)} ${h.category.padEnd(24)} ${h.description}`,
		);
	}
	console.log(`\n${rows.length} header(s).`);
}

function runInspect(name: string | undefined): void {
	if (!name) {
		console.error('[cf-headers] Usage: cf-headers inspect <header-name>');
		process.exitCode = 1;
		return;
	}
	const info = getHeaderInfo(name);
	if (!info) {
		console.log(
			`"${name}" is not in the built-in catalog — treated as a custom header.`,
		);
		return;
	}
	console.log(`${info.name}`);
	console.log(`  status:      ${info.status}`);
	console.log(`  category:    ${info.category}`);
	console.log(`  context:     ${info.context}`);
	console.log(
		`  settable via _headers: ${info.settableViaHeadersFile ? 'yes' : 'no (request-oriented header)'}`,
	);
	console.log(`  description: ${info.description}`);
	console.log(`  reference:   ${info.referenceUrl}`);
}

async function main(): Promise<void> {
	const parsed = (() => {
		try {
			return parseArgs({
				args: process.argv.slice(2),
				options: {
					help: {
						type: 'boolean',
						short: 'h',
					},
					config: {
						type: 'string',
						short: 'c',
					},
					'out-dir': {
						type: 'string',
						short: 'o',
					},
					strict: {
						type: 'boolean',
					},
					category: {
						type: 'string',
					},
					status: {
						type: 'string',
					},
				},
				allowPositionals: true,
			});
		} catch (err) {
			console.error(`[cf-headers] Error: ${(err as Error).message}`);
			console.log(HELP);
			process.exitCode = 1;
			return null;
		}
	})();

	if (!parsed) {
		return;
	}

	const { values, positionals } = parsed;

	if (values.help) {
		console.log(HELP);
		return;
	}

	const command = positionals[0];

	if (command === 'list-headers') {
		runListHeaders({
			category: values.category,
			status: values.status,
		});
		return;
	}

	if (command === 'inspect') {
		runInspect(positionals[1]);
		return;
	}

	if (command === undefined || command === 'build') {
		await runBuild({
			config: values.config,
			'out-dir': values['out-dir'],
			strict: values.strict,
		});
		return;
	}

	console.error(`[cf-headers] Unknown command: ${command}`);
	console.log(HELP);
	process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error(
		`[cf-headers] ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
});
