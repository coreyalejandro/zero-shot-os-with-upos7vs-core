import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GovernanceService } from '../core/services/governance.service.js';

export async function registerGovernanceRoutes(
  fastify: FastifyInstance,
  governanceService: GovernanceService
) {
  // GET /api/governance/status
  // Returns status of all required governance artifacts
  fastify.get('/api/governance/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const status = await governanceService.checkArtifacts();
    return status;
  });

  // POST /api/governance/validate/handoff
  // Validates HANDOFF.md structure and freshness
  fastify.post<{ Body: { path: string } }>(
    '/api/governance/validate/handoff',
    {
      schema: {
        body: {
          type: 'object',
          required: ['path'],
          properties: {
            path: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const { path } = request.body;
      const result = await governanceService.validateHandoff(path);

      if (!result.valid) {
        return reply.code(400).send(result);
      }

      return result;
    }
  );

  // GET /api/governance/health
  // Health check endpoint for governance service
  fastify.get('/api/governance/health', async (request: FastifyRequest, reply: FastifyReply) => {
    const healthy = await governanceService.healthCheck();
    return {
      status: healthy ? 'healthy' : 'unhealthy',
      service: 'GovernanceService',
      timestamp: new Date().toISOString()
    };
  });

  // GET /api/governance/artifacts/:name
  // Get details about a specific artifact
  fastify.get<{ Params: { name: string } }>(
    '/api/governance/artifacts/:name',
    async (request, reply) => {
      const status = await governanceService.checkArtifacts();
      const artifact = status.artifacts.find(a => a.name === request.params.name);

      if (!artifact) {
        return reply.code(404).send({
          error: 'Artifact not found',
          name: request.params.name
        });
      }

      return artifact;
    }
  );

  // POST /api/governance/validate/schema
  // Validate arbitrary data against a loaded schema
  fastify.post<{ Body: { schemaName: string; data: any } }>(
    '/api/governance/validate/schema',
    {
      schema: {
        body: {
          type: 'object',
          required: ['schemaName', 'data'],
          properties: {
            schemaName: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    },
    async (request, reply) => {
      const { schemaName, data } = request.body;
      const result = governanceService.validateAgainstSchema(schemaName, data);

      if (!result.valid) {
        return reply.code(400).send(result);
      }

      return result;
    }
  );

  // GET /api/governance/schemas
  // List all loaded schemas
  fastify.get('/api/governance/schemas', async () => {
    const schemas = governanceService.getLoadedSchemas();
    return { schemas, count: schemas.length };
  });
}
