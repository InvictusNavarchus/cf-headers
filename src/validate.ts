import { MAX_LINE_LENGTH, MAX_RULES } from "./build.js";
import { getHeaderInfo } from "./registry.js";
import type { HeaderRule, ValidationIssue } from "./types.js";

const ABSOLUTE_URL_WITH_PORT = /^https?:\/\/[^/]+:\d+/;
const NON_HTTPS_ABSOLUTE_URL = /^http:\/\//;

function isDetach(value: unknown): value is { detach: true } {
  return typeof value === "object" && value !== null && "detach" in value && (value as { detach: unknown }).detach === true;
}

/**
 * Validate a rule set against Cloudflare's documented constraints:
 *  - at most 100 rule blocks
 *  - at most 2000 characters per rendered line
 *  - absolute URLs must use https and may not specify a port
 *  - a header can't be both set and detached in the same rule
 *
 * Also flags (as warnings) headers that are deprecated, non-standard, or
 * not realistically something you'd set from a `_headers` file, so you
 * catch typos and legacy headers before they ship.
 */
export function validateConfig(rules: HeaderRule[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (rules.length > MAX_RULES) {
    issues.push({
      level: "error",
      message: `Cloudflare allows at most ${MAX_RULES} header rules; this config defines ${rules.length}.`,
    });
  }

  rules.forEach((rule, ruleIndex) => {
    if (!rule.path || rule.path.trim().length === 0) {
      issues.push({ level: "error", message: "Rule is missing a path.", ruleIndex });
    }

    if (NON_HTTPS_ABSOLUTE_URL.test(rule.path)) {
      issues.push({
        level: "error",
        message: `Absolute URLs must start with "https://": "${rule.path}".`,
        ruleIndex,
      });
    }

    if (ABSOLUTE_URL_WITH_PORT.test(rule.path)) {
      issues.push({
        level: "error",
        message: `Absolute URLs may not specify a port: "${rule.path}".`,
        ruleIndex,
      });
    }

    if (rule.path.split("*").length - 1 > 1) {
      issues.push({
        level: "error",
        message: `Only a single "*" splat is allowed per path: "${rule.path}".`,
        ruleIndex,
      });
    }

    for (const [name, value] of Object.entries(rule.headers)) {
      const line = isDetach(value) ? `  ! ${name}` : `  ${name}: ${String(value)}`;
      if (line.length > MAX_LINE_LENGTH) {
        issues.push({
          level: "error",
          message: `Line for "${name}" is ${line.length} characters, over the ${MAX_LINE_LENGTH}-character limit.`,
          ruleIndex,
        });
      }

      const info = getHeaderInfo(name);
      if (info) {
        if (info.status === "deprecated") {
          issues.push({
            level: "warning",
            message: `"${name}" is deprecated: ${info.description}`,
            ruleIndex,
          });
        } else if (info.status === "non-standard") {
          issues.push({
            level: "warning",
            message: `"${name}" is a non-standard/proprietary header: ${info.description}`,
            ruleIndex,
          });
        }
        if (!info.settableViaHeadersFile) {
          issues.push({
            level: "warning",
            message: `"${name}" is normally a request-only header; setting it via _headers has no effect on browser behavior.`,
            ruleIndex,
          });
        }
      }
    }
  });

  return issues;
}

/** Throws if any `"error"`-level issues are present. Always safe to call on
 * a set of only-warning issues (no-op). */
export function assertNoErrors(issues: ValidationIssue[]): void {
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length > 0) {
    const details = errors.map((e) => (e.ruleIndex !== undefined ? `  [rule ${e.ruleIndex}] ${e.message}` : `  ${e.message}`)).join("\n");
    throw new Error(`cf-headers: invalid configuration:\n${details}`);
  }
}
