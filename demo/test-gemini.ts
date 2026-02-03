#!/usr/bin/env npx tsx
/**
 * Simple Gemini Adapter Test
 */

import { GeminiAdapter } from '../packages/core/adapters/gemini-adapter.js';

async function main() {
  console.log('Testing Gemini Adapter...\n');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable not set');
    console.log('\nTo get an API key:');
    console.log('1. Go to https://aistudio.google.com/app/apikey');
    console.log('2. Create a new API key');
    console.log('3. Run: export GEMINI_API_KEY=your-key-here');
    process.exit(1);
  }

  // Create adapter with minimal config
  const adapter = new GeminiAdapter(
    { apiKey, model: 'gemini-2.0-flash' },
    { 
      features: {} as any, 
      providers: {} as any,
      global: {} as any,
    }
  );

  await adapter.initialize();
  console.log('✓ Adapter initialized');

  // Health check
  const healthy = await adapter.healthCheck();
  console.log(`✓ Health check: ${healthy ? 'PASS' : 'FAIL'}\n`);

  // Simple completion test
  console.log('Sending test prompt...\n');
  
  try {
    const response = await adapter.complete(
      'What is 2 + 2? Reply with just the number.',
      'You are a helpful math assistant. Be concise.'
    );
    
    console.log('Response:', response);
    console.log('\n✓ Gemini API working!');
  } catch (error) {
    console.error('Error:', error);
  }

  await adapter.shutdown();
}

main().catch(console.error);
