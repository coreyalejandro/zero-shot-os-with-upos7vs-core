import { BaseService } from './base.js';
import { UserConfig } from '../config.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export interface ArtifactCheck {
  name: string;
  path: string;
  exists: boolean;
  lastModified?: string;
  sizeBytes?: number;
  schemaName?: string;
  schemaValid?: boolean;
  validationErrors?: string[];
}

export interface GovernanceStatus {
  compliant: boolean;
  artifacts: ArtifactCheck[];
  missingArtifacts: string[];
  lastCheck: string;
}

export class GovernanceService extends BaseService {
  private requiredArtifacts = [
    'HANDOFF.md',
    'openmemory.md',
    'USER_PROFILE.md',
    'ARCHITECTURE.mermaid'
  ];

  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();
  private schemasLoaded: boolean = false;
  private schemaMap: Record<string, string> = {
    'HANDOFF.md': 'handoff',
    'openmemory.md': 'openmemory',
    'USER_PROFILE.md': 'user-profile'
  };

  constructor(config: UserConfig) {
    super(
      {
        name: 'GovernanceService',
        version: '1.0.0',
        description: 'Governance artifact validation and API',
        dependencies: [],
        optional: false
      },
      config
    );

    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  async initialize(): Promise<void> {
    await this.loadSchemas();
    this.status.initialized = true;
    this.status.enabled = true;
  }

  async shutdown(): Promise<void> {
    this.status.initialized = false;
  }

  async healthCheck(): Promise<boolean> {
    return this.schemasLoaded && this.validators.size > 0;
  }

  protected shouldEnable(): boolean {
    return true; // Always enabled
  }

  private async loadSchemas(): Promise<void> {
    const schemaDir = path.join(process.cwd(), 'schemas', 'governance');

    const schemaFiles = [
      { name: 'handoff', file: 'handoff.schema.json' },
      { name: 'openmemory', file: 'openmemory.schema.json' },
      { name: 'user-profile', file: 'user-profile.schema.json' }
    ];

    for (const { name, file } of schemaFiles) {
      try {
        const schemaPath = path.join(schemaDir, file);
        const schemaContent = await fs.readFile(schemaPath, 'utf-8');
        const schema = JSON.parse(schemaContent);
        const validator = this.ajv.compile(schema);
        this.validators.set(name, validator);
      } catch (error) {
        console.error(`Failed to load schema ${file}:`, error);
      }
    }

    this.schemasLoaded = true;
  }

  async checkArtifacts(rootDir: string = process.cwd()): Promise<GovernanceStatus> {
    const artifacts: ArtifactCheck[] = [];
    const missing: string[] = [];
    let validationFailed = false;

    for (const artifact of this.requiredArtifacts) {
      const artifactPath = path.join(rootDir, artifact);
      try {
        const stats = await fs.stat(artifactPath);
        const artifactInfo: ArtifactCheck = {
          name: artifact,
          path: artifactPath,
          exists: true,
          lastModified: stats.mtime.toISOString(),
          sizeBytes: stats.size
        };

        const validation = await this.validateArtifactSchema(artifact, artifactPath);
        if (validation.validated) {
          artifactInfo.schemaName = validation.schemaName;
          artifactInfo.schemaValid = validation.valid;
          artifactInfo.validationErrors = validation.errors;
          if (!validation.valid) {
            validationFailed = true;
          }
        } else if (validation.errors.length > 0) {
          artifactInfo.validationErrors = validation.errors;
        }

        artifacts.push(artifactInfo);
      } catch {
        artifacts.push({
          name: artifact,
          path: artifactPath,
          exists: false
        });
        missing.push(artifact);
      }
    }

    return {
      compliant: missing.length === 0 && !validationFailed,
      artifacts,
      missingArtifacts: missing,
      lastCheck: new Date().toISOString()
    };
  }

  async validateHandoff(filePath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for required sections
      const requiredSections = ['## Current State', '## Next Steps', '## Blockers'];
      for (const section of requiredSections) {
        if (!content.includes(section)) {
          errors.push(`Missing section: ${section}`);
        }
      }

      // Check freshness (must be updated within last 7 days)
      const stats = await fs.stat(filePath);
      const daysSinceUpdate = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 7) {
        errors.push(`HANDOFF.md is stale (${Math.round(daysSinceUpdate)} days old, max 7)`);
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      return { valid: false, errors: [`Failed to read file: ${error}`] };
    }
  }

  /**
   * Validate data against a loaded JSON schema
   */
  validateAgainstSchema(schemaName: string, data: any): { valid: boolean; errors: string[] } {
    const validator = this.validators.get(schemaName);

    if (!validator) {
      return {
        valid: false,
        errors: [`Schema '${schemaName}' not found. Available: ${Array.from(this.validators.keys()).join(', ')}`]
      };
    }

    const valid = validator(data);

    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors = (validator.errors || []).map(err =>
      `${err.instancePath} ${err.message}`
    );

    return { valid: false, errors };
  }

  /**
   * Get list of loaded schema names
   */
  getLoadedSchemas(): string[] {
    return Array.from(this.validators.keys());
  }

  /**
   * Validate a governance artifact against a known schema (if available).
   * Attempts to parse the file as JSON or from a fenced ```json code block.
   * If parsing fails, validation is skipped but recorded in validationErrors.
   */
  private async validateArtifactSchema(
    artifactName: string,
    filePath: string
  ): Promise<{ validated: boolean; valid: boolean; errors: string[]; schemaName?: string }> {
    const schemaName = this.schemaMap[artifactName];
    if (!schemaName) {
      return { validated: false, valid: true, errors: [] };
    }

    const validator = this.validators.get(schemaName);
    if (!validator) {
      return {
        validated: false,
        valid: true,
        errors: [`Schema '${schemaName}' is not loaded`],
        schemaName
      };
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = this.parseJsonContent(content);
      if (!parsed) {
        return {
          validated: false,
          valid: true,
          errors: ['Schema validation skipped: no JSON content found in artifact'],
          schemaName
        };
      }

      const valid = validator(parsed);
      if (valid) {
        return { validated: true, valid: true, errors: [], schemaName };
      }

      const errors = (validator.errors || []).map(err => `${err.instancePath || '/'} ${err.message}`);
      return { validated: true, valid: false, errors, schemaName };
    } catch (error) {
      return {
        validated: true,
        valid: false,
        errors: [`Failed to validate artifact: ${error}`],
        schemaName
      };
    }
  }

  /**
   * Attempt to parse JSON from a file's content.
   * - First, try the whole file as JSON.
   * - If that fails, try to extract the first ```json fenced block.
   */
  private parseJsonContent(content: string): any | null {
    const trimmed = content.trim();
    const wholeFile = this.tryParseJson(trimmed);
    if (wholeFile) return wholeFile;

    const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i);
    if (fencedMatch && fencedMatch[1]) {
      return this.tryParseJson(fencedMatch[1]);
    }

    return null;
  }

  private tryParseJson(value: string): any | null {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}
