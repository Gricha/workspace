import type { IncomingMessage } from 'http';

export interface TailscaleStatus {
  running: boolean;
  dnsName?: string;
  tailnetName?: string;
  ipv4?: string;
  httpsEnabled: boolean;
}

export interface TailscaleIdentity {
  email: string;
  name?: string;
  profilePic?: string;
}

interface TailscaleStatusJson {
  BackendState: string;
  Self?: {
    DNSName?: string;
    TailscaleIPs?: string[];
  };
  CertDomains?: string[];
}

export async function getTailscaleStatus(): Promise<TailscaleStatus> {
  try {
    const proc = Bun.spawn(['tailscale', 'status', '--json'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      return { running: false, httpsEnabled: false };
    }

    const status: TailscaleStatusJson = JSON.parse(output);

    if (status.BackendState !== 'Running') {
      return { running: false, httpsEnabled: false };
    }

    const dnsName = status.Self?.DNSName?.replace(/\.$/, '');
    const tailnetName = dnsName?.split('.').slice(1).join('.');
    const ipv4 = status.Self?.TailscaleIPs?.find((ip) => !ip.includes(':'));
    const httpsEnabled = (status.CertDomains?.length ?? 0) > 0;

    return {
      running: true,
      dnsName,
      tailnetName,
      ipv4,
      httpsEnabled,
    };
  } catch {
    return { running: false, httpsEnabled: false };
  }
}

export interface TailscaleServeResult {
  success: boolean;
  error?: 'permission_denied' | 'unknown';
  message?: string;
}

export async function startTailscaleServe(port: number): Promise<TailscaleServeResult> {
  try {
    const proc = Bun.spawn(['tailscale', 'serve', '--bg', String(port)], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode === 0) {
      return { success: true };
    }

    if (stderr.includes('Access denied') || stderr.includes('serve config denied')) {
      return {
        success: false,
        error: 'permission_denied',
        message: 'Run: sudo tailscale set --operator=$USER',
      };
    }

    return { success: false, error: 'unknown', message: stderr.trim() };
  } catch (err) {
    return { success: false, error: 'unknown', message: String(err) };
  }
}

export async function stopTailscaleServe(): Promise<boolean> {
  try {
    const proc = Bun.spawn(['tailscale', 'serve', 'off'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

export function getTailscaleIdentity(req: IncomingMessage): TailscaleIdentity | null {
  const login = req.headers['tailscale-user-login'];
  const name = req.headers['tailscale-user-name'];
  const pic = req.headers['tailscale-user-profile-pic'];

  if (!login) return null;

  return {
    email: Array.isArray(login) ? login[0] : login,
    name: Array.isArray(name) ? name[0] : name,
    profilePic: Array.isArray(pic) ? pic[0] : pic,
  };
}
