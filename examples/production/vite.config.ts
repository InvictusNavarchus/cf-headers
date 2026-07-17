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
			// Enable strict mode in production to break the build if headers are invalid
			strict: true,
			rules: [
				// 1. Hardened security headers for all HTML/app paths
				securityHeadersPreset('/*', {
					hsts: {
						maxAge: 31536000,
						includeSubDomains: true,
						preload: true,
					},
					// Customizes CSP by overriding specific directives on top of the default 'compatible' preset
					csp: {
						scriptSrc: [
							"'self'",
							'https://www.googletagmanager.com',
							'https://www.google-analytics.com',
							'https://js.stripe.com',
						],
						imgSrc: [
							"'self'",
							'data:',
							'https://www.google-analytics.com',
							'https://images.unsplash.com',
						],
						styleSrc: [
							"'self'",
							"'unsafe-inline'",
							'https://fonts.googleapis.com',
						],
						fontSrc: ["'self'", 'https://fonts.gstatic.com'],
						connectSrc: [
							"'self'",
							'https://www.google-analytics.com',
							'https://api.stripe.com',
						],
						frameSrc: [
							"'self'",
							'https://js.stripe.com',
							'https://www.youtube-nocookie.com',
						],
					},
					permissions: {
						camera: [],
						microphone: [],
						geolocation: [],
						payment: ['self', 'https://js.stripe.com'],
						usb: [],
						interestCohort: [],
						browsingTopics: [],
					},
					coop: 'same-origin',
					corp: 'same-origin',
				}),

				// 2. Aggressive, long-lived caching for fingerprinted frontend assets
				immutableAssetsPreset('/assets/*'),

				// 3. Allow CORS for public web fonts so external sites can load them if needed
				corsPreset('/fonts/*'),

				// 4. Do not cache dynamic API routes to ensure freshness
				dynamicContentPreset('/api/*'),

				// 5. Prevent indexing of preview/staging deployment domains (e.g. project.pages.dev)
				noIndexPreviewDomainPreset({ platform: 'pages' }),

				// 6. Custom rule showing how to add arbitrary headers for specific paths
				{
					path: '/downloads/*',
					comment:
						'Force file downloads to have correct attachment header and disallow execution',
					headers: {
						'Content-Disposition': 'attachment',
						'X-Content-Type-Options': 'nosniff',
					},
				},
			],
		}),
	],
});
