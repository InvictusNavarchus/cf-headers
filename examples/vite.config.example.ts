import { defineConfig } from "vite";
import { cfHeaders } from "cf-headers/vite";
import { corsPreset, immutableAssetsPreset, securityHeadersPreset } from "cf-headers";

export default defineConfig({
  plugins: [
    cfHeaders({
      rules: [
        securityHeadersPreset("/*"),
        immutableAssetsPreset("/assets/*"),
        corsPreset("/fonts/*"),
      ],
    }),
  ],
});
