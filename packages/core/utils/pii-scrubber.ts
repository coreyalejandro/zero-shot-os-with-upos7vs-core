/**
 * PII (Personally Identifiable Information) Scrubbing Utility
 *
 * Removes or masks sensitive information from user messages before logging/analytics
 * to ensure privacy and compliance with data protection regulations.
 */

import { Logger } from './logger.js';

export interface PIIScrubberConfig {
  /**
   * Enable PII scrubbing
   */
  enabled: boolean;

  /**
   * Scrubbing mode: 'remove' (delete) or 'mask' (replace with placeholder)
   */
  mode: 'remove' | 'mask';

  /**
   * Custom placeholder text for masked PII (default: '[REDACTED]')
   */
  placeholder?: string;

  /**
   * Enable detection of specific PII types
   */
  detect: {
    emails: boolean;
    phoneNumbers: boolean;
    creditCards: boolean;
    ssn: boolean;
    ipAddresses: boolean;
    apiKeys: boolean;
    urls: boolean; // URLs might contain sensitive paths
    customPatterns?: Array<{
      name: string;
      pattern: RegExp;
      placeholder?: string;
    }>;
  };

  /**
   * Log scrubbing activity (for debugging/auditing)
   */
  logActivity: boolean;
}

export interface ScrubbingResult {
  /**
   * Scrubbed text with PII removed or masked
   */
  scrubbed: string;

  /**
   * List of detected PII types that were scrubbed
   */
  detected: string[];

  /**
   * Original text length
   */
  originalLength: number;

  /**
   * Scrubbed text length
   */
  scrubbedLength: number;
}

const DEFAULT_CONFIG: PIIScrubberConfig = {
  enabled: true,
  mode: 'mask',
  placeholder: '[REDACTED]',
  detect: {
    emails: true,
    phoneNumbers: true,
    creditCards: true,
    ssn: true,
    ipAddresses: true,
    apiKeys: true,
    urls: false, // Disabled by default as URLs are often needed for context
  },
  logActivity: false,
};

/**
 * PII Scrubbing Utility
 *
 * Detects and removes/masks personally identifiable information from text
 */
export class PIIScrubber {
  private config: PIIScrubberConfig;
  private logger: Logger;

  constructor(config: Partial<PIIScrubberConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger('PIIScrubber');
  }

  /**
   * Scrub PII from text
   */
  scrub(text: string): ScrubbingResult {
    if (!this.config.enabled || !text) {
      return {
        scrubbed: text,
        detected: [],
        originalLength: text?.length || 0,
        scrubbedLength: text?.length || 0,
      };
    }

    let scrubbed = text;
    const detected: string[] = [];

    // API keys (check FIRST to avoid false positives with phone numbers)
    // Common patterns: sk-..., api_key=..., token: ...
    if (this.config.detect.apiKeys) {
      const apiKeyPatterns = [
        /\b(sk|pk|tk|ak)-[a-zA-Z0-9]{20,}\b/g, // Stripe, OpenAI style
        /\bapi[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9]{20,}['"]?/gi,
        /\btoken\s*[:=]\s*['"]?[a-zA-Z0-9]{20,}['"]?/gi,
        /\bbearer\s+[a-zA-Z0-9._-]{20,}/gi,
      ];

      for (const pattern of apiKeyPatterns) {
        if (pattern.test(scrubbed)) {
          scrubbed = scrubbed.replace(pattern, this.getReplacement('apiKey'));
          if (!detected.includes('apiKey')) {
            detected.push('apiKey');
          }
        }
      }
    }

    // Email addresses
    if (this.config.detect.emails) {
      const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      if (emailPattern.test(scrubbed)) {
        scrubbed = scrubbed.replace(emailPattern, this.getReplacement('email'));
        detected.push('email');
      }
    }

    // Phone numbers (US format: (123) 456-7890, 123-456-7890, 123.456.7890, +1 123 456 7890)
    // Check after API keys to avoid false positives
    if (this.config.detect.phoneNumbers) {
      const phonePattern = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g;
      if (phonePattern.test(scrubbed)) {
        scrubbed = scrubbed.replace(phonePattern, this.getReplacement('phone'));
        detected.push('phone');
      }
    }

    // Credit card numbers (13-19 digits, may have spaces/dashes)
    if (this.config.detect.creditCards) {
      const ccPattern = /\b(?:\d{4}[-\s]?){3}\d{1,4}\b/g;
      if (ccPattern.test(scrubbed)) {
        scrubbed = scrubbed.replace(ccPattern, this.getReplacement('creditCard'));
        detected.push('creditCard');
      }
    }

    // Social Security Numbers (SSN: XXX-XX-XXXX)
    if (this.config.detect.ssn) {
      const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
      if (ssnPattern.test(scrubbed)) {
        scrubbed = scrubbed.replace(ssnPattern, this.getReplacement('ssn'));
        detected.push('ssn');
      }
    }

    // IP addresses (IPv4 and IPv6)
    if (this.config.detect.ipAddresses) {
      // IPv4
      const ipv4Pattern = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
      if (ipv4Pattern.test(scrubbed)) {
        scrubbed = scrubbed.replace(ipv4Pattern, this.getReplacement('ipAddress'));
        detected.push('ipAddress');
      }

      // IPv6 (simplified pattern)
      const ipv6Pattern = /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g;
      if (ipv6Pattern.test(scrubbed)) {
        scrubbed = scrubbed.replace(ipv6Pattern, this.getReplacement('ipAddress'));
        if (!detected.includes('ipAddress')) {
          detected.push('ipAddress');
        }
      }
    }


    // URLs (optional, as they might contain sensitive paths)
    if (this.config.detect.urls) {
      const urlPattern = /https?:\/\/[^\s]+/g;
      if (urlPattern.test(scrubbed)) {
        scrubbed = scrubbed.replace(urlPattern, this.getReplacement('url'));
        detected.push('url');
      }
    }

    // Custom patterns
    if (this.config.detect.customPatterns) {
      for (const customPattern of this.config.detect.customPatterns) {
        if (customPattern.pattern.test(scrubbed)) {
          const placeholder = customPattern.placeholder || this.config.placeholder;
          scrubbed = scrubbed.replace(customPattern.pattern, placeholder || '[REDACTED]');
          detected.push(`custom:${customPattern.name}`);
        }
      }
    }

    // Log activity if enabled
    if (this.config.logActivity && detected.length > 0) {
      this.logger.debug(`Scrubbed PII types: ${detected.join(', ')}`);
    }

    return {
      scrubbed,
      detected,
      originalLength: text.length,
      scrubbedLength: scrubbed.length,
    };
  }

  /**
   * Get replacement text based on mode
   */
  private getReplacement(type: string): string {
    if (this.config.mode === 'remove') {
      return '';
    }

    // Use type-specific placeholder if available, otherwise use default
    return this.config.placeholder || '[REDACTED]';
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PIIScrubberConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PIIScrubberConfig {
    return { ...this.config };
  }

  /**
   * Check if scrubbing is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

/**
 * Default PII scrubber instance
 */
let defaultScrubber: PIIScrubber | null = null;

/**
 * Get or create default PII scrubber
 */
export function getDefaultScrubber(config?: Partial<PIIScrubberConfig>): PIIScrubber {
  if (!defaultScrubber) {
    defaultScrubber = new PIIScrubber(config);
  } else if (config) {
    defaultScrubber.updateConfig(config);
  }
  return defaultScrubber;
}

/**
 * Quick scrub function using default scrubber
 */
export function scrubPII(text: string, config?: Partial<PIIScrubberConfig>): string {
  const scrubber = getDefaultScrubber(config);
  return scrubber.scrub(text).scrubbed;
}
