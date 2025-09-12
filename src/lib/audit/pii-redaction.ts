/**
 * Enhanced PII redaction utility with pattern-based detection
 */

// Common PII patterns
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  // IP addresses
  ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  // URLs with potential sensitive parameters
  urlWithParams: /https?:\/\/[^\s]+[?&]([^=]+=[^&\s]+)/g,
  // Potential API keys or tokens (sequences of 20+ alphanumeric characters)
  apiKey: /\b[A-Za-z0-9]{20,}\b/g,
};

// Sensitive field names that should be redacted regardless of content
const SENSITIVE_FIELD_NAMES = [
  "password",
  "secret",
  "token",
  "key",
  "api_key",
  "apikey",
  "auth",
  "authorization",
  "credential",
  "private",
  "confidential",
];

export interface RedactionConfig {
  maxValueLength: number;
  enablePatternDetection: boolean;
  enableFieldNameDetection: boolean;
  customPatterns?: RegExp[];
  whitelistFields?: string[];
}

export const DEFAULT_REDACTION_CONFIG: RedactionConfig = {
  maxValueLength: 100,
  enablePatternDetection: true,
  enableFieldNameDetection: true,
  customPatterns: [],
  whitelistFields: ["id", "status", "version", "locale", "created_at", "updated_at"],
};

/**
 * Redact PII from a string value using multiple detection methods
 */
function redactStringValue(value: string, config: RedactionConfig): string {
  let redactedValue = value;
  const redactionReasons: string[] = [];

  // Method 1: Length-based redaction
  if (config.maxValueLength > 0 && value.length > config.maxValueLength) {
    redactionReasons.push(`exceeds ${config.maxValueLength} chars`);
    redactedValue = `[REDACTED: ${value.length} characters - ${redactionReasons.join(", ")}]`;
    return redactedValue;
  }

  // Method 2: Pattern-based detection
  if (config.enablePatternDetection) {
    for (const [patternName, pattern] of Object.entries(PII_PATTERNS)) {
      if (pattern.test(value)) {
        redactionReasons.push(patternName);
        redactedValue = redactedValue.replace(
          pattern,
          `[${patternName.toUpperCase()}_REDACTED]`,
        );
      }
    }

    // Apply custom patterns
    if (config.customPatterns) {
      for (const [index, pattern] of config.customPatterns.entries()) {
        if (pattern.test(value)) {
          redactionReasons.push(`custom_pattern_${index}`);
          redactedValue = redactedValue.replace(pattern, "[CUSTOM_PII_REDACTED]");
        }
      }
    }
  }

  return redactionReasons.length > 0 ? redactedValue : value;
}

/**
 * Check if a field name indicates sensitive content
 */
function isFieldNameSensitive(fieldName: string, config: RedactionConfig): boolean {
  if (!config.enableFieldNameDetection) {
    return false;
  }

  if (config.whitelistFields?.includes(fieldName.toLowerCase())) {
    return false;
  }

  const lowerFieldName = fieldName.toLowerCase();
  return SENSITIVE_FIELD_NAMES.some((sensitiveField) =>
    lowerFieldName.includes(sensitiveField),
  );
}

/**
 * Recursively redact PII from an object
 */
function redactObjectFields(
  obj: unknown,
  config: RedactionConfig,
  parentKey = "",
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      redactObjectFields(item, config, `${parentKey}[${index}]`),
    );
  }

  if (typeof obj === "object") {
    const redactedObj: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const fullKey = parentKey ? `${parentKey}.${key}` : key;

      // Check if field name is sensitive (but respect whitelist)
      if (isFieldNameSensitive(key, config)) {
        redactedObj[key] = "[REDACTED: sensitive field name]";
        continue;
      }

      if (typeof value === "string") {
        redactedObj[key] = redactStringValue(value, config);
      } else {
        redactedObj[key] = redactObjectFields(value, config, fullKey);
      }
    }

    return redactedObj;
  }

  if (typeof obj === "string") {
    return redactStringValue(obj, config);
  }

  return obj;
}

/**
 * Enhanced redaction function for event records
 */
export function redactSensitiveData(
  eventRecord: Record<string, unknown>,
  config: RedactionConfig = DEFAULT_REDACTION_CONFIG,
): Record<string, unknown> {
  const redactedEvent = { ...eventRecord };

  // Redact before data
  if (redactedEvent.before) {
    const beforeData =
      typeof redactedEvent.before === "string"
        ? JSON.parse(redactedEvent.before)
        : redactedEvent.before;

    redactedEvent.before = redactObjectFields(beforeData, config);
  }

  // Redact after data
  if (redactedEvent.after) {
    const afterData =
      typeof redactedEvent.after === "string"
        ? JSON.parse(redactedEvent.after)
        : redactedEvent.after;

    redactedEvent.after = redactObjectFields(afterData, config);
  }

  return redactedEvent;
}

/**
 * Create custom redaction config for different contexts
 */
export function createRedactionConfig(
  overrides: Partial<RedactionConfig>,
): RedactionConfig {
  return {
    ...DEFAULT_REDACTION_CONFIG,
    ...overrides,
  };
}

/**
 * Validate redaction effectiveness for testing
 */
export function validateRedaction(original: string, redacted: string): boolean {
  // Check that common PII patterns are not present in redacted content
  for (const pattern of Object.values(PII_PATTERNS)) {
    if (pattern.test(redacted)) {
      return false;
    }
  }

  // If original contained PII, redacted should be different
  const originalHadPii = Object.values(PII_PATTERNS).some((pattern) =>
    pattern.test(original),
  );
  if (originalHadPii && original === redacted) {
    return false;
  }

  return true;
}
