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

Invalid directive combinations (such as specifying both `public` and `private`, or `no-store` alongside `max-age` in `Cache-Control`) are caught by the build validator (`validateConfig`) rather than silently emitting nonsensical headers into your `_headers` output.

## Presets

Ready-made rules for common production scenarios. Defaults are tuned to match Cloudflare's best practices without breaking modern SPA build tools:

| Preset | Default Path | What it does |
|---|---|---|
| `securityHeadersPreset(path?, options?)` | `/*` | Full baseline hardening: CSP (`compatible`), HSTS (1 yr), `nosniff`, `DENY`, COOP, CORP, and locked down Permissions-Policy. |
| `dynamicContentPreset(path?)` | `/*` | Overrides `Cache-Control` to `no-cache, no-store, must-revalidate` for dynamic/API routes. |
| `immutableAssetsPreset(path?, options?)` | `/assets/*` | Overrides `Cache-Control` to `immutable` caching, and by default detaches HTML-specific headers (CSP, Permissions-Policy, X-Frame-Options) to minimize overhead. |
| `corsPreset(path)` | *(required)* | Overrides CORS origin to `*` and CORP to `cross-origin` for static assets like fonts or shared public files. |
| `noIndexPreviewDomainPreset(options?)` | Pages / Workers hosts | Injects `X-Robots-Tag: noindex` on `*.pages.dev` or `*.workers.dev` preview subdomains so only your custom domain gets indexed. |

### Security Headers Preset

Calling `securityHeadersPreset()` with no arguments applies the following production baseline:

| Header | Default Value | Notes |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing. |
| `X-Frame-Options` | `DENY` | Prevents clickjacking by blocking iframe embedding. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Protects sensitive path/query data across origins. |
| `Strict-Transport-Security` | `max-age=31536000` | 1-year HSTS. Preload/subdomains configurable. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates browsing context from popups/openers. |
| `Cross-Origin-Resource-Policy` | `same-origin` | Blocks other sites from embedding your resources. |
| `Cross-Origin-Embedder-Policy` | *(omitted)* | Disabled by default to avoid breaking third-party embeds (Stripe, YouTube, etc.). |
| `Permissions-Policy` | Camera, mic, geo, etc. `()` | Disables invasive sensors by default (`camera=(), geolocation=(), ...`). |
| `Content-Security-Policy` | `compatible` preset | SPA-friendly CSP baseline (see below). |

#### Understanding the CSP Baselines (`compatible` vs `strict`)

Content-Security-Policy is the header most prone to breaking single-page apps. `cf-headers` ships with two presets:

- **`compatible` (Default)**: Tailored for modern frontend frameworks (Vite, Astro, SvelteKit, Next/Nuxt SSG).
  - ✅ **Allowed**: Same-origin scripts, styles, and workers; inline styles (`'unsafe-inline'`); `data:` and `blob:` URIs for images, fonts, and web workers.
  - ❌ **Blocked**: External domains (APIs, CDNs, fonts, analytics); `eval()`; Flash/plugins (`object-src 'none'`); framing (`frame-ancestors 'none'`).
- **`strict`**: High-security lockdown for zero-inline, fully self-contained static sites (disallows `'unsafe-inline'` and `data:`/`blob:` URIs).

#### Customizing Security Headers

You can customize individual headers, extend the CSP, or disable headers entirely by passing `false`:

```ts
import { securityHeadersPreset } from "@navarchus/cf-headers";

securityHeadersPreset("/*", {
  // 1. Extend the compatible CSP baseline for external APIs, fonts, or CDNs:
  csp: {
    connectSrc: ["'self'", "https://api.example.com", "https://*.sentry.io"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com"],
  },

  // Or switch to strict CSP with overrides:
  // csp: { preset: "strict", overrides: { scriptSrc: ["'self'", "https://cdn.example.com"] } },

  // 2. Custom HSTS (preload enforces includeSubDomains and maxAge >= 1 year):
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },

  // 3. Selectively allow specific Permissions-Policy features:
  permissions: {
    camera: ["self"], // allow same-origin camera while keeping others blocked
    geolocation: ["self", "https://maps.example.com"],
  },

  // 4. Adjust framing or cross-origin policies:
  xFrameOptions: "SAMEORIGIN", // or false to omit
  coop: "same-origin-allow-popups",
  coep: "credentialless", // enable COEP without breaking third-party subresources
  corp: "cross-origin",

  // 5. Disable individual headers completely if handled elsewhere:
  referrerPolicy: false,
  xContentTypeOptions: false,
});
```

### Other Preset Options

#### `immutableAssetsPreset(path?, options?)`
Defaults to `/assets/*`. By default (`cleanHeaders: true`), it strips HTML-specific headers (`CSP`, `Permissions-Policy`, `X-Frame-Options`) that are unnecessary on immutable static chunks, saving response bandwidth. Pass `{ cleanHeaders: false }` to keep them:

```ts
immutableAssetsPreset("/assets/*", { cleanHeaders: false });
```

#### `noIndexPreviewDomainPreset(options?)`
Prevents preview domains from being crawled by search engines. Defaults to Cloudflare Pages (`*.pages.dev`). Specify `{ platform: 'workers' }` for Workers static assets (`*.workers.dev`):

```ts
// Returns HeaderRule[]:
noIndexPreviewDomainPreset({ platform: "workers" });
```

#### `corsPreset(path)`
A quick way to enable permissive cross-origin fetching for public fonts or static assets:

```ts
corsPreset("/fonts/*");
// Renders:
// /fonts/*
//   ! Access-Control-Allow-Origin
//   Access-Control-Allow-Origin: *
//   ! Cross-Origin-Resource-Policy
//   Cross-Origin-Resource-Policy: cross-origin
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
- conflicting or invalid header directives (e.g. `public` and `private` together in `Cache-Control`, or `no-store` combined with `max-age`)
- invalid `Permissions-Policy` syntax (e.g. single quotes, or invalid keywords like `none` and `src`)

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
