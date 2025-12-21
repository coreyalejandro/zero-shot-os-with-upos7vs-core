/**
 * Retry Utility with Exponential Backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number; // ms
  maxDelay?: number; // ms
  backoffFactor?: number;
  retryableErrors?: string[]; // Error names/codes to retry
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'retryableErrors' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries,
    initialDelay,
    maxDelay,
    backoffFactor,
    retryableErrors,
    onRetry,
  } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (retryableErrors && !isRetryableError(error as Error, retryableErrors)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Call retry callback
      if (onRetry) {
        onRetry(error as Error, attempt + 1);
      }

      // Wait before retrying
      await sleep(delay);

      // Increase delay for next retry (exponential backoff)
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Check if an error should be retried
 */
function isRetryableError(error: Error, retryableErrors: string[]): boolean {
  // Check error name
  if (retryableErrors.includes(error.name)) {
    return true;
  }

  // Check error message
  return retryableErrors.some((pattern) => error.message.includes(pattern));
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Circuit Breaker for rate limiting and failure detection
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private options: {
      failureThreshold: number; // Number of failures before opening
      resetTimeout: number; // ms to wait before trying again
      successThreshold?: number; // Successes needed to close from half-open
    }
  ) {
    this.options.successThreshold = options.successThreshold ?? 2;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if we should try half-open
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();

      // Success - close circuit if was half-open
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.options.failureThreshold) {
        this.state = 'open';
      }

      throw error;
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Rate Limiter using token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private options: {
      tokensPerInterval: number;
      interval: number; // ms
      maxTokens?: number;
    }
  ) {
    this.options.maxTokens = options.maxTokens ?? options.tokensPerInterval;
    this.tokens = this.options.maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Wait for next refill
    const timeUntilRefill = this.options.interval - (Date.now() - this.lastRefill);
    await sleep(Math.max(0, timeUntilRefill));

    this.refill();
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const intervalsPassed = Math.floor(timePassed / this.options.interval);

    if (intervalsPassed > 0) {
      this.tokens = Math.min(
        this.options.maxTokens!,
        this.tokens + intervalsPassed * this.options.tokensPerInterval
      );
      this.lastRefill = now;
    }
  }

  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}
