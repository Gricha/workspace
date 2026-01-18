import { homedir } from 'os';
import { join } from 'path';

export function expandPath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return join(process.env.HOME || homedir(), filePath.slice(2));
  }
  return filePath;
}
