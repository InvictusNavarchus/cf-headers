# cf-headers

[![npm](https://img.shields.io/npm/v/@navarchus/cf-headers)](https://www.npmjs.com/package/@navarchus/cf-headers)
[![License](https://img.shields.io/github/license/InvictusNavarchus/cf-headers)](https://github.com/InvictusNavarchus/cf-headers/blob/master/LICENSE)

Type-safe `_headers` file generator for **Cloudflare Pages** and **Workers static assets**.

- ✅ Autocomplete for **~150 HTTP headers**
- ✅ Typed builders for the fiddly, string-assembled headers:
  `Cache-Control`, `Content-Security-Policy`, `Permissions-Policy`
- ✅ Secure presets for common security headers
- ✅ Validates against Cloudflare's documented limits: 100 rules, 2000
  chars/line, HTTPS-only absolute URLs, single splat per path
- ✅ Works as a Vite plugin or plain Node programmatic API

## Install

```bash
npm install --save-dev @navarchus/cf-headers
```

### Peer Dependencies (Optional)

`cf-headers` is designed to be completely tool-agnostic with zero required runtime dependencies. Depending on your setup, you can install the following optional peer dependencies:

* **For the Vite Plugin (`cf-headers/vite`)**: Make sure you have `vite` installed in your project:
  ```bash
  npm install --save-dev vite
  ```

## Quick start

### Vite Plugin

If your project uses Vite, add the plugin to your `vite.config.ts`. It hooks into the `closeBundle` step to automatically validate and write your `_headers` file:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { cfHeaders } from "@navarchus/cf-headers/vite";
import { securityHeadersPreset, immutableAssetsPreset } from "@navarchus/cf-headers";

export default defineConfig({
  plugins: [
    cfHeaders({
      rules: [
        securityHeadersPreset("/*"),
        immutableAssetsPreset("/assets/*")
      ],
    }),
  ],
});
```

### Programmatic API

Not using Vite? You can call the programmatic API from any Node build or post-build script (Webpack, Esbuild, Next.js, etc.):

```ts
import { writeHeadersFile, securityHeadersPreset, immutableAssetsPreset } from "@navarchus/cf-headers";

await writeHeadersFile({
  outDir: "dist", // path to your built static assets
  rules: [
    securityHeadersPreset("/*"),
    immutableAssetsPreset("/assets/*"),
  ],
});
```

## Writing rules

A rule is a path (or absolute HTTPS URL) plus a block of headers, matching
[Cloudflare's `_headers` syntax](https://developers.cloudflare.com/workers/static-assets/headers/)
one-to-one:

```ts
import { rule } from "@navarchus/cf-headers";

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

**Override** a header to prevent Cloudflare's default accumulation behavior. Cloudflare does not use path specificity to resolve conflicts; instead, it comma-joins multiple values if a request matches multiple rules. To make a narrower rule truly override a broader one, use `override()`:

```ts
import { rule, override } from "@navarchus/cf-headers";

rule("/assets/*", { "Cache-Control": override("public, max-age=31536000, immutable") });
// renders as:
// /assets/*
//   ! Cache-Control
//   Cache-Control: public, max-age=31536000, immutable
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
import { cacheControl, csp, permissionsPolicy, compatibleCsp, strictCsp } from "@navarchus/cf-headers";

cacheControl({ public: true, maxAge: 31536000, immutable: true });
// "public, max-age=31536000, immutable"

// Raw CSP builder:
csp({ defaultSrc: ["'self'"], scriptSrc: ["'self'", "https://cdn.example.com"] });
// "default-src 'self'; script-src 'self' https://cdn.example.com"

// High-level CSP presets:
compatibleCsp(); // Practical SPA-friendly CSP (style-src 'unsafe-inline', data/blob URLs)
strictCsp();     // High-security lockdown for fully self-contained static sites

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
| `securityHeadersPreset(path?, options?)` | `nosniff`, CSP, HSTS, Permissions-Policy, Referrer-Policy, and secure COOP/CORP defaults. |
| `dynamicContentPreset(path?)` | Overrides `Cache-Control` to `no-store, no-cache, must-revalidate` for dynamic routes. |
| `immutableAssetsPreset(path?, options?)` | Overrides `Cache-Control` to `immutable` caching, and detaches HTML-specific headers (CSP, Permissions-Policy, X-Frame-Options) to avoid bloat. |
| `corsPreset(path?)` | Overrides CORS origin to `*` and CORP to `cross-origin` to ensure static assets can be loaded cross-origin. |
| `noIndexPreviewDomainPreset(options?)` | `X-Robots-Tag: noindex` on your `*.pages.dev`/`*.workers.dev` preview subdomain. |

### Security Headers Customization

The `securityHeadersPreset` offers deep customization. Most values can be customized or disabled entirely by passing `false`:

```ts
securityHeadersPreset("/*", {
  // Select a CSP preset ('compatible' | 'strict'), pass CspOptions (merges onto 'compatible'), or false to omit
  csp: "compatible", // default
  
  // Or: merge custom overrides directly onto the default 'compatible' preset:
  // csp: { connectSrc: ["'self'", "https://api.example.com"] },

  // Or: use the strict preset with custom overrides:
  // csp: { preset: "strict", overrides: { imgSrc: ["'self'", "data:"] } },
  
  // Custom HSTS config or false to disable
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  
  // Disable specific headers entirely if handled elsewhere
  permissions: false,
  referrerPolicy: false,
  xContentTypeOptions: false,
  xFrameOptions: false,
  coop: false,
  coep: false,
  corp: false,
});
```


## Catalog metadata

The same metadata that powers deprecation warnings is exported, so you can build tooling on top of it. E.g.,, a CI check that fails on deprecated headers in production rules, or a custom preset generator.

```ts
import { getHeadersByStatus } from "@navarchus/cf-headers";
getHeadersByStatus("deprecated"); // every deprecated header in the catalog
```

## Validation

Every build validates against Cloudflare's documented constraints and fails
(by default) on:

- more than 100 rule blocks
- any rendered line over 2000 characters
- absolute URLs that aren't `https://` or that specify a port
- more than one `*` splat in a path

It also issues **warnings** on:
- deprecated or non-standard headers
- unsafe directives in `Content-Security-Policy`
- potential path collisions where the same header is set as a plain value (not overridden/detached) in multiple overlapping path patterns (helping you avoid unintended comma-joined values)

Set `strict: false` in your configuration to downgrade these to warnings instead of build failures.

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
