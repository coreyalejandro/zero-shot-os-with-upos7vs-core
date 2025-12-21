import Fastify from 'fastify';
import { registerGovernanceRoutes } from '../governance-routes.js';
import { GovernanceService } from '../../core/services/governance.service.js';
import { ConfigManager } from '../../core/config.js';

async function buildServer() {
  const fastify = Fastify({ logger: false });
  const configManager = new ConfigManager(process.cwd());
  const config = await configManager.load();

  const governanceService = new GovernanceService(config);
  await governanceService.initialize();

  await registerGovernanceRoutes(fastify, governanceService);

  return fastify;
}

describe('Governance API', () => {
  let fastify;

  beforeAll(async () => {
    fastify = await buildServer();
  });

  afterAll(async () => {
    if (fastify) {
      await fastify.close();
    }
  });

  test('returns artifact status with schema validation', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/governance/status'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.compliant).toBe(true);

    const handoff = body.artifacts.find((a: any) => a.name === 'HANDOFF.md');
    expect(handoff).toBeDefined();
    expect(handoff.schemaName).toBe('handoff');
    expect(handoff.schemaValid).toBe(true);
    expect(handoff.validationErrors).toEqual([]);
  });

  test('rejects invalid payload against handoff schema', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/governance/validate/schema',
      payload: { schemaName: 'handoff', data: {} }
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.valid).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  test('accepts valid payload against handoff schema', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/governance/validate/schema',
      payload: {
        schemaName: 'handoff',
        data: {
          currentState:
            'This current state string is deliberately long to exceed fifty characters for validation.',
          nextSteps: ['Review architecture'],
          blockers: [],
          lastUpdated: '2025-01-01T00:00:00Z'
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
  });
});
