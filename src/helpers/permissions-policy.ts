/**
 * An allowlist for a single browser feature: `[]` blocks it everywhere,
 * `["self"]` allows only the current origin, or list explicit origins
 * (e.g. `["https://example.com"]"`).
 */
export type PermissionsPolicyAllowlist = '*' | Array<'self' | (string & {})>;

/**
 * A representative (non-exhaustive) set of Permissions-Policy features.
 * Any other feature name can still be supplied via `extra`.
 */
export interface PermissionsPolicyOptions {
	camera?: PermissionsPolicyAllowlist;
	microphone?: PermissionsPolicyAllowlist;
	geolocation?: PermissionsPolicyAllowlist;
	fullscreen?: PermissionsPolicyAllowlist;
	payment?: PermissionsPolicyAllowlist;
	usb?: PermissionsPolicyAllowlist;
	gyroscope?: PermissionsPolicyAllowlist;
	accelerometer?: PermissionsPolicyAllowlist;
	magnetometer?: PermissionsPolicyAllowlist;
	midi?: PermissionsPolicyAllowlist;
	interestCohort?: PermissionsPolicyAllowlist;
	browsingTopics?: PermissionsPolicyAllowlist;
	/** Escape hatch for features not modeled above, e.g. `{ "attribution-reporting": [] }`. */
	extra?: Record<string, PermissionsPolicyAllowlist>;
}

const FEATURE_NAMES: Record<
	Exclude<keyof PermissionsPolicyOptions, 'extra'>,
	string
> = {
	camera: 'camera',
	microphone: 'microphone',
	geolocation: 'geolocation',
	fullscreen: 'fullscreen',
	payment: 'payment',
	usb: 'usb',
	gyroscope: 'gyroscope',
	accelerometer: 'accelerometer',
	magnetometer: 'magnetometer',
	midi: 'midi',
	interestCohort: 'interest-cohort',
	browsingTopics: 'browsing-topics',
};

function serializeAllowlist(allowlist: PermissionsPolicyAllowlist): string {
	if (allowlist === '*') return '*';
	if (allowlist.length === 0) return '()';
	return `(${allowlist
		.map((origin) => {
			const trimmed = origin.trim().replace(/^'|'$/g, '');
			if (trimmed === 'none') {
				throw new Error(
					`permissionsPolicy: "none" is not a valid origin keyword in Permissions-Policy. To block a feature, use an empty array [] (which renders as "()").`,
				);
			}
			if (trimmed === 'src') {
				throw new Error(
					`permissionsPolicy: "src" is not a valid origin keyword in Permissions-Policy. Use "self" or explicit origins instead.`,
				);
			}
			if (trimmed === '*') {
				throw new Error(
					`permissionsPolicy: Wildcard "*" cannot be used inside an array. Use the string "*" directly (e.g., camera: '*') instead of ['*'].`,
				);
			}
			if (trimmed === 'self') {
				if (origin !== 'self') {
					throw new Error(
						`permissionsPolicy: Single-quoted "${origin}" is invalid in Permissions-Policy. Use the unquoted "self" token instead.`,
					);
				}
				return 'self';
			}
			return `"${origin}"`;
		})
		.join(' ')})`;
}

/**
 * Build a `Permissions-Policy` value from a typed feature map instead of
 * hand-assembling a `,`-separated string.
 *
 * @example
 * permissionsPolicy({ camera: [], geolocation: ["self"] })
 * // "camera=(), geolocation=(self)"
 */
export function permissionsPolicy(options: PermissionsPolicyOptions): string {
	const parts: string[] = [];

	for (const [key, feature] of Object.entries(FEATURE_NAMES) as [
		Exclude<keyof PermissionsPolicyOptions, 'extra'>,
		string,
	][]) {
		const allowlist = options[key];
		if (allowlist !== undefined) {
			parts.push(`${feature}=${serializeAllowlist(allowlist)}`);
		}
	}

	if (options.extra) {
		for (const [feature, allowlist] of Object.entries(options.extra)) {
			parts.push(`${feature}=${serializeAllowlist(allowlist)}`);
		}
	}

	if (parts.length === 0) {
		throw new Error('permissionsPolicy(): at least one feature must be set.');
	}

	return parts.join(', ');
}

/** Locks down the most commonly abused sensitive features by default. */
export function lockedDownPermissionsPolicy(
	overrides: PermissionsPolicyOptions = {},
): string {
	return permissionsPolicy({
		camera: [],
		microphone: [],
		geolocation: [],
		payment: [],
		usb: [],
		interestCohort: [],
		browsingTopics: [],
		...overrides,
	});
}
