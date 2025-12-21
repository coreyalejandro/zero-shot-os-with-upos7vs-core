/**
 * PII Scrubbing Tests
 *
 * Tests for PII detection and scrubbing functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PIIScrubber, scrubPII, PIIScrubberConfig } from '../utils/pii-scrubber.js';

describe('PIIScrubber', () => {
  let scrubber: PIIScrubber;

  beforeEach(() => {
    scrubber = new PIIScrubber({
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
        urls: false,
      },
      logActivity: false,
    });
  });

  describe('email detection', () => {
    it('should detect and mask email addresses', () => {
      const text = 'Contact me at john.doe@example.com for details';
      const result = scrubber.scrub(text);

      expect(result.scrubbed).toContain('[REDACTED]');
      expect(result.scrubbed).not.toContain('john.doe@example.com');
      expect(result.detected).toContain('email');
    });

    it('should handle multiple email addresses', () => {
      const text = 'Email admin@company.com or support@company.com';
      const result = scrubber.scrub(text);

      expect(result.detected).toContain('email');
      expect(result.scrubbed.split('[REDACTED]').length).toBeGreaterThan(2);
    });

    it('should not detect emails when disabled', () => {
      const disabledScrubber = new PIIScrubber({
        enabled: true,
        detect: { ...scrubber.getConfig().detect, emails: false },
      });

      const text = 'Contact me at john.doe@example.com';
      const result = disabledScrubber.scrub(text);

      expect(result.scrubbed).toContain('john.doe@example.com');
      expect(result.detected).not.toContain('email');
    });
  });

  describe('phone number detection', () => {
    it('should detect US phone numbers in various formats', () => {
      const formats = [
        '(123) 456-7890',
        '123-456-7890',
        '123.456.7890',
        '+1 123 456 7890',
        '1-123-456-7890',
      ];

      for (const phone of formats) {
        const text = `Call me at ${phone}`;
        const result = scrubber.scrub(text);

        expect(result.detected).toContain('phone');
        expect(result.scrubbed).not.toContain(phone);
      }
    });
  });

  describe('credit card detection', () => {
    it('should detect credit card numbers', () => {
      const text = 'My card is 4532-1234-5678-9010';
      const result = scrubber.scrub(text);

      expect(result.detected).toContain('creditCard');
      expect(result.scrubbed).not.toContain('4532-1234-5678-9010');
    });

    it('should handle credit cards with spaces', () => {
      const text = 'Card: 4532 1234 5678 9010';
      const result = scrubber.scrub(text);

      expect(result.detected).toContain('creditCard');
    });
  });

  describe('SSN detection', () => {
    it('should detect Social Security Numbers', () => {
      const text = 'SSN: 123-45-6789';
      const result = scrubber.scrub(text);

      expect(result.detected).toContain('ssn');
      expect(result.scrubbed).not.toContain('123-45-6789');
    });
  });

  describe('IP address detection', () => {
    it('should detect IPv4 addresses', () => {
      const text = 'Server IP: 192.168.1.1';
      const result = scrubber.scrub(text);

      expect(result.detected).toContain('ipAddress');
      expect(result.scrubbed).not.toContain('192.168.1.1');
    });

    it('should detect IPv6 addresses', () => {
      const text = 'IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const result = scrubber.scrub(text);

      expect(result.detected).toContain('ipAddress');
    });
  });

  describe('API key detection', () => {
    it('should detect API keys with sk- prefix', () => {
      const text = 'API key: sk-test12345678901234567890';
      const result = scrubber.scrub(text);

      expect(result.detected).toContain('apiKey');
      expect(result.scrubbed).not.toContain('sk-test12345678901234567890');
    });

    it('should detect api_key= patterns', () => {
      const text = 'api_key=abc123def456ghi789jkl012';
      const result = scrubber.scrub(text);

      expect(result.detected).toContain('apiKey');
    });

    it('should detect token: patterns', () => {
      const text = 'token: xyz789abc123def456ghi012';
      const result = scrubber.scrub(text);

      expect(result.detected).toContain('apiKey');
    });

    it('should detect Bearer tokens', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const result = scrubber.scrub(text);

      expect(result.detected).toContain('apiKey');
    });
  });

  describe('scrubbing modes', () => {
    it('should mask PII in mask mode', () => {
      const maskScrubber = new PIIScrubber({ mode: 'mask', placeholder: '[REDACTED]' });
      const text = 'Email: test@example.com';
      const result = maskScrubber.scrub(text);

      expect(result.scrubbed).toContain('[REDACTED]');
      expect(result.scrubbed.length).toBeGreaterThan(0);
    });

    it('should remove PII in remove mode', () => {
      const removeScrubber = new PIIScrubber({ mode: 'remove' });
      const text = 'Email: test@example.com';
      const result = removeScrubber.scrub(text);

      expect(result.scrubbed).not.toContain('test@example.com');
      expect(result.scrubbed.length).toBeLessThan(text.length);
    });
  });

  describe('custom patterns', () => {
    it('should detect custom patterns', () => {
      const customScrubber = new PIIScrubber({
        detect: {
          ...scrubber.getConfig().detect,
          customPatterns: [
            {
              name: 'employeeId',
              pattern: /\bEMP-\d{6}\b/g,
              placeholder: '[EMPLOYEE_ID]',
            },
          ],
        },
      });

      const text = 'Employee ID: EMP-123456';
      const result = customScrubber.scrub(text);

      expect(result.detected).toContain('custom:employeeId');
      expect(result.scrubbed).toContain('[EMPLOYEE_ID]');
    });
  });

  describe('disabled scrubbing', () => {
    it('should return original text when disabled', () => {
      const disabledScrubber = new PIIScrubber({ enabled: false });
      const text = 'Email: test@example.com Phone: 123-456-7890';
      const result = disabledScrubber.scrub(text);

      expect(result.scrubbed).toBe(text);
      expect(result.detected).toHaveLength(0);
    });
  });

  describe('multiple PII types', () => {
    it('should detect multiple types in one message', () => {
      const text = 'Contact john@example.com at 123-456-7890 or visit 192.168.1.1';
      const result = scrubber.scrub(text);

      expect(result.detected.length).toBeGreaterThan(1);
      expect(result.detected).toContain('email');
      expect(result.detected).toContain('phone');
      expect(result.detected).toContain('ipAddress');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = scrubber.scrub('');
      expect(result.scrubbed).toBe('');
      expect(result.detected).toHaveLength(0);
    });

    it('should handle text with no PII', () => {
      const text = 'This is a normal message with no sensitive information';
      const result = scrubber.scrub(text);

      expect(result.scrubbed).toBe(text);
      expect(result.detected).toHaveLength(0);
    });

    it('should preserve text structure', () => {
      const text = 'Line 1: test@example.com\nLine 2: 123-456-7890';
      const result = scrubber.scrub(text);

      expect(result.scrubbed).toContain('Line 1:');
      expect(result.scrubbed).toContain('Line 2:');
      expect(result.scrubbed).toContain('\n');
    });
  });

  describe('result metadata', () => {
    it('should track original and scrubbed lengths', () => {
      const text = 'Email: test@example.com';
      const result = scrubber.scrub(text);

      expect(result.originalLength).toBe(text.length);
      expect(result.scrubbedLength).toBeGreaterThan(0);
      expect(result.scrubbedLength).toBeLessThanOrEqual(result.originalLength + 20); // Account for placeholder
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      scrubber.updateConfig({ placeholder: '[MASKED]' });
      const text = 'Email: test@example.com';
      const result = scrubber.scrub(text);

      expect(result.scrubbed).toContain('[MASKED]');
    });

    it('should return current configuration', () => {
      const config = scrubber.getConfig();
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.mode).toBe('mask');
    });

    it('should check if enabled', () => {
      expect(scrubber.isEnabled()).toBe(true);

      scrubber.updateConfig({ enabled: false });
      expect(scrubber.isEnabled()).toBe(false);
    });
  });
});

describe('scrubPII helper function', () => {
  it('should scrub PII using default scrubber', () => {
    const text = 'Contact test@example.com';
    const scrubbed = scrubPII(text);

    expect(scrubbed).not.toContain('test@example.com');
    expect(scrubbed).toContain('[REDACTED]');
  });

  it('should accept custom configuration', () => {
    const text = 'Contact test@example.com';
    const scrubbed = scrubPII(text, { placeholder: '[MASKED]' });

    expect(scrubbed).toContain('[MASKED]');
  });
});

describe('integration', () => {
  it('should handle real-world message with multiple PII types', () => {
    const integrationScrubber = new PIIScrubber({
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
        urls: false,
      },
    });

    const message = `
      Hi, please contact me at john.doe@company.com or call 555-123-4567.
      My SSN is 123-45-6789 and my credit card is 4532-1234-5678-9010.
      API key: sk-test12345678901234567890
      Server: 192.168.1.100
    `;

    const result = integrationScrubber.scrub(message);

    expect(result.detected.length).toBeGreaterThan(4);
    expect(result.scrubbed).not.toContain('john.doe@company.com');
    expect(result.scrubbed).not.toContain('555-123-4567');
    expect(result.scrubbed).not.toContain('123-45-6789');
    expect(result.scrubbed).not.toContain('4532-1234-5678-9010');
    expect(result.scrubbed).not.toContain('sk-test12345678901234567890');
    expect(result.scrubbed).not.toContain('192.168.1.100');
  });
});
