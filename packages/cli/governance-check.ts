#!/usr/bin/env node
import { GovernanceService } from '../core/services/governance.service.js';
import { ConfigManager } from '../core/config.js';

/**
 * CLI tool to check governance artifact compliance
 * Usage: npx tsx packages/cli/governance-check.ts
 */

async function main() {
  console.log('🔍 UPOS7VS Governance Check\n');

  try {
    // Load config
    const configManager = new ConfigManager();
    const config = await configManager.load();

    // Create governance service
    const governanceService = new GovernanceService(config);
    await governanceService.initialize();

    // Check artifacts
    const status = await governanceService.checkArtifacts();

    console.log('📋 Artifact Status:\n');

    for (const artifact of status.artifacts) {
      const icon = artifact.exists ? '✅' : '❌';
      const details = artifact.exists
        ? `(${artifact.sizeBytes} bytes, modified ${artifact.lastModified})`
        : '(missing)';
      const schemaDetails =
        artifact.schemaValid === true
          ? ` | schema ✅${artifact.schemaName ? ` (${artifact.schemaName})` : ''}`
          : artifact.schemaValid === false
            ? ` | schema ❌ ${artifact.validationErrors?.join('; ')}`
            : artifact.validationErrors && artifact.validationErrors.length > 0
              ? ` | schema ⚠️ ${artifact.validationErrors.join('; ')}`
              : '';

      console.log(`${icon} ${artifact.name} ${details}${schemaDetails}`);
    }

    console.log();

    if (status.compliant) {
      console.log('✅ All governance artifacts present');
      process.exit(0);
    } else {
      console.log('❌ Missing artifacts:');
      for (const missing of status.missingArtifacts) {
        console.log(`   - ${missing}`);
      }
      console.log('\n💡 Create missing artifacts to pass governance checks');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Governance check failed:', error);
    process.exit(1);
  }
}

main();
