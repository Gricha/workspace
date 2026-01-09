export interface PortForward {
  localPort: number;
  remotePort: number;
}

export function parsePortForward(spec: string): PortForward {
  if (spec.includes(':')) {
    const [local, remote] = spec.split(':');
    return {
      localPort: parseInt(local, 10),
      remotePort: parseInt(remote, 10),
    };
  }
  const port = parseInt(spec, 10);
  return { localPort: port, remotePort: port };
}

export function formatPortForwards(forwards: PortForward[]): string {
  return forwards
    .map((f) =>
      f.localPort === f.remotePort ? String(f.localPort) : `${f.localPort}:${f.remotePort}`
    )
    .join(', ');
}
