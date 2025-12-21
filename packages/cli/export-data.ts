#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

function stringify(rows: Array<Array<string | number>>): string {
  const escape = (value: string) => {
    // Basic CSV escaping: wrap in quotes when needed and escape quotes by doubling.
    if (value.includes('"')) value = value.replace(/"/g, '""');
    if (/[",\n\r]/.test(value)) return `"${value}"`;
    return value;
  };

  return (
    rows
      .map((row) =>
        row
          .map((cell) => escape(String(cell)))
          .join(',')
      )
      .join('\n') + '\n'
  );
}

interface ExportOptions {
  format?: 'json' | 'csv' | 'all';
  output?: string;
  types?: ('config' | 'analytics' | 'prompts' | 'modes' | 'rules')[];
  includeApiKeys?: boolean;
}

class DataExporter {
  private uposDir: string;
  private exportDir: string;

  constructor() {
    this.uposDir = path.join(os.homedir(), '.upos7vs');
    this.exportDir = path.join(process.cwd(), 'export');
  }

  async exportAll(options: ExportOptions = {}): Promise<void> {
    const {
      format = 'all',
      output = this.exportDir,
      types = ['config', 'analytics', 'prompts', 'modes', 'rules'],
      includeApiKeys = false,
    } = options;

    console.log('🚀 Starting data export...\n');

    // Create export directory
    await fs.mkdir(output, { recursive: true });

    const results: Record<string, boolean> = {};

    // Export each type
    for (const type of types) {
      try {
        switch (type) {
          case 'config':
            await this.exportConfig(output, format, includeApiKeys);
            results.config = true;
            break;
          case 'analytics':
            await this.exportAnalytics(output, format);
            results.analytics = true;
            break;
          case 'prompts':
            await this.exportPrompts(output, format);
            results.prompts = true;
            break;
          case 'modes':
            await this.exportModes(output, format);
            results.modes = true;
            break;
          case 'rules':
            await this.exportRules(output, format);
            results.rules = true;
            break;
        }
      } catch (error) {
        console.error(`❌ Failed to export ${type}:`, error);
        results[type] = false;
      }
    }

    // Create export manifest
    await this.createManifest(output, results);

    console.log('\n✅ Export complete!');
    console.log(`📁 Location: ${output}`);
    console.log('\nExported files:');
    Object.entries(results).forEach(([type, success]) => {
      console.log(`  ${success ? '✅' : '❌'} ${type}`);
    });
  }

  async exportConfig(
    output: string,
    format: string,
    includeApiKeys: boolean
  ): Promise<void> {
    console.log('📝 Exporting configuration...');

    const configPath = path.join(this.uposDir, 'config', 'config.json');

    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      let config = JSON.parse(configData);

      // Remove API keys unless explicitly requested
      if (!includeApiKeys && config.providers) {
        config = this.scrubApiKeys(config);
      }

      // Export as JSON
      if (format === 'json' || format === 'all') {
        await fs.writeFile(
          path.join(output, 'config.json'),
          JSON.stringify(config, null, 2)
        );
        console.log('  ✅ config.json');
      }

      // Export as CSV (flattened)
      if (format === 'csv' || format === 'all') {
        const flatConfig = this.flattenObject(config);
        const csv = stringify([
          ['Key', 'Value'],
          ...Object.entries(flatConfig),
        ]);
        await fs.writeFile(path.join(output, 'config.csv'), csv);
        console.log('  ✅ config.csv');
      }
    } catch (error) {
      console.log('  ⚠️  No configuration found (this is okay for new installations)');
    }
  }

  async exportAnalytics(output: string, format: string): Promise<void> {
    console.log('📊 Exporting analytics...');

    const analyticsPath = path.join(this.uposDir, 'analytics', 'metrics.jsonl');

    try {
      const data = await fs.readFile(analyticsPath, 'utf-8');
      const lines = data.trim().split('\n').filter(Boolean);
      const metrics = lines.map((line) => JSON.parse(line));

      // Export as JSON
      if (format === 'json' || format === 'all') {
        await fs.writeFile(
          path.join(output, 'analytics.json'),
          JSON.stringify(metrics, null, 2)
        );
        console.log(`  ✅ analytics.json (${metrics.length} records)`);
      }

      // Export as CSV
      if (format === 'csv' || format === 'all') {
        const csv = this.metricsToCSV(metrics);
        await fs.writeFile(path.join(output, 'analytics.csv'), csv);
        console.log(`  ✅ analytics.csv (${metrics.length} records)`);
      }
    } catch (error) {
      console.log('  ⚠️  No analytics data found');
    }
  }

  async exportPrompts(output: string, format: string): Promise<void> {
    console.log('💬 Exporting prompt history...');

    const promptsPath = path.join(this.uposDir, 'history', 'prompts.jsonl');

    try {
      const data = await fs.readFile(promptsPath, 'utf-8');
      const lines = data.trim().split('\n').filter(Boolean);
      const prompts = lines.map((line) => JSON.parse(line));

      // Export as JSONL (preserve format)
      if (format === 'json' || format === 'all') {
        await fs.writeFile(
          path.join(output, 'prompts.jsonl'),
          data
        );
        console.log(`  ✅ prompts.jsonl (${prompts.length} prompts)`);
      }

      // Export as CSV
      if (format === 'csv' || format === 'all') {
        const csv = this.promptsToCSV(prompts);
        await fs.writeFile(path.join(output, 'prompts.csv'), csv);
        console.log(`  ✅ prompts.csv (${prompts.length} prompts)`);
      }

      // Export as Markdown
      if (format === 'all') {
        const markdown = this.promptsToMarkdown(prompts);
        await fs.writeFile(path.join(output, 'prompts.md'), markdown);
        console.log(`  ✅ prompts.md (${prompts.length} prompts)`);
      }
    } catch (error) {
      console.log('  ⚠️  No prompt history found');
    }
  }

  async exportModes(output: string, format: string): Promise<void> {
    console.log('🎯 Exporting mode configurations...');

    const modesDir = path.join(process.cwd(), 'packages', 'core', 'modes');

    try {
      const files = await fs.readdir(modesDir);
      const modes: any[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(modesDir, file), 'utf-8');
          modes.push(JSON.parse(content));
        }
      }

      // Export as JSON
      if (format === 'json' || format === 'all') {
        await fs.writeFile(
          path.join(output, 'modes.json'),
          JSON.stringify(modes, null, 2)
        );
        console.log(`  ✅ modes.json (${modes.length} modes)`);
      }
    } catch (error) {
      console.log('  ⚠️  No mode configurations found');
    }
  }

  async exportRules(output: string, format: string): Promise<void> {
    console.log('📋 Exporting mode rules...');

    const rulesDir = path.join(process.cwd(), 'cursor', 'rules');

    try {
      const files = await fs.readdir(rulesDir);
      const rules: any[] = [];

      for (const file of files) {
        if (file.endsWith('.mdc')) {
          const content = await fs.readFile(path.join(rulesDir, file), 'utf-8');
          rules.push({
            filename: file,
            content: content,
          });
        }
      }

      // Export as JSON
      if (format === 'json' || format === 'all') {
        await fs.writeFile(
          path.join(output, 'rules.json'),
          JSON.stringify(rules, null, 2)
        );
        console.log(`  ✅ rules.json (${rules.length} rules)`);
      }

      // Export as directory structure
      const rulesExportDir = path.join(output, 'rules');
      await fs.mkdir(rulesExportDir, { recursive: true });
      for (const rule of rules) {
        await fs.writeFile(
          path.join(rulesExportDir, rule.filename),
          rule.content
        );
      }
      console.log(`  ✅ rules/ directory (${rules.length} files)`);
    } catch (error) {
      console.log('  ⚠️  No mode rules found');
    }
  }

  private async createManifest(
    output: string,
    results: Record<string, boolean>
  ): Promise<void> {
    const manifest = {
      exportDate: new Date().toISOString(),
      version: '2.0.0',
      exported: results,
      files: await this.listExportedFiles(output),
    };

    await fs.writeFile(
      path.join(output, 'MANIFEST.json'),
      JSON.stringify(manifest, null, 2)
    );
  }

  private async listExportedFiles(output: string): Promise<string[]> {
    try {
      const files = await fs.readdir(output, { recursive: true });
      return files.filter((f) => f !== 'MANIFEST.json');
    } catch {
      return [];
    }
  }

  private scrubApiKeys(config: any): any {
    const scrubbed = JSON.parse(JSON.stringify(config));

    if (scrubbed.providers) {
      Object.keys(scrubbed.providers).forEach((provider) => {
        if (scrubbed.providers[provider].apiKey) {
          scrubbed.providers[provider].apiKey = '[REDACTED]';
        }
      });
    }

    return scrubbed;
  }

  private flattenObject(obj: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    Object.keys(obj).forEach((key) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(flattened, this.flattenObject(obj[key], fullKey));
      } else {
        flattened[fullKey] = Array.isArray(obj[key])
          ? JSON.stringify(obj[key])
          : obj[key];
      }
    });

    return flattened;
  }

  private metricsToCSV(metrics: any[]): string {
    if (metrics.length === 0) return '';

    const headers = Object.keys(metrics[0]);
    const rows = metrics.map((m) => headers.map((h) => {
      const value = m[h];
      if (typeof value === 'object') return JSON.stringify(value);
      return value;
    }));

    return stringify([headers, ...rows]);
  }

  private promptsToCSV(prompts: any[]): string {
    if (prompts.length === 0) return '';

    const headers = ['timestamp', 'mode', 'provider', 'promptPreview', 'responsePreview'];
    const rows = prompts.map((p) => [
      p.timestamp || '',
      p.mode || '',
      p.provider || '',
      (p.prompt || '').substring(0, 100) + '...',
      (p.response || '').substring(0, 100) + '...',
    ]);

    return stringify([headers, ...rows]);
  }

  private promptsToMarkdown(prompts: any[]): string {
    let md = '# Prompt History\n\n';
    md += `Exported: ${new Date().toISOString()}\n`;
    md += `Total prompts: ${prompts.length}\n\n`;
    md += '---\n\n';

    prompts.forEach((p, i) => {
      md += `## Prompt ${i + 1}\n\n`;
      md += `- **Date:** ${p.timestamp || 'Unknown'}\n`;
      md += `- **Mode:** ${p.mode || 'Unknown'}\n`;
      md += `- **Provider:** ${p.provider || 'Unknown'}\n\n`;
      md += `### Prompt\n\n${p.prompt || 'No prompt recorded'}\n\n`;
      md += `### Response\n\n${p.response || 'No response recorded'}\n\n`;
      md += '---\n\n';
    });

    return md;
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const exporter = new DataExporter();

  const options: ExportOptions = {
    format: 'all',
    types: ['config', 'analytics', 'prompts', 'modes', 'rules'],
    includeApiKeys: args.includes('--include-api-keys'),
  };

  // Parse arguments
  if (args.includes('--format')) {
    const formatIndex = args.indexOf('--format');
    options.format = args[formatIndex + 1] as 'json' | 'csv' | 'all';
  }

  if (args.includes('--output')) {
    const outputIndex = args.indexOf('--output');
    options.output = args[outputIndex + 1];
  }

  if (args.includes('--type')) {
    const typeIndex = args.indexOf('--type');
    options.types = [args[typeIndex + 1] as any];
  }

  await exporter.exportAll(options);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Export failed:', error);
    process.exit(1);
  });
}

export { DataExporter };
