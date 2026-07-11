import {
  corsPreset,
  defineConfig,
  immutableAssetsPreset,
  noIndexPreviewDomainPreset,
  securityHeadersPreset,
} from "cf-headers";

export default defineConfig({
  outDir: "dist",
  rules: [
    securityHeadersPreset("/*"),
    immutableAssetsPreset("/assets/*"),
    corsPreset("/fonts/*"),
    noIndexPreviewDomainPreset("https://:project.pages.dev/*"),
    {
      path: "/api/*",
      comment: "API responses should never be cached by the browser.",
      headers: {
        "Cache-Control": "no-store",
      },
    },
  ],
});
