/**
 * Base Service Interface
 *
 * Provides dependency injection and modular service architecture
 * All services extend BaseService and can be toggled on/off via config
 */

import { UserConfig } from '../config.js';

export interface ServiceMetadata {
  name: string;
  version: string;
  description: string;
  dependencies: string[];
  optional: boolean;
}

export interface ServiceStatus {
  enabled: boolean;
  initialized: boolean;
  healthy: boolean;
  lastError?: string;
}

/**
 * Base Service class
 * All services should extend this
 */
export abstract class BaseService {
  protected config: UserConfig;
  protected status: ServiceStatus;
  public readonly metadata: ServiceMetadata;

  constructor(metadata: ServiceMetadata, config: UserConfig) {
    this.metadata = metadata;
    this.config = config;
    this.status = {
      enabled: false,
      initialized: false,
      healthy: false,
    };
  }

  /**
   * Initialize the service
   */
  abstract initialize(): Promise<void>;

  /**
   * Shutdown the service
   */
  abstract shutdown(): Promise<void>;

  /**
   * Health check
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get service status
   */
  getStatus(): ServiceStatus {
    return { ...this.status };
  }

  /**
   * Update configuration
   */
  async updateConfig(config: UserConfig): Promise<void> {
    this.config = config;
  }

  /**
   * Check if service should be enabled based on config
   */
  protected abstract shouldEnable(): boolean;
}
