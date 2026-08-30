import fs from 'fs';
import path from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from '../config/env.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import { errorHandler } from '../middleware/error-handler.js';
import { registerApiRoutes } from '../app/routes.js';

async function audit() {
  const runtimeOps = new Set<string>();

  const app = Fastify({ logger: false });
  app.addHook('onRoute', (routeOptions) => {
    // Fastify prefix is /api/v1
    const rawPath = routeOptions.url;
    // Normalize /api/v1/foo/:bar -> /foo/{bar}
    const cleanPath = rawPath
      .replace(/^\/api\/v1/, '')
      .replace(/:([a-zA-Z0-9_]+)/g, '{$1}');

    if (cleanPath === '' || cleanPath === '/*') return;

    const methods = Array.isArray(routeOptions.method)
      ? routeOptions.method
      : [routeOptions.method];

    for (const m of methods) {
      if (m === 'HEAD' || m === 'OPTIONS') continue;
      runtimeOps.add(`${m.toUpperCase()} ${cleanPath}`);
    }
  });

  await app.register(cors);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  app.addHook('onRequest', requestIdMiddleware);
  app.setErrorHandler(errorHandler);
  await app.register(registerApiRoutes, { prefix: '/api/v1' });
  await app.ready();

  // Read OpenAPI
  const openapiPath = path.resolve(process.cwd(), '../contracts/openapi/openapi.yaml');
  const openapiContent = fs.readFileSync(openapiPath, 'utf8');

  const openapiOps = new Set<string>();
  const lines = openapiContent.split('\n');
  let currentPath = '';
  const openapiPaths = new Set<string>();

  for (const line of lines) {
    const pathMatch = line.match(/^  (\/[a-zA-Z0-9_\-\/{}:]+):/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      openapiPaths.add(currentPath);
      continue;
    }
    const methodMatch = line.match(/^    (get|post|put|patch|delete):/i);
    if (methodMatch && currentPath) {
      const method = methodMatch[1].toUpperCase();
      openapiOps.add(`${method} ${currentPath}`);
    }
  }

  console.log(`\n--- CONTRACT AUDIT RESULTS ---`);
  console.log(`Runtime Operations: ${runtimeOps.size}`);
  console.log(`OpenAPI Operations: ${openapiOps.size}`);
  console.log(`OpenAPI Unique Paths: ${openapiPaths.size}`);

  const missingFromOpenApi = [...runtimeOps].filter(op => !openapiOps.has(op)).sort();
  const extraInOpenApi = [...openapiOps].filter(op => !runtimeOps.has(op)).sort();

  console.log(`\nRuntime operations MISSING from OpenAPI (${missingFromOpenApi.length}):`);
  missingFromOpenApi.forEach(op => console.log(`  + ${op}`));

  console.log(`\nOpenAPI operations NOT in Runtime (${extraInOpenApi.length}):`);
  extraInOpenApi.forEach(op => console.log(`  - ${op}`));

  await app.close();
}

audit().catch(console.error);
