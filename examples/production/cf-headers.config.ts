import {
	defineConfig,
	securityHeadersPreset,
	immutableAssetsPreset,
	dynamicContentPreset,
	corsPreset,
	noIndexPreviewDomainPreset,
} from 'cf-headers';

export default defineConfig({
	// Output directory for the generated _headers file
	outDir: 'examples/production',

	// Enable strict validation to catch errors during build time
	strict: true,

	rules: [
		// 1. Hardened security headers for all HTML/app paths
		securityHeadersPreset('/*', {
			// Customize HSTS for production (required for domain preloading)
			hsts: {
				maxAge: 31536000, // 1 year
				includeSubDomains: true,
				preload: true,
			},

			// Custom Content-Security-Policy (CSP)
			csp: {
				defaultSrc: ["'self'"],
				// Enable Google Tag Manager, Google Analytics, and Stripe scripts
				scriptSrc: [
					"'self'",
					'https://www.googletagmanager.com',
					'https://www.google-analytics.com',
					'https://js.stripe.com',
				],
				// Allow images from self, data URIs, and Google Analytics
				imgSrc: [
					"'self'",
					'data:',
					'https://www.google-analytics.com',
					'https://images.unsplash.com',
				],
				// Allow styles from self and Google Fonts
				styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
				fontSrc: ["'self'", 'https://fonts.gstatic.com'],
				// Connect to self, Google Analytics, and Stripe API
				connectSrc: [
					"'self'",
					'https://www.google-analytics.com',
					'https://api.stripe.com',
				],
				// Allow iframes from Stripe and YouTube
				frameSrc: [
					"'self'",
					'https://js.stripe.com',
					'https://www.youtube-nocookie.com',
				],
				objectSrc: ["'none'"],
				baseUri: ["'self'"],
				upgradeInsecureRequests: true,
			},

			// Custom Permissions-Policy to lock down device APIs
			permissions: {
				camera: [],
				microphone: [],
				geolocation: [],
				// Allow payments from self and Stripe
				payment: ['self', 'https://js.stripe.com'],
				usb: [],
				interestCohort: [],
				browsingTopics: [],
			},

			// Use Cross-Origin-Opener-Policy and Cross-Origin-Resource-Policy
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
		noIndexPreviewDomainPreset('https://:project.pages.dev/*'),

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
});
