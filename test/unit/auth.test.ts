import { describe, it, expect } from 'vitest';
import { checkAuth, unauthorizedResponse } from '../../src/agent/auth';
import type { AgentConfig } from '../../src/shared/types';

function createRequest(
  url: string,
  headers: Record<string, string> = {}
): Request {
  return new Request(url, { headers });
}

function createConfig(token?: string): AgentConfig {
  return {
    port: 7391,
    credentials: { env: {}, files: {} },
    scripts: {},
    ...(token ? { auth: { token } } : {}),
  };
}

describe('checkAuth', () => {
  describe('no token configured', () => {
    it('should pass when no token is configured', () => {
      const req = createRequest('http://localhost:7391/rpc/workspaces');
      const config = createConfig();

      const result = checkAuth(req, config);

      expect(result.ok).toBe(true);
      expect(result.identity).toBeUndefined();
    });

    it('should pass without auth header when no token configured', () => {
      const req = createRequest('http://localhost:7391/rpc/workspaces');
      const config = createConfig();

      const result = checkAuth(req, config);

      expect(result.ok).toBe(true);
    });
  });

  describe('token configured, no header', () => {
    it('should fail when token is configured but no auth header', () => {
      const req = createRequest('http://localhost:7391/rpc/workspaces');
      const config = createConfig('secret-token');

      const result = checkAuth(req, config);

      expect(result.ok).toBe(false);
      expect(result.identity).toBeUndefined();
    });
  });

  describe('token configured, wrong token', () => {
    it('should fail when token is wrong', () => {
      const req = createRequest('http://localhost:7391/rpc/workspaces', {
        Authorization: 'Bearer wrong-token',
      });
      const config = createConfig('secret-token');

      const result = checkAuth(req, config);

      expect(result.ok).toBe(false);
    });

    it('should fail with malformed Authorization header', () => {
      const req = createRequest('http://localhost:7391/rpc/workspaces', {
        Authorization: 'secret-token',
      });
      const config = createConfig('secret-token');

      const result = checkAuth(req, config);

      expect(result.ok).toBe(false);
    });

    it('should fail with Basic auth instead of Bearer', () => {
      const req = createRequest('http://localhost:7391/rpc/workspaces', {
        Authorization: 'Basic secret-token',
      });
      const config = createConfig('secret-token');

      const result = checkAuth(req, config);

      expect(result.ok).toBe(false);
    });
  });

  describe('token configured, correct token', () => {
    it('should pass when token matches', () => {
      const req = createRequest('http://localhost:7391/rpc/workspaces', {
        Authorization: 'Bearer secret-token',
      });
      const config = createConfig('secret-token');

      const result = checkAuth(req, config);

      expect(result.ok).toBe(true);
      expect(result.identity).toEqual({ type: 'token' });
    });

    it('should handle long tokens', () => {
      const longToken = 'perry-' + 'a'.repeat(100);
      const req = createRequest('http://localhost:7391/rpc/workspaces', {
        Authorization: `Bearer ${longToken}`,
      });
      const config = createConfig(longToken);

      const result = checkAuth(req, config);

      expect(result.ok).toBe(true);
      expect(result.identity).toEqual({ type: 'token' });
    });
  });

  describe('Tailscale headers', () => {
    it('should pass with Tailscale user login header', () => {
      const req = createRequest('http://localhost:7391/rpc/workspaces', {
        'Tailscale-User-Login': 'user@example.com',
      });
      const config = createConfig('secret-token');

      const result = checkAuth(req, config);

      expect(result.ok).toBe(true);
      expect(result.identity).toEqual({
        type: 'tailscale',
        user: 'user@example.com',
      });
    });

    it('should pass with Tailscale headers and include user info', () => {
      const req = createRequest('http://localhost:7391/rpc/workspaces', {
        'Tailscale-User-Login': 'user@example.com',
        'Tailscale-User-Name': 'Test User',
      });
      const config = createConfig('secret-token');

      const result = checkAuth(req, config);

      expect(result.ok).toBe(true);
      expect(result.identity?.type).toBe('tailscale');
      expect(result.identity?.user).toBe('user@example.com');
    });

    it('should prefer Tailscale identity over Bearer token', () => {
      const req = createRequest('http://localhost:7391/rpc/workspaces', {
        'Tailscale-User-Login': 'user@example.com',
        Authorization: 'Bearer secret-token',
      });
      const config = createConfig('secret-token');

      const result = checkAuth(req, config);

      expect(result.ok).toBe(true);
      expect(result.identity?.type).toBe('tailscale');
    });
  });

  describe('public paths', () => {
    it('should pass for /health without any auth', () => {
      const req = createRequest('http://localhost:7391/health');
      const config = createConfig('secret-token');

      const result = checkAuth(req, config);

      expect(result.ok).toBe(true);
    });

    it('should pass for /health even with token configured', () => {
      const req = createRequest('http://localhost:7391/health');
      const config = createConfig('super-secret-token');

      const result = checkAuth(req, config);

      expect(result.ok).toBe(true);
    });

    it('should not pass for other paths without auth', () => {
      const req = createRequest('http://localhost:7391/rpc/info');
      const config = createConfig('secret-token');

      const result = checkAuth(req, config);

      expect(result.ok).toBe(false);
    });
  });
});

describe('unauthorizedResponse', () => {
  it('should return 401 status', () => {
    const response = unauthorizedResponse();

    expect(response.status).toBe(401);
  });

  it('should include WWW-Authenticate header', () => {
    const response = unauthorizedResponse();

    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
  });

  it('should include CORS header', () => {
    const response = unauthorizedResponse();

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should have Unauthorized body', async () => {
    const response = unauthorizedResponse();
    const body = await response.text();

    expect(body).toBe('Unauthorized');
  });
});
