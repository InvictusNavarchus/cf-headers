import { defineConfig } from "vite";
import { cfHeaders } from "cf-headers/vite";
import { corsPreset, immutableAssetsPreset, noIndexPreviewDomainPreset, rule, securityHeadersPreset } from "cf-headers";

export default defineConfig({
  plugins: [
    cfHeaders({
      rules: [
        securityHeadersPreset("/*"),
        immutableAssetsPreset("/assets/*"),
        corsPreset("/fonts/*"),
        noIndexPreviewDomainPreset("https://:project.pages.dev/*"),
        rule(
          "/api/*",
          { "Cache-Control": "no-store" },
          "API responses should never be cached by the browser.",
        )
      ],
    }),
  ],
});
