# cf-headers

![License](https://img.shields.io/github/license/InvictusNavarchus/cf-headers)
![Version](https://img.shields.io/github/package-json/v/InvictusNavarchus/cf-headers)

Type-safe `_headers` file generator for **Cloudflare Pages** and **Workers static assets**.

- ✅ Autocomplete for **~150 HTTP headers**, each tagged with status
  (`standard` / `experimental` / `deprecated` / `non-standard`), category,
  and a plain-English description
- ✅ Narrowed value types for common headers (`X-Frame-Options`,
  `Referrer-Policy`, `Cross-Origin-*`, ...) — typos get caught at compile time
- ✅ Typed builders for the fiddly, string-assembled headers:
  `Cache-Control`, `Content-Security-Policy`, `Permissions-Policy`
- ✅ Validates against Cloudflare's documented limits (100 rules, 2000
  chars/line, HTTPS-only absolute URLs, single splat per path) before you ship
- ✅ Works from a config file + CLI, a Vite plugin, or plain Node — pick
  whichever fits your build

```
/*
  X-Content-Type-Options: nosniff
  Content-Security-Policy: default-src 'self'; object-src 'none'
```

## Install

```bash
npm install --save-dev cf-headers
```

### Peer Dependencies (Optional)

`cf-headers` is designed to be completely tool-agnostic with zero required runtime dependencies. Depending on your setup, you can install the following optional peer dependencies:

* **For the Vite Plugin (`cf-headers/vite`)**: Make sure you have `vite` installed in your project:
  ```bash
  npm install --save-dev vite
  ```
* **For TypeScript Config Files (`cf-headers.config.ts` / `.mts`)**: The CLI uses `esbuild` to compile your configuration file in-memory. If your project uses Vite (or SvelteKit, Astro, Remix, etc.), `esbuild` is already installed transitively. Otherwise, install it locally:
  ```bash
  npm install --save-dev esbuild
  ```
  *(Note: If you use a JavaScript configuration file like `cf-headers.config.js` or `.mjs`, no transpiler is required and you do not need to install `esbuild` at all).*

## Quick start

**1. Create a config file** (`cf-headers.config.ts`) at your project root:

```ts
import {
  defineConfig,
  securityHeadersPreset,
  immutableAssetsPreset,
  corsPreset,
} from "cf-headers";

export default defineConfig({
  outDir: "dist", // wherever your framework outputs static files
  rules: [
    securityHeadersPreset("/*"),
    immutableAssetsPreset("/assets/*"),
    corsPreset("/fonts/*"),
  ],
});
```

**2. Run it after your build:**

```bash
npx cf-headers
```

That writes a Cloudflare-ready `dist/_headers` file. Add it to your build
script:

```json
{
  "scripts": {
    "build": "vite build && cf-headers"
  }
}
```

Or skip the CLI entirely and use the **Vite plugin**, which hooks into
`closeBundle` automatically:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { cfHeaders } from "cf-headers/vite";
import { securityHeadersPreset, immutableAssetsPreset } from "cf-headers";

export default defineConfig({
  plugins: [
    cfHeaders({
      rules: [securityHeadersPreset("/*"), immutableAssetsPreset("/assets/*")],
    }),
  ],
});
```

Not using Vite? Call the programmatic API from any Node build script
(webpack, esbuild, Next.js, a plain `postbuild` script, ...):

```ts
import { writeHeadersFile, rule } from "cf-headers";

await writeHeadersFile({
  outDir: "dist",
  rules: [rule("/*", { "X-Content-Type-Options": "nosniff" })],
});
```

## Writing rules

A rule is a path (or absolute HTTPS URL) plus a block of headers, matching
[Cloudflare's `_headers` syntax](https://developers.cloudflare.com/workers/static-assets/headers/)
one-to-one:

```ts
import { rule } from "cf-headers";

rule(
  "/secure/page",
  {
    "X-Frame-Options": "DENY", // autocompletes to "DENY" | "SAMEORIGIN"
    "X-Content-Type-Options": "nosniff",
    "X-My-Custom-Header": "anything", // unknown headers still work as plain strings
  },
  "lock this route down", // optional comment, rendered as `# ...` above the rule
);
```

Splats and `:placeholder`s work exactly like in `_redirects`:

```ts
rule("/movies/:title", { "x-movie-name": 'You are watching ":title"' });
rule("/static/*", { "Cache-Control": "public, max-age=31556952, immutable" });
```

**Detach** a header that a broader rule (or Cloudflare's defaults) would
otherwise apply, using `{ detach: true }` instead of a string value:

```ts
rule("/*.jpg", { "Content-Security-Policy": { detach: true } });
// renders as:  ! Content-Security-Policy
```

## Type safety

Header **names** autocomplete from the full catalog but still accept any
string, so custom/`X-` headers are never blocked:

```ts
rule("/*", { "Referrer-Policy": "strict-origin-when-cross-origin" }); // ✅ autocompletes

rule("/*", { "Referrer-Policy": "strict-origin-when-cross-orgin" }); // ❌ compile error, typo caught
```

A handful of headers with a fixed vocabulary get a real literal-union type
(see `src/header-values.ts` for the full list): `X-Frame-Options`,
`Referrer-Policy`, `X-Content-Type-Options`, `X-DNS-Prefetch-Control`,
`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`,
`Cross-Origin-Resource-Policy`, `X-Permitted-Cross-Domain-Policies`.

## Value builders

`Cache-Control`, `Content-Security-Policy`, and `Permissions-Policy` are easy
to get subtly wrong as hand-rolled strings, so they get typed builders:

```ts
import { cacheControl, csp, permissionsPolicy } from "cf-headers";

cacheControl({ public: true, maxAge: 31536000, immutable: true });
// "public, max-age=31536000, immutable"

csp({ defaultSrc: ["'self'"], scriptSrc: ["'self'", "https://cdn.example.com"] });
// "default-src 'self'; script-src 'self' https://cdn.example.com"

permissionsPolicy({ camera: [], geolocation: ["self"] });
// "camera=(), geolocation=(self)"
```

Each builder validates itself, e.g. `cacheControl({ public: true, private: true })`
throws immediately (`public` and `private` are mutually exclusive) instead of
silently emitting a nonsensical header.

## Presets

Ready-made rules for the scenarios that come up on nearly every project:

| Preset | What it does |
|---|---|
| `securityHeadersPreset(path?, options?)` | `nosniff`, strict CSP, Permissions-Policy, Referrer-Policy, and secure COOP/CORP defaults |
| `dynamicContentPreset(path?)` | `no-store, no-cache, must-revalidate` headers for HTML entry points or API routes |
| `immutableAssetsPreset(path?)` | Year-long, `immutable` caching for content-hashed build output |
| `corsPreset(path?)` | `Access-Control-Allow-Origin: *` |
| `noIndexPreviewDomainPreset(domainPattern?)` | `X-Robots-Tag: noindex` on your `*.pages.dev`/`*.workers.dev` preview subdomain |


## Exploring the header catalog

```bash
npx cf-headers list-headers                  # every header
npx cf-headers list-headers --category=cors   # filter by category
npx cf-headers list-headers --status=deprecated
npx cf-headers inspect content-security-policy
```

`inspect` output includes status, category, whether the header is realistically
something you'd set from a `_headers` file, a description, and an MDN link —
the same data available programmatically:

```ts
import { getHeaderInfo, getHeadersByStatus } from "cf-headers";

getHeaderInfo("X-Frame-Options");
// { name: "X-Frame-Options", status: "deprecated", category: "security", ... }

getHeadersByStatus("deprecated"); // every deprecated header in the catalog
```

Deprecated and non-standard headers still work when used in a rule — you'll
just get a build-time warning (not a failure) explaining why:

```
[cf-headers] warn (rule 0): "X-Frame-Options" is deprecated: Legacy clickjacking
protection; superseded by CSP frame-ancestors.
```

## Validation

Every build validates against Cloudflare's documented constraints and fails
(by default) on:

- more than 100 rule blocks
- any rendered line over 2000 characters
- absolute URLs that aren't `https://` or that specify a port
- more than one `*` splat in a path

Set `strict: false` in your config (or pass `--no-strict` to the CLI) to
downgrade these to warnings instead of build failures.

## CLI reference

```
cf-headers [build]              Generate _headers from your config file
cf-headers list-headers         Print the full header catalog
cf-headers inspect <name>       Show metadata for a single header
cf-headers --help               Show usage

Options for build:
  -c, --config <path>   Path to a cf-headers.config.{ts,js,mjs} file
  -o, --out-dir <dir>   Override the config's outDir
  --no-strict           Only warn on validation issues instead of failing
```

`.ts` config files are transpiled on the fly. The CLI will dynamically resolve a local installation of `esbuild` (which is typically already present transitively in Vite-based projects, or can be installed via `npm install --save-dev esbuild`). 

If you prefer a zero-dependency setup, write your configuration file as a `.js` or `.mjs` file, which Node.js loads natively.

## What this package doesn't do

- It doesn't call the Cloudflare API — it only writes a static `_headers`
  file into your build output, exactly like you'd hand-author one.
- It doesn't cover `_redirects`, Workers route config, or `wrangler.toml`.
- The header catalog's status flags (`experimental`/`deprecated`/etc.) reflect
  general browser-spec status, not a live, per-browser support matrix —
  check [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers)
  or [caniuse](https://caniuse.com) for exact version-level support if that
  level of detail matters for your use case.

## License

MIT
