#!/usr/bin/env node
import { generateHeadersFile } from "./build.js";
import { findConfigFile, loadConfig } from "./load-config.js";
import { getHeaderInfo, HEADERS_REGISTRY } from "./registry.js";
import { assertNoErrors, validateConfig } from "./validate.js";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { ValidationIssue } from "./types.js";

const HELP = `cf-headers — type-safe _headers generator for Cloudflare Pages & Workers

Usage:
  cf-headers [build]                Generate _headers from your config file
  cf-headers list-headers           Print the full header catalog
  cf-headers inspect <name>         Show metadata for a single header
  cf-headers --help                 Show this message

Options for "build" (the default command):
  -c, --config <path>   Path to a cf-headers.config.{ts,js,mjs,cjs} file
                         (default: search the current directory)
  -o, --out-dir <dir>   Override the config's outDir
  --no-strict           Only warn on validation issues instead of failing
`;

function printIssues(issues: ValidationIssue[]): void {
  for (const issue of issues) {
    const prefix = issue.level === "error" ? "error" : "warn";
    const location = issue.ruleIndex !== undefined ? ` (rule ${issue.ruleIndex})` : "";
    console[issue.level === "error" ? "error" : "warn"](`[cf-headers] ${prefix}${location}: ${issue.message}`);
  }
}

async function runBuild(args: string[]): Promise<void> {
  let configPath: string | undefined;
  let outDirOverride: string | undefined;
  let strictOverride: boolean | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-c" || arg === "--config") {
      configPath = args[++i];
    } else if (arg === "-o" || arg === "--out-dir") {
      outDirOverride = args[++i];
    } else if (arg === "--no-strict") {
      strictOverride = false;
    } else if (arg === "--strict") {
      strictOverride = true;
    }
  }

  const cwd = process.cwd();
  const resolvedConfigPath = configPath ? path.resolve(cwd, configPath) : await findConfigFile(cwd);

  if (!resolvedConfigPath) {
    console.error(
      "[cf-headers] No config file found. Create a cf-headers.config.ts " +
        '(e.g. `export default defineConfig({ outDir: "dist", rules: [...] })`) ' +
        "or pass --config <path>.",
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
  const filePath = path.join(outDir, "_headers");
  await fs.writeFile(filePath, content, "utf-8");

  console.log(`[cf-headers] Wrote ${config.rules.length} rule(s) to ${filePath}`);
}

function runListHeaders(args: string[]): void {
  const categoryFilter = args.find((a) => a.startsWith("--category="))?.split("=")[1];
  const statusFilter = args.find((a) => a.startsWith("--status="))?.split("=")[1];

  const rows = HEADERS_REGISTRY.filter((h) => !categoryFilter || h.category === categoryFilter).filter(
    (h) => !statusFilter || h.status === statusFilter,
  );

  for (const h of rows) {
    console.log(`${h.name.padEnd(38)} ${h.status.padEnd(12)} ${h.category.padEnd(24)} ${h.description}`);
  }
  console.log(`\n${rows.length} header(s).`);
}

function runInspect(name: string | undefined): void {
  if (!name) {
    console.error("[cf-headers] Usage: cf-headers inspect <header-name>");
    process.exitCode = 1;
    return;
  }
  const info = getHeaderInfo(name);
  if (!info) {
    console.log(`"${name}" is not in the built-in catalog — treated as a custom header.`);
    return;
  }
  console.log(`${info.name}`);
  console.log(`  status:      ${info.status}`);
  console.log(`  category:    ${info.category}`);
  console.log(`  context:     ${info.context}`);
  console.log(`  settable via _headers: ${info.settableViaHeadersFile ? "yes" : "no (request-oriented header)"}`);
  console.log(`  description: ${info.description}`);
  console.log(`  reference:   ${info.referenceUrl}`);
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;

  if (command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }

  if (command === "list-headers") {
    runListHeaders(rest);
    return;
  }

  if (command === "inspect") {
    runInspect(rest[0]);
    return;
  }

  if (command === undefined || command === "build") {
    await runBuild(rest);
    return;
  }

  // Anything else is treated as a flag for the default "build" command,
  // e.g. `cf-headers --config ./my.config.ts`.
  await runBuild([command, ...rest]);
}

main().catch((error: unknown) => {
  console.error(`[cf-headers] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
