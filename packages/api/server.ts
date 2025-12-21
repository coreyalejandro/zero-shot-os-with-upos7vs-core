#!/usr/bin/env node
import Fastify from 'fastify';
import { GovernanceService } from '../core/services/governance.service.js';
import { ConfigManager } from '../core/config.js';
import { registerGovernanceRoutes } from './governance-routes.js';

/**
 * UPOS7VS Governance API Server
 *
 * Exposes governance endpoints for CI/CD integration
 */

async function startServer() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    }
  });

  try {
    // Load configuration
    const configManager = new ConfigManager();
    const config = await configManager.load();

    // Initialize governance service
    const governanceService = new GovernanceService(config);
    await governanceService.initialize();

    // Register routes
    await registerGovernanceRoutes(fastify, governanceService);

    // Health check endpoint
    fastify.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Root endpoint
    fastify.get('/', async () => {
      return {
        name: 'UPOS7VS Governance API',
        version: '1.0.0',
        endpoints: [
          'GET /health',
          'GET /api/governance/status',
          'POST /api/governance/validate/handoff',
          'GET /api/governance/health',
          'GET /api/governance/artifacts/:name',
          'POST /api/governance/validate/schema'
        ]
      };
    });

    // Start server
    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });

    console.log(`\n✅ UPOS7VS Governance API started`);
    console.log(`🌐 Server: http://localhost:${port}`);
    console.log(`📋 Status: http://localhost:${port}/api/governance/status`);
    console.log(`💚 Health: http://localhost:${port}/health\n`);

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
