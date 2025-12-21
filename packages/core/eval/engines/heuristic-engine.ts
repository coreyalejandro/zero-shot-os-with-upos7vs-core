import { EvalEngine, EvalInput, EvalResult } from '../types.js';

/**
 * Lightweight, dependency-free heuristic evaluator.
 * Provides a cheap fallback when external providers are unavailable.
 */
export class HeuristicEngine implements EvalEngine {
  name = 'heuristic';

  async evaluate(input: EvalInput): Promise<EvalResult> {
    const lengthScore = Math.min(1, input.response.length / 500); // favor non-trivial outputs
    const apologyPenalty = /sorry|apologize/i.test(input.response) ? 0.2 : 0;
    const score = Math.max(0, Math.min(1, lengthScore - apologyPenalty));

    return {
      score,
      label: score >= 0.7 ? 'pass' : score >= 0.4 ? 'partial' : 'fail',
      provider: this.name,
    };
  }
}
