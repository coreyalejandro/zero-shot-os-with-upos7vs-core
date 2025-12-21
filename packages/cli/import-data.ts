#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface ImportOptions {
  source: string;
  types?: ('config' | 'analytics' | 'prompts' | 'modes' | 'rules')[];
  merge?: boolean;
  backup?: boolean;
}

class DataImporter {
  private uposDir: string;

  constructor() {
    this.uposDir = path.join(os.homedir(), '.upos7vs');
  }

  async importAll(options: ImportOptions): Promise<void> {
    const {
      source,
      types = ['config', 'analytics', 'prompts', 'modes', 'rules'],
      merge = false,
      backup = true,
    } = options;

    console.log('📥 Starting data import...\n');

    // Verify source exists
    try {
      await fs.access(source);
    } catch {
      throw new Error(`Source directory not found: ${source}`);
    }

    // Check for manifest
    const manifestPath = path.join(source, 'MANIFEST.json');
    let manifest: any = null;

    try {
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(manifestData);
      console.log(`📋 Found export manifest from ${manifest.exportDate}`);
    } catch {
      console.log('⚠️  No manifest found, proceeding anyway...');
    }

    // Create backup if requested
    if (backup) {
      await this.createBackup();
    }

    const results: Record<string, boolean> = {};

    // Import each type
    for (const type of types) {
      try {
        switch (type) {
          case 'config':
            await this.importConfig(source, merge);
            results.config = true;
            break;
          case 'analytics':
            await this.importAnalytics(source, merge);
            results.analytics = true;
            break;
          case 'prompts':
            await this.importPrompts(source, merge);
            results.prompts = true;
            break;
          case 'modes':
            await this.importModes(source);
            results.modes = true;
            break;
          case 'rules':
            await this.importRules(source);
            results.rules = true;
            break;
        }
      } catch (error) {
        console.error(`❌ Failed to import ${type}:`, error);
        results[type] = false;
      }
    }

    console.log('\n✅ Import complete!');
    console.log('\nImported:');
    Object.entries(results).forEach(([type, success]) => {
      console.log(`  ${success ? '✅' : '❌'} ${type}`);
    });

    if (backup) {
      console.log(`\n💾 Backup created at: ${path.join(this.uposDir, 'backups', new Date().toISOString().split('T')[0])}`);
    }
  }

  async importConfig(source: string, merge: boolean): Promise<void> {
    console.log('📝 Importing configuration...');

    const configSrc = path.join(source, 'config.json');
    const configDst = path.join(this.uposDir, 'config', 'config.json');

    try {
      const importedConfig = JSON.parse(await fs.readFile(configSrc, 'utf-8'));

      if (merge) {
        // Merge with existing config
        try {
          const existingConfig = JSON.parse(await fs.readFile(configDst, 'utf-8'));
          const mergedConfig = this.deepMerge(existingConfig, importedConfig);
          await fs.mkdir(path.dirname(configDst), { recursive: true });
          await fs.writeFile(configDst, JSON.stringify(mergedConfig, null, 2));
          console.log('  ✅ Config merged');
        } catch {
          // No existing config, just write imported
          await fs.mkdir(path.dirname(configDst), { recursive: true });
          await fs.writeFile(configDst, JSON.stringify(importedConfig, null, 2));
          console.log('  ✅ Config imported (no existing config to merge)');
        }
      } else {
        // Replace existing config
        await fs.mkdir(path.dirname(configDst), { recursive: true });
        await fs.writeFile(configDst, JSON.stringify(importedConfig, null, 2));
        console.log('  ✅ Config replaced');
      }
    } catch (error) {
      console.log('  ⚠️  No config.json found in source');
    }
  }

  async importAnalytics(source: string, merge: boolean): Promise<void> {
    console.log('📊 Importing analytics...');

    const analyticsSrc = path.join(source, 'analytics.json');
    const analyticsDst = path.join(this.uposDir, 'analytics', 'metrics.jsonl');

    try {
      const importedMetrics = JSON.parse(await fs.readFile(analyticsSrc, 'utf-8'));

      await fs.mkdir(path.dirname(analyticsDst), { recursive: true });

      if (merge) {
        // Append to existing analytics
        const jsonl = importedMetrics.map((m: any) => JSON.stringify(m)).join('\n') + '\n';
        await fs.appendFile(analyticsDst, jsonl);
        console.log(`  ✅ ${importedMetrics.length} records appended`);
      } else {
        // Replace analytics
        const jsonl = importedMetrics.map((m: any) => JSON.stringify(m)).join('\n') + '\n';
        await fs.writeFile(analyticsDst, jsonl);
        console.log(`  ✅ ${importedMetrics.length} records imported`);
      }
    } catch (error) {
      console.log('  ⚠️  No analytics.json found in source');
    }
  }

  async importPrompts(source: string, merge: boolean): Promise<void> {
    console.log('💬 Importing prompt history...');

    const promptsSrc = path.join(source, 'prompts.jsonl');
    const promptsDst = path.join(this.uposDir, 'history', 'prompts.jsonl');

    try {
      const importedPrompts = await fs.readFile(promptsSrc, 'utf-8');

      await fs.mkdir(path.dirname(promptsDst), { recursive: true });

      if (merge) {
        // Append to existing prompts
        await fs.appendFile(promptsDst, importedPrompts);
        const count = importedPrompts.trim().split('\n').length;
        console.log(`  ✅ ${count} prompts appended`);
      } else {
        // Replace prompts
        await fs.writeFile(promptsDst, importedPrompts);
        const count = importedPrompts.trim().split('\n').length;
        console.log(`  ✅ ${count} prompts imported`);
      }
    } catch (error) {
      console.log('  ⚠️  No prompts.jsonl found in source');
    }
  }

  async importModes(source: string): Promise<void> {
    console.log('🎯 Importing mode configurations...');

    const modesSrc = path.join(source, 'modes.json');
    const modesDir = path.join(process.cwd(), 'packages', 'core', 'modes');

    try {
      const modes = JSON.parse(await fs.readFile(modesSrc, 'utf-8'));

      await fs.mkdir(modesDir, { recursive: true });

      for (const mode of modes) {
        const filename = `${mode.id || mode.name}.json`;
        await fs.writeFile(
          path.join(modesDir, filename),
          JSON.stringify(mode, null, 2)
        );
      }

      console.log(`  ✅ ${modes.length} modes imported`);
    } catch (error) {
      console.log('  ⚠️  No modes.json found in source');
    }
  }

  async importRules(source: string): Promise<void> {
    console.log('📋 Importing mode rules...');

    const rulesDir = path.join(source, 'rules');
    const rulesDst = path.join(process.cwd(), 'cursor', 'rules');

    try {
      const files = await fs.readdir(rulesDir);
      const mdcFiles = files.filter((f) => f.endsWith('.mdc'));

      await fs.mkdir(rulesDst, { recursive: true });

      for (const file of mdcFiles) {
        const content = await fs.readFile(path.join(rulesDir, file), 'utf-8');
        await fs.writeFile(path.join(rulesDst, file), content);
      }

      console.log(`  ✅ ${mdcFiles.length} rules imported`);
    } catch (error) {
      console.log('  ⚠️  No rules/ directory found in source');
    }
  }

  private async createBackup(): Promise<void> {
    console.log('💾 Creating backup...');

    const backupDir = path.join(
      this.uposDir,
      'backups',
      new Date().toISOString().split('T')[0]
    );

    await fs.mkdir(backupDir, { recursive: true });

    // Backup config
    try {
      const configSrc = path.join(this.uposDir, 'config', 'config.json');
      const configDst = path.join(backupDir, 'config.json');
      await fs.copyFile(configSrc, configDst);
    } catch {
      // No config to backup
    }

    // Backup analytics
    try {
      const analyticsSrc = path.join(this.uposDir, 'analytics', 'metrics.jsonl');
      const analyticsDst = path.join(backupDir, 'metrics.jsonl');
      await fs.copyFile(analyticsSrc, analyticsDst);
    } catch {
      // No analytics to backup
    }

    // Backup prompts
    try {
      const promptsSrc = path.join(this.uposDir, 'history', 'prompts.jsonl');
      const promptsDst = path.join(backupDir, 'prompts.jsonl');
      await fs.copyFile(promptsSrc, promptsDst);
    } catch {
      // No prompts to backup
    }

    console.log(`  ✅ Backup created`);
  }

  private deepMerge(target: any, source: any): any {
    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: npm run import:data <source> [options]

Options:
  --type <type>      Import only specific type (config, analytics, prompts, modes, rules)
  --merge            Merge with existing data instead of replacing
  --no-backup        Skip backup creation
  --help             Show this help message

Examples:
  npm run import:data ./export
  npm run import:data ./export -- --merge
  npm run import:data ./export -- --type config
  npm run import:data ./backup-2024-01-01 -- --no-backup
    `);
    process.exit(0);
  }

  const importer = new DataImporter();

  const options: ImportOptions = {
    source: args[0],
    types: ['config', 'analytics', 'prompts', 'modes', 'rules'],
    merge: args.includes('--merge'),
    backup: !args.includes('--no-backup'),
  };

  if (args.includes('--type')) {
    const typeIndex = args.indexOf('--type');
    options.types = [args[typeIndex + 1] as any];
  }

  await importer.importAll(options);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
}

export { DataImporter };
