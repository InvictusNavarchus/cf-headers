#!/usr/bin/env node
import { generateHeadersFile } from './build.js';
import { findConfigFile, loadConfig } from './load-config.js';
import { getHeaderInfo, HEADERS_REGISTRY } from './registry.js';
import { assertNoErrors, validateConfig } from './validate.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { cac } from 'cac';
import type { ValidationIssue } from './types.js';

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

export async function runBuild(options: {
	config?: string;
	outDir?: string;
	strict?: boolean;
}): Promise<void> {
	const configPath = options.config;
	const outDirOverride = options.outDir;
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

export function runListHeaders(options: {
	category?: string;
	status?: string;
}): void {
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

export function runInspect(name: string | undefined): void {
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

export async function runCli(argv: string[]): Promise<void> {
	const cli = cac('cf-headers');

	cli
		.option(
			'-c, --config <path>',
			'Path to a cf-headers.config.{ts,js,mjs} file',
		)
		.option('-o, --out-dir <dir>', "Override the config's outDir")
		.option('--strict', 'Enable strict validation (default: true)');

	cli
		.command('[command]', 'Generate _headers from your config file')
		.alias('build')
		.action(async (command, options) => {
			if (command !== undefined && command !== 'build') {
				console.error(`[cf-headers] Unknown command: ${command}`);
				cli.outputHelp();
				process.exitCode = 1;
				return;
			}
			await runBuild({
				config: options.config,
				outDir: options.outDir,
				strict: options.strict,
			});
		});

	cli
		.command('list-headers', 'Print the full header catalog')
		.option('--category <category>', 'Filter headers by category')
		.option('--status <status>', 'Filter headers by status')
		.action((options) => {
			runListHeaders({
				category: options.category,
				status: options.status,
			});
		});

	cli
		.command('inspect <name>', 'Show metadata for a single header')
		.action((name) => {
			runInspect(name);
		});

	cli.help();
	cli.version('0.1.0');

	cli.parse(argv, { run: false });
	await cli.runMatchedCommand();
}

if (
	process.argv[1] &&
	(path.basename(process.argv[1]) === 'cli.ts' ||
		path.basename(process.argv[1]) === 'cli.js' ||
		path.basename(process.argv[1]) === 'cli.mjs' ||
		path.basename(process.argv[1]) === 'cf-headers')
) {
	runCli(process.argv).catch((error: unknown) => {
		console.error(
			`[cf-headers] ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exitCode = 1;
	});
}
