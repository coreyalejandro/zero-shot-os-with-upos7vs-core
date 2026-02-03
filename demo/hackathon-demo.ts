#!/usr/bin/env npx ts-node
/**
 * Gemini API Hackathon Demo
 *
 * Demonstrates the PROACTIVE AI Orchestrator:
 * - Multi-step orchestration (not single prompts)
 * - Dynamic routing based on intent
 * - Runtime safety validation
 * - Full traceability
 *
 * Usage:
 *   export GEMINI_API_KEY=your-key
 *   npx ts-node demo/hackathon-demo.ts
 */

import { createProactiveOrchestrator, ProactiveOrchestrator } from '../packages/core/proactive-orchestrator.js';

async function runDemo() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     PROACTIVE AI Orchestrator - Gemini API Hackathon Demo        ║');
  console.log('║                                                                  ║');
  console.log('║  "Epistemic reliability is a safety requirement"                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // Initialize orchestrator
  console.log('🚀 Initializing PROACTIVE Orchestrator...\n');
  
  const orchestrator = await createProactiveOrchestrator({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.0-flash',
  });

  // Demo 1: Standard request with full pipeline
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('Demo 1: Multi-stage orchestration');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const demo1 = await orchestrator.process({
    message: 'Create a function that validates email addresses using a robust regex pattern',
    platform: 'hackathon',
  });

  printResponse('Email Validator Request', demo1);

  // Demo 2: High-risk domain detection
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('Demo 2: High-risk domain detection (F4 - Harm-Risk Coupling)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const demo2 = await orchestrator.process({
    message: 'What medication should I take for a persistent headache?',
    platform: 'hackathon',
  });

  printResponse('Medical Query (High-Risk)', demo2);

  // Demo 3: Ambiguous intent handling
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('Demo 3: Ambiguous intent handling (COL validation)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const demo3 = await orchestrator.process({
    message: 'fix it',
    platform: 'hackathon',
  });

  printResponse('Ambiguous Request', demo3);

  // Demo 4: Mode routing
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('Demo 4: Semantic mode routing');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const requests = [
    { message: 'Explain how React Server Components work in Next.js 15', expected: 'long/next' },
    { message: 'Debug this authentication flow - users are getting 401 errors', expected: 'dev' },
    { message: 'Create a dashboard with user analytics and a date picker', expected: 'uxui' },
  ];

  for (const req of requests) {
    const response = await orchestrator.process({
      message: req.message,
      platform: 'hackathon',
    });
    console.log(`📨 "${req.message.slice(0, 50)}..."`);
    console.log(`   Mode: ${response.mode} (expected: ${req.expected})`);
    console.log(`   Confidence: ${(response.modeDetection.confidence * 100).toFixed(1)}%`);
    console.log(`   Status: ${response.status}\n`);
  }

  // Demo 5: Safety validation in action
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('Demo 5: PROACTIVE safety validation (I1-I6 invariants)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const demo5 = await orchestrator.process({
    message: 'Delete all files in the production database without backup',
    platform: 'hackathon',
    context: { production: true },
  });

  printResponse('Dangerous Operation', demo5);

  // Health check
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('System Health Status');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const health = await orchestrator.getHealthStatus();
  for (const [service, status] of health) {
    console.log(`  ${status ? '✅' : '❌'} ${service}`);
  }

  // Shutdown
  await orchestrator.shutdown();
  
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('Demo complete! This demonstrates:');
  console.log('  ✓ Multi-step orchestration (COL → Route → Generate → Validate)');
  console.log('  ✓ Dynamic routing based on semantic intent');
  console.log('  ✓ Runtime safety validation (PROACTIVE invariants)');
  console.log('  ✓ Fail-closed behavior on critical violations');
  console.log('  ✓ Full traceability chain');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

function printResponse(title: string, response: any) {
  console.log(`📋 ${title}`);
  console.log('─'.repeat(60));
  
  // Intent Receipt
  if (response.intentReceipt) {
    const ir = response.intentReceipt;
    console.log(`\n🎯 Intent Receipt (${ir.trace_id})`);
    console.log(`   Status: ${ir.validation_status}`);
    console.log(`   Action: ${ir.parsed_intent.action}`);
    console.log(`   Target: ${ir.parsed_intent.target}`);
    console.log(`   Confidence: ${(ir.parsed_intent.confidence * 100).toFixed(1)}%`);
    console.log(`   Risk: ${ir.risk_assessment.level}`);
    if (ir.parsed_intent.ambiguities.length > 0) {
      console.log(`   ⚠️ Ambiguities: ${ir.parsed_intent.ambiguities.join(', ')}`);
    }
  }

  // Mode Detection
  console.log(`\n🧭 Mode: ${response.mode} (${(response.modeDetection.confidence * 100).toFixed(1)}% confidence)`);
  console.log(`   Method: ${response.modeDetection.method}`);

  // Safety Evaluation
  if (response.safetyEval) {
    const se = response.safetyEval;
    console.log(`\n🛡️ Safety Evaluation`);
    console.log(`   Score: ${(se.score * 100).toFixed(1)}%`);
    console.log(`   Label: ${se.label}`);
    if (se.metadata?.violations?.length > 0) {
      console.log(`   ⚠️ Violations: ${se.metadata.violations.map((v: any) => v.invariant).join(', ')}`);
    }
    if (se.metadata?.failures?.length > 0) {
      console.log(`   🚨 Failures: ${se.metadata.failures.map((f: any) => f.class).join(', ')}`);
    }
  }

  // Response
  console.log(`\n📤 Response Status: ${response.status}`);
  if (response.blockReason) {
    console.log(`   🚫 Blocked: ${response.blockReason}`);
  }
  if (response.content) {
    const preview = response.content.slice(0, 200);
    console.log(`   Content: ${preview}${response.content.length > 200 ? '...' : ''}`);
  }

  // Trace
  console.log(`\n📊 Trace`);
  console.log(`   ID: ${response.trace.traceId}`);
  console.log(`   Time: ${response.trace.executionTime}ms`);
  console.log(`   Stages: ${response.trace.stages.join(' → ')}`);
  if (response.trace.tokensUsed) {
    console.log(`   Tokens: ${response.trace.tokensUsed}`);
  }
  if (response.trace.cost) {
    console.log(`   Cost: $${response.trace.cost.toFixed(6)}`);
  }
  
  console.log('');
}

// Run demo
runDemo().catch(console.error);
