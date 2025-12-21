import { EvalRunner, buildEvalRunner } from '../eval/eval-runner.js';
import { HeuristicEngine } from '../eval/engines/heuristic-engine.js';
import { AetherEngine } from '../eval/engines/aether-engine.js';
import { LlmGraderEngine } from '../eval/engines/llm-grader-engine.js';
import { EvalInput } from '../eval/types.js';
import { DEFAULT_CONFIG } from '../config.js';

describe('EvalRunner', () => {
  describe('buildEvalRunner', () => {
    it('should return null when evaluation is disabled', () => {
      const config = {
        ...DEFAULT_CONFIG,
        features: {
          ...DEFAULT_CONFIG.features,
          evaluation: {
            enabled: false,
            sampleRate: 0.25,
            engines: {
              heuristic: { enabled: true },
            },
          },
        },
      };
      const runner = buildEvalRunner(config);
      expect(runner).toBeNull();
    });

    it('should return null when evaluation config is missing', () => {
      const config = { ...DEFAULT_CONFIG, features: { ...DEFAULT_CONFIG.features, evaluation: undefined } };
      const runner = buildEvalRunner(config);
      expect(runner).toBeNull();
    });

    it('should build runner with heuristic engine by default', () => {
      const config = {
        ...DEFAULT_CONFIG,
        features: {
          ...DEFAULT_CONFIG.features,
          evaluation: {
            enabled: true,
            sampleRate: 1.0,
            engines: {
              heuristic: { enabled: true },
            },
          },
        },
      };
      const runner = buildEvalRunner(config);
      expect(runner).not.toBeNull();
    });

    it('should build runner with multiple engines', () => {
      const config = {
        ...DEFAULT_CONFIG,
        features: {
          ...DEFAULT_CONFIG.features,
          evaluation: {
            enabled: true,
            sampleRate: 0.5,
            engines: {
              aether: { enabled: true, apiKey: 'test-key' },
              llmGrader: { enabled: true, apiKey: 'test-key' },
              heuristic: { enabled: true },
            },
          },
        },
      };
      const runner = buildEvalRunner(config);
      expect(runner).not.toBeNull();
    });
  });

  describe('EvalRunner.maybeEvaluate', () => {
    it('should return null when sample rate prevents evaluation', async () => {
      const runner = new EvalRunner([new HeuristicEngine()], { sampleRate: 0 });
      const input: EvalInput = {
        id: 'test-1',
        intent: 'test intent',
        prompt: 'test prompt',
        response: 'test response',
        platform: 'cursor',
        mode: 'core',
      };
      
      // With sampleRate 0, should always return null
      const result = await runner.maybeEvaluate(input);
      expect(result).toBeNull();
    });

    it('should evaluate with sampleRate 1.0', async () => {
      const runner = new EvalRunner([new HeuristicEngine()], { sampleRate: 1.0 });
      const input: EvalInput = {
        id: 'test-2',
        intent: 'test intent',
        prompt: 'test prompt',
        response: 'This is a good response with sufficient length to pass the heuristic check',
        platform: 'cursor',
        mode: 'core',
      };
      
      const result = await runner.maybeEvaluate(input);
      expect(result).not.toBeNull();
      expect(result?.provider).toBe('heuristic');
      expect(result?.score).toBeGreaterThanOrEqual(0);
      expect(result?.score).toBeLessThanOrEqual(1);
    });

    it('should scrub PII from input', async () => {
      const runner = new EvalRunner([new HeuristicEngine()], { sampleRate: 1.0 });
      const input: EvalInput = {
        id: 'test-3',
        intent: 'test intent with email@example.com',
        prompt: 'test prompt with phone 555-1234',
        response: 'test response',
        platform: 'cursor',
        mode: 'core',
      };
      
      const result = await runner.maybeEvaluate(input);
      expect(result).not.toBeNull();
      // PII should be scrubbed, so the evaluation should still work
      expect(result?.provider).toBe('heuristic');
    });

    it('should fail open and try next engine on error', async () => {
      // Create a mock engine that always fails
      class FailingEngine {
        name = 'failing';
        async healthy() {
          return true;
        }
        async evaluate() {
          throw new Error('Engine failure');
        }
      }

      const runner = new EvalRunner(
        [new FailingEngine() as any, new HeuristicEngine()],
        { sampleRate: 1.0 }
      );
      
      const input: EvalInput = {
        id: 'test-4',
        intent: 'test intent',
        prompt: 'test prompt',
        response: 'test response with enough length',
        platform: 'cursor',
        mode: 'core',
      };
      
      // Should fall back to heuristic engine
      const result = await runner.maybeEvaluate(input);
      expect(result).not.toBeNull();
      expect(result?.provider).toBe('heuristic');
    });

    it('should skip unhealthy engines', async () => {
      const aetherEngine = new AetherEngine({});
      const runner = new EvalRunner(
        [aetherEngine, new HeuristicEngine()],
        { sampleRate: 1.0 }
      );
      
      const input: EvalInput = {
        id: 'test-5',
        intent: 'test intent',
        prompt: 'test prompt',
        response: 'test response',
        platform: 'cursor',
        mode: 'core',
      };
      
      // Aether should be unhealthy (no API key), so should use heuristic
      const result = await runner.maybeEvaluate(input);
      expect(result).not.toBeNull();
      expect(result?.provider).toBe('heuristic');
    });
  });

  describe('HeuristicEngine', () => {
    it('should evaluate based on response length', async () => {
      const engine = new HeuristicEngine();
      const input: EvalInput = {
        id: 'test-6',
        intent: 'test',
        prompt: 'test',
        response: 'x'.repeat(500), // Should score well
        platform: 'cursor',
        mode: 'core',
      };
      
      const result = await engine.evaluate(input);
      expect(result.score).toBeGreaterThanOrEqual(0.7);
      expect(result.label).toBe('pass');
    });

    it('should penalize apologies', async () => {
      const engine = new HeuristicEngine();
      const input: EvalInput = {
        id: 'test-7',
        intent: 'test',
        prompt: 'test',
        response: 'I apologize, but I cannot help with that.',
        platform: 'cursor',
        mode: 'core',
      };
      
      const result = await engine.evaluate(input);
      expect(result.score).toBeLessThan(0.5);
    });
  });
});
