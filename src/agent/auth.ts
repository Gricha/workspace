import type { AgentConfig } from '../shared/types';
import { getTailscaleIdentity } from '../tailscale';

export interface AuthResult {
  ok: boolean;
  identity?: { type: 'token' | 'tailscale'; user?: string };
}

const PUBLIC_PATHS = ['/health'];

export function checkAuth(req: Request, config: AgentConfig): AuthResult {
  const url = new URL(req.url);

  if (PUBLIC_PATHS.includes(url.pathname)) {
    return { ok: true };
  }

  if (!config.auth?.token) {
    return { ok: true };
  }

  const tsIdentity = getTailscaleIdentity(req);
  if (tsIdentity) {
    return { ok: true, identity: { type: 'tailscale', user: tsIdentity.email } };
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token === config.auth.token) {
      return { ok: true, identity: { type: 'token' } };
    }
  }

  return { ok: false };
}

export function unauthorizedResponse(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Bearer',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
