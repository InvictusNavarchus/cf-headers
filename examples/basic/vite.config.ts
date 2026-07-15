import { defineConfig } from 'vite';
import { cfHeaders } from 'cf-headers/vite';
import {
	corsPreset,
	dynamicContentPreset,
	immutableAssetsPreset,
	noIndexPreviewDomainPreset,
	securityHeadersPreset,
} from 'cf-headers';

export default defineConfig({
	plugins: [
		cfHeaders({
			rules: [
				securityHeadersPreset('/*'),
				immutableAssetsPreset('/assets/*'),
				corsPreset('/fonts/*'),
				noIndexPreviewDomainPreset(),
				dynamicContentPreset('/api/*'),
			],
		}),
	],
});
