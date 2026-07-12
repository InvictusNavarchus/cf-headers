import { defineConfig } from "vite";
import { cfHeaders } from "cf-headers/vite";
import { corsPreset, immutableAssetsPreset, noIndexPreviewDomainPreset, securityHeadersPreset } from "cf-headers";

export default defineConfig({
  plugins: [
    cfHeaders({
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
    }),
  ],
});
