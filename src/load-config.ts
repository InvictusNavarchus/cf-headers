import { transform } from "esbuild";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { CfHeadersConfig } from "./types.js";

const CONFIG_CANDIDATES = [
  "cf-headers.config.ts",
  "cf-headers.config.mts",
  "cf-headers.config.js",
  "cf-headers.config.mjs",
];

/** Search `cwd` for a supported config filename. */
export async function findConfigFile(cwd: string): Promise<string | undefined> {
  for (const candidate of CONFIG_CANDIDATES) {
    const candidatePath = path.join(cwd, candidate);
    try {
      await fs.access(candidatePath);
      return candidatePath;
    } catch {
      // not found, try next candidate
    }
  }
  return undefined;
}

async function importFreshEsm(fileUrl: string): Promise<unknown> {
  // Cache-bust so repeated CLI runs (e.g. --watch) pick up edits.
  const bustedUrl = `${fileUrl}?t=${Date.now()}`;
  return import(bustedUrl);
}

/**
 * Load a `cf-headers.config.*` file and return its default export. `.ts`
 * files are transpiled in-memory with esbuild (no project-wide ts-node/tsx
 * setup required) and imported from a throwaway temp file.
 */
export async function loadConfig(configPath: string): Promise<CfHeadersConfig> {
  const ext = path.extname(configPath);
  let moduleUrl: string;
  let cleanup: (() => Promise<void>) | undefined;

  if (ext === ".ts" || ext === ".mts") {
    const source = await fs.readFile(configPath, "utf-8");
    const { code } = await transform(source, {
      loader: "ts",
      format: "esm",
      target: "node20",
      sourcefile: configPath,
    });
    // Written *next to* the original config (not os.tmpdir()) so relative
    // imports and node_modules resolution behave exactly as the user wrote
    // them — a temp dir would silently break both.
    const tempFile = path.join(
      path.dirname(configPath),
      `.cf-headers.config.${Date.now()}.${Math.random().toString(36).slice(2)}.mjs`,
    );
    await fs.writeFile(tempFile, code, "utf-8");
    moduleUrl = pathToFileURL(tempFile).href;
    cleanup = () => fs.rm(tempFile, { force: true });
  } else {
    moduleUrl = pathToFileURL(configPath).href;
  }

  try {
    const mod = (await importFreshEsm(moduleUrl)) as { default?: CfHeadersConfig };
    if (!mod.default) {
      throw new Error(`Config file "${configPath}" must have a default export (e.g. \`export default defineConfig({...})\`).`);
    }
    return mod.default;
  } finally {
    if (cleanup) await cleanup();
  }
}
