import {
	corsPreset,
	defineConfig,
	dynamicContentPreset,
	immutableAssetsPreset,
	noIndexPreviewDomainPreset,
	securityHeadersPreset,
} from 'cf-headers';

export default defineConfig({
	outDir: 'dist',
	rules: [
		securityHeadersPreset('/*'),
		immutableAssetsPreset('/assets/*'),
		corsPreset('/fonts/*'),
		noIndexPreviewDomainPreset('https://:project.pages.dev/*'),
		dynamicContentPreset('/api/*'),
	],
});
