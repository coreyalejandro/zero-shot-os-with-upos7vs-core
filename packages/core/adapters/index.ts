/**
 * Platform Adapters Index
 *
 * Central export for all platform adapters
 */

export { WatsonAdapter, createWatsonAdapter, type WatsonConfig, type WatsonRequest, type WatsonResponse } from './watson-adapter.js';
export { OpenAIAdapter, createOpenAIAdapter, type OpenAIConfig, type OpenAIRequest, type OpenAIResponse } from './openai-adapter.js';
export { AnthropicAdapter, createAnthropicAdapter, type AnthropicConfig, type AnthropicRequest, type AnthropicResponse } from './anthropic-adapter.js';
export { GeminiAdapter, createGeminiAdapter, type GeminiConfig, type GeminiRequest, type GeminiResponse } from './gemini-adapter.js';
