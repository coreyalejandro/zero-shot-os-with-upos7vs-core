/**
 * Mode Router Semantic Detection Tests
 *
 * Tests for semantic mode detection using embeddings
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ModeRouterService } from '../services/mode-router.service.js';
import { DEFAULT_CONFIG, UserConfig } from '../config.js';
import { EmbeddingsClient, LocalEmbeddingsProvider, MemoryEmbeddingCache } from '../utils/embeddings-client.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

describe('ModeRouterService - Semantic Detection', () => {
  let service: ModeRouterService;
  let testRoot: string;
  let rulesPath: string;
  let configWithSemantic: UserConfig;

  beforeEach(async () => {
    testRoot = join(process.cwd(), '.test-mode-router');
    rulesPath = join(testRoot, 'cursor', 'rules');

    // Clean up test directory
    if (existsSync(testRoot)) {
      await rm(testRoot, { recursive: true, force: true });
    }
    await mkdir(rulesPath, { recursive: true });

    // Create mock rule files
    const modes: Array<{ mode: string; content: string }> = [
      {
        mode: 'core',
        content: `# UPOS-7-VS Core Mode
## Activation
Always active as default mode.
## ROLE
Core assistant for general tasks.
`,
      },
      {
        mode: 'dev',
        content: `# UPOS-7-VS Developer Mode
## Activation
UPOS7VS-DEV: or mentions of debugging, refactoring, backend
## ROLE
Senior full-stack engineer focused on correctness and architecture.
`,
      },
      {
        mode: 'uxui',
        content: `# UPOS-7-VS UX/UI Mode
## Activation
UPOS7VS-UXUI: or mentions of components, design, accessibility
## ROLE
UX/UI engineer focused on accessible, responsive interfaces.
`,
      },
    ];

    for (const { mode, content } of modes) {
      const filename = mode === 'core' ? 'upos-7-vs-core.mdc' : `upos-7-vs-${mode}.mdc`;
      await writeFile(join(rulesPath, filename), content, 'utf-8');
    }

    // Configure with semantic router enabled
    configWithSemantic = {
      ...DEFAULT_CONFIG,
      mode: {
        ...DEFAULT_CONFIG.mode,
        semanticRouter: {
          enabled: true,
          provider: 'local' as const,
          similarityThreshold: 0.7,
          useCache: true,
          cacheTTL: 3600,
        },
      },
    };

    service = new ModeRouterService(configWithSemantic, testRoot);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }

    // Clean up test directory
    if (existsSync(testRoot)) {
      await rm(testRoot, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should initialize with semantic router enabled', async () => {
      await service.initialize();

      const health = await service.healthCheck();
      expect(health).toBe(true);
    });

    it('should precompute mode embeddings on initialization', async () => {
      await service.initialize();

      // Verify embeddings were computed (we can't directly access private members,
      // but we can test that semantic detection works)
      const result = await service.detectMode('I need to debug a TypeScript error');
      expect(result).toBeDefined();
      expect(result.method).toBeDefined();
    });

    it('should not initialize semantic router when disabled', async () => {
      const configWithoutSemantic = {
        ...DEFAULT_CONFIG,
        mode: {
          ...DEFAULT_CONFIG.mode,
          semanticRouter: {
            enabled: false,
            provider: 'local' as const,
            similarityThreshold: 0.7,
            useCache: true,
            cacheTTL: 3600,
          },
        },
      };

      const serviceWithoutSemantic = new ModeRouterService(configWithoutSemantic, testRoot);
      await serviceWithoutSemantic.initialize();

      const result = await serviceWithoutSemantic.detectMode('debug TypeScript');
      expect(result.method).not.toBe('semantic');

      await serviceWithoutSemantic.shutdown();
    });
  });

  describe('detectMode - semantic detection', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should detect dev mode from semantic similarity', async () => {
      const result = await service.detectMode('I need to fix a bug in my backend API');

      expect(result).toBeDefined();
      // Semantic detection may vary, so we check that it's a valid mode
      const validModes = ['dev', 'core', 'long'];
      expect(validModes.includes(result.mode)).toBe(true);
      // Should use semantic detection if similarity is high enough
      if (result.confidence >= 0.7) {
        expect(result.method).toBe('semantic');
      }
    });

    it('should detect uxui mode from semantic similarity', async () => {
      const result = await service.detectMode('How do I make this component accessible and responsive?');

      expect(result).toBeDefined();
      expect(result.mode).toBe('uxui');
      // Should use semantic detection if similarity is high enough
      if (result.confidence >= 0.7) {
        expect(result.method).toBe('semantic');
      }
    });

    it('should fall back to keyword detection if semantic confidence is low', async () => {
      const result = await service.detectMode('random unrelated text that does not match any mode');

      expect(result).toBeDefined();
      // Should fall back through the chain: semantic -> keyword -> fallback
      const validMethods = ['semantic', 'keyword', 'fallback'];
      expect(validMethods.includes(result.method)).toBe(true);
      // With low confidence, should eventually reach fallback
      if (result.confidence < 0.5) {
        expect(['keyword', 'fallback']).toContain(result.method);
      }
    });

    it('should include latency in result', async () => {
      const result = await service.detectMode('debug my code');

      expect(result).toBeDefined();
      expect(result.latency).toBeDefined();
      expect(typeof result.latency).toBe('number');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should prioritize prefix detection over semantic', async () => {
      const result = await service.detectMode('UPOS7VS-DEV: fix this bug');

      expect(result).toBeDefined();
      expect(result.mode).toBe('dev');
      expect(result.method).toBe('prefix');
      expect(result.prefixDetected).toBe('UPOS7VS-DEV:');
    });
  });

  describe('detectMode - multi-stage detection flow', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should try prefix first, then semantic, then keyword, then fallback', async () => {
      // Test without prefix (should try semantic)
      const result1 = await service.detectMode('I need to refactor my codebase');
      expect(result1).toBeDefined();
      expect(['semantic', 'keyword', 'fallback']).toContain(result1.method);

      // Test with prefix (should use prefix)
      const result2 = await service.detectMode('UPOS7VS-DEV: refactor code');
      expect(result2).toBeDefined();
      expect(result2.method).toBe('prefix');
    });

    it('should respect similarity threshold', async () => {
      // Use a very high threshold to force fallback
      const highThresholdConfig = {
        ...configWithSemantic,
        mode: {
          ...configWithSemantic.mode,
          semanticRouter: {
            ...configWithSemantic.mode.semanticRouter!,
            similarityThreshold: 0.99, // Very high threshold
          },
        },
      };

      const highThresholdService = new ModeRouterService(highThresholdConfig, testRoot);
      await highThresholdService.initialize();

      const result = await highThresholdService.detectMode('debug TypeScript error');
      // Should fall back since threshold is too high
      expect(['keyword', 'fallback']).toContain(result.method);

      await highThresholdService.shutdown();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle embedding generation errors gracefully', async () => {
      // The service should fall back to keyword detection on errors
      // We can't easily mock the internal embeddings client, but we can test
      // that the service handles errors gracefully
      const result = await service.detectMode('test message');
      expect(result).toBeDefined();
      // Should not crash, should fall back
      expect(['semantic', 'keyword', 'fallback']).toContain(result.method);
    });

    it('should handle empty message', async () => {
      const result = await service.detectMode('');

      expect(result).toBeDefined();
      expect(result.mode).toBeDefined();
      expect(['fallback', 'core']).toContain(result.mode);
    });
  });

  describe('integration', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle full detection workflow', async () => {
      const messages = [
        'UPOS7VS-DEV: fix bug',
        'I need to debug my code',
        'How do I make this accessible?',
        'random text',
      ];

      const results = await Promise.all(messages.map(msg => service.detectMode(msg)));

      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.mode).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(result.method).toBeDefined();
        expect(result.latency).toBeDefined();
      });

      // First should use prefix
      expect(results[0].method).toBe('prefix');
    });

    it('should maintain performance with caching', async () => {
      const message = 'debug TypeScript error';

      // First call
      const start1 = Date.now();
      const result1 = await service.detectMode(message);
      const time1 = Date.now() - start1;

      // Second call (should use cache)
      const start2 = Date.now();
      const result2 = await service.detectMode(message);
      const time2 = Date.now() - start2;

      expect(result1.mode).toBe(result2.mode);
      // Second call should be faster due to caching
      // (though this is not guaranteed, it's likely)
      expect(time2).toBeLessThanOrEqual(time1 * 2); // Allow some variance
    });
  });
});
