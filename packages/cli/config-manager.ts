#!/usr/bin/env node
/**
 * UPOS-7-VS Configuration Manager CLI
 *
 * Interactive tool for managing user configuration
 * Usage: npx upos-config [command]
 */

import { ConfigManager, UserConfig, DEFAULT_CONFIG } from '../core/config.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = readline.createInterface({ input, output });

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'interactive';

  const config = new ConfigManager();

  try {
    await config.load();
  } catch (error) {
    console.log(colorize('⚠ No existing config found. Creating default...', 'yellow'));
  }

  switch (command) {
    case 'init':
      await initConfig(config);
      break;
    case 'show':
      await showConfig(config);
      break;
    case 'set':
      await setConfig(config, args.slice(1));
      break;
    case 'reset':
      await resetConfig(config);
      break;
    case 'validate':
      await validateConfig(config);
      break;
    case 'interactive':
    default:
      await interactiveConfig(config);
      break;
  }

  rl.close();
}

async function initConfig(config: ConfigManager): Promise<void> {
  console.log(colorize('\n✨ UPOS-7-VS Configuration Setup\n', 'bright'));

  // Platform selection
  console.log(colorize('📱 Platform Configuration', 'cyan'));
  const platform = await rl.question(
    'Primary platform (cursor/chatgpt/claude/openai-api): [cursor] '
  );

  // Mode selection
  console.log(colorize('\n🎯 Mode Configuration', 'cyan'));
  const defaultMode = await rl.question(
    'Default mode (core/uxui/dev/next/agent/long): [core] '
  );

  // Verbalized Sampling
  console.log(colorize('\n🔄 Verbalized Sampling', 'cyan'));
  const vsEnabled = await rl.question('Enable verbalized sampling? (yes/no): [yes] ');
  const vsStrategy = await rl.question(
    'Sampling strategy (creative/balanced/conservative): [balanced] '
  );
  const vsNumSamples = await rl.question('Number of samples (2-10): [5] ');

  // Analytics
  console.log(colorize('\n📊 Analytics', 'cyan'));
  const analyticsEnabled = await rl.question('Enable analytics tracking? (yes/no): [yes] ');

  // Build config
  const userConfig: Partial<UserConfig> = {
    platform: {
      primary: (platform || 'cursor') as any,
      enabled: ['cursor', 'chatgpt', 'claude', 'openai-api'] as any[],
    },
    mode: {
      default: (defaultMode || 'core') as any,
      autoDetect: true,
      fallbackToCore: true,
    },
    features: {
      verbalizedSampling: {
        enabled: vsEnabled !== 'no',
        strategy: (vsStrategy || 'balanced') as any,
        numSamples: parseInt(vsNumSamples || '5'),
        autoRank: true,
        showProbabilities: true,
      },
      analytics: {
        enabled: analyticsEnabled !== 'no',
        trackQuality: true,
        trackCost: true,
        trackPerformance: true,
      },
      promptHistory: DEFAULT_CONFIG.features.promptHistory,
      autoSync: DEFAULT_CONFIG.features.autoSync,
      enhancement: DEFAULT_CONFIG.features.enhancement,
    },
    reasoning: DEFAULT_CONFIG.reasoning,
    output: DEFAULT_CONFIG.output,
    performance: DEFAULT_CONFIG.performance,
    advanced: DEFAULT_CONFIG.advanced,
  };

  await config.update(userConfig as UserConfig);

  console.log(colorize('\n✓ Configuration saved!', 'green'));
  console.log(colorize('\nTo modify later, run: npx upos-config interactive', 'blue'));
}

async function showConfig(config: ConfigManager): Promise<void> {
  const current = config.get();

  console.log(colorize('\n📋 Current Configuration\n', 'bright'));
  console.log(JSON.stringify(current, null, 2));
}

async function setConfig(config: ConfigManager, args: string[]): Promise<void> {
  if (args.length < 2) {
    console.log(colorize('Usage: npx upos-config set <key.path> <value>', 'red'));
    console.log('\nExamples:');
    console.log('  npx upos-config set features.verbalizedSampling.enabled true');
    console.log('  npx upos-config set mode.default dev');
    return;
  }

  const [path, value] = args;
  const keys = path.split('.');

  const current = config.get();
  let target: any = current;

  // Navigate to the parent object
  for (let i = 0; i < keys.length - 1; i++) {
    if (!target[keys[i]]) {
      console.log(colorize(`Error: Invalid path ${path}`, 'red'));
      return;
    }
    target = target[keys[i]];
  }

  const lastKey = keys[keys.length - 1];

  // Parse value
  let parsedValue: any = value;
  if (value === 'true') parsedValue = true;
  else if (value === 'false') parsedValue = false;
  else if (!isNaN(Number(value))) parsedValue = Number(value);

  // Set value
  target[lastKey] = parsedValue;

  await config.save(current);

  console.log(colorize(`✓ Set ${path} = ${parsedValue}`, 'green'));
}

async function resetConfig(config: ConfigManager): Promise<void> {
  const confirm = await rl.question(
    colorize('⚠ This will reset all configuration to defaults. Continue? (yes/no): ', 'yellow')
  );

  if (confirm.toLowerCase() === 'yes') {
    await config.reset();
    console.log(colorize('✓ Configuration reset to defaults', 'green'));
  } else {
    console.log('Cancelled');
  }
}

async function validateConfig(config: ConfigManager): Promise<void> {
  try {
    config.get(); // This will throw if invalid
    console.log(colorize('✓ Configuration is valid', 'green'));
  } catch (error) {
    console.log(colorize(`✗ Configuration error: ${error}`, 'red'));
    process.exit(1);
  }
}

async function interactiveConfig(config: ConfigManager): Promise<void> {
  let running = true;

  while (running) {
    console.clear();
    console.log(colorize('╔═══════════════════════════════════════════╗', 'cyan'));
    console.log(colorize('║   UPOS-7-VS Configuration Manager        ║', 'cyan'));
    console.log(colorize('╚═══════════════════════════════════════════╝', 'cyan'));

    const current = config.get();

    console.log('\n' + colorize('Current Settings:', 'bright'));
    console.log(`  Platform: ${colorize(current.platform.primary, 'green')}`);
    console.log(`  Mode: ${colorize(current.mode.default, 'green')}`);
    console.log(
      `  Verbalized Sampling: ${colorize(
        current.features.verbalizedSampling.enabled ? 'ON' : 'OFF',
        current.features.verbalizedSampling.enabled ? 'green' : 'red'
      )} (${current.features.verbalizedSampling.strategy}, ${
        current.features.verbalizedSampling.numSamples
      } samples)`
    );
    console.log(
      `  Analytics: ${colorize(
        current.features.analytics.enabled ? 'ON' : 'OFF',
        current.features.analytics.enabled ? 'green' : 'red'
      )}`
    );

    console.log('\n' + colorize('Options:', 'bright'));
    console.log('  1. Change platform');
    console.log('  2. Change default mode');
    console.log('  3. Toggle verbalized sampling');
    console.log('  4. Configure sampling strategy');
    console.log('  5. Toggle analytics');
    console.log('  6. View full configuration');
    console.log('  7. Reset to defaults');
    console.log('  0. Exit');

    const choice = await rl.question(colorize('\nSelect option: ', 'yellow'));

    switch (choice) {
      case '1':
        const platform = await rl.question('Platform (cursor/chatgpt/claude/openai-api): ');
        await config.update({
          platform: { ...current.platform, primary: platform as any },
        } as any);
        console.log(colorize('✓ Platform updated', 'green'));
        await sleep(1000);
        break;

      case '2':
        const mode = await rl.question('Mode (core/uxui/dev/next/agent/long): ');
        await config.update({
          mode: { ...current.mode, default: mode as any },
        } as any);
        console.log(colorize('✓ Mode updated', 'green'));
        await sleep(1000);
        break;

      case '3':
        await config.update({
          features: {
            ...current.features,
            verbalizedSampling: {
              ...current.features.verbalizedSampling,
              enabled: !current.features.verbalizedSampling.enabled,
            },
          },
        } as any);
        console.log(
          colorize(
            `✓ Verbalized sampling ${
              !current.features.verbalizedSampling.enabled ? 'enabled' : 'disabled'
            }`,
            'green'
          )
        );
        await sleep(1000);
        break;

      case '4':
        const strategy = await rl.question(
          'Strategy (creative/balanced/conservative): '
        );
        const numSamples = await rl.question('Number of samples (2-10): ');
        await config.update({
          features: {
            ...current.features,
            verbalizedSampling: {
              ...current.features.verbalizedSampling,
              strategy: strategy as any,
              numSamples: parseInt(numSamples),
            },
          },
        } as any);
        console.log(colorize('✓ Sampling configuration updated', 'green'));
        await sleep(1000);
        break;

      case '5':
        await config.update({
          features: {
            ...current.features,
            analytics: {
              ...current.features.analytics,
              enabled: !current.features.analytics.enabled,
            },
          },
        } as any);
        console.log(
          colorize(
            `✓ Analytics ${!current.features.analytics.enabled ? 'enabled' : 'disabled'}`,
            'green'
          )
        );
        await sleep(1000);
        break;

      case '6':
        console.log('\n' + JSON.stringify(current, null, 2));
        await rl.question(colorize('\nPress Enter to continue...', 'blue'));
        break;

      case '7':
        await resetConfig(config);
        await sleep(1000);
        break;

      case '0':
        running = false;
        console.log(colorize('\n👋 Goodbye!\n', 'cyan'));
        break;

      default:
        console.log(colorize('Invalid option', 'red'));
        await sleep(1000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
