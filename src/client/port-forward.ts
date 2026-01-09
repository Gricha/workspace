export interface PortForward {
  localPort: number;
  remotePort: number;
}

function validatePort(port: number, label: string): void {
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${label}: must be a number between 1 and 65535`);
  }
}

export function parsePortForward(spec: string): PortForward {
  if (spec.includes(':')) {
    const [local, remote] = spec.split(':');
    const localPort = parseInt(local, 10);
    const remotePort = parseInt(remote, 10);
    validatePort(localPort, 'local port');
    validatePort(remotePort, 'remote port');
    return { localPort, remotePort };
  }
  const port = parseInt(spec, 10);
  validatePort(port, 'port');
  return { localPort: port, remotePort: port };
}

export function formatPortForwards(forwards: PortForward[]): string {
  return forwards
    .map((f) =>
      f.localPort === f.remotePort ? String(f.localPort) : `${f.localPort}:${f.remotePort}`
    )
    .join(', ');
}
