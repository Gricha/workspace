#!/usr/bin/env bun
/**
 * Generates OpenAPI specification from the Perry API router.
 * Output is written to docs/static/openapi.json
 */

import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { createRouter, type RouterContext } from '../src/agent/router';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

// Create a mock context - handlers won't be called during spec generation
const mockContext: RouterContext = {
  workspaces: {} as RouterContext['workspaces'],
  config: { get: () => ({} as any), set: () => {} },
  configDir: '',
  stateDir: '',
  startTime: Date.now(),
  terminalServer: { closeConnectionsForWorkspace: () => {}, getConnectionCount: () => 0 },
  sessionsCache: {} as RouterContext['sessionsCache'],
  modelCache: {} as RouterContext['modelCache'],
  triggerAutoSync: () => {},
};

const router = createRouter(mockContext);

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

function addTagsToSpec(spec: any): any {
  const tagMapping: Record<string, string> = {
    '/workspaces': 'Workspaces',
    '/sessions': 'Sessions',
    '/models': 'Models',
    '/github': 'GitHub',
    '/host': 'Host',
    '/info': 'Info',
    '/config/credentials': 'Configuration',
    '/config/scripts': 'Configuration',
    '/config/agents': 'Configuration',
    '/config/skills': 'Configuration',
    '/config/mcp': 'Configuration',
    '/config/ssh': 'Configuration',
    '/config/terminal': 'Configuration',
    '/config/tailscale': 'Configuration',
  };

  const usedTags = new Set<string>();

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    const tag = Object.entries(tagMapping).find(([prefix]) => path.startsWith(prefix))?.[1];
    if (tag) {
      usedTags.add(tag);
      for (const method of Object.values(methods as Record<string, any>)) {
        if (typeof method === 'object' && method !== null) {
          method.tags = [tag];
        }
      }
    }
  }

  spec.tags = Array.from(usedTags)
    .sort()
    .map((name) => ({ name }));

  return spec;
}

async function main() {
  let spec = await generator.generate(router, {
    info: {
      title: 'Perry API',
      version: '1.0.0',
      description:
        'API for managing Perry workspaces, AI agent sessions, and configuration. Perry provides isolated, self-hosted development environments accessible over SSH and Tailscale.',
    },
    servers: [
      {
        url: 'http://localhost:7391',
        description: 'Local Perry agent',
      },
    ],
  });

  spec = addTagsToSpec(spec);

  const outputPath = join(import.meta.dirname, '..', 'docs', 'static', 'openapi.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(spec, null, 2));

  console.log(`OpenAPI spec written to ${outputPath}`);
  console.log(`Generated ${Object.keys(spec.paths || {}).length} paths`);
}

main().catch((err) => {
  console.error('Failed to generate OpenAPI spec:', err);
  process.exit(1);
});
